import { test, expect } from '@playwright/test';
import { addTransaction, clearDatabase, openCategoryFilter, openEditModal, parseDollar, scrollToTotals } from './helpers'

// ─── Constants ─────────────────────────────────────────────

const MONTHLY_TOTALS: string = '.monthly-totals';
const TOTAL_INCOME: string = '.total-income-value';
const TOTAL_EXPENSE: string = '.total-expense-value';
const TOTAL_NET: string = '.total-net-value';

// ─── Transactions list rendering ─────────────────────────────────────────────

test.describe('Transactions list rendering', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('empty state is shown when there are no transactions', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.getByRole('table')).not.toBeVisible();
  });

  test('table appears after adding a transaction', async ({ page }) => {
    await addTransaction(page, { description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Coffee')).toBeVisible();
  });

  test('monthly totals bar is visible after adding a transaction', async ({ page }) => {
    await addTransaction(page, { description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
    await expect(page.locator(MONTHLY_TOTALS)).toBeVisible();
  });

  test('table disappears and empty state returns after deleting the last transaction', async ({ page }) => {
    await addTransaction(page, { description: 'Solo', amount: 10, type: 'expense', category: 'other' });
    await expect(page.getByRole('table')).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('table')).not.toBeVisible();
    await expect(page.locator('.empty-state')).toBeVisible();
  });
});

// ─── Monthly totals — expense only ───────────────────────────────────────────

test.describe('Monthly totals — expense only', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('single expense: income=$0, expense=amount, net negative', async ({ page }) => {
    await addTransaction(page, { description: 'Lunch', amount: 25, type: 'expense', category: 'food' });

    const income = parseDollar(await page.locator(TOTAL_INCOME).textContent());
    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    const net = parseDollar(await page.locator(TOTAL_NET).textContent());

    expect(income).toBeCloseTo(0, 2);
    expect(expense).toBeCloseTo(25, 2);
    expect(net).toBeCloseTo(-25, 2);
  });

  test('multiple expenses: totals are summed correctly', async ({ page }) => {
    await addTransaction(page, { description: 'Coffee', amount: 5.50, type: 'expense', category: 'food' });
    await addTransaction(page, { description: 'Bus', amount: 2.75, type: 'expense', category: 'transport' });
    await addTransaction(page, { description: 'Book', amount: 12.00, type: 'expense', category: 'shopping' });

    await scrollToTotals(page);

    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    const net = parseDollar(await page.locator(TOTAL_NET).textContent());

    expect(expense).toBeCloseTo(20.25, 2);
    expect(net).toBeCloseTo(-20.25, 2);
  });
});

// ─── Monthly totals — income only ────────────────────────────────────────────

test.describe('Monthly totals — income only', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('single income: income=amount, expense=$0, net positive', async ({ page }) => {
    await addTransaction(page, { description: 'Salary', amount: 3000, type: 'income', category: 'salary' });

    await scrollToTotals(page);

    const income = parseDollar(await page.locator(TOTAL_INCOME).textContent());
    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    const net = parseDollar(await page.locator(TOTAL_NET).textContent());

    expect(income).toBeCloseTo(3000, 2);
    expect(expense).toBeCloseTo(0, 2);
    expect(net).toBeCloseTo(3000, 2);
  });
});

// ─── Monthly totals — mixed income and expenses ───────────────────────────────

test.describe('Monthly totals — mixed', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('income and expenses: all three totals are non-zero and correct', async ({ page }) => {
    await addTransaction(page, { description: 'Salary', amount: 2000, type: 'income', category: 'salary' });
    await addTransaction(page, { description: 'Rent', amount: 800, type: 'expense', category: 'other' });
    await addTransaction(page, { description: 'Groceries', amount: 150, type: 'expense', category: 'food' });

    await scrollToTotals(page);

    const income = parseDollar(await page.locator(TOTAL_INCOME).textContent());
    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    const net = parseDollar(await page.locator(TOTAL_NET).textContent());

    expect(income).toBeCloseTo(2000, 2);
    expect(expense).toBeCloseTo(950, 2);
    expect(net).toBeCloseTo(1050, 2);
  });

  test('totals are never $0.00 when transactions exist (regression)', async ({ page }) => {
    await addTransaction(page, { description: 'Freelance', amount: 500, type: 'income', category: 'salary' });
    await addTransaction(page, { description: 'Taxi', amount: 35, type: 'expense', category: 'transport' });

    await scrollToTotals(page);

    const income = parseDollar(await page.locator(TOTAL_INCOME).textContent());
    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());

    expect(income).toBeGreaterThan(0);
    expect(expense).toBeGreaterThan(0);
  });

  test('net = income - expense (mathematical identity)', async ({ page }) => {
    await addTransaction(page, { description: 'Bonus', amount: 1250.50, type: 'income', category: 'salary' });
    await addTransaction(page, { description: 'Heating', amount: 320.75, type: 'expense', category: 'utilities' });

    const income = parseDollar(await page.locator(TOTAL_INCOME).textContent());
    const expense = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    const net = parseDollar(await page.locator(TOTAL_NET).textContent());

    expect(net).toBeCloseTo(income - expense, 1);
  });
});

// ─── Totals update after mutations ───────────────────────────────────────────

test.describe('Monthly totals update after mutations', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('totals update correctly after adding a second transaction', async ({ page }) => {
    await addTransaction(page, { description: 'First', amount: 100, type: 'expense', category: 'food' });

    const expenseBefore = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    await addTransaction(page, { description: 'Second', amount: 50, type: 'expense', category: 'food' });

    await scrollToTotals(page);

    const expenseAfter = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseAfter).toBeCloseTo(150, 2);
  });

  test('totals update correctly after editing a transaction amount', async ({ page }) => {
    await addTransaction(page, { description: 'Editable', amount: 100, type: 'expense', category: 'food' });

    await scrollToTotals(page);

    const expenseBefore = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    const row = page.getByRole('row', { name: 'Editable' });
    await row.getByRole('button', { name: 'Edit' }).click();
    const editModal = page.locator('#editModal');
    await expect(editModal).toBeVisible();
    await editModal.getByLabel('Amount ($)').fill('200');
    // Scope to the modal so Playwright scrolls within it rather than
    // trying to scroll the whole page to reach the footer button.
    await editModal.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editModal).not.toBeVisible();
    await page.waitForLoadState('networkidle');

    const expenseAfter = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseAfter).toBeCloseTo(200, 2);
  });

  test('totals update correctly after deleting a transaction', async ({ page }) => {
    await addTransaction(page, { description: 'Keep', amount: 80, type: 'expense', category: 'food' });
    await addTransaction(page, { description: 'DeleteMe', amount: 20, type: 'expense', category: 'food' });

    const expenseBefore = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    page.once('dialog', dialog => dialog.accept());
    const row = page.getByRole('row', { name: 'DeleteMe' });
    await row.getByRole('button', { name: 'Delete' }).click();
    //await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForLoadState('networkidle');

    await scrollToTotals(page);

    const expenseAfter = parseDollar(await page.locator(TOTAL_EXPENSE).textContent());
    expect(expenseAfter).toBeLessThan(100);
    expect(expenseAfter).toBeGreaterThan(0);
  });
});

// ─── Transaction count ────────────────────────────────────────────────────────

test.describe('Monthly transaction count', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('transaction count matches the number of rows in the table', async ({ page }) => {
    await addTransaction(page, { description: 'A', amount: 10, type: 'expense', category: 'food' });
    await addTransaction(page, { description: 'B', amount: 20, type: 'expense', category: 'food' });
    await addTransaction(page, { description: 'C', amount: 30, type: 'income', category: 'salary' });

    await scrollToTotals(page);

    //const rows = await page.getByRole('table').locator('tbody tr').count();
    const rows = await page.getByRole('row').count();
    expect(rows).toEqual(3);
  });
});
