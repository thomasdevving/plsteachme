import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./tests/e2e', fullyParallel:false, workers:1, use:{ baseURL:process.env.TEST_BASE_URL || 'http://localhost:3100', browserName:'chromium' }, webServer:process.env.TEST_BASE_URL ? undefined : { command:'npm run start', url:'http://localhost:3100', reuseExistingServer:true, timeout:60000 }, reporter:'list' });
