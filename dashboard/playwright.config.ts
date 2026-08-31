import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Magneetar Dashboard E2E tests.
 *
 * This configuration runs end-to-end tests against the dashboard UI,
 * validating critical user flows like:
 * - Authentication (login/logout)
 * - Device management (view, claim, share)
 * - Command execution (lock, alarm, locate)
 * - Evidence capture and download
 * - Settings management
 *
 * Usage:
 *   npx playwright test                    # Run all tests
 *   npx playwright test --project=chromium # Run on Chrome only
 *   npx playwright test auth.spec.ts       # Run specific test file
 *   npx playwright show-report             # View HTML report
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.DASHBOARD_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
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
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
