import { defineConfig } from '@playwright/test';
// Installable app and offline lessons, with real service workers, against a
// production build (`npm run build` first). Offline behavior is not tested with next dev.
export default defineConfig({
  testDir: './tests/pwa',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3100',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath: process.env.TEST_BROWSER_PATH, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  webServer: process.env.TEST_BASE_URL ? undefined : { command: 'npm run start', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 60_000 },
});
