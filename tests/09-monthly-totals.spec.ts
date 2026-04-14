import { test, expect } from '@playwright/test';
import { clearDatabase, parseDollar, seedTransactionsViaAPI } from './helpers'
import { TransactionsPage } from './pages/TransactionsPage';
import { setPriority } from 'os';

// ─── Transactions list rendering ─────────────────────────────────────────────

test.describe('Transactions list rendering', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    txPage.goto();
  });

  test('empty state is shown when there are no transactions', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.getByRole('table')).not.toBeVisible();
  });

  test('table appears after adding a transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
    await expect(txPage.table).toBeVisible();
    await expect(txPage.table.getByText('Coffee')).toBeVisible();
  });

  test('monthly totals bar is visible after adding a transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
    await expect(txPage.monthlyTotals).toBeVisible();
  });

  test('table disappears and empty state returns after deleting the last transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Solo', amount: 10, type: 'expense', category: 'other' });
    await expect(txPage.table).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('table')).not.toBeVisible();
    await expect(page.locator('.empty-state')).toBeVisible();
  });
});

// ─── Monthly totals — expense only ───────────────────────────────────────────

test.describe('Monthly totals — expense only', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    await txPage.goto();
  });

  test('single expense: income=$0, expense=amount, net negative', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Lunch', amount: 25, type: 'expense', category: 'food' });
    const income = parseDollar(await txPage.income.textContent());
    const expense = parseDollar(await txPage.expenses.textContent());
    const net = parseDollar(await txPage.net.textContent());

    expect(income).toBeCloseTo(0, 2);
    expect(expense).toBeCloseTo(25, 2);
    expect(net).toBeCloseTo(-25, 2);
  });

  test('multiple expenses: totals are summed correctly', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Coffee', amount: 5.50, type: 'expense', category: 'food' });
    await txPage.addTransactionViaUI({ description: 'Bus', amount: 2.75, type: 'expense', category: 'transport' });
    await txPage.addTransactionViaUI({ description: 'Book', amount: 12.00, type: 'expense', category: 'shopping' });

    await txPage.scrollToTotals();

    const expense = parseDollar(await txPage.expenses.textContent());
    const net = parseDollar(await txPage.net.textContent());

    expect(expense).toBeCloseTo(20.25, 2);
    expect(net).toBeCloseTo(-20.25, 2);
  });
});

// ─── Monthly totals — income only ────────────────────────────────────────────

test.describe('Monthly totals — income only', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    txPage.goto();
  });

  test('single income: income=amount, expense=$0, net positive', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Salary', amount: 3000, type: 'income', category: 'salary' });

    await txPage.scrollToTotals();

    const income = parseDollar(await txPage.income.textContent());
    const expense = parseDollar(await txPage.expenses.textContent());
    const net = parseDollar(await txPage.net.textContent());

    expect(income).toBeCloseTo(3000, 2);
    expect(expense).toBeCloseTo(0, 2);
    expect(net).toBeCloseTo(3000, 2);
  });
});

// ─── Monthly totals — mixed income and expenses ───────────────────────────────

test.describe('Monthly totals — mixed', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    txPage.goto();
  });

  test('income and expenses: all three totals are non-zero and correct', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'SalaryPay', amount: 2000, type: 'income', category: 'salary' });
    await txPage.addTransactionViaUI({ description: 'Rent', amount: 800, type: 'expense', category: 'other' });
    await txPage.addTransactionViaUI({ description: 'Groceries', amount: 150, type: 'expense', category: 'food' });

    await txPage.scrollToTotals();

    const income = parseDollar(await txPage.income.textContent());
    const expense = parseDollar(await txPage.expenses.textContent());
    const net = parseDollar(await txPage.net.textContent());


    expect(income).toBeCloseTo(2000, 2);
    expect(expense).toBeCloseTo(950, 2);
    expect(net).toBeCloseTo(1050, 2);
  });

  test('totals are never $0.00 when transactions exist (regression)', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Freelance', amount: 500, type: 'income', category: 'salary' });
    await txPage.addTransactionViaUI({ description: 'Taxi', amount: 35, type: 'expense', category: 'transport' });

    await txPage.scrollToTotals();

    const income = parseDollar(await txPage.income.textContent());
    const expense = parseDollar(await txPage.expenses.textContent());

    expect(income).toBeGreaterThan(0);
    expect(expense).toBeGreaterThan(0);
  });

  test('net = income - expense (mathematical identity)', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Bonus', amount: 1250.50, type: 'income', category: 'salary' });
    await txPage.addTransactionViaUI({ description: 'Heating', amount: 320.75, type: 'expense', category: 'utilities' });

    const income = parseDollar(await txPage.income.textContent());
    const expense = parseDollar(await txPage.expenses.textContent());
    const net = parseDollar(await txPage.net.textContent());

    expect(net).toBeCloseTo(income - expense, 1);
  });
});

// ─── Totals update after mutations ───────────────────────────────────────────

test.describe('Monthly totals update after mutations', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    txPage.goto();
  });

  test('totals update correctly after adding a second transaction', async ({ }) => {
    await txPage.addTransactionViaUI({ description: 'First', amount: 100, type: 'expense', category: 'food' });

    const expenseBefore = parseDollar(await txPage.expenses.textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    await txPage.addTransactionViaUI({ description: 'Second', amount: 50, type: 'expense', category: 'food' });

    await txPage.scrollToTotals();

    const expenseAfter = parseDollar(await txPage.expenses.textContent());
    expect(expenseAfter).toBeCloseTo(150, 2);
  });

  test('totals update correctly after editing a transaction amount', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Editable', amount: 100, type: 'expense', category: 'food' });

    await txPage.scrollToTotals();

    const expenseBefore = parseDollar(await txPage.expenses.textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    const row = page.getByRole('row', { name: 'Editable' });
    await row.getByRole('button', { name: 'Edit' }).click();
    const editModal = page.locator('#editModal');
    await expect(editModal).toBeVisible();
    await editModal.getByLabel('Amount ($)').fill('200');
    await editModal.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editModal).not.toBeVisible();
    await page.waitForLoadState('networkidle');

    const expenseAfter = parseDollar(await txPage.expenses.textContent());
    expect(expenseAfter).toBeCloseTo(200, 2);
  });

  test('totals update correctly after deleting a transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'Keep', amount: 80, type: 'expense', category: 'food' });
    await txPage.addTransactionViaUI({ description: 'DeleteMe', amount: 20, type: 'expense', category: 'food' });

    const expenseBefore = parseDollar(await txPage.expenses.textContent());
    expect(expenseBefore).toBeCloseTo(100, 2);

    page.once('dialog', dialog => dialog.accept());
    const row = page.getByRole('row', { name: 'DeleteMe' });
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.waitForLoadState('networkidle');

    await txPage.scrollToTotals();

    const expenseAfter = parseDollar(await txPage.expenses.textContent());
    expect(expenseAfter).toBeLessThan(100);
    expect(expenseAfter).toBeGreaterThan(0);
  });
});

// ─── Transaction count ────────────────────────────────────────────────────────

test.describe('Monthly transaction count', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    txPage.goto();
  });

  test('transaction count matches the number of rows in the table', async ({ page }) => {
    await txPage.addTransactionViaUI({ description: 'A', amount: 10, type: 'expense', category: 'food' });
    await txPage.addTransactionViaUI({ description: 'B', amount: 20, type: 'expense', category: 'food' });
    await txPage.addTransactionViaUI({ description: 'C', amount: 30, type: 'income', category: 'salary' });

    await txPage.scrollToTotals();

    const rows = await page.getByRole('row').count() - 1; // subtract header row
    expect(rows).toEqual(3);
  });
});
