const { test, expect } = require('@playwright/test');

/**
 * Navigation Tests
 * Tests basic navigation and page loads
 */

test.describe('Navigation', () => {
  test('should load homepage and redirect to summary', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/summary');
    await expect(page).toHaveTitle(/Summary - Expense Manager/);
    await expect(page.locator('.nav-brand')).toContainText('Expense Manager');
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Transactions');
    await expect(page).toHaveURL('/transactions');
    await expect(page).toHaveTitle(/Transactions - Expense Manager/);

    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle(/Settings - Expense Manager/);

    await page.click('text=Summary');
    await expect(page).toHaveURL('/summary');
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/summary');

    const summaryLink = page.locator('a[href="/summary"]');
    await expect(summaryLink).toHaveClass(/active/);

    await page.click('text=Transactions');

    const transactionsLink = page.locator('a[href="/transactions"]');
    await expect(transactionsLink).toHaveClass(/active/);
  });

  test('should load stats container on summary page', async ({ page }) => {
    await page.goto('/summary');

    // Stats are loaded via fetch — wait for summary cards to appear
    await expect(page.locator('.summary-card.income')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.summary-card.expense')).toBeVisible();
  });

  test('should load transactions list on transactions page', async ({ page }) => {
    await page.goto('/transactions');

    // Transactions list is loaded via fetch on DOMContentLoaded
    const list = page.locator('#transactions-list');
    await expect(list).toBeVisible();
    // Either shows transactions or the empty state
    await expect(list).not.toBeEmpty();
  });
});
