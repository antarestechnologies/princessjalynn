import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // PGlite boots a WASM Postgres per test file; give it room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
