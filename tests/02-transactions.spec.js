const { test, expect } = require('@playwright/test');

/**
 * Transaction CRUD Tests
 * Tests adding, editing, and deleting transactions
 */

test.describe('Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to transactions page before each test
    await page.goto('/transactions');
  });

  test('should add a new expense transaction', async ({ page }) => {
    // Fill in the form
    await page.fill('#description', 'Test Grocery Shopping');
    await page.fill('#amount', '45.50');
    await page.selectOption('#type', 'expense');
    
    // Set date to today
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#date', today);
    
    // Select category
    await page.selectOption('#category', 'food');
    
    // Add tags
    await page.fill('#tags', 'test, automated');
    
    // Submit form
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    
    // Wait for transaction to appear in list
    await page.waitForTimeout(1000);
    
    // Verify transaction appears
    await expect(page.locator('text=Test Grocery Shopping')).toBeVisible();
    await expect(page.locator('text=-$45.50')).toBeVisible();
    await expect(page.locator('.type-badge.type-expense')).toContainText('Expense');
  });

  test('should add a new income transaction', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Fill in income transaction
    await page.fill('#description', 'Freelance Payment');
    await page.fill('#amount', '1500.00');
    await page.selectOption('#type', 'income');
    await page.fill('#date', today);
    await page.selectOption('#category', 'freelance');
    
    // Submit
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Verify
    await expect(page.locator('text=Freelance Payment')).toBeVisible();
    await expect(page.locator('text=+$1500.00')).toBeVisible();
    await expect(page.locator('.type-badge.type-income')).toContainText('Income');
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    
    // Check that native validation triggers
    const descriptionInput = page.locator('#description');
    const isInvalid = await descriptionInput.evaluate(
      el => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test('should handle transaction with quotes in description', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Add transaction with special characters
    await page.fill('#description', "O'Malley's Irish Pub");
    await page.fill('#amount', '35.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'food');
    
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Should not cause JavaScript errors
    await expect(page.locator("text=O'Malley's Irish Pub")).toBeVisible();
  });

  test('should edit a transaction', async ({ page }) => {
    // First add a transaction
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'Original Description');
    await page.fill('#amount', '25.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'other');
    
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Click edit button (find by data attribute or class)
    await page.click('button.btn-edit:has-text("Edit")');
    
    // Wait for modal to appear
    await expect(page.locator('#editModal')).toBeVisible();
    
    // Edit the description
    await page.fill('#edit-description', 'Updated Description');
    await page.fill('#edit-amount', '30.00');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for modal to close
    await expect(page.locator('#editModal')).not.toBeVisible();
    await page.waitForTimeout(1000);
    
    // Verify changes
    await expect(page.locator('text=Updated Description')).toBeVisible();
    await expect(page.locator('text=-$30.00')).toBeVisible();
  });

  test('should delete a transaction', async ({ page }) => {
    // Add a transaction first
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#description', 'To Be Deleted');
    await page.fill('#amount', '10.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'other');
    
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Listen for confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete button
    await page.click('button.btn-delete:has-text("Delete")');
    
    // Wait for deletion
    await page.waitForTimeout(1000);
    
    // Transaction should be gone
    await expect(page.locator('text=To Be Deleted')).not.toBeVisible();
  });

  test('should handle tags correctly', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    await page.fill('#description', 'Tagged Transaction');
    await page.fill('#amount', '50.00');
    await page.selectOption('#type', 'expense');
    await page.fill('#date', today);
    await page.selectOption('#category', 'shopping');
    await page.fill('#tags', 'urgent, important, business');
    
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForTimeout(1000);
    
    // Check that tags appear as badges
    await expect(page.locator('.tag-badge:has-text("urgent")')).toBeVisible();
    await expect(page.locator('.tag-badge:has-text("important")')).toBeVisible();
    await expect(page.locator('.tag-badge:has-text("business")')).toBeVisible();
  });
});
