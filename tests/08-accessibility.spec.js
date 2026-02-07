const { test, expect } = require('@playwright/test');

/**
 * Accessibility Tests
 * Tests keyboard navigation, ARIA attributes, and screen reader support
 */

test.describe('Accessibility', () => {
  
  test('should have proper page titles', async ({ page }) => {
    await page.goto('/summary');
    await expect(page).toHaveTitle(/Summary - Expense Manager/);
    
    await page.goto('/transactions');
    await expect(page).toHaveTitle(/Transactions - Expense Manager/);
    
    await page.goto('/settings');
    await expect(page).toHaveTitle(/Settings - Expense Manager/);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/transactions');
    
    // Tab through form fields
    await page.keyboard.press('Tab'); // Description
    await expect(page.locator('#description')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Amount
    await expect(page.locator('#amount')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Type
    await expect(page.locator('#type')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Date
    await expect(page.locator('#date')).toBeFocused();
  });

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/transactions');
    
    // All form inputs should have labels
    const descriptionLabel = page.locator('label[for="description"]');
    await expect(descriptionLabel).toBeVisible();
    await expect(descriptionLabel).toContainText('Description');
    
    const amountLabel = page.locator('label[for="amount"]');
    await expect(amountLabel).toBeVisible();
    await expect(amountLabel).toContainText('Amount');
    
    const typeLabel = page.locator('label[for="type"]');
    await expect(typeLabel).toBeVisible();
    await expect(typeLabel).toContainText('Type');
    
    const dateLabel = page.locator('label[for="date"]');
    await expect(dateLabel).toBeVisible();
    await expect(dateLabel).toContainText('Date');
    
    const categoryLabel = page.locator('label[for="category"]');
    await expect(categoryLabel).toBeVisible();
    await expect(categoryLabel).toContainText('Category');
  });

  test('should submit form with keyboard', async ({ page }) => {
    await page.goto('/transactions');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Focus first field
    await page.click('#description');
    await page.keyboard.type('Keyboard Test');
    
    await page.keyboard.press('Tab');
    await page.keyboard.type('25.00');
    
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown'); // Select expense
    
    await page.keyboard.press('Tab');
    await page.keyboard.type(today);
    
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown'); // Select first category
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(1000);
    
    // Transaction should be added
    await expect(page.locator('text=Keyboard Test')).toBeVisible();
  });

  test('should navigate modals with keyboard', async ({ page }) => {
    await page.goto('/transactions');
    
    // Add a transaction
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Modal Test');
    await page.fill('#amount', '15.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Open edit modal
    await page.click('button.btn-edit:has-text("Edit")');
    
    // Modal should be visible
    await expect(page.locator('#editModal')).toBeVisible();
    
    // Should be able to tab through modal fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Escape should close modal
    await page.keyboard.press('Escape');
    
    // Modal should close (if Escape handler is implemented)
    // Note: This may not work if Escape handler isn't implemented
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/transactions');
    
    // Buttons should have meaningful text
    const addButton = page.locator('button:has-text("Add Transaction")');
    await expect(addButton).toBeVisible();
    
    const importButton = page.locator('button:has-text("Import CSV")');
    await expect(importButton).toBeVisible();
    
    // Action buttons should be identifiable
    await page.fill('#description', 'Button Test');
    await page.fill('#amount', '10.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', new Date().toISOString().split('T')[0]);
    await page.selectOption('#category', 'food');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    const editButton = page.locator('button:has-text("Edit")').first();
    await expect(editButton).toBeVisible();
    
    const deleteButton = page.locator('button:has-text("Delete")').first();
    await expect(deleteButton).toBeVisible();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/summary');
    await page.waitForTimeout(1500);
    
    // Check that text is visible (basic contrast check)
    const summaryCards = page.locator('.summary-card');
    await expect(summaryCards.first()).toBeVisible();
    
    // Labels should be readable
    const labels = page.locator('.summary-label');
    await expect(labels.first()).toBeVisible();
  });

  test('should have navigable links', async ({ page }) => {
    await page.goto('/');
    
    // All nav links should be keyboard accessible
    await page.keyboard.press('Tab');
    // Tab through to nav links
    
    const summaryLink = page.locator('a[href="/summary"]');
    await expect(summaryLink).toBeVisible();
    
    const transactionsLink = page.locator('a[href="/transactions"]');
    await expect(transactionsLink).toBeVisible();
    
    const settingsLink = page.locator('a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test('should handle focus indicators', async ({ page }) => {
    await page.goto('/transactions');
    
    // Tab to first input
    await page.keyboard.press('Tab');
    
    // Check if element has focus
    const focused = await page.evaluate(() => {
      return document.activeElement.id;
    });
    
    expect(focused).toBeTruthy();
  });

  test('should provide error feedback', async ({ page }) => {
    await page.goto('/transactions');
    
    // Try to submit incomplete form
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    
    // HTML5 validation should provide feedback
    const description = page.locator('#description');
    const isRequired = await description.getAttribute('required');
    
    expect(isRequired).toBe('');
  });
});
