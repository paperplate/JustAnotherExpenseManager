const { test, expect } = require('@playwright/test');

/**
 * Filter Combination Tests
 * Tests all meaningful combinations of category, tag, and time-range filters
 * on both the Summary and Transactions pages.
 *
 * Data setup (shared via beforeEach):
 *   - 3 food expenses:       Groceries ($120, recurring), Pizza ($40, dining), Snacks ($15, today)
 *   - 1 transport expense:   Bus Pass ($60, commute, recurring)
 *   - 1 salary income:       Salary ($3000, recurring)
 *   - 1 entertainment exp:   Cinema ($30, leisure)
 * All transactions are dated today so time-range filters always include them.
 */

// ─── helpers ────────────────────────────────────────────────────────────────

async function clearDatabase(page) {
    const response = await page.request.post('/api/transactions/clear-all');
    if (!response.ok()) {
        throw new Error(`Failed to clear database: ${response.status()} ${await response.text()}`);
    }
}

async function addTransaction(page, { description, amount, type, category, tags = '', date }) {
    await page.fill('#description', description);
    await page.fill('#amount', String(amount));
    await page.selectOption('#type', type);
    await page.fill('#date', date);
    await page.selectOption('#category', category);
    if (tags) await page.fill('#tags', tags);
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForLoadState('networkidle');
    // Reset tags field so it doesn't bleed into the next call
    await page.fill('#tags', '');
}

async function openCategoryFilter(page) {
    const details = page.locator('#category-details');
    if (!(await details.getAttribute('open'))) {
        await page.click('#category-summary');
    }
    await expect(page.locator('#category-options-list .filter-option').first())
        .toBeVisible({ timeout: 5000 });
}

async function openTagFilter(page) {
    const details = page.locator('#tag-details');
    if (!(await details.getAttribute('open'))) {
        await page.click('#tag-summary');
    }
    await expect(page.locator('#tag-options-list .filter-option').first())
        .toBeVisible({ timeout: 5000 });
}

async function selectCategory(page, name) {
    await openCategoryFilter(page);
    await page.locator('#category-options-list .filter-option', { hasText: new RegExp(`^${name}$`, 'i') }).click();
    await page.waitForLoadState('networkidle');
}

async function selectTag(page, name) {
    await openTagFilter(page);
    await page.locator('#tag-options-list .filter-option', { hasText: new RegExp(`^${name}$`, 'i') }).click();
    await page.waitForLoadState('networkidle');
}

async function resetCategoryFilter(page) {
    await openCategoryFilter(page);
    await page.locator('#category-details .filter-option[data-value=""]').click();
    await page.waitForLoadState('networkidle');
}

async function resetTagFilter(page) {
    await openTagFilter(page);
    await page.locator('#tag-details .filter-option[data-value=""]').click();
    await page.waitForLoadState('networkidle');
}

// ─── shared setup ────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

async function seedData(page) {
    await clearDatabase(page);

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    await addTransaction(page, { description: 'Groceries',  amount: 120,  type: 'expense', category: 'food',          tags: 'recurring',         date: TODAY });
    await addTransaction(page, { description: 'Pizza',      amount: 40,   type: 'expense', category: 'food',          tags: 'dining',            date: TODAY });
    await addTransaction(page, { description: 'Snacks',     amount: 15,   type: 'expense', category: 'food',          tags: '',                  date: TODAY });
    await addTransaction(page, { description: 'Bus Pass',   amount: 60,   type: 'expense', category: 'transport',     tags: 'recurring,commute', date: TODAY });
    await addTransaction(page, { description: 'Salary',     amount: 3000, type: 'income',  category: 'salary',        tags: 'recurring',         date: TODAY });
    await addTransaction(page, { description: 'Cinema',     amount: 30,   type: 'expense', category: 'entertainment', tags: 'leisure',           date: TODAY });
}

// ─── Summary page filter combinations ────────────────────────────────────────

test.describe('Summary page — filter combinations', () => {
    test.beforeEach(async ({ page }) => {
        await seedData(page);
        await page.goto('/summary');
        await page.waitForLoadState('networkidle');
    });

    // ── Category only ─────────────────────────────────────────────────────────

    test('category:food — expense total reflects only food transactions', async ({ page }) => {
        await selectCategory(page, 'food');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        // food expenses: 120 + 40 + 15 = $175.00
        expect(expenseValue.trim()).toBe('$175.00');
        // income should be zero (no food income)
        const incomeValue = await page.locator('.summary-card.income .summary-value').textContent();
        expect(incomeValue.trim()).toBe('$0.00');
    });

    test('category:transport — expense total reflects only transport transactions', async ({ page }) => {
        await selectCategory(page, 'transport');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$60.00');
    });

    test('category:salary — income total reflects only salary transactions', async ({ page }) => {
        await selectCategory(page, 'salary');

        const incomeValue = await page.locator('.summary-card.income .summary-value').textContent();
        expect(incomeValue.trim()).toBe('$3000.00');
        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$0.00');
    });

    test('multiple categories — totals are combined', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectCategory(page, 'transport');

        // food ($175) + transport ($60) = $235 expenses
        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$235.00');
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
        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$180.00');
        // recurring income: Salary $3000
        const incomeValue = await page.locator('.summary-card.income .summary-value').textContent();
        expect(incomeValue.trim()).toBe('$3000.00');
    });

    test('tag:recurring — category chart is still visible (regression test)', async ({ page }) => {
        await selectTag(page, 'recurring');

        // This was the bug: tag-only filter caused category chart to disappear
        await expect(page.locator('#charts-container')).toBeVisible();
        await expect(page.locator('#categoryChart')).toBeVisible();
    });

    test('tag:dining — only Pizza shown in expense total', async ({ page }) => {
        await selectTag(page, 'dining');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$40.00');
    });

    test('tag:leisure — only Cinema shown in expense total', async ({ page }) => {
        await selectTag(page, 'leisure');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$30.00');
    });

    test('tag filter URL contains tags= parameter', async ({ page }) => {
        await selectTag(page, 'recurring');
        expect(page.url()).toContain('tags=recurring');
    });

    // ── Category + Tag ────────────────────────────────────────────────────────

    test('category:food + tag:recurring — only Groceries matches both', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectTag(page, 'recurring');

        // Only Groceries is both food AND recurring
        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$120.00');
    });

    test('category:food + tag:dining — only Pizza matches both', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectTag(page, 'dining');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$40.00');
    });

    test('category:transport + tag:recurring — only Bus Pass matches both', async ({ page }) => {
        await selectCategory(page, 'transport');
        await selectTag(page, 'recurring');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$60.00');
    });

    test('category:entertainment + tag:recurring — no overlap, shows $0', async ({ page }) => {
        await selectCategory(page, 'entertainment');
        await selectTag(page, 'recurring');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$0.00');
    });

    test('category + tag — URL contains both parameters', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectTag(page, 'dining');

        expect(page.url()).toContain('categories=food');
        expect(page.url()).toContain('tags=dining');
    });

    // ── Time range only ────────────────────────────────────────────────────────

    test('time range: current_month — includes all seeded transactions', async ({ page }) => {
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        // All transactions are dated today so they fall in current month
        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        // Total expenses: 120 + 40 + 15 + 60 + 30 = $265
        expect(expenseValue.trim()).toBe('$265.00');
    });

    test('time range: custom (today only) — includes all seeded transactions', async ({ page }) => {
        await page.selectOption('#time-range', 'custom');
        await expect(page.locator('#custom-range-picker')).toBeVisible();
        await page.fill('#start-date', TODAY);
        await page.fill('#end-date', TODAY);
        await page.click('button:has-text("Apply")');
        await page.waitForLoadState('networkidle');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$265.00');
    });

    // ── Category + Time range ─────────────────────────────────────────────────

    test('category:food + current_month — food expenses within current month', async ({ page }) => {
        await selectCategory(page, 'food');
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$175.00');
    });

    // ── Tag + Time range ──────────────────────────────────────────────────────

    test('tag:recurring + current_month — recurring within current month', async ({ page }) => {
        await selectTag(page, 'recurring');
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        const expenseValue = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(expenseValue.trim()).toBe('$180.00');
        // Charts must remain visible (regression guard)
        await expect(page.locator('#categoryChart')).toBeVisible();
    });

    // ── Reset behaviour ───────────────────────────────────────────────────────

    test('resetting category to "All" restores unfiltered totals', async ({ page }) => {
        await selectCategory(page, 'food');
        const filteredExpense = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(filteredExpense.trim()).toBe('$175.00');

        await resetCategoryFilter(page);
        const totalExpense = await page.locator('.summary-card.expense .summary-value').textContent();
        // Should now show all expenses: 120+40+15+60+30 = $265
        expect(totalExpense.trim()).toBe('$265.00');
    });

    test('resetting tag to "All Tags" restores unfiltered totals', async ({ page }) => {
        await selectTag(page, 'dining');
        const filteredExpense = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(filteredExpense.trim()).toBe('$40.00');

        await resetTagFilter(page);
        const totalExpense = await page.locator('.summary-card.expense .summary-value').textContent();
        expect(totalExpense.trim()).toBe('$265.00');
    });
});

// ─── Transactions page filter combinations ────────────────────────────────────

test.describe('Transactions page — filter combinations', () => {
    test.beforeEach(async ({ page }) => {
        await seedData(page);
        await page.goto('/transactions');
        await page.waitForLoadState('networkidle');
    });

    // ── Category only ─────────────────────────────────────────────────────────

    test('category:food — shows all three food transactions', async ({ page }) => {
        await selectCategory(page, 'food');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Pizza')).toBeVisible();
        await expect(page.locator('text=Snacks')).toBeVisible();
        await expect(page.locator('text=Bus Pass')).not.toBeVisible();
        await expect(page.locator('text=Salary')).not.toBeVisible();
        await expect(page.locator('text=Cinema')).not.toBeVisible();
    });

    test('category:transport — shows only Bus Pass', async ({ page }) => {
        await selectCategory(page, 'transport');

        await expect(page.locator('text=Bus Pass')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
    });

    test('category:salary — shows only Salary', async ({ page }) => {
        await selectCategory(page, 'salary');

        await expect(page.locator('text=Salary')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
        await expect(page.locator('text=Cinema')).not.toBeVisible();
    });

    test('multiple categories — shows union of matching transactions', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectCategory(page, 'transport');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Pizza')).toBeVisible();
        await expect(page.locator('text=Bus Pass')).toBeVisible();
        await expect(page.locator('text=Salary')).not.toBeVisible();
    });

    // ── Tag only ──────────────────────────────────────────────────────────────

    test('tag:recurring — shows Groceries, Bus Pass, and Salary', async ({ page }) => {
        await selectTag(page, 'recurring');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Bus Pass')).toBeVisible();
        await expect(page.locator('text=Salary')).toBeVisible();
        await expect(page.locator('text=Pizza')).not.toBeVisible();
        await expect(page.locator('text=Cinema')).not.toBeVisible();
    });

    test('tag:dining — shows only Pizza', async ({ page }) => {
        await selectTag(page, 'dining');

        await expect(page.locator('text=Pizza')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
        await expect(page.locator('text=Bus Pass')).not.toBeVisible();
    });

    test('tag:commute — shows only Bus Pass', async ({ page }) => {
        await selectTag(page, 'commute');

        await expect(page.locator('text=Bus Pass')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
    });

    test('tag:leisure — shows only Cinema', async ({ page }) => {
        await selectTag(page, 'leisure');

        await expect(page.locator('text=Cinema')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
    });

    // ── Category + Tag ────────────────────────────────────────────────────────

    test('category:food + tag:recurring — only Groceries matches both', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectTag(page, 'recurring');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Pizza')).not.toBeVisible();
        await expect(page.locator('text=Snacks')).not.toBeVisible();
        await expect(page.locator('text=Bus Pass')).not.toBeVisible();
    });

    test('category:food + tag:dining — only Pizza matches both', async ({ page }) => {
        await selectCategory(page, 'food');
        await selectTag(page, 'dining');

        await expect(page.locator('text=Pizza')).toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
        await expect(page.locator('text=Snacks')).not.toBeVisible();
    });

    test('category:entertainment + tag:recurring — no matches, shows empty state', async ({ page }) => {
        await selectCategory(page, 'entertainment');
        await selectTag(page, 'recurring');

        // No transaction is both entertainment AND recurring
        await expect(page.locator('text=Cinema')).not.toBeVisible();
        await expect(page.locator('text=Groceries')).not.toBeVisible();
        // Should show empty state rather than a broken page
        const listText = await page.locator('#transactions-list').textContent();
        expect(listText.trim().length).toBeGreaterThan(0); // not blank
    });

    // ── Time range only ────────────────────────────────────────────────────────

    test('time range: current_month — all seeded transactions visible', async ({ page }) => {
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Salary')).toBeVisible();
        await expect(page.locator('text=Cinema')).toBeVisible();
    });

    test('time range: custom (yesterday to yesterday) — no seeded transactions', async ({ page }) => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        await page.selectOption('#time-range', 'custom');
        await expect(page.locator('#custom-range-picker')).toBeVisible();
        await page.fill('#start-date', yesterday);
        await page.fill('#end-date', yesterday);
        await page.click('button:has-text("Apply")');
        await page.waitForLoadState('networkidle');

        // All transactions are dated TODAY, none should appear for yesterday
        await expect(page.locator('text=Groceries')).not.toBeVisible();
        await expect(page.locator('text=Salary')).not.toBeVisible();
    });

    // ── Category + Time range ─────────────────────────────────────────────────

    test('category:food + current_month — food transactions in current month', async ({ page }) => {
        await selectCategory(page, 'food');
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Pizza')).toBeVisible();
        await expect(page.locator('text=Snacks')).toBeVisible();
        await expect(page.locator('text=Bus Pass')).not.toBeVisible();
    });

    // ── Tag + Time range ──────────────────────────────────────────────────────

    test('tag:recurring + current_month — recurring transactions in current month', async ({ page }) => {
        await selectTag(page, 'recurring');
        await page.selectOption('#time-range', 'current_month');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Groceries')).toBeVisible();
        await expect(page.locator('text=Bus Pass')).toBeVisible();
        await expect(page.locator('text=Salary')).toBeVisible();
        await expect(page.locator('text=Pizza')).not.toBeVisible();
    });
});
