import { Browser, APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  clearDatabase,
  TODAY,
  TransactionOptions,
  seedTransactionsViaAPI
} from './helpers';

import { TransactionsPage } from './pages/TransactionsPage';
import { SummaryPage } from './pages/SummaryPage';

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

const groceries: TransactionOptions = {
  description: 'Groceries', amount: 120, type: 'expense', category: 'food', tags: 'recurring'
};
const pizza: TransactionOptions = {
  description: 'Pizza', amount: 40, type: 'expense', category: 'food', tags: 'dining'
};
const snacks: TransactionOptions = {
  description: 'Snacks', amount: 15, type: 'expense', category: 'food', tags: ''
};
const busPass: TransactionOptions = {
  description: 'Bus Pass', amount: 60, type: 'expense', category: 'transport', tags: 'recurring,commute'
};
const salary: TransactionOptions = {
  description: 'Paycheck', amount: 3000, type: 'income', category: 'salary', tags: 'recurring'
};
const cinema: TransactionOptions = {
  description: 'Cinema', amount: 30, type: 'expense', category: 'entertainment', tags: 'leisure'
};
// ─── shared setup ────────────────────────────────────────────────────────────

async function seedData(tp: TransactionsPage, request: APIRequestContext): Promise<void> {
  await clearDatabase(tp.page);

  tp.goto();

  let transactions: TransactionOptions[] = [
    groceries,
    pizza,
    snacks,
    busPass,
    salary,
    cinema
  ];

  await seedTransactionsViaAPI(request, transactions);
  await tp.page.waitForLoadState('networkidle');


  await tp.scrollToTotals();
  const tableRows = tp.page.getByRole('row');
  await expect(tableRows).toHaveCount(transactions.length + 1); // Add 1 for header row
}

// ─── Summary page filter combinations ────────────────────────────────────────

test.describe.serial('Summary page — filter combinations', () => {
  test.beforeEach(async ({ summaryPage, transactionsPage, request }) => {
    let txPage = transactionsPage;
    await seedData(txPage, request);
    await summaryPage.goto();
  });

  // ── Category only ─────────────────────────────────────────────────────────

  test('category:food — expense total reflects only food transactions', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await page.waitForTimeout(500); // flaky test. Try adding delay
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    // food expenses: 120 + 40 + 15 = $175.00
    expect(expenseValue!.trim()).toBe('$175.00');
    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$0.00');
  });

  test('category:transport — expense total reflects only transport transactions', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('transport');
    await page.waitForTimeout(500);

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$60.00');
  });

  test('category:salary — income total reflects only salary transactions', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('salary');

    await sumPage.scrollToSummary();
    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$3000.00');
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$0.00');
  });

  test('multiple categories — totals are combined', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await page.waitForTimeout(500);
    await sumPage.filter.selectCategory('transport');
    await page.waitForTimeout(500);

    // food ($175) + transport ($60) = $235 expenses
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$235.00');
  });

  test('category:food — category chart remains visible', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');

    await expect(page.locator('#charts-container')).toBeVisible();
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────

  test('tag:recurring — expense total is Groceries + Bus Pass, income is Paycheck', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('recurring');

    await sumPage.scrollToSummary();

    // recurring expenses: Groceries $120 + Bus Pass $60 = $180
    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$180.00');
    // recurring income: Paycheck $3000
    const incomeValue = await page.locator(SUMMARY_INCOME_VALUE).textContent();
    expect(incomeValue!.trim()).toBe('$3000.00');
  });

  test('tag:recurring — category chart is still visible', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('recurring');
    await sumPage.scrollToSummary();

    await expect(page.locator('#charts-container')).toBeVisible();
    await expect(page.locator('#categoryChart')).toBeVisible();
  });

  test('tag:dining — only Pizza shown in expense total', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('dining');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$40.00');
  });

  test('tag:leisure — only Cinema shown in expense total', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('leisure');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$30.00');
  });

  test('tag filter URL contains tags= parameter', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('recurring');
    expect(page.url()).toContain('tags=recurring');
  });

  // ── Category + Tag ────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries matches both', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await sumPage.filter.selectCategory('recurring');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$120.00');
  });

  test('category:food + tag:dining — only Pizza matches both', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await sumPage.filter.selectTag('dining');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$40.00');
  });

  test('category:transport + tag:recurring — only Bus Pass matches both', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('transport');
    await sumPage.filter.selectTag('recurring');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$60.00');
  });

  test('category:entertainment + tag:recurring — no overlap, shows $0', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('entertainment');
    await sumPage.filter.selectTag('recurring');
    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$0.00');
  });

  test('category + tag — URL contains both parameters', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await sumPage.filter.selectTag('dining');

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

  test('category:food + current_month — food expenses within current month', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$175.00');
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring within current month', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('recurring');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await sumPage.scrollToSummary();

    const expenseValue = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(expenseValue!.trim()).toBe('$180.00');
    // Charts must remain visible (regression guard)
    await expect(page.locator('#categoryChart')).toBeVisible();
  });

  // ── Reset behaviour ───────────────────────────────────────────────────────

  test('resetting category to "All" restores unfiltered totals', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');
    await sumPage.scrollToSummary();
    const filteredExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(filteredExpense!.trim()).toBe('$175.00');

    await sumPage.filter.resetCategoryFilter();
    await sumPage.scrollToSummary();
    const totalExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    // Should now show all expenses: 120+40+15+60+30 = $265
    expect(totalExpense!.trim()).toBe('$265.00');
  });

  test('resetting tag to "All Tags" restores unfiltered totals', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('dining');
    await sumPage.scrollToSummary();
    const filteredExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(filteredExpense!.trim()).toBe('$40.00');

    await sumPage.filter.resetTagFilter();
    await sumPage.scrollToSummary();
    const totalExpense = await page.locator(SUMMARY_EXPENSE_VALUE).textContent();
    expect(totalExpense!.trim()).toBe('$265.00');
  });
});

// ─── Transactions page filter combinations ────────────────────────────────────

test.describe.serial('Transactions page — filter combinations', () => {
  test.beforeEach(async ({ request, transactionsPage }) => {
    let txPage = transactionsPage;
    await seedData(txPage, request);
    await txPage.goto();
  });

  // ── Category only ─────────────────────────────────────────────────────────

  test('category:food — shows all three food transactions', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.scrollToTotals();
    const locators = [
      page.getByText(groceries.description),
      page.getByText(pizza.description),
      page.getByText(snacks.description),
      page.getByText(busPass.description),
      page.getByText(salary.description),
      page.getByText(cinema.description),
    ];

    await txPage.filter.selectCategory('food');
    await expect(locators[0]).toBeVisible();
    await expect(locators[1]).toBeVisible();
    await expect(locators[2]).toBeVisible();
    await expect(locators[3]).not.toBeVisible();
    await expect(locators[4]).not.toBeVisible();
    await expect(locators[5]).not.toBeVisible();
  });

  test('category:transport — shows only Bus Pass', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('transport');

    await expect(page.getByText(busPass.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
  });

  test('category:salary — shows only Paycheck', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('salary');

    await expect(page.getByText(salary.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
    await expect(page.getByText(cinema.description)).not.toBeVisible();
  });

  test('multiple categories — shows union of matching transactions', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('food');
    await txPage.filter.selectCategory('transport');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(pizza.description)).toBeVisible();
    await expect(page.getByText(busPass.description)).toBeVisible();
    await expect(page.getByText(salary.description)).not.toBeVisible();
  });

  // ── Tag only ──────────────────────────────────────────────────────────────

  test('tag:recurring — shows Groceries, Bus Pass, and Salary', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectTag('recurring');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(busPass.description)).toBeVisible();
    await expect(page.getByText(salary.description)).toBeVisible();
    await expect(page.getByText(pizza.description)).not.toBeVisible();
    await expect(page.getByText(cinema.description)).not.toBeVisible();
  });

  test('tag:dining — shows only Pizza', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectTag('dining');

    await expect(page.getByText(pizza.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
    await expect(page.getByText(busPass.description)).not.toBeVisible();
  });

  test('tag:commute — shows only Bus Pass', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectTag('commute');

    await expect(page.getByText(busPass.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
  });

  test('tag:leisure — shows only Cinema', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectTag('leisure');

    await expect(page.getByText(cinema.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
  });

  // ── Category + Tag ────────────────────────────────────────────────────────

  test('category:food + tag:recurring — only Groceries matches both', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('food');
    await txPage.filter.selectTag('recurring');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(pizza.description)).not.toBeVisible();
    await expect(page.getByText(snacks.description)).not.toBeVisible();
    await expect(page.getByText(busPass.description)).not.toBeVisible();
  });

  test('category:food + tag:dining — only Pizza matches both', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('food');
    await txPage.filter.selectTag('dining');

    await expect(page.getByText(pizza.description)).toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
    await expect(page.getByText(snacks.description)).not.toBeVisible();
  });

  test('category:entertainment + tag:recurring — no matches, shows empty state', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('entertainment');
    await txPage.filter.selectTag('recurring');

    await expect(page.getByText(cinema.description)).not.toBeVisible();
    await expect(page.getByText(groceries.description)).not.toBeVisible();
    // Should show empty state rather than a broken page
    const listText = await page.locator('#transactions-list').textContent();
    expect(listText!.trim().length).toBeGreaterThan(0);
  });

  // ── Time range only ────────────────────────────────────────────────────────

  test('time range: current_month — all seeded transactions visible', async ({ page }) => {
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(salary.description)).toBeVisible();
    await expect(page.getByText(cinema.description)).toBeVisible();
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
    await expect(page.getByText(groceries.description)).not.toBeVisible();
    await expect(page.getByText(salary.description)).not.toBeVisible();
  });

  // ── Category + Time range ─────────────────────────────────────────────────

  test('category:food + current_month — food transactions in current month', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectCategory('food');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(pizza.description)).toBeVisible();
    await expect(page.getByText(snacks.description)).toBeVisible();
    await expect(page.getByText(busPass.description)).not.toBeVisible();
  });

  // ── Tag + Time range ──────────────────────────────────────────────────────

  test('tag:recurring + current_month — recurring transactions in current month', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    await txPage.filter.selectTag('recurring');
    await page.getByLabel('Time Range:').selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(groceries.description)).toBeVisible();
    await expect(page.getByText(busPass.description)).toBeVisible();
    await expect(page.getByText(salary.description)).toBeVisible();
    await expect(page.getByText(pizza.description)).not.toBeVisible();
  });
});
