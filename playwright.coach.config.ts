import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  webServer: process.env.TEST_BASE_URL ? undefined : {command:'npm run start',url:'http://localhost:3100',reuseExistingServer:true,timeout:60000},
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3100",
    launchOptions: {
      executablePath: process.env.TEST_BROWSER_PATH,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [
    {
      name: "phone-375",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-414",
      use: {
        viewport: { width: 414, height: 896 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
