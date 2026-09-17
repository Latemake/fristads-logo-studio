import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3100",
          localStorage: [{ name: "logo-studio-language", value: "fi" }],
        },
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && node scripts/test-server.mjs --production",
    url: "http://localhost:3100",
    reuseExistingServer: false,
  },
  timeout: 45000,
});
