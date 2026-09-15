import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // Use system Chrome when Playwright's bundled Chromium isn't installed
        channel: 'chrome',
      },
    },
  ],
  // webServer is intentionally NOT used here — the helper script
  // (e2e/run-offline-test.sh) manages the vite preview lifecycle.
});
