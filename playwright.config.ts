import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./apps/web/e2e/auth.setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3107",
    storageState: "/tmp/tokenlens-playwright-auth.json",
  },
  webServer: {
    command: "pnpm --filter @tokenlens/web start --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: true,
  },
});
