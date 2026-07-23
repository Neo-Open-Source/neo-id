import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWK, type CryptoKey } from "jose";
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

let keyCache: { privateKey: CryptoKey; publicKey: CryptoKey } | null = null;

async function getKeys() {
  if (keyCache) return keyCache;

  const privPem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const pubPem = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");

  if (!privPem || !pubPem) {
    throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set");
  }

  keyCache = {
    privateKey: await importPKCS8(privPem, "RS256"),
    publicKey: await importSPKI(pubPem, "RS256"),
  };

  return keyCache;
}

export function clearKeyCache() {
  keyCache = null;
}

const ISSUER = () => process.env.JWT_ISSUER || "https://id.neome.uk";

export async function signAccessToken(
  payload: JwtPayload,
  sessionId?: string
): Promise<string> {
  const { privateKey } = await getKeys();

  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    ...(sessionId && { session_id: sessionId }),
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(ISSUER())
    .setExpirationTime(`${TOKEN.ACCESS_TOKEN_EXPIRY}s`)
    .setJti(randomUUID())
    .sign(privateKey);
}

export async function signIdToken(payload: JwtPayload): Promise<string> {
  const { privateKey } = await getKeys();

  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    name: payload.email,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(ISSUER())
    .setExpirationTime(`${TOKEN.ID_TOKEN_EXPIRY}s`)
    .setJti(randomUUID())
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { publicKey } = await getKeys();

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: ISSUER(),
  });

  return {
    sub: payload.sub!,
    email: payload.email as string,
    role: payload.role as string,
    session_id: payload.session_id as string | undefined,
  };
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  const { publicKey } = await getKeys();
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return { keys: [jwk] };
}
