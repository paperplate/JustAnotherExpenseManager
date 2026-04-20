import { test, expect } from './fixtures';

/**
 * Navigation + basic page structure smoke tests.
 * No data seeded — verifies structural presence only.
 */

test.describe('Navigation', () => {
  test('homepage redirects to summary', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Summary - Expense Manager/);
    await expect(page.getByRole('link', { name: /Expense Manager/ })).toBeVisible();
  });

  test('navigate between pages', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL('/transactions');
    await expect(page).toHaveTitle(/Transactions - Expense Manager/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle(/Settings - Expense Manager/);

    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(page).toHaveURL('/summary');
  });

  test('active navigation item is highlighted', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByRole('link', { name: 'Summary' })).toHaveClass(/active/);

    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page.getByRole('link', { name: 'Transactions' })).toHaveClass(/active/);
  });

  test('summary page renders income / expense / net cards', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.locator('.summary-card.income')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.summary-card.expense')).toBeVisible();
    await expect(page.locator('.summary-card.net')).toBeVisible();
  });

  test('summary stats container loads', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.locator('.summary-card.income')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.summary-card.expense')).toBeVisible();
  });

  test('chart canvas elements exist on summary page', async ({ page }) => {
    await page.goto('/summary');
    // canvases are always in the DOM; container visibility depends on data
    await expect(page.locator('#categoryChart')).toBeAttached();
    await expect(page.locator('#monthlyChart')).toBeAttached();
  });

  test('transactions list container is present on transactions page', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.locator('#transactions-list')).toBeVisible();
  });

  test('unknown route returns 404', async ({ page }) => {
    const res = await page.goto('/nonexistent-page');
    expect(res?.status()).toBe(404);
  });
});
