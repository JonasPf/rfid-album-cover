import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const devPort = 5179;
const devServerSpec = /dev-server\.spec\.ts/;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: devServerSpec },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: devServerSpec },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: devServerSpec },
    {
      name: "dev-server",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${devPort}` },
      testMatch: devServerSpec,
    },
  ],
  webServer: [
    // The production build in dist/; `task e2e` builds it first.
    {
      command: `npx vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
    },
    // A fresh dev server with no optimized dependencies, for dev-server.spec.ts.
    {
      command: `npx vite --force --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
    },
  ],
});
