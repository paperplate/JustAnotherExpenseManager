/**
 * Filter Combination Tests
 *
 * Tests all meaningful combinations of category, tag, and time-range filters
 * on both the Summary and Transactions pages.
 *
 * Data setup — seeded fresh before each test:
 *   food:          Groceries ($120, recurring), Pizza ($40, dining), Snacks ($15)
 *   transport:     Bus Pass ($60, recurring, commute)
 *   salary income: Paycheck ($3000, recurring)
 *   entertainment: Cinema ($30, leisure)
 *
 * All transactions are dated TODAY so every time-range filter includes them.
 */

import { test, expect } from './fixtures';
import { clearDatabase, seedTransactionsViaAPI, TODAY, type TransactionOptions } from './helpers';
import type { APIRequestContext } from '@playwright/test';

// ── Seed data ─────────────────────────────────────────────────────────────────

const TRANSACTIONS: TransactionOptions[] = [
  { description: 'Groceries', amount: 120, type: 'expense', category: 'food', tags: 'recurring' },
  { description: 'Pizza', amount: 40, type: 'expense', category: 'food', tags: 'dining' },
  { description: 'Snacks', amount: 15, type: 'expense', category: 'food', tags: '' },
  { description: 'Bus Pass', amount: 60, type: 'expense', category: 'transport', tags: 'recurring,commute' },
  { description: 'Paycheck', amount: 3000, type: 'income', category: 'salary', tags: 'recurring' },
  { description: 'Cinema', amount: 30, type: 'expense', category: 'entertainment', tags: 'leisure' },
];

async function seedData(request: APIRequestContext): Promise<void> {
  await clearDatabase(request);
  await seedTransactionsViaAPI(request, TRANSACTIONS);
}

// ── Summary page — filter combinations ───────────────────────────────────────

test.describe('Summary page — filter combinations', () => {
  test.beforeEach(async ({ summaryPage, request }) => {
    await seedData(request);
    await summaryPage.goto();
  });

  // ── Initial state ────────────────────────────────────────────────────────────

  test('charts are visible on initial page load', async ({ page }) => {
    await expect(page.locator('#charts-container')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  // ── Category only ─────────────────────────────────────────────────────────────

  test('category:food — expense total reflects only food transactions', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    // food expenses: 120 + 40 + 15 = $175.00
    await expect(summaryPage.summaryExpenseValue).toHaveText('$175.00');
    await expect(summaryPage.summaryIncomeValue).toHaveText('$0.00');
  });

  test('category:transport — expense total reflects only transport', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('transport');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$60.00');
  });

  test('category:salary — income total reflects only salary', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('salary');
    await expect(summaryPage.summaryIncomeValue).toHaveText('$3000.00');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$0.00');
  });

  test('multiple categories — totals are combined', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await summaryPage.filter.selectCategory('transport');
    // food ($175) + transport ($60) = $235
    await expect(summaryPage.summaryExpenseValue).toHaveText('$235.00');
  });

  test('category filter — chart remains visible', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await expect(summaryPage.charts).toBeVisible();
    await expect(summaryPage.categoryChart).toBeVisible();
    await expect(summaryPage.monthlyChart).toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────────

  test('tag:recurring — expense = Groceries + Bus Pass, income = Paycheck', async ({ summaryPage }) => {
    await summaryPage.filter.selectTag('recurring');
    // expenses: 120 + 60 = $180; income: 3000
    await expect(summaryPage.summaryExpenseValue).toHaveText('$180.00');
    await expect(summaryPage.summaryIncomeValue).toHaveText('$3000.00');
  });

  test('tag:recurring — chart is still visible', async ({ summaryPage }) => {
    await summaryPage.filter.selectTag('recurring');
    await expect(summaryPage.charts).toBeVisible();
    await expect(summaryPage.categoryChart).toBeVisible();
  });

  test('tag:dining — only Pizza in expense total', async ({ summaryPage }) => {
    await summaryPage.filter.selectTag('dining');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$40.00');
  });

  test('tag:leisure — only Cinema in expense total', async ({ summaryPage }) => {
    await summaryPage.filter.selectTag('leisure');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$30.00');
  });

  test('tag filter URL contains tags= parameter', async ({ page, summaryPage }) => {
    await summaryPage.filter.selectTag('recurring');
    expect(page.url()).toContain('tags=recurring');
  });

  // ── Category + Tag ────────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries matches both', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await summaryPage.filter.selectTag('recurring');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$120.00');
  });

  test('category:food + tag:dining — only Pizza matches both', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await summaryPage.filter.selectTag('dining');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$40.00');
  });

  test('category:transport + tag:recurring — only Bus Pass matches both', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('transport');
    await summaryPage.filter.selectTag('recurring');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$60.00');
  });

  test('category:entertainment + tag:recurring — no overlap, shows $0', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('entertainment');
    await summaryPage.filter.selectTag('recurring');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$0.00');
  });

  test('category + tag — URL contains both parameters', async ({ page, summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await summaryPage.filter.selectTag('dining');
    expect(page.url()).toContain('categories=food');
    expect(page.url()).toContain('tags=dining');
  });

  // ── Time range ────────────────────────────────────────────────────────────────

  test('time range current_month — includes all seeded transactions', async ({ summaryPage }) => {
    await summaryPage.filter.selectTime('current_month');
    // Total expenses: 120 + 40 + 15 + 60 + 30 = $265
    await expect(summaryPage.summaryExpenseValue).toHaveText('$265.00');
  });

  test('time range custom (today) — includes all seeded transactions', async ({ summaryPage }) => {
    await summaryPage.filter.selectTime('custom', TODAY, TODAY);
    await expect(summaryPage.summaryExpenseValue).toHaveText('$265.00');
  });

  test('custom date range picker visible when "custom" selected', async ({ page, summaryPage }) => {
    await summaryPage.filter.selectTime('custom', TODAY, TODAY);
    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await expect(page.getByLabel('Start Date:')).toBeVisible();
    await expect(page.getByLabel('End Date:')).toBeVisible();
  });

  // ── Category + Time range ─────────────────────────────────────────────────────

  test('category:food + current_month — food expenses within current month', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await summaryPage.filter.selectTime('current_month');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$175.00');
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring within current month', async ({ page, summaryPage }) => {
    await summaryPage.filter.selectTag('recurring');
    await summaryPage.filter.selectTime('current_month');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$180.00');
    await expect(page.locator('#categoryChart')).toBeVisible();
  });

  // ── Reset behaviour ───────────────────────────────────────────────────────────

  test('resetting category to "All" restores unfiltered totals', async ({ summaryPage }) => {
    await summaryPage.filter.selectCategory('food');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$175.00');

    await summaryPage.filter.resetCategoryFilter();
    // All expenses: 120+40+15+60+30 = $265
    await expect(summaryPage.summaryExpenseValue).toHaveText('$265.00');
  });

  test('resetting tag to "All Tags" restores unfiltered totals', async ({ summaryPage }) => {
    await summaryPage.filter.selectTag('dining');
    await expect(summaryPage.summaryExpenseValue).toHaveText('$40.00');

    await summaryPage.filter.resetTagFilter();
    await expect(summaryPage.summaryExpenseValue).toHaveText('$265.00');
  });
});

// ── Transactions page — filter combinations ───────────────────────────────────

test.describe('Transactions page — filter combinations', () => {
  test.beforeEach(async ({ transactionsPage, request }) => {
    await seedData(request);
    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();
    // Confirm all 6 rows loaded (header + 6 data rows)
    await expect(transactionsPage.table.getByRole('row')).toHaveCount(TRANSACTIONS.length + 1);
  });

  // ── Category only ─────────────────────────────────────────────────────────────

  test('category:food — shows all three food transactions', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('food');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Snacks')).toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
    await expect(page.getByText('Paycheck')).not.toBeVisible();
    await expect(page.getByText('Cinema')).not.toBeVisible();
  });

  test('category:transport — shows only Bus Pass', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('transport');
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('category:salary — shows only Paycheck', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('salary');
    await expect(page.getByText('Paycheck')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('multiple categories — shows union of matching transactions', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('food');
    await transactionsPage.filter.selectCategory('transport');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Paycheck')).not.toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────────

  test('tag:recurring — shows Groceries, Bus Pass, and Paycheck', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectTag('recurring');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Paycheck')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
    await expect(page.getByText('Cinema')).not.toBeVisible();
  });

  test('tag:dining — shows only Pizza', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectTag('dining');
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('tag:commute — shows only Bus Pass', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectTag('commute');
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('tag:leisure — shows only Cinema', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectTag('leisure');
    await expect(page.getByText('Cinema')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  // ── Category + Tag ────────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('food');
    await transactionsPage.filter.selectTag('recurring');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
  });

  test('category:food + tag:dining — only Pizza', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('food');
    await transactionsPage.filter.selectTag('dining');
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('category:entertainment + tag:recurring — no matches, shows empty state', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('entertainment');
    await transactionsPage.filter.selectTag('recurring');
    await expect(page.getByText('Cinema')).not.toBeVisible();
    const listText = await page.locator('#transactions-list').textContent();
    expect(listText!.trim().length).toBeGreaterThan(0); // not a blank crash
  });

  // ── Time range ────────────────────────────────────────────────────────────────

  test('current_month — all seeded transactions visible', async ({ page, summaryPage }) => {
    await summaryPage.filter.selectTime('current_month');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Paycheck')).toBeVisible();
    await expect(page.getByText('Cinema')).toBeVisible();
  });

  test('custom (yesterday) — no seeded transactions (all dated today)', async ({ page, summaryPage }) => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    await summaryPage.filter.selectTime('custom', yesterday, yesterday);
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  // ── Category + Time range ─────────────────────────────────────────────────────

  test('category:food + current_month — food transactions in month', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectCategory('food');
    await transactionsPage.filter.selectTime('current_month');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring transactions in month', async ({ page, transactionsPage }) => {
    await transactionsPage.filter.selectTag('recurring');
    await transactionsPage.filter.selectTime('current_month');
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Paycheck')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
  });
});
