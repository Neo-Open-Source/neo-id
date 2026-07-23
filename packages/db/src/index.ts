import { PrismaClient } from "./__generated__/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export { PrismaClient, PrismaPg };
export type * from "./__generated__/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error("[db] pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// ─── User Helpers ────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}

export async function findUserByUsername(username: string) {
  return db.user.findFirst({ where: { username } });
}

export async function createUser(data: {
  email: string;
  username?: string;
  passwordHash: string;
  displayName?: string;
}) {
  return db.user.create({ data });
}

export async function updateUser(
  id: string,
  data: Partial<{
    displayName: string;
    firstName: string;
    lastName: string;
    avatar: string;
    passwordHash: string;
    totpSecret: string;
    totpEnabled: boolean;
    emailMfaEnabled: boolean;
    emailVerified: boolean;
    role: string;
    status: string;
    lastLoginAt: Date;
    lastLoginIp: string;
  }>
) {
  return db.user.update({ where: { id }, data });
}

// ─── Session Helpers ─────────────────────────────────────────────────────────

export async function createSession(data: {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
}) {
  return db.session.create({ data });
}

export async function findActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, isActive: true },
    orderBy: { lastActiveAt: "desc" },
  });
}

export async function deactivateSession(id: string) {
  return db.session.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deactivateAllSessions(userId: string) {
  return db.session.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
}

// ─── Refresh Token Helpers ───────────────────────────────────────────────────

export async function createRefreshToken(data: {
  userId: string;
  sessionId?: string;
  tokenHash: string;
  parentId?: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
}) {
  return db.refreshToken.create({ data });
}

export async function findRefreshToken(tokenHash: string) {
  return db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export async function revokeRefreshToken(
  id: string,
  reason: string
) {
  return db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

export async function revokeAllRefreshTokens(
  userId: string,
  reason: string
) {
  return db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

// ─── Passkey Helpers ─────────────────────────────────────────────────────────

export async function findPasskeys(userId: string) {
  return db.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findPasskeyByCredentialId(credentialId: string) {
  return db.passkey.findUnique({ where: { credentialId } });
}

export async function createPasskey(data: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter?: number;
  transports?: string;
  deviceName?: string;
}) {
  return db.passkey.create({ data });
}

export async function updatePasskeyCounter(
  id: string,
  counter: number
) {
  return db.passkey.update({
    where: { id },
    data: { counter, lastUsedAt: new Date() },
  });
}

export async function deletePasskey(id: string) {
  return db.passkey.delete({ where: { id } });
}

// ─── MFA Code Helpers ────────────────────────────────────────────────────────

export async function createMfaCode(data: {
  userId: string;
  code: string;
  purpose: string;
  expiresAt: Date;
}) {
  return db.mfaCode.create({ data });
}

export async function findValidMfaCode(
  userId: string,
  purpose: string
) {
  return db.mfaCode.findFirst({
    where: {
      userId,
      purpose,
      expiresAt: { gte: new Date() },
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function useMfaCode(id: string) {
  return db.mfaCode.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

// ─── Service App Helpers ─────────────────────────────────────────────────────

export async function findServiceByClientId(clientId: string) {
  return db.serviceApp.findUnique({ where: { clientId } });
}

export async function findUserServices(ownerId: string) {
  return db.serviceApp.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createServiceApp(data: {
  ownerId: string;
  clientId: string;
  clientSecretHash: string;
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  redirectUris: string[];
}) {
  return db.serviceApp.create({ data });
}

// ─── Identity Helpers ────────────────────────────────────────────────────────

export async function findIdentity(
  provider: string,
  providerUserId: string
) {
  return db.identity.findUnique({
    where: {
      provider_providerUserId: { provider, providerUserId },
    },
  });
}

export async function findUserIdentities(userId: string) {
  return db.identity.findMany({
    where: { userId },
    select: { provider: true, createdAt: true },
  });
}

export async function createIdentity(data: {
  userId: string;
  provider: string;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  return db.identity.create({ data });
}

// ─── OAuth State Helpers ─────────────────────────────────────────────────────

export async function createOAuthState(data: {
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
  redirectUri?: string;
  serviceAppId?: string;
  userId?: string;
  expiresAt: Date;
}) {
  return db.oAuthState.create({ data });
}

export async function findOAuthState(state: string) {
  return db.oAuthState.findUnique({ where: { state } });
}

export async function deleteOAuthState(id: string) {
  return db.oAuthState.delete({ where: { id } });
}

export async function cleanupExpiredOAuthStates() {
  return db.oAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

// ─── Audit Log Helpers ───────────────────────────────────────────────────────

export async function createAuditLog(data: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetId?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  return db.auditLog.create({
    data: {
      ...data,
      details: data.details ? JSON.parse(JSON.stringify(data.details)) : undefined,
    },
  });
}

export async function findAuditLogs(params: {
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count(),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
