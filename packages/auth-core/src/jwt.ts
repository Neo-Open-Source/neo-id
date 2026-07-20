import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWK } from "jose";
import { TOKEN } from "@neo-id/shared";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  session_id?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;

async function getKeys() {
  if (privateKey && publicKey) return { privateKey, publicKey };

  const privPem = process.env.JWT_PRIVATE_KEY;
  const pubPem = process.env.JWT_PUBLIC_KEY;

  if (!privPem || !pubPem) {
    throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set");
  }

  privateKey = await importPKCS8(privPem, "RS256");
  publicKey = await importSPKI(pubPem, "RS256");

  return { privateKey, publicKey };
}

export async function signAccessToken(
  payload: JwtPayload,
  sessionId?: string
): Promise<string> {
  const { privateKey: key } = await getKeys();

  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    ...(sessionId && { session_id: sessionId }),
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER || "https://id.neome.uk")
    .setExpirationTime(`${TOKEN.ACCESS_TOKEN_EXPIRY}s`)
    .setJti(crypto.randomUUID())
    .sign(key);
}

export async function signIdToken(payload: JwtPayload): Promise<string> {
  const { privateKey: key } = await getKeys();

  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    name: payload.email,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER || "https://id.neome.uk")
    .setExpirationTime(`${TOKEN.ID_TOKEN_EXPIRY}s`)
    .setJti(crypto.randomUUID())
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { publicKey: key } = await getKeys();

  const { payload } = await jwtVerify(token, key, {
    issuer: process.env.JWT_ISSUER || "https://id.neome.uk",
  });

  return {
    sub: payload.sub!,
    email: payload.email as string,
    role: payload.role as string,
    session_id: payload.session_id as string | undefined,
  };
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  const { publicKey: key } = await getKeys();
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return { keys: [jwk] };
}
