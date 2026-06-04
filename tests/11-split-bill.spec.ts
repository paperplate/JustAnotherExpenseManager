/**
 * Split Bill Feature Tests
 *
 * Covers:
 *   - Component rendering on summary and transactions pages
 *   - Adding / removing people (tags)
 *   - Automatic amount splitting based on transaction tags
 *   - Remainder row display for unallocated amounts
 *   - Total reflects summary expense card
 *   - Total reflects visible transactions (no selection)
 *   - Total reflects only checked rows (selection mode)
 *   - sessionStorage persistence across filter changes
 *   - Enter key adds person
 */

import { test, expect } from './fixtures';
import { clearDatabase, seedTransactionsViaAPI, TODAY, parseDollar, parsePercent } from './helpers';
import { SplitBillComponent } from './pages/SplitBillComponent';

test.describe('Split Bill', () => {
  test.beforeEach(async ({ request }) => {
    await clearDatabase(request);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────────

  test('component is visible on summary page', async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await expect(split.root).toBeVisible();
    await expect(split.nameInput).toBeVisible();
    await expect(split.addBtn).toBeVisible();
  });

  test('component is visible on transactions page', async ({ transactionsPage }) => {
    await transactionsPage.goto();
    const split = new SplitBillComponent(transactionsPage.page);
    await expect(split.root).toBeVisible();
    await expect(split.nameInput).toBeVisible();
  });

  test('shows empty state before any people are added', async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
    await expect(split.tbody).toContainText('Add people (tags) above to split the bill based on transaction tags.');
  });

  // ── Add / Remove people ───────────────────────────────────────────────────────

  test('adds a person via button click', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [{ description: 'Tx', amount: 10, type: 'expense', category: 'food', tags: 'Alice' }]);
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addPerson('Alice');
    await expect(split.row('Alice')).toBeVisible();
  });



  test('clears name input after adding', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [{ description: 'Tx', amount: 10, type: 'expense', category: 'food', tags: 'Alice' }]);
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addPerson('Alice');
    await expect(split.nameInput).toHaveValue('');
  });

  test('removes a person', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [{ description: 'Tx', amount: 10, type: 'expense', category: 'food', tags: 'Alice,Bob' }]);
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.removeBtn('Alice').click();
    await expect(split.row('Alice')).not.toBeVisible();
    await expect(split.row('Bob')).toBeVisible();
  });

  test('shows empty state after removing all people', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [{ description: 'Tx', amount: 10, type: 'expense', category: 'food', tags: 'Alice' }]);
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addPerson('Alice');
    await split.removeBtn('Alice').click();
    await expect(split.tbody).toContainText('Add people (tags) above to split the bill based on transaction tags.');
  });

  test('ignores empty name input', async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addBtn.click();
    await expect(split.tbody).toContainText('Add people (tags) above to split the bill based on transaction tags.');
  });

  // ── Automatic Splitting ───────────────────────────────────────────────────────

  test('amount is split automatically based on transaction tags', async ({ request, transactionsPage }) => {
    // 100 on Alice and Bob -> each gets 50
    // 60 on Alice -> Alice gets 60
    await seedTransactionsViaAPI(request, [
      { description: 'Dinner', amount: 100, type: 'expense', category: 'food', tags: 'Alice,Bob' },
      { description: 'Lunch', amount: 60, type: 'expense', category: 'food', tags: 'Alice' },
    ]);
    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const split = new SplitBillComponent(transactionsPage.page);
    await split.clearSessionStorage();
    await transactionsPage.page.reload();
    transactionsPage.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await transactionsPage.scrollToTotals();

    await split.addPerson('Alice');
    await split.addPerson('Bob');

    // Alice: 50 + 60 = 110
    // Bob: 50
    await split.expectAmount('Alice', 110);
    await split.expectAmount('Bob', 50);
  });

  test('remainder row shows unallocated amount', async ({ request, transactionsPage }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Dinner', amount: 100, type: 'expense', category: 'food', tags: 'Alice' },
      { description: 'Lunch', amount: 60, type: 'expense', category: 'food', tags: 'Charlie' }, // Charlie is not added
    ]);
    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const split = new SplitBillComponent(transactionsPage.page);
    await split.clearSessionStorage();
    await transactionsPage.page.reload();
    await transactionsPage.scrollToTotals();

    await split.addPerson('Alice');

    // Total = 160. Alice gets 100. Remainder = 60.
    await expect(split.remainderRow()).toHaveClass(/split-remainder-nonzero/);
    const text = await split.remainderRow().locator('.split-remainder-amount').textContent();
    expect(parseFloat(text?.replace(/[^0-9.-]+/g, '') || '0')).toBeCloseTo(60, 2);
  });

  test('remainder row is not highlighted when all amount is allocated', async ({ request, transactionsPage }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Dinner', amount: 100, type: 'expense', category: 'food', tags: 'Alice,Bob' },
    ]);
    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const split = new SplitBillComponent(transactionsPage.page);
    await split.clearSessionStorage();
    await transactionsPage.page.reload();
    await transactionsPage.scrollToTotals();

    await split.addPerson('Alice');
    await split.addPerson('Bob');

    await expect(split.remainderRow()).not.toHaveClass(/split-remainder-nonzero/);
  });

  // ── Total reflects summary expense card ──────────────────────────────────────

  test('total matches expense card value on summary page', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Rent', amount: 800, type: 'expense', category: 'other' },
      { description: 'Groceries', amount: 150, type: 'expense', category: 'food' },
      { description: 'Salary', amount: 3000, type: 'income', category: 'salary' },
    ]);

    await summaryPage.goto();
    await summaryPage.scrollToSummary();

    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
    await summaryPage.scrollToSummary();

    // expenses = 800 + 150 = 950
    await split.expectTotal(950);
  });

  test('total updates when category filter is applied', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Rent', amount: 800, type: 'expense', category: 'other' },
      { description: 'Groceries', amount: 150, type: 'expense', category: 'food' },
    ]);

    await summaryPage.goto();
    await summaryPage.scrollToSummary();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
    await summaryPage.scrollToSummary();

    await summaryPage.filter.selectCategory('food');
    await split.expectTotal(150);
  });

  // ── Total reflects transactions page ─────────────────────────────────────────

  test('total is sum of all visible expense rows minus income rows (no selection)', async ({
    request, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Bus', amount: 20, type: 'expense', category: 'transport' },
      { description: 'Salary', amount: 500, type: 'income', category: 'salary' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const split = new SplitBillComponent(transactionsPage.page);
    await split.clearSessionStorage();
    await transactionsPage.page.reload();
    await transactionsPage.scrollToTotals();

    // Expenses = 25, Income = 500. Total = 25 - 500 = -475
    await split.expectTotal(-475);
  });

  test('total updates to only checked rows when selection mode active', async ({
    request, page, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Lunch', amount: 30, type: 'expense', category: 'food' },
      { description: 'Dinner', amount: 50, type: 'expense', category: 'food' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    await expect(page.locator('.split-select-cell').first()).toBeVisible();

    // Check only Coffee ($5) and Lunch ($30)
    const rows = page.locator('tr[data-amount]');
    await rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox').check();
    await rows.filter({ hasText: 'Lunch' }).locator('.split-select-checkbox').check();

    await transactionsPage.split.expectTotal(35);
  });

  test('total subtracts checked income rows when selection mode active', async ({
    request, page, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Refund', amount: 2, type: 'income', category: 'other' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const rows = page.locator('tr[data-amount]');
    await rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox').check();
    await rows.filter({ hasText: 'Refund' }).locator('.split-select-checkbox').check();

    await transactionsPage.split.expectTotal(3);
  });

  test('deselecting all rows reverts to full visible total', async ({
    request, page, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Lunch', amount: 30, type: 'expense', category: 'food' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const rows = page.locator('tr[data-amount]');
    const checkbox = rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox');
    await checkbox.check();

    await transactionsPage.split.expectTotal(5);

    await checkbox.uncheck();
    await transactionsPage.split.expectTotal(35);
  });

  test('disabling selection mode reverts to full visible total', async ({
    request, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Lunch', amount: 30, type: 'expense', category: 'food' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    await transactionsPage.split.resetSelection.click();
    await transactionsPage.table.getByRole('row').filter({ hasText: 'Coffee' }).locator('.split-select-checkbox').check();

    await transactionsPage.split.expectTotal(5);

    // Disable selection — reverts to full total
    await transactionsPage.split.resetSelection.click();
    await transactionsPage.split.expectTotal(35);
  });

  // ── sessionStorage persistence ────────────────────────────────────────────────

  test('people persist after navigating away and back', async ({ request, summaryPage }) => {
    await seedTransactionsViaAPI(request, [{ description: 'Tx', amount: 10, type: 'expense', category: 'food', tags: 'Alice,Bob' }]);
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();

    await split.addPerson('Alice');
    await split.addPerson('Bob');

    // Navigate away then back within the same session
    await summaryPage.page.goto('/transactions');
    await summaryPage.page.goto('/summary');
    await summaryPage.scrollToSummary();

    const split2 = new SplitBillComponent(summaryPage.page);
    await expect(split2.row('Alice')).toBeVisible();
    await expect(split2.row('Bob')).toBeVisible();
  });

  test('people persist through filter changes on summary page', async ({
    request, summaryPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Groceries', amount: 120, type: 'expense', category: 'food', tags: 'Alice,Bob' },
    ]);

    await summaryPage.goto();
    await summaryPage.scrollToSummary();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
    await summaryPage.scrollToSummary();

    await split.addPerson('Alice');
    await split.addPerson('Bob');

    await summaryPage.filter.selectCategory('food');
    await summaryPage.page.waitForLoadState('networkidle');

    await expect(split.row('Alice')).toBeVisible();
    await expect(split.row('Bob')).toBeVisible();
  });

  // ── Edge cases ────────────────────────────────────────────────────────────────

  test('total shows $0.00 on page with no transactions', async ({ summaryPage }) => {
    await summaryPage.goto();
    await summaryPage.scrollToSummary();

    const split = new SplitBillComponent(summaryPage.page);
    await split.expectTotal(0);
  });
});
