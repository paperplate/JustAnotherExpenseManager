import { Page, Browser } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  clearDatabase,
  addTransaction,
  TODAY,
  selectCategory,
  selectTag,
  resetCategoryFilter,
  resetTagFilter,
  scrollToTotals
} from './helpers';

/**
 * Filter Combination Tests
 * Tests all meaningful combinations of category, tag, and time-range filters
 * on both the Summary and Transactions pages.
 *
 * Data setup (seeded once per describe block via beforeAll, not before every test):
 *   - 3 food expenses:       Groceries ($120, recurring), Pizza ($40, dining), Snacks ($15, today)
 *   - 1 transport expense:   Bus Pass ($60, commute, recurring)
 *   - 1 salary income:       Salary ($3000, recurring)
 *   - 1 entertainment exp:   Cinema ($30, leisure)
 * All transactions are dated today so time-range filters always include them.
 *
 * Each describe block is marked serial so tests within it run sequentially and
 * share the same seeded state. This avoids re-seeding 6 transactions before
 * every one of the 36 tests, cutting setup time from O(n_tests) to O(n_blocks).
 */

// ─── Constants ────────────────────────────────────────────────────────────
const SUMMARY_EXPENSE_VALUE: string = '.summary-card.expense .summary-value';
const SUMMARY_INCOME_VALUE: string = '.summary-card.income .summary-value';

// ─── shared setup ────────────────────────────────────────────────────────────

async function seedData(page: Page): Promise<void> {
  await clearDatabase(page);

  await page.goto('/transactions');
  await page.waitForLoadState('networkidle');

  await addTransaction(page, { description: 'Groceries', amount: 120, type: 'expense', category: 'food', tags: 'recurring', date: TODAY });
  await addTransaction(page, { description: 'Pizza', amount: 40, type: 'expense', category: 'food', tags: 'dining', date: TODAY });
  await addTransaction(page, { description: 'Snacks', amount: 15, type: 'expense', category: 'food', tags: '', date: TODAY });
  await addTransaction(page, { description: 'Bus Pass', amount: 60, type: 'expense', category: 'transport', tags: 'recurring,commute', date: TODAY });
  await addTransaction(page, { description: 'Salary', amount: 3000, type: 'income', category: 'salary', tags: 'recurring', date: TODAY });
  await addTransaction(page, { description: 'Cinema', amount: 30, type: 'expense', category: 'entertainment', tags: 'leisure', date: TODAY });
}

// ─── Summary page filter combinations ────────────────────────────────────────

test.describe.serial('Summary page — filter combinations', () => {
  test.beforeAll(async ({ browser, workerBaseURL }) => {
    const ctx = await browser.newContext({ baseURL: workerBaseURL });
    const page = await ctx.newPage();
    await seedData(page);
    await page.close();
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/summary');
    await page.waitForLoadState('networkidle');
  });

  // ── Category only ─────────────────────────────────────────────────────────

  test('category:food — expense total reflects only food transactions', async ({ page }) => {
    await selectCategory(page, 'food');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    // food expenses: 120 + 40 + 15 = $175.00
    expect(expenseValue!.trim()).toBe('$175.00');
    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$0.00');
  });

  test('category:transport — expense total reflects only transport transactions', async ({ page }) => {
    await selectCategory(page, 'transport');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$60.00');
  });

  test('category:salary — income total reflects only salary transactions', async ({ page }) => {
    await selectCategory(page, 'salary');

    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$3000.00');
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$0.00');
  });

  test('multiple categories — totals are combined', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectCategory(page, 'transport');

    // food ($175) + transport ($60) = $235 expenses
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$235.00');
  });

  test('category:food — category chart remains visible', async ({ page }) => {
    await selectCategory(page, 'food');

    await expect(page.locator('#charts-container')).toBeVisible();
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────

  test('tag:recurring — expense total is Groceries + Bus Pass, income is Salary', async ({ page }) => {
    await selectTag(page, 'recurring');

    // recurring expenses: Groceries $120 + Bus Pass $60 = $180
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$180.00');
    // recurring income: Salary $3000
    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$3000.00');
  });

  test('tag:recurring — category chart is still visible', async ({ page }) => {
    await selectTag(page, 'recurring');

    await expect(page.locator('#charts-container')).toBeVisible();
    await expect(page.locator('#categoryChart')).toBeVisible();
  });

  test('tag:dining — only Pizza shown in expense total', async ({ page }) => {
    await selectTag(page, 'dining');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$40.00');
  });

  test('tag:leisure — only Cinema shown in expense total', async ({ page }) => {
    await selectTag(page, 'leisure');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$30.00');
  });

  test('tag filter URL contains tags= parameter', async ({ page }) => {
    await selectTag(page, 'recurring');
    expect(page.url()).toContain('tags=recurring');
  });

  // ── Category + Tag ────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries matches both', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectTag(page, 'recurring');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$120.00');
  });

  test('category:food + tag:dining — only Pizza matches both', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectTag(page, 'dining');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$40.00');
  });

  test('category:transport + tag:recurring — only Bus Pass matches both', async ({ page }) => {
    await selectCategory(page, 'transport');
    await selectTag(page, 'recurring');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$60.00');
  });

  test('category:entertainment + tag:recurring — no overlap, shows $0', async ({ page }) => {
    await selectCategory(page, 'entertainment');
    await selectTag(page, 'recurring');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$0.00');
  });

  test('category + tag — URL contains both parameters', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectTag(page, 'dining');

    expect(page.url()).toContain('categories=food');
    expect(page.url()).toContain('tags=dining');
  });

  // ── Time range only ────────────────────────────────────────────────────────

  test('time range: current_month — includes all seeded transactions', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    // All transactions are dated today so they fall in current month
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    // Total expenses: 120 + 40 + 15 + 60 + 30 = $265
    expect(expenseValue!.trim()).toBe('$265.00');
  });

  test('time range: custom (today only) — includes all seeded transactions', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('custom');
    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await page.getByLabel('Start Date:').fill(TODAY);
    await page.getByLabel('End Date:').fill(TODAY);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$265.00');
  });

  // ── Category + Time range ─────────────────────────────────────────────────

  test('category:food + current_month — food expenses within current month', async ({ page }) => {
    await selectCategory(page, 'food');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$175.00');
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring within current month', async ({ page }) => {
    await selectTag(page, 'recurring');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$180.00');
    // Charts must remain visible (regression guard)
    await expect(page.locator('#categoryChart')).toBeVisible();
  });

  // ── Reset behaviour ───────────────────────────────────────────────────────

  test('resetting category to "All" restores unfiltered totals', async ({ page }) => {
    await selectCategory(page, 'food');
    const filteredExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(filteredExpense!.trim()).toBe('$175.00');

    await resetCategoryFilter(page);
    const totalExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    // Should now show all expenses: 120+40+15+60+30 = $265
    expect(totalExpense!.trim()).toBe('$265.00');
  });

  test('resetting tag to "All Tags" restores unfiltered totals', async ({ page }) => {
    await selectTag(page, 'dining');
    const filteredExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(filteredExpense!.trim()).toBe('$40.00');

    await resetTagFilter(page);
    const totalExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(totalExpense!.trim()).toBe('$265.00');
  });
});

// ─── Transactions page filter combinations ────────────────────────────────────

test.describe.serial('Transactions page — filter combinations', () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const page = await browser.newPage();
    await seedData(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  // ── Category only ─────────────────────────────────────────────────────────

  test('category:food — shows all three food transactions', async ({ page }) => {
    await selectCategory(page, 'food');
    await expect(page.getByText('Groceries')).toBeAttached();
    await expect(page.getByText('Pizza')).toBeAttached();
    await expect(page.getByText('Snacks')).toBeAttached();
    await expect(page.getByText('Bus Pass')).not.toBeAttached();
    await expect(page.getByText('Salary')).not.toBeAttached();
    await expect(page.getByText('Cinema')).not.toBeAttached();
  });

  test('category:transport — shows only Bus Pass', async ({ page }) => {
    await selectCategory(page, 'transport');

    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('category:salary — shows only Salary', async ({ page }) => {
    await selectCategory(page, 'salary');

    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Cinema')).not.toBeVisible();
  });

  test('multiple categories — shows union of matching transactions', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectCategory(page, 'transport');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Salary')).not.toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────

  test('tag:recurring — shows Groceries, Bus Pass, and Salary', async ({ page }) => {
    await selectTag(page, 'recurring');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
    await expect(page.getByText('Cinema')).not.toBeVisible();
  });

  test('tag:dining — shows only Pizza', async ({ page }) => {
    await selectTag(page, 'dining');

    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
  });

  test('tag:commute — shows only Bus Pass', async ({ page }) => {
    await selectTag(page, 'commute');

    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  test('tag:leisure — shows only Cinema', async ({ page }) => {
    await selectTag(page, 'leisure');

    await expect(page.getByText('Cinema')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
  });

  // ── Category + Tag ────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries matches both', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectTag(page, 'recurring');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
    await expect(page.getByText('Snacks')).not.toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
  });

  test('category:food + tag:dining — only Pizza matches both', async ({ page }) => {
    await selectCategory(page, 'food');
    await selectTag(page, 'dining');

    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Snacks')).not.toBeVisible();
  });

  test('category:entertainment + tag:recurring — no matches, shows empty state', async ({ page }) => {
    await selectCategory(page, 'entertainment');
    await selectTag(page, 'recurring');

    await expect(page.getByText('Cinema')).not.toBeVisible();
    await expect(page.getByText('Groceries')).not.toBeVisible();
    // Should show empty state rather than a broken page
    const listText = await page.locator('#transactions-list').textContent();
    expect(listText!.trim().length).toBeGreaterThan(0);
  });

  // ── Time range only ────────────────────────────────────────────────────────

  test('time range: current_month — all seeded transactions visible', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByText('Cinema')).toBeVisible();
  });

  test('time range: custom (yesterday to yesterday) — no seeded transactions', async ({ page }) => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await page.getByLabel('Time Range:').selectOption('custom');
    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await page.getByLabel('Start Date:').fill(yesterday);
    await page.getByLabel('End Date:').fill(yesterday);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    // All transactions are dated TODAY, none should appear for yesterday
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Salary')).not.toBeVisible();
  });

  // ── Category + Time range ─────────────────────────────────────────────────

  test('category:food + current_month — food transactions in current month', async ({ page }) => {
    await selectCategory(page, 'food');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('Snacks')).toBeVisible();
    await expect(page.getByText('Bus Pass')).not.toBeVisible();
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring transactions in current month', async ({ page }) => {
    await selectTag(page, 'recurring');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Bus Pass')).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByText('Pizza')).not.toBeVisible();
  });
});
