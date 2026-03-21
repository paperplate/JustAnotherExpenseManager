import { test, expect } from '@playwright/test';
import {
  addTransaction,
  selectCategory,
  openCategoryFilter,
  resetCategoryFilter,
  scrollToTotals,
  TransactionOptions
} from './helpers'

/**
 * Filters and Statistics Tests
 * Tests the <details>/<li> filter UI and statistics display.
 *
 * Filter UI facts (post-HTMX refactor):
 *  - Category/tag dropdowns are <details id="category-details"> / <details id="tag-details">
 *  - The trigger is <summary id="category-summary"> / <summary id="tag-summary">
 *  - Each option is an <li class="filter-option"> with onclick; NO checkboxes
 *  - Selected items get class "selected"
 *  - Stats and charts are loaded via plain fetch(), not HTMX
 */

// ─── Constants ────────────────────────────────────────────────────────────
const SUMMARY_EXPENSE_VALUE: string = '.summary-card.expense .summary-value';
const SUMMARY_INCOME_VALUE: string = '.summary-card.income .summary-value';
const INCOME_CARD: string = '.summary-card.income';
const EXPENSE_CARD: string = '.summary-card.expense';
const NET_CARD: string = '.summary-card.net'

test.describe('Filters and Statistics', () => {
  // Add two transactions (one expense, one income) before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    let transactions: TransactionOptions[] = [
      {
        description: 'Filter Test Expense',
        amount: 100,
        type: 'expense',
        category: 'food'
      },
      {
        description: 'Filter Test Income',
        amount: 500,
        type: 'income',
        category: 'salary'
      }
    ];

    for (const t of transactions) {
      await addTransaction(page, t);
    }

    await scrollToTotals(page);
    const tableRows = page.getByRole('row');
    await expect(tableRows).toHaveCount(transactions.length + 1); // Add 1 for header row

    await page.getByRole('link', { name: 'Summary' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('should display summary statistics', async ({ page }) => {
    await expect(page.locator(INCOME_CARD)).toBeVisible();
    await expect(page.locator(EXPENSE_CARD)).toBeVisible();
    await expect(page.locator(NET_CARD)).toBeVisible();

    await expect(page.locator(SUMMARY_INCOME_VALUE)).toContainText('$');
    await expect(page.locator(SUMMARY_EXPENSE_VALUE)).toContainText('$');
  });

  test('should display charts after page load', async ({ page }) => {
    // Charts are rendered by loadStats() + refreshCharts() on DOMContentLoaded
    await expect(page.locator('#charts-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  test('should filter by time range', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('3_months');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(INCOME_CARD)).toBeVisible();

    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(INCOME_CARD)).toBeVisible();
  });

  test('should show custom date range picker when "custom" is selected', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('custom');

    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await expect(page.getByLabel('Start Date:')).toBeVisible();
    await expect(page.getByLabel('End Date:')).toBeVisible();
  });

  test('should apply custom date range', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('custom');
    await expect(page.locator('#custom-range-picker')).toBeVisible();

    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 7) + '-01';

    await page.getByLabel('Start Date:').fill(firstOfMonth);
    await page.getByLabel('End Date:').fill(today);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(INCOME_CARD)).toBeVisible();
  });

  test('category filter dropdown opens on summary click', async ({ page }) => {
    const details = page.locator('#category-details');
    await expect(details).toBeVisible();

    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
  });

  test('category filter options are loaded without category: prefix', async ({ page }) => {
    await page.locator('#category-details').locator('summary').click();

    await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });

    const optionTexts = await page.locator('#category-options-list').allTextContents();
    const hasPrefix = optionTexts.some(t => t.trim().startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should filter stats by category', async ({ page }) => {
    await selectCategory(page, 'food');

    await expect(page.locator('.summary-card.expense')).toBeVisible();

    await expect(page.locator('#category-summary')).toContainText('food');
  });

  test('should select multiple categories and update summary text', async ({ page }) => {
    await page.locator('#category-details').locator('summary').click();
    await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });

    const options = page.locator('#category-options-list');
    const count = await options.count();

    if (count >= 2) {
      await options.nth(0).click();
      await options.nth(1).click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#category-summary')).toContainText('categories');
    }
  });

  test('Transactions page selecting "All Categories" deselects individual categories', async ({ page }) => {
    await page.goto('/transactions');
    await selectCategory(page, 'food');
    await resetCategoryFilter(page);

    await expect(page.locator('#category-summary')).toContainText('All Categories');
  });

  test('Summary page selecting "All Categories" deselects individual categories', async ({ page }) => {
    await page.goto('/summary');
    await selectCategory(page, 'food');
    await resetCategoryFilter(page);

    await expect(page.locator('#category-summary')).toContainText('All Categories');
  });

  test('tag filter dropdown opens and shows options', async ({ page }) => {
    await page.goto('/transactions');
    await addTransaction(page, {
      description: 'Tagged',
      amount: 10.0,
      type: 'expense',
      category: 'other',
      tags: 'playwrighttest'
    });

    await page.goto('/summary');
    await page.waitForLoadState('networkidle');

    await page.locator('#tag-details').locator('summary').click();
    await expect(page.locator('#tag-details')).toHaveAttribute('open', '');

    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'playwrighttest' })
    ).toBeVisible({ timeout: 5000 });
  });

  test('filter state is reflected in URL', async ({ page }) => {
    await page.locator('#category-details').locator('summary').click();
    await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });

    await page.locator('#category-options-list').first().click();
    await page.waitForLoadState('networkidle');

    // URL should now contain categories= parameter
    expect(page.url()).toContain('categories=');
  });
});
