const { test, expect } = require('@playwright/test');

/**
 * Monthly Totals Regression Tests
 *
 * Guards against the bug where Income, Expenses, and Net in the monthly summary
 * bar always displayed $0.00.
 *
 * Root cause: Jinja2 variables mutated with {% set %} inside a {% for %} loop
 * are scoped to that loop block — the outer-scope variables stay 0.  The fix
 * computes the totals in Python (routes/transactions.py) and passes them as
 * explicit template variables (month_income, month_expense).
 *
 * Also verifies that the transactions list itself is rendered via the
 * transactions_list.html partial on every API response (GET, POST, PUT, DELETE).
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

async function clearDatabase(page) {
    const response = await page.request.post('/api/transactions/clear-all');
    if (!response.ok()) {
        throw new Error(`clear-all failed: ${response.status()} ${await response.text()}`);
    }
}

async function addTransaction(page, { description, amount, type, category, tags = '', date = TODAY }) {
    await page.fill('#description', description);
    await page.fill('#amount', String(amount));
    await page.selectOption('#type', type);
    await page.fill('#date', date);
    // The category <select> is populated asynchronously by loadCategorySelect().
    // Wait for the desired option to appear before selecting it to avoid racing
    // against the fetch('/api/categories') response.
    //await page.waitForSelector(`#category option[value="${category}"]`, { timeout: 5000 });
    //await page.selectOption('#category', category);
    await page.selectOption('[aria-label="category"]', '${category}');
    if (tags) await page.fill('#tags', tags);
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForLoadState('networkidle');
    if (tags) await page.fill('#tags', '');
}

/**
 * Parse a dollar string like "$1,234.56" or "$0.00" to a float.
 */
function parseDollar(text) {
    return parseFloat(text.replace(/[$,]/g, ''));
}

// ─── Transactions list rendering ─────────────────────────────────────────────

test.describe('Transactions list rendering', () => {
    test.beforeEach(async ({ page }) => {
        await clearDatabase(page);
        await page.goto('/transactions');
        await page.waitForLoadState('networkidle');
    });

    test('empty state is shown when there are no transactions', async ({ page }) => {
        await expect(page.locator('.empty-state')).toBeVisible();
        await expect(page.locator('.transactions-table')).not.toBeVisible();
    });

    test('table appears after adding a transaction', async ({ page }) => {
        await addTransaction(page, { description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
        await expect(page.locator('.transactions-table')).toBeVisible();
        await expect(page.locator('text=Coffee')).toBeVisible();
    });

    test('monthly totals bar is visible after adding a transaction', async ({ page }) => {
        await addTransaction(page, { description: 'Coffee', amount: 5, type: 'expense', category: 'food' });
        await expect(page.locator('.monthly-totals')).toBeVisible();
    });

    test('table disappears and empty state returns after deleting the last transaction', async ({ page }) => {
        await addTransaction(page, { description: 'Solo', amount: 10, type: 'expense', category: 'other' });
        await expect(page.locator('.transactions-table')).toBeVisible();

        page.once('dialog', dialog => dialog.accept());
        await page.locator('button.btn-delete').first().click();
        await page.waitForLoadState('networkidle');

        await expect(page.locator('.transactions-table')).not.toBeVisible();
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

        const income = parseDollar(await page.locator('.total-income-value').textContent());
        const expense = parseDollar(await page.locator('.total-expense-value').textContent());
        const net = parseDollar(await page.locator('.total-net-value').textContent());

        expect(income).toBeCloseTo(0, 2);
        expect(expense).toBeCloseTo(25, 2);
        expect(net).toBeCloseTo(-25, 2);
    });

    test('multiple expenses: totals are summed correctly', async ({ page }) => {
        await addTransaction(page, { description: 'Coffee', amount: 5.50, type: 'expense', category: 'food' });
        await addTransaction(page, { description: 'Bus', amount: 2.75, type: 'expense', category: 'transport' });
        await addTransaction(page, { description: 'Book', amount: 12.00, type: 'expense', category: 'shopping' });

        const expense = parseDollar(await page.locator('.total-expense-value').textContent());
        const net = parseDollar(await page.locator('.total-net-value').textContent());

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

        const income = parseDollar(await page.locator('.total-income-value').textContent());
        const expense = parseDollar(await page.locator('.total-expense-value').textContent());
        const net = parseDollar(await page.locator('.total-net-value').textContent());

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
        await addTransaction(page, { description: 'Salary',   amount: 2000, type: 'income',  category: 'salary' });
        await addTransaction(page, { description: 'Rent',     amount: 800,  type: 'expense', category: 'other' });
        await addTransaction(page, { description: 'Groceries', amount: 150, type: 'expense', category: 'food' });

        const income = parseDollar(await page.locator('.total-income-value').textContent());
        const expense = parseDollar(await page.locator('.total-expense-value').textContent());
        const net = parseDollar(await page.locator('.total-net-value').textContent());

        expect(income).toBeCloseTo(2000, 2);
        expect(expense).toBeCloseTo(950, 2);
        expect(net).toBeCloseTo(1050, 2);
    });

    test('totals are never $0.00 when transactions exist (regression)', async ({ page }) => {
        // This is the core regression guard: before the fix every total was $0.00
        await addTransaction(page, { description: 'Freelance', amount: 500, type: 'income',  category: 'salary' });
        await addTransaction(page, { description: 'Taxi',      amount: 35,  type: 'expense', category: 'transport' });

        const income = parseDollar(await page.locator('.total-income-value').textContent());
        const expense = parseDollar(await page.locator('.total-expense-value').textContent());

        expect(income).toBeGreaterThan(0);
        expect(expense).toBeGreaterThan(0);
    });

    test('net = income - expense (mathematical identity)', async ({ page }) => {
        await addTransaction(page, { description: 'Bonus',   amount: 1250.50, type: 'income',  category: 'salary' });
        await addTransaction(page, { description: 'Heating', amount: 320.75,  type: 'expense', category: 'utilities' });

        const income = parseDollar(await page.locator('.total-income-value').textContent());
        const expense = parseDollar(await page.locator('.total-expense-value').textContent());
        const net = parseDollar(await page.locator('.total-net-value').textContent());

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

        const expenseBefore = parseDollar(await page.locator('.total-expense-value').textContent());
        expect(expenseBefore).toBeCloseTo(100, 2);

        await addTransaction(page, { description: 'Second', amount: 50, type: 'expense', category: 'food' });

        const expenseAfter = parseDollar(await page.locator('.total-expense-value').textContent());
        expect(expenseAfter).toBeCloseTo(150, 2);
    });

    test('totals update correctly after editing a transaction amount', async ({ page }) => {
        await addTransaction(page, { description: 'Editable', amount: 100, type: 'expense', category: 'food' });

        const expenseBefore = parseDollar(await page.locator('.total-expense-value').textContent());
        expect(expenseBefore).toBeCloseTo(100, 2);

        // Edit the transaction to change the amount
        await page.click('button.btn-edit:has-text("Edit")');
        await expect(page.locator('#editModal')).toBeVisible();
        await page.fill('#edit-amount', '200');
        await page.click('button:has-text("Save Changes")');
        await expect(page.locator('#editModal')).not.toBeVisible();
        await page.waitForLoadState('networkidle');

        const expenseAfter = parseDollar(await page.locator('.total-expense-value').textContent());
        expect(expenseAfter).toBeCloseTo(200, 2);
    });

    test('totals update correctly after deleting a transaction', async ({ page }) => {
        await addTransaction(page, { description: 'Keep',   amount: 80,  type: 'expense', category: 'food' });
        await addTransaction(page, { description: 'Delete', amount: 20,  type: 'expense', category: 'food' });

        const expenseBefore = parseDollar(await page.locator('.total-expense-value').textContent());
        expect(expenseBefore).toBeCloseTo(100, 2);

        // Delete the second transaction (most recent is listed first, so it's the first row)
        page.once('dialog', dialog => dialog.accept());
        await page.locator('button.btn-delete').first().click();
        await page.waitForLoadState('networkidle');

        const expenseAfter = parseDollar(await page.locator('.total-expense-value').textContent());
        // After deleting either $20 or $80 transaction, total must be less than $100
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
        await addTransaction(page, { description: 'C', amount: 30, type: 'income',  category: 'salary' });

        const rows = await page.locator('.transactions-table tbody tr').count();
        const countText = await page.locator('.monthly-totals').textContent();

        expect(rows).toBe(3);
        expect(countText).toContain('3');
    });
});
