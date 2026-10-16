import { PASSWORD, isWorkersRuntime } from "@neo-id/shared";
import bcryptjs from "bcryptjs";

const PBKDF2_PREFIX = "$pbkdf2$";
const PBKDF2_ITERATIONS = 100_000;
const SALT_LEN = 16;
const KEY_LEN = 32;

interface BcryptLike {
  hash(data: string, saltOrRounds: number): Promise<string>;
  compare(data: string, hash: string): Promise<boolean>;
}

async function loadBcrypt(): Promise<BcryptLike | null> {
  if (!isWorkersRuntime()) {
    try {
      const mod = await import("bcrypt");
      return (mod.default ?? mod) as BcryptLike;
    } catch {
      // fall through to pure-JS implementation
    }
  }
  return bcryptjs as BcryptLike;
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    KEY_LEN * 8,
  );
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bytesToB64url(salt)}$${bytesToB64url(new Uint8Array(bits))}`;
}

async function pbkdf2Verify(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  const iterations = parseInt(parts[2] ?? "", 10);
  const salt = parts[3];
  const expected = parts[4];
  if (!iterations || !salt || !expected) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: b64urlToBytes(salt), iterations },
    key,
    KEY_LEN * 8,
  );
  const actual = b64urlToBytes(expected);
  const computed = new Uint8Array(bits);
  if (actual.length !== computed.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ computed[i]!;
  return diff === 0;
}

export async function hash(password: string): Promise<string> {
  const bcrypt = await loadBcrypt();
  if (bcrypt) return bcrypt.hash(password, PASSWORD.SALT_ROUNDS);
  return pbkdf2Hash(password);
}

export async function verify(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith(PBKDF2_PREFIX)) return pbkdf2Verify(password, hash);
  const bcrypt = await loadBcrypt();
  if (!bcrypt) throw new Error("password verification unavailable in this runtime");
  return bcrypt.compare(password, hash);
}
