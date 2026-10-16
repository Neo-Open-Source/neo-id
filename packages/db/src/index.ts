import { PrismaClient } from "./__generated__/prisma/client";
import { createRequire } from "node:module";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { isWorkersRuntime } from "@neo-id/shared";

export type * from "./__generated__/prisma/client";
export { createNeonClient, neonHttpEndpoint } from "./neon-http";
export type { NeonHttpClient, SqlRow, SqlValue } from "./neon-http";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nodeEnv(name: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) return process.env[name];
  } catch {
    return undefined;
  }
  return undefined;
}

export function getDatabaseUrl(explicit?: string): string {
  const url = explicit ?? nodeEnv("DATABASE_URL");
  if (!url) throw new Error("[db] DATABASE_URL is not set");
  return url;
}

function createNodeClient(): PrismaClient {
  const require = createRequire(import.meta.url);
  const pg = require("pg") as typeof import("pg");
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");

  const pool = new pg.Pool({
    connectionString: nodeEnv("DATABASE_URL"),
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
  });

  pool.on("error", (err) => {
    console.error("[db] pool error:", err.message);
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function workersDbProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get() {
      throw new Error(
        "[db] PrismaClient (pg TCP) is unavailable on Cloudflare Workers. " +
          "Pass c.env.DATABASE_URL to createNeonClient() or migrate the query to neon-http.",
      );
    },
  });
}

function createWorkersClient(connectionString?: string): PrismaClient {
  const adapter = new PrismaNeonHttp(getDatabaseUrl(connectionString), {});
  return new PrismaClient({ adapter });
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? (isWorkersRuntime() ? workersDbProxy() : createNodeClient());

if (!isWorkersRuntime()) globalForPrisma.prisma = db;

const workersClients = new Map<string, PrismaClient>();

export function getWorkersDb(connectionString: string): PrismaClient {
  const cached = workersClients.get(connectionString);
  if (cached) return cached;
  const client = createWorkersClient(connectionString);
  workersClients.set(connectionString, client);
  return client;
}
