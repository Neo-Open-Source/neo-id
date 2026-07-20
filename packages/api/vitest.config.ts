import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
    globals: true,
    alias: {
      "@neo-id/db": path.resolve(__dirname, "tests/__mocks__/db.ts"),
    },
    env: {
      JWT_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB\naFDrBz9vFqU5yTfMJPHE2TkDBAUflsYE5mWGT0RAQM9SD7yTJJHdVRAJm0MU2k0E\nmDfM3HN3HqE5F2Xz1qZ3yTJJHdVRAJm0MU2k0EaFDrBz9vFqU5yTfMJPHE2TkDBA==\n-----END RSA PRIVATE KEY-----",
      JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy\nF8PbnGy0AHB7MhgHcTz6sE2I2yPBaFDrBz9vFqU5yTfMJPHE2TkDBAUflsYE5mWG\nT0RAQM9SD7yTJJHdVRAJm0MU2k0EmDfM3HN3HqE5F2Xz1qZ3yTJJHdVRAJm0MU2k0\nEaFDrBz9vFqU5yTfMJPHE2TkDBA==\n-----END PUBLIC KEY-----",
      JWT_ISSUER: "https://test.neome.uk",
    },
  },
});
