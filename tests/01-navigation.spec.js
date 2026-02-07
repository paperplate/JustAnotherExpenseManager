const { test, expect } = require('@playwright/test');

/**
 * Navigation Tests
 * Tests basic navigation and page loads
 */

test.describe('Navigation', () => {
  test('should load homepage and redirect to summary', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to summary page
    await expect(page).toHaveURL('/summary');
    await expect(page).toHaveTitle(/Summary - Expense Manager/);
    
    // Should show navigation
    await expect(page.locator('.nav-brand')).toContainText('Expense Manager');
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Transactions
    await page.click('text=Transactions');
    await expect(page).toHaveURL('/transactions');
    await expect(page).toHaveTitle(/Transactions - Expense Manager/);
    
    // Navigate to Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle(/Settings - Expense Manager/);
    
    // Navigate back to Summary
    await page.click('text=Summary');
    await expect(page).toHaveURL('/summary');
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/summary');
    
    // Summary link should be active
    const summaryLink = page.locator('a[href="/summary"]');
    await expect(summaryLink).toHaveClass(/active/);
    
    // Navigate to Transactions
    await page.click('text=Transactions');
    
    // Transactions link should now be active
    const transactionsLink = page.locator('a[href="/transactions"]');
    await expect(transactionsLink).toHaveClass(/active/);
  });
});
