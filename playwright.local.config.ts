import { defineConfig } from "@playwright/test";

const baseURL = process.env.IRIEVERSE_APP_URL || "http://127.0.0.1:5173";
const shouldStartLocalServer = !process.env.IRIEVERSE_APP_URL || baseURL.includes("127.0.0.1") || baseURL.includes("localhost");

export default defineConfig({
  testDir: "./tests",
  testMatch: /app-flows\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    colorScheme: "dark",
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  },
  webServer: shouldStartLocalServer
    ? {
        command: "npm run dev -- --host 127.0.0.1",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
