const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Expense Manager E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Reporters: blob for CI sharding (merged later), html+list locally */
  reporter: process.env.CI
    ? [['blob'], ['list']]
    : [['html', { outputFolder: 'playwright-report' }], ['list']],

  /* Workers: 2 in CI (GitHub Actions 2-CPU runners), unlimited locally */
  workers: process.env.CI ? 2 : undefined,
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
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
    
    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'JustAnotherExpenseManager',
    url: 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      DATABASE_TYPE: process.env.DATABASE_TYPE || 'sqlite',
      SQLITE_PATH: process.env.SQLITE_PATH || './data/expenses.db',
      SECRET_KEY: process.env.SECRET_KEY || 'dev-insecure-default-change-me',
      //FLASK_DEBUG: '1',
    },
  },
});
