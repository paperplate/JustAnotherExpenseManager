import { test, expect } from './fixtures';
//import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  TransactionOptions,
  seedTransactionsViaAPI
} from './helpers'

//import { TransactionsPage } from './pages/TransactionsPage';
//import { SummaryPage } from './pages/SummaryPage';

/**
 * Filters and Statistics Tests
 * Tests the <details>/<li> filter UI and statistics display.
 */

test.describe('Filters and Statistics', () => {
  //let txPage: TransactionsPage;
  //let sumPage: SummaryPage;

  test.beforeEach(async ({ page, request, transactionsPage, summaryPage }) => {
    let txPage = transactionsPage;
    let sumPage = summaryPage;
    //txPage = new TransactionsPage(page);
    //sumPage = new SummaryPage(page);
    await txPage.goto();
    await page.waitForLoadState('networkidle');

    await clearDatabase(page);
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

    //for (const t of transactions) {
    //await addTransaction(page, t);
    //}
    await seedTransactionsViaAPI(request, transactions);

    await txPage.scrollToTotals();
    const tableRows = page.getByRole('row');
    await expect(tableRows).toHaveCount(transactions.length + 1); // Add 1 for header row

    await sumPage.goto();
    //await page.getByRole('link', { name: 'Summary' }).click();
    await page.waitForLoadState('networkidle');

  });

  test('should display summary statistics', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await expect(sumPage.incomeCard).toBeVisible();
    await expect(sumPage.expenseCard).toBeVisible();
    await expect(sumPage.netCard).toBeVisible();

    await expect(sumPage.summaryIncomeValue).toContainText('$');
    await expect(sumPage.summaryExpenseValue).toContainText('$');
  });

  test('should display charts after page load', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    // Charts are rendered by loadStats() + refreshCharts() on DOMContentLoaded
    //await expect(page.locator('#charts-container')).toBeVisible({ timeout: 5000 });
    //await expect(page.locator('#categoryChart')).toBeVisible();
    //await expect(page.locator('#monthlyChart')).toBeVisible();
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

  test('category filter dropdown opens on summary click', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await expect(sumPage.filter.categoryDetails).toBeVisible();

    await sumPage.filter.categoryDetails.locator('summary').click();
    await expect(sumPage.filter.categoryDetails).toHaveAttribute('open', '');
  });

  test('category filter options are loaded without category: prefix', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    await sumPage.filter.categoryDetails.locator('summary').click();

    await expect(sumPage.filter.categoryOptionsList.first()).toBeVisible({ timeout: 5000 });

    const optionTexts = await sumPage.filter.categoryOptionsList.allTextContents();
    const hasPrefix = optionTexts.some(t => t.trim().startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should filter stats by category', async ({ page, summaryPage }) => {
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
    async ({ page, transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.goto();
      //await page.goto('/transactions');

      //await selectCategory(page, 'food');
      //await resetCategoryFilter(page);
      await txPage.filter.selectCategory('food');
      await txPage.filter.resetCategoryFilter();

      await expect(txPage.filter.categorySummary).toContainText('All Categories');
      //await expect(page.locator('#category-summary')).toContainText('All Categories');
    });

  test('Summary page selecting "All Categories" deselects individual categories',
    async ({ page, summaryPage }) => {
      let sumPage = summaryPage;
      await sumPage.goto();
      //await page.goto('/summary');
      await sumPage.filter.selectCategory('food');
      //await resetCategoryFilter(page);
      //await selectCategory(page, 'food');
      await sumPage.filter.resetCategoryFilter();

      await expect(sumPage.filter.categorySummary).toContainText('All Categories');
      //await expect(page.locator('#category-summary')).toContainText('All Categories');
    });

  test('tag filter dropdown opens and shows options', async ({ page, transactionsPage, summaryPage }) => {
    let sumPage = summaryPage;
    let txPage = transactionsPage;
    //await page.goto('/transactions');
    //await addTransaction(page, {
    await txPage.goto();
    await txPage.addTransactionViaUI({
      description: 'Tagged',
      amount: 10.0,
      type: 'expense',
      category: 'other',
      tags: 'playwrighttest'
    });

    //await page.goto('/summary');
    await sumPage.goto();
    await page.waitForLoadState('networkidle');

    //await page.locator('#tag-details').locator('summary').click();
    //await expect(page.locator('#tag-details')).toHaveAttribute('open', '');
    await sumPage.filter.tagDetails.locator('summary').click();
    await expect(sumPage.filter.tagDetails).toHaveAttribute('open', '');

    await expect(
      //page.locator('#tag-options-list').filter({ hasText: 'playwrighttest' })
      sumPage.filter.tagFilterOption.filter({ hasText: 'playwrighttest' })
    ).toBeVisible({ timeout: 5000 });
  });

  test('filter state is reflected in URL', async ({ page, summaryPage }) => {
    let sumPage = summaryPage;
    //await page.locator('#category-details').locator('summary').click();
    //await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });
    await sumPage.filter.categoryDetails.locator('summary').click();
    await expect(sumPage.filter.categoryOptionsList.first()).toBeVisible({ timeout: 5000 });

    await sumPage.filter.categoryOptionsList.first().click();
    await page.waitForLoadState('networkidle');

    // URL should now contain categories= parameter
    expect(page.url()).toContain('categories=');
  });
});
