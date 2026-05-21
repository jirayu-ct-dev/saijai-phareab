import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~~": root,
      "~": root,
      "@@": root,
      "@": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});
