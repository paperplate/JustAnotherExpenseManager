const { test, expect } = require('@playwright/test');

/**
 * Mobile Responsiveness Tests
 * Tests mobile viewports and touch interactions
 */

test.describe('Mobile Responsiveness', () => {
  
  test.use({ 
    viewport: { width: 375, height: 667 } // iPhone SE size
  });

  test('should display mobile navigation', async ({ page }) => {
    await page.goto('/');
    
    // Navigation should be visible
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.nav-brand')).toBeVisible();
    
    // Links should be visible
    await expect(page.locator('text=Summary')).toBeVisible();
    await expect(page.locator('text=Transactions')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should handle mobile form layout', async ({ page }) => {
    await page.goto('/transactions');
    
    // Form elements should be visible and usable
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('#date')).toBeVisible();
    await expect(page.locator('#category')).toBeVisible();
    
    // Form should be fillable on mobile
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Mobile Test');
    await page.fill('#amount', '15.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    
    // Submit should work
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('text=Mobile Test')).toBeVisible();
  });

  test('should display mobile-friendly summary cards', async ({ page }) => {
    await page.goto('/summary');
    await page.waitForTimeout(1500);
    
    // Summary cards should stack vertically on mobile
    const summaryGrid = page.locator('.summary-grid');
    await expect(summaryGrid).toBeVisible();
    
    // All three cards should be visible
    await expect(page.locator('.summary-card.income')).toBeVisible();
    await expect(page.locator('.summary-card.expense')).toBeVisible();
    await expect(page.locator('.summary-card.net')).toBeVisible();
  });

  test('should handle mobile dropdown interactions', async ({ page }) => {
    await page.goto('/summary');
    await page.waitForTimeout(1500);
    
    // Tap category dropdown
    await page.click('#category-display');
    
    // Dropdown should open
    await expect(page.locator('#category-dropdown')).toBeVisible();
    
    // Should be able to interact with checkboxes
    const checkbox = page.locator('#category-dropdown input[type="checkbox"]').first();
    await checkbox.click();
    
    // Dropdown should still be functional
    await expect(page.locator('#category-dropdown')).toBeVisible();
  });

  test('should display mobile-friendly charts', async ({ page }) => {
    await page.goto('/summary');
    await page.waitForTimeout(2000);
    
    // Charts should be visible (may stack vertically)
    await expect(page.locator('#categoryChart')).toBeVisible();
    await expect(page.locator('#monthlyChart')).toBeVisible();
    
    // Chart containers should be responsive
    const chartCard = page.locator('.chart-card').first();
    await expect(chartCard).toBeVisible();
  });

  test('should show mobile-optimized transaction list', async ({ page }) => {
    // Add a transaction first
    await page.goto('/transactions');
    
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Mobile Transaction');
    await page.fill('#amount', '20.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    
    await page.waitForTimeout(1000);
    
    // Table should be visible and scrollable if needed
    await expect(page.locator('.transactions-table')).toBeVisible();
    await expect(page.locator('text=Mobile Transaction')).toBeVisible();
    
    // Action buttons should be accessible
    await expect(page.locator('button:has-text("Edit")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Delete")').first()).toBeVisible();
  });

  test('should handle mobile modal dialogs', async ({ page }) => {
    await page.goto('/transactions');
    
    // Add a transaction
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Modal Test');
    await page.fill('#amount', '30.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Open edit modal
    await page.click('button.btn-edit:has-text("Edit")');
    
    // Modal should be visible and usable on mobile
    await expect(page.locator('#editModal')).toBeVisible();
    await expect(page.locator('#edit-description')).toBeVisible();
    
    // Should be able to edit
    await page.fill('#edit-description', 'Mobile Edited');
    
    // Close button should work
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('#editModal')).not.toBeVisible();
  });

  test('should handle tablet viewport', async ({ page }) => {
    // Change to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    
    // Should display properly at tablet size
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.container')).toBeVisible();
    
    // Navigate and check layout
    await page.click('text=Transactions');
    await expect(page.locator('.card')).toBeVisible();
    
    // Form should be usable
    await expect(page.locator('#description')).toBeVisible();
  });
});
