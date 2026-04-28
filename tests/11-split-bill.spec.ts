/**
 * Split Bill Feature Tests
 *
 * Covers:
 *   - Component rendering on summary and transactions pages
 *   - Adding / removing people
 *   - Even split calculation
 *   - Manual percentage adjustment + rebalancing
 *   - Lock toggle
 *   - Remainder row display
 *   - Total reflects summary expense card
 *   - Total reflects visible transactions (no selection)
 *   - Total reflects only checked rows (selection mode)
 *   - sessionStorage persistence across filter changes
 *   - Enter key adds person
 */

import { test, expect } from './fixtures';
import { clearDatabase, seedTransactionsViaAPI, TODAY, parseDollar, parsePercent } from './helpers';
import { SplitBillComponent } from './pages/SplitBillComponent';

// ── Rendering ─────────────────────────────────────────────────────────────────

test.describe('Split Bill — rendering', () => {
  test('component is visible on summary page', async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await expect(split.root).toBeVisible();
    await expect(split.nameInput).toBeVisible();
    await expect(split.addBtn).toBeVisible();
    await expect(split.evenBtn).toBeVisible();
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
    await expect(split.tbody).toContainText('Add people above');
  });
});

// ── Add / Remove people ───────────────────────────────────────────────────────

test.describe('Split Bill — add and remove people', () => {
  test.beforeEach(async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
  });

  test('adds a person via button click', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await expect(split.row('Alice')).toBeVisible();
  });

  test('adds a person via Enter key', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPersonViaEnter('Bob');
    await expect(split.row('Bob')).toBeVisible();
  });

  test('clears name input after adding', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await expect(split.nameInput).toHaveValue('');
  });

  test('removes a person', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.removeBtn('Alice').click();
    await expect(split.row('Alice')).not.toBeVisible();
    await expect(split.row('Bob')).toBeVisible();
  });

  test('shows empty state after removing all people', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.removeBtn('Alice').click();
    await expect(split.tbody).toContainText('Add people above');
  });

  test('ignores empty name input', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addBtn.click();
    await expect(split.tbody).toContainText('Add people above');
  });
});

// ── Even split ────────────────────────────────────────────────────────────────

test.describe('Split Bill — even split', () => {
  test.beforeEach(async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
  });

  test('two people each get 50%', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.evenBtn.click();

    const alicePct = parsePercent(await split.percentageInput('Alice').inputValue());
    const bobPct = parsePercent(await split.percentageInput('Bob').inputValue());
    expect(alicePct).toBeCloseTo(50, 1);
    expect(bobPct).toBeCloseTo(50, 1);
  });

  test('three people split sums to 100%', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.addPerson('Charlie');

    const pcts = await Promise.all(
      ['Alice', 'Bob', 'Charlie'].map((n) =>
        split.percentageInput(n).inputValue().then(parsePercent)
      )
    );
    const sum = pcts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  test('even split resets manual adjustments', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.setPct('Alice', 70);
    await split.evenBtn.click();

    const alicePct = parsePercent(await split.percentageInput('Alice').inputValue());
    expect(alicePct).toBeCloseTo(50, 1);
  });
});

// ── Manual percentage + rebalancing ──────────────────────────────────────────

test.describe('Split Bill — manual percentage adjustment', () => {
  test.beforeEach(async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
  });

  test('changing one person pct rebalances unlocked others', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.addPerson('Charlie');

    // Set Alice to 50 — Bob and Charlie should share the remaining 50
    await split.setPct('Alice', 50);

    const bobPct = parsePercent(await split.percentageInput('Bob').inputValue());
    const charliePct = parsePercent(await split.percentageInput('Charlie').inputValue());
    expect(bobPct + charliePct).toBeCloseTo(50, 1);
  });

  test('amount cells update when percentage changes', async ({ request, summaryPage }) => {
    await clearDatabase(request);
    await seedTransactionsViaAPI(request, [
      { description: 'Dinner', amount: 100, type: 'expense', category: 'food' },
    ]);
    await summaryPage.goto();
    await summaryPage.scrollToSummary();

    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
    await summaryPage.scrollToSummary();

    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.setPct('Alice', 75);

    const aliceAmount = parseDollar(await split.amountCell('Alice').textContent());
    const bobAmount = parseDollar(await split.amountCell('Bob').textContent());
    expect(aliceAmount).toBeCloseTo(75, 0);
    expect(bobAmount).toBeCloseTo(25, 0);
  });

  test('remainder row shows zero when percentages sum to 100', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.evenBtn.click();

    await expect(split.remainderRow()).not.toHaveClass(/split-remainder-nonzero/);
  });

  test('remainder row highlights when percentages do not sum to 100', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    // Manually set both to 40 — leaves 20% unallocated
    await split.setPct('Alice', 40);
    await split.lockBtn('Alice').click();
    await split.setPct('Bob', 40);
    await split.lockBtn('Bob').click();

    await expect(split.remainderRow()).toHaveClass(/split-remainder-nonzero/);
  });
});

// ── Lock toggle ───────────────────────────────────────────────────────────────

test.describe('Split Bill — lock toggle', () => {
  test.beforeEach(async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
  });

  test('locked person pct does not change when others are adjusted', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');
    await split.addPerson('Charlie');

    // Lock Bob at 20
    await split.setPct('Bob', 20);
    await split.lockBtn('Bob').click();
    await expect(split.lockBtn('Bob')).toHaveClass(/locked/);

    // Now adjust Alice — Bob should stay at 20
    await split.setPct('Alice', 60);

    const bobPct = parsePercent(await split.percentageInput('Bob').inputValue());
    expect(bobPct).toBeCloseTo(20, 1);
  });

  test('unlocking allows person to be rebalanced', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');

    await split.setPct('Alice', 70);
    await split.lockBtn('Alice').click();
    // Unlock
    await split.lockBtn('Alice').click();
    await expect(split.lockBtn('Alice')).not.toHaveClass(/locked/);

    await split.evenBtn.click();
    const alicePct = parsePercent(await split.percentageInput('Alice').inputValue());
    expect(alicePct).toBeCloseTo(50, 1);
  });
});

// ── Total reflects summary expense card ──────────────────────────────────────

test.describe('Split Bill — total from summary page', () => {
  test.beforeEach(async ({ request }) => {
    await clearDatabase(request);
  });

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
    const totalText = await split.totalDisplay.textContent();
    expect(parseDollar(totalText)).toBeCloseTo(950, 0);
  });

  test('total updates when category filter is applied', async ({ request, page, summaryPage }) => {
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
    await page.waitForLoadState('networkidle');

    const totalText = await split.totalDisplay.textContent();
    expect(parseDollar(totalText)).toBeCloseTo(150, 0);
  });
});

// ── Total reflects transactions page ─────────────────────────────────────────

test.describe('Split Bill — total from transactions page', () => {
  test.beforeEach(async ({ request }) => {
    await clearDatabase(request);
  });

  test('total is sum of all visible expense rows (no selection)', async ({
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

    // Only expenses: 5 + 20 = 25
    const totalText = await split.totalDisplay.textContent();
    expect(parseDollar(totalText)).toBeCloseTo(25, 0);
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

    // Enable selection mode
    await page.getByRole('button', { name: /Select for Split/i }).click();
    await expect(page.locator('.split-select-cell').first()).toBeVisible();

    // Check only Coffee ($5) and Lunch ($30)
    const rows = page.locator('tr[data-amount]');
    await rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox').check();
    await rows.filter({ hasText: 'Lunch' }).locator('.split-select-checkbox').check();

    const split = new SplitBillComponent(page);
    const totalText = await split.totalDisplay.textContent();
    expect(parseDollar(totalText)).toBeCloseTo(35, 0);
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

    await page.getByRole('button', { name: /Select for Split/i }).click();

    const rows = page.locator('tr[data-amount]');
    const checkbox = rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox');
    await checkbox.check();

    const split = new SplitBillComponent(page);
    expect(parseDollar(await split.totalDisplay.textContent())).toBeCloseTo(5, 0);

    await checkbox.uncheck();
    expect(parseDollar(await split.totalDisplay.textContent())).toBeCloseTo(35, 0);
  });

  test('disabling selection mode reverts to full visible total', async ({
    request, page, transactionsPage,
  }) => {
    await seedTransactionsViaAPI(request, [
      { description: 'Coffee', amount: 5, type: 'expense', category: 'food' },
      { description: 'Lunch', amount: 30, type: 'expense', category: 'food' },
    ]);

    await transactionsPage.goto();
    await transactionsPage.scrollToTotals();

    const toggleBtn = page.getByRole('button', { name: /Select for Split/i });
    await toggleBtn.click();
    await rows.filter({ hasText: 'Coffee' }).locator('.split-select-checkbox').check();

    const split = new SplitBillComponent(page);
    expect(parseDollar(await split.totalDisplay.textContent())).toBeCloseTo(5, 0);

    // Disable selection — reverts to full total
    await toggleBtn.click();
    expect(parseDollar(await split.totalDisplay.textContent())).toBeCloseTo(35, 0);
  });
});

// ── sessionStorage persistence ────────────────────────────────────────────────

test.describe('Split Bill — sessionStorage persistence', () => {
  test('people persist after navigating away and back', async ({ summaryPage }) => {
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
    await clearDatabase(request);
    await seedTransactionsViaAPI(request, [
      { description: 'Groceries', amount: 120, type: 'expense', category: 'food' },
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
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test.describe('Split Bill — edge cases', () => {
  test.beforeEach(async ({ summaryPage }) => {
    await summaryPage.goto();
    const split = new SplitBillComponent(summaryPage.page);
    await split.clearSessionStorage();
    await summaryPage.page.reload();
  });

  test('single person gets 100%', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    const pct = parsePercent(await split.percentageInput('Alice').inputValue());
    expect(pct).toBeCloseTo(100, 1);
  });

  test('percentage input clamped to 0–100', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.addPerson('Alice');
    await split.addPerson('Bob');

    await split.setPct('Alice', 150);
    const pct = parsePercent(await split.percentageInput('Alice').inputValue());
    expect(pct).toBeLessThanOrEqual(100);
  });

  test('total shows $0.00 on page with no transactions', async ({ request, summaryPage }) => {
    await clearDatabase(request);
    await summaryPage.goto();
    await summaryPage.scrollToSummary();

    const split = new SplitBillComponent(summaryPage.page);
    const totalText = await split.totalDisplay.textContent();
    expect(parseDollar(totalText)).toBeCloseTo(0, 0);
  });

  test('adding a person with only whitespace is ignored', async ({ summaryPage }) => {
    const split = new SplitBillComponent(summaryPage.page);
    await split.nameInput.fill('   ');
    await split.addBtn.click();
    await expect(split.tbody).toContainText('Add people above');
  });
});
