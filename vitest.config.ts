import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { include: ["packages/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "@tokenlens/shared": resolve(__dirname, "packages/shared/src"),
      "@tokenlens/analytics": resolve(__dirname, "packages/analytics/src"),
      "@tokenlens/database": resolve(__dirname, "packages/database/src"),
      "@tokenlens/otel-parser": resolve(__dirname, "packages/otel-parser/src"),
      "@tokenlens/repo-analyzer": resolve(__dirname, "packages/repo-analyzer/src"),
    },
  },
});
