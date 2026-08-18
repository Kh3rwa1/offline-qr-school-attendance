import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.FLAKE_OBSERVATION === 'true' ? 1 : 0, // Strict zero-retry policy for merge-blocking CI gates; flakiness is never hidden
  reporter: process.env.CI ? [['html', { outputFolder: 'output/playwright/report', open: 'never' }], ['line']] : 'list',
  outputDir: 'output/playwright/test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3100',
    extraHTTPHeaders: {
      'x-playwright-e2e': 'true',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run e2e:server',
        url: 'http://127.0.0.1:3100/api/v1/health',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
