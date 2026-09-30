import { defineConfig, devices } from "@playwright/test";

// UI tests run against the production build served by `vite preview`.
// PW_CHROMIUM lets environments with a preinstalled Chromium skip the download.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.js",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://localhost:4173",
    serviceWorkers: "block",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
