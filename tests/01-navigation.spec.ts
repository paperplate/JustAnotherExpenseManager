import { test, expect } from './fixtures';

/**
 * Navigation Tests
 * Tests basic navigation and page loads
 */

test.describe('Navigation', () => {
  test('should load homepage and redirect to summary', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Summary - Expense Manager/);
    await expect(page.getByRole('link', { name: /Expense Manager/ })).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
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

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/summary');

    await expect(page.getByRole('link', { name: 'Summary' })).toHaveClass(/active/);

    await page.getByRole('link', { name: 'Transactions' }).click();

    await expect(page.getByRole('link', { name: 'Transactions' })).toHaveClass(/active/);
  });

  test('should load stats container on summary page', async ({ page }) => {
    await page.goto('/summary');

    await expect(page.locator('.summary-card.income')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.summary-card.expense')).toBeVisible();
  });

  test('should load transactions list on transactions page', async ({ page }) => {
    await page.goto('/transactions');

    const list = page.locator('#transactions-list');
    await expect(list).toBeVisible();
    await expect(list).not.toBeEmpty();
  });
});
