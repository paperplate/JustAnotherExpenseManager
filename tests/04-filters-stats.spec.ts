import { test, expect } from './fixtures';
import { clearDatabase, TransactionOptions } from './helpers'
import { TransactionsPage } from './pages/TransactionsPage';

/**
 * Filters and Statistics Tests
 * Tests the <details>/<li> filter UI and statistics display.
 */

test.describe('Filters and Statistics', () => {
  test.beforeEach(async ({ page, request, transactionsPage, summaryPage }) => {
    let txPage = transactionsPage;
    let sumPage = summaryPage;
    await txPage.goto();
    await page.waitForLoadState('networkidle');

    await clearDatabase(request);
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

    //await seedTransactionsViaAPI(request, transactions);
    for (const t of transactions) {
      await txPage.addTransactionViaUI(t);
    }

    await txPage.scrollToTotals();
    const tableRows = page.getByRole('row');
    await expect(tableRows).toHaveCount(transactions.length + 1); // Add 1 for header row

    await sumPage.goto();
    await page.waitForLoadState('networkidle');

  });

  test('should display summary statistics', async ({ summaryPage }) => {
    let sumPage = summaryPage;
    await expect(sumPage.incomeCard).toBeVisible();
    await expect(sumPage.expenseCard).toBeVisible();
    await expect(sumPage.netCard).toBeVisible();

    await expect(sumPage.summaryIncomeValue).toContainText('$');
    await expect(sumPage.summaryExpenseValue).toContainText('$');
  });

  test('should display charts after page load', async ({ summaryPage }) => {
    let sumPage = summaryPage;
    await expect(sumPage.charts).toBeVisible({ timeout: 5000 });
    await expect(sumPage.categoryChart).toBeVisible();
    await expect(sumPage.monthlyChart).toBeVisible();
  });

  test('should filter by time range', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.timeRange.selectOption('3_months');
    await page.waitForLoadState('networkidle');

    await expect(sumPage.incomeCard).toBeVisible();

    await sumPage.filter.timeRange.selectOption('current_month');
    await page.waitForLoadState('networkidle');

    await expect(sumPage.incomeCard).toBeVisible();
  });

  test('should show custom date range picker when "custom" is selected', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.timeRange.selectOption('custom');

    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await expect(page.getByLabel('Start Date:')).toBeVisible();
    await expect(page.getByLabel('End Date:')).toBeVisible();
  });

  test('should apply custom date range', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.timeRange.selectOption('custom');
    await expect(page.locator('#custom-range-picker')).toBeVisible();

    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 7) + '-01';

    await page.getByLabel('Start Date:').fill(firstOfMonth);
    await page.getByLabel('End Date:').fill(today);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    await expect(sumPage.incomeCard).toBeVisible();
  });

  test('category filter dropdown opens on summary click', async ({ summaryPage }) => {
    let sumPage = summaryPage;
    await expect(sumPage.filter.categoryDetails).toBeVisible();

    await sumPage.filter.categoryDetails.locator('summary').click();
    await expect(sumPage.filter.categoryDetails).toHaveAttribute('open', '');
  });

  test('category filter options are loaded without category: prefix', async ({ summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.categoryDetails.locator('summary').click();

    await expect(sumPage.filter.categoryOptionsList.first()).toBeVisible({ timeout: 5000 });

    const optionTexts = await sumPage.filter.categoryOptionsList.allTextContents();
    const hasPrefix = optionTexts.some(t => t.trim().startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should filter stats by category', async ({ summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.selectCategory('food');

    await expect(sumPage.expenseCard).toBeVisible();
    await expect(sumPage.filter.categorySummary).toContainText('food');
  });

  test('should select multiple categories and update summary text', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.categoryDetails.locator('summary').click();
    await expect(sumPage.filter.categoryOptionsList.first()).toBeVisible({ timeout: 5000 });

    const count = await sumPage.filter.categoryOptionsList.count();

    if (count >= 2) {
      await sumPage.filter.categoryOptionsList.nth(0).click();
      await sumPage.filter.categoryOptionsList.nth(1).click();
      await page.waitForLoadState('networkidle');

      await expect(sumPage.filter.categorySummary).toContainText('categories');
    }
  });

  test('Transactions page selecting "All Categories" deselects individual categories',
    async ({ transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.goto();

      await txPage.filter.selectCategory('food');
      await txPage.filter.resetCategoryFilter();

      await expect(txPage.filter.categorySummary).toContainText('All Categories');
    });

  test('Summary page selecting "All Categories" deselects individual categories',
    async ({ summaryPage }) => {
      let sumPage = summaryPage;
      await sumPage.goto();
      await sumPage.filter.selectCategory('food');
      await sumPage.filter.resetCategoryFilter();

      await expect(sumPage.filter.categorySummary).toContainText('All Categories');
    });

  test('tag filter dropdown opens and shows options', async ({ page, transactionsPage, summaryPage }) => {
    let sumPage = summaryPage;
    let txPage = transactionsPage;
    await txPage.goto();
    txPage = new TransactionsPage(page);
    await txPage.addTransactionViaUI({
      description: 'Tagged',
      amount: 10.0,
      type: 'expense',
      category: 'other',
      tags: 'playwrighttest'
    });

    await sumPage.goto();

    await sumPage.filter.tagDetails.locator('summary').click();
    await expect(sumPage.filter.tagDetails).toHaveAttribute('open', '');

    await expect(
      sumPage.filter.tagFilterOption.filter({ hasText: 'playwrighttest' })
    ).toBeVisible({ timeout: 5000 });
  });

  test('filter state is reflected in URL', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.categoryDetails.locator('summary').click();
    await expect(sumPage.filter.categoryOptionsList.first()).toBeVisible({ timeout: 5000 });

    await sumPage.filter.categoryOptionsList.first().click();
    await page.waitForLoadState('networkidle');

    // URL should now contain categories= parameter
    expect(page.url()).toContain('categories=');
  });
});
