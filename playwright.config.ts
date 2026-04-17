import { defineConfig, devices } from '@playwright/test';

/**
 * Each worker starts its own Flask instance on a unique port with its own
 * SQLite file (see tests/fixtures.ts → `port` worker fixture).
 * This means spec files run fully in parallel without DB conflicts.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,

  // Tests within a file run serially; files run in parallel across workers.
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,

  // Each worker owns one Flask server + one SQLite DB.
  workers: process.env.CI ? 2 : 4,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'results.json' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: { mode: 'retain-on-failure' },
    // baseURL is provided dynamically by the `port` worker fixture.
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // No webServer block — fixtures.ts spawns per-worker servers instead.
});
