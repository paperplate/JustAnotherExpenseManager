const { test, expect } = require('@playwright/test');

/**
 * Filters and Statistics Tests
 * Tests filtering functionality and statistics display
 */

test.describe('Filters and Statistics', () => {
  test.beforeEach(async ({ page }) => {
    // Add some test data first
    await page.goto('/transactions');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add an expense
    await page.fill('#description', 'Test Expense');
    await page.fill('#amount', '100.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(500);
    
    // Add an income
    await page.fill('#description', 'Test Income');
    await page.fill('#amount', '500.00');
    await page.selectOption('#type', 'income');
    await page.fill('#date', today);
    await page.selectOption('#category', 'salary');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(500);
    
    // Navigate to summary page
    await page.click('text=Summary');
  });

  test('should display summary statistics', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(1000);
    
    // Check that summary cards are visible
    await expect(page.locator('.summary-card.income')).toBeVisible();
    await expect(page.locator('.summary-card.expense')).toBeVisible();
    await expect(page.locator('.summary-card.net')).toBeVisible();
    
    // Verify amounts are displayed
    await expect(page.locator('.summary-card.income .summary-value')).toContainText('$');
    await expect(page.locator('.summary-card.expense .summary-value')).toContainText('$');
  });

  test('should display charts', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Check that chart canvases exist
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
  });

  test('should filter by time range', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Select different time ranges
    await page.selectOption('#time-range', '3_months');
    await page.waitForTimeout(1000);
    
    // Stats should update (we can't verify exact values, but check no errors)
    await expect(page.locator('.summary-card.income')).toBeVisible();
    
    // Try current month
    await page.selectOption('#time-range', 'current_month');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('.summary-card.income')).toBeVisible();
  });

  test('should show custom date range picker', async ({ page }) => {
    // Click custom range
    await page.selectOption('#time-range', 'custom');
    
    // Custom range picker should appear
    await expect(page.locator('#custom-range-picker')).toBeVisible();
    await expect(page.locator('#start-date')).toBeVisible();
    await expect(page.locator('#end-date')).toBeVisible();
  });

  test('should filter by category', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Click category dropdown
    await page.click('#category-display');
    
    // Dropdown should open
    await expect(page.locator('#category-dropdown')).toBeVisible();
    
    // Select a category (uncheck "All")
    await page.click('#category-dropdown input[value=""]');
    
    // Check specific category
    await page.click('#category-dropdown input[value="food"]');
    
    // Wait for filter to apply
    await page.waitForTimeout(1500);
    
    // Stats should update
    await expect(page.locator('.summary-card.income')).toBeVisible();
  });

  test('should close dropdowns when clicking outside', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Open category dropdown
    await page.click('#category-display');
    await expect(page.locator('#category-dropdown')).toBeVisible();
    
    // Click outside
    await page.click('h1');
    await page.waitForTimeout(300);
    
    // Dropdown should close
    await expect(page.locator('#category-dropdown')).not.toBeVisible();
  });

  test('should handle multiple category selection', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Open dropdown
    await page.click('#category-display');
    
    // Uncheck "All"
    await page.click('#category-dropdown input[value=""]');
    
    // Select multiple categories
    await page.click('#category-dropdown input[value="food"]');
    await page.click('#category-dropdown input[value="transport"]');
    
    // Display text should update
    await expect(page.locator('#category-selected-text')).toContainText('2 categories');
    
    // Wait for filter to apply
    await page.waitForTimeout(1500);
    
    await expect(page.locator('.summary-card.income')).toBeVisible();
  });
});
