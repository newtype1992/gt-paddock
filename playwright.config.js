import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    channel: "chrome",
    baseURL: "http://127.0.0.1:4178",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: !process.env.CI,
  },
});
