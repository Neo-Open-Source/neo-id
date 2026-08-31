import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false, // DTS generated via tsc --build
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["src/react/index.ts"],
    format: ["esm"],
    sourcemap: true,
    external: ["react"],
    esbuildOptions(options) {
      options.jsx = "automatic";
    },
  },
]);
