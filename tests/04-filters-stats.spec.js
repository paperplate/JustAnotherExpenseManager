const { test, expect } = require('@playwright/test');

/**
 * Filters and Statistics Tests
 * Tests the <details>/<li> filter UI and statistics display.
 *
 * Filter UI facts (post-HTMX refactor):
 *  - Category/tag dropdowns are <details id="category-details"> / <details id="tag-details">
 *  - The trigger is <summary id="category-summary"> / <summary id="tag-summary">
 *  - Each option is an <li class="filter-option"> with onclick; NO checkboxes
 *  - Selected items get class "selected"
 *  - Stats and charts are loaded via plain fetch(), not HTMX
 */

test.describe('Filters and Statistics', () => {
  // Add two transactions (one expense, one income) before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const today = new Date().toISOString().split('T')[0];

    await page.fill('#description', 'Filter Test Expense');
    await page.fill('#amount', '100.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForLoadState('networkidle');

    await page.fill('#description', 'Filter Test Income');
    await page.fill('#amount', '500.00');
    await page.selectOption('#type', 'income');
    await page.fill('#date', today);
    await page.selectOption('#category', 'salary');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForLoadState('networkidle');

    await page.click('text=Summary');
    await page.waitForLoadState('networkidle');
  });

  test('should display summary statistics', async ({ page }) => {
    await expect(page.locator('.summary-card.income')).toBeVisible();
    await expect(page.locator('.summary-card.expense')).toBeVisible();
    await expect(page.locator('.summary-card.net')).toBeVisible();

    await expect(page.locator('.summary-card.income .summary-value')).toContainText('$');
    await expect(page.locator('.summary-card.expense .summary-value')).toContainText('$');
  });

  test('should display charts after page load', async ({ page }) => {
    // Charts are rendered by loadStats() + refreshCharts() on DOMContentLoaded
    await expect(page.locator('#charts-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  test('should filter by time range', async ({ page }) => {
    await page.selectOption('#time-range', '3_months');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.summary-card.income')).toBeVisible();

    await page.selectOption('#time-range', 'current_month');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.summary-card.income')).toBeVisible();
  });

  test('should show custom date range picker when "custom" is selected', async ({ page }) => {
    await page.selectOption('#time-range', 'custom');

    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await expect(page.locator('#start-date')).toBeVisible();
    await expect(page.locator('#end-date')).toBeVisible();
  });

  test('should apply custom date range', async ({ page }) => {
    await page.selectOption('#time-range', 'custom');
    await expect(page.locator('#custom-range-picker')).toBeVisible();

    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 7) + '-01';

    await page.fill('#start-date', firstOfMonth);
    await page.fill('#end-date', today);
    await page.click('button:has-text("Apply")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.summary-card.income')).toBeVisible();
  });

  test('category filter dropdown opens on summary click', async ({ page }) => {
    const details = page.locator('#category-details');
    await expect(details).toBeVisible();

    // Click the <summary> to open the <details>
    await page.click('#category-summary');
    await expect(details).toHaveAttribute('open', '');
  });

  test('category filter options are loaded without category: prefix', async ({ page }) => {
    await page.click('#category-summary');

    // Wait for options to load (they are fetched async)
    await expect(page.locator('#category-options-list .filter-option').first()).toBeVisible({ timeout: 5000 });

    const optionTexts = await page.locator('#category-options-list .filter-option').allTextContents();
    const hasPrefix = optionTexts.some(t => t.trim().startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should filter stats by category', async ({ page }) => {
    await page.click('#category-summary');
    await expect(page.locator('#category-options-list .filter-option').first()).toBeVisible({ timeout: 5000 });

    // Click the "food" option
    const foodOption = page.locator('#category-options-list .filter-option', { hasText: 'Food' });
    await foodOption.click();
    await page.waitForLoadState('networkidle');

    // Summary should update and still be visible
    await expect(page.locator('.summary-card.expense')).toBeVisible();

    // The summary text should now reflect "food" filter
    await expect(page.locator('#category-summary')).toContainText('food');
  });

  test('should select multiple categories and update summary text', async ({ page }) => {
    await page.click('#category-summary');
    await expect(page.locator('#category-options-list .filter-option').first()).toBeVisible({ timeout: 5000 });

    const options = page.locator('#category-options-list .filter-option');
    const count = await options.count();

    if (count >= 2) {
      await options.nth(0).click();
      await options.nth(1).click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#category-summary')).toContainText('categories');
    }
  });

  test('selecting "All Categories" deselects individual categories', async ({ page }) => {
    await page.click('#category-summary');
    await expect(page.locator('#category-options-list .filter-option').first()).toBeVisible({ timeout: 5000 });

    // Select a specific category
    await page.locator('#category-options-list .filter-option').first().click();
    await page.waitForLoadState('networkidle');

    // Now click "All Categories" to reset
    await page.click('#category-summary');
    await page.locator('#category-details .filter-option[data-value=""]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#category-summary')).toContainText('All Categories');
  });

  test('tag filter dropdown opens and shows options', async ({ page }) => {
    // First add a transaction with a tag so there is something to show
    await page.goto('/transactions');
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Tagged');
    await page.fill('#amount', '10.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'other');
    await page.fill('#tags', 'playwrighttest');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForLoadState('networkidle');

    await page.goto('/summary');
    await page.waitForLoadState('networkidle');

    await page.click('#tag-summary');
    await expect(page.locator('#tag-details')).toHaveAttribute('open', '');

    await expect(page.locator('#tag-options-list .filter-option', { hasText: 'playwrighttest' })).toBeVisible({ timeout: 5000 });
  });

  test('filter state is reflected in URL', async ({ page }) => {
    await page.click('#category-summary');
    await expect(page.locator('#category-options-list .filter-option').first()).toBeVisible({ timeout: 5000 });

    await page.locator('#category-options-list .filter-option').first().click();
    await page.waitForLoadState('networkidle');

    // URL should now contain categories= parameter
    expect(page.url()).toContain('categories=');
  });
});
