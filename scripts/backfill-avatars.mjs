import pg from "pg";
import { createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DRY = process.argv.includes("--dry-run");
const VIA_WRANGLER = process.argv.includes("--wrangler");
const BATCH = 500;
const MAX_SIZE = 5 * 1024 * 1024;

const {
  DATABASE_URL,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  CDN_BASE,
} = process.env;

const missing = ["DATABASE_URL", "CDN_BASE"]
  .concat(VIA_WRANGLER ? [] : ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"])
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`missing env: ${missing.join(", ")}`);
  process.exit(1);
}
if (DRY) console.log("dry-run: no writes");

function sniffExt(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ["png", "image/png"];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ["jpg", "image/jpeg"];
  if (
    buf.length > 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return ["webp", "image/webp"];
  if (
    buf.length > 6 &&
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return ["gif", "image/gif"];
  return null;
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function r2Put(key, body, contentType) {
  const url = new URL(`${R2_ENDPOINT.replace(/\/$/, "")}/${R2_BUCKET}/${key}`);
  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const stamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "content-type": contentType,
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    "PUT",
    url.pathname,
    "",
    names.map((k) => `${k}:${String(headers[k]).trim()}\n`).join(""),
    names.join(";"),
    payloadHash,
  ].join("\n");
  const scope = `${stamp}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(Buffer.from(canonical, "utf8"))].join("\n");
  const h = (k, d) => createHmac("sha256", k).update(d).digest();
  const sk = h(h(h(h(`AWS4${R2_SECRET_ACCESS_KEY}`, stamp), "auto"), "s3"), "aws4_request");
  const sig = createHmac("sha256", sk).update(toSign).digest("hex");
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sig}` },
    body,
  });
  if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`);
}

function r2PutWrangler(key, body, contentType) {
  const bucket = process.env.R2_BUCKET || "neome-storage";
  const tmp = join(tmpdir(), `avatar-${sha256Hex(body).slice(0, 16)}`);
  writeFileSync(tmp, body);
  execFileSync("wrangler", ["r2", "object", "put", "--remote", `${bucket}/${key}`, "--file", tmp, "--content-type", contentType], { stdio: "pipe" });
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
let cursor = null;
let scanned = 0;
let migrated = 0;
let skipped = 0;

for (;;) {
  const { rows } = await pool.query(
    `SELECT id, avatar, "avatarKey" FROM users WHERE avatar LIKE 'data:%' AND ($1::text IS NULL OR id > $1) ORDER BY id LIMIT ${BATCH}`,
    [cursor],
  );
  if (!rows.length) break;
  for (const row of rows) {
    cursor = row.id;
    scanned++;
    const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(row.avatar).trim());
    if (!m) { skipped++; continue; }
    let buf;
    try {
      buf = Buffer.from(m[2], "base64");
    } catch {
      skipped++;
      continue;
    }
    if (!buf.length || buf.length > MAX_SIZE) { skipped++; continue; }
    const sniffed = sniffExt(buf);
    if (!sniffed) { skipped++; continue; }
    const key = `avatars/${sha256Hex(buf)}.${sniffed[0]}`;
    const url = `${CDN_BASE.replace(/\/$/, "")}/${key}`;
    if (row.avatarKey === key && row.avatar === url) { skipped++; continue; }
    if (!DRY) {
      if (VIA_WRANGLER) r2PutWrangler(key, buf, sniffed[1]);
      else await r2Put(key, buf, sniffed[1]);
      await pool.query(`UPDATE users SET "avatarKey" = $1, avatar = $2 WHERE id = $3`, [key, url, row.id]);
    }
    migrated++;
  }
}

console.log(JSON.stringify({ scanned, migrated, skipped, dryRun: DRY }));
await pool.end();
