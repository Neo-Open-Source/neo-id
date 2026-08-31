import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// The monorepo keeps .env at the repo root, but Prisma runs from packages/db.
// Load the root .env explicitly so DATABASE_URL resolves regardless of cwd.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
