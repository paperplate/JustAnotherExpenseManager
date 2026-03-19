import { test, expect } from './fixtures';
import { addTransaction } from './helpers'

/**
 * Transaction CRUD Tests
 * Tests adding, editing, and deleting transactions
 */

test.describe('Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    // Wait for the transactions list to finish its initial fetch
    await page.waitForLoadState('networkidle');
  });

  test('should add a new expense transaction', async ({ page }) => {
    await addTransaction(page, {
      description: 'Test Grocery Shopping',
      amount: 45.5,
      type: 'expense',
      category: 'food',
      tags: 'test,automated'
    });

    await expect(page.locator('text=Test Grocery Shopping')).toBeVisible();
    await expect(page.locator('text=-$45.50')).toBeVisible();
    await expect(page.locator('.type-badge.type-expense')).toContainText('Expense');
  });

  test('should add a new income transaction', async ({ page }) => {
    await addTransaction(page, {
      description: 'Freelance Payment',
      amount: 1500,
      type: 'income',
      category: 'salary'
    });

    await expect(page.locator('text=Freelance Payment')).toBeVisible();
    await expect(page.locator('text=+$1500.00')).toBeVisible();
    await expect(page.locator('.type-badge.type-income')).toContainText('Income');
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button[type="submit"]:has-text("Add Transaction")');

    const descriptionInput = page.locator('#description');
    const isInvalid = await descriptionInput.evaluate(el => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should handle transaction with quotes in description', async ({ page }) => {
    await addTransaction(page, {
      description: "O'Malley's Irish Pub",
      amount: 35.0,
      type: 'expense',
      category: 'food'
    });

    await expect(page.locator("text=O'Malley's Irish Pub")).toBeVisible();
  });

  test('should edit a transaction', async ({ page }) => {
    await addTransaction(page, {
      description: "Original Description",
      amount: 25.0,
      type: 'expense',
      category: 'other'
    });

    await page.click('button.btn-edit:has-text("Edit")');
    await expect(page.locator('#editModal')).toBeVisible();

    await page.fill('#edit-description', 'Updated Description');
    await page.fill('#edit-amount', '30.00');

    await page.getByRole('button').filter({ hasText: 'Save Changes' }).click();
    await expect(page.locator('#editModal')).not.toBeVisible();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Updated Description')).toBeVisible();
    await expect(page.locator('text=-$30.00')).toBeVisible();
  });

  test('should pre-select current category in edit modal', async ({ page }) => {
    await addTransaction(page, {
      description: "Category Check",
      amount: 20.0,
      type: 'expense',
      category: 'food'
    });

    await page.click('button.btn-edit:has-text("Edit")');
    await expect(page.locator('#editModal')).toBeVisible();

    // Category dropdown in modal should pre-select 'food', not show 'category:food'
    const selectedCategory = await page.locator('#edit-category').inputValue();
    expect(selectedCategory).toBe('food');
    expect(selectedCategory).not.toContain('category:');
  });

  test('should delete a transaction', async ({ page }) => {
    await addTransaction(page, {
      description: "To Be Deleted",
      amount: 10.0,
      type: 'expense',
      category: 'other'
    });

    page.on('dialog', dialog => dialog.accept());

    await page.click('button.btn-delete:has-text("Delete")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=To Be Deleted')).not.toBeVisible();
  });

  test('should handle tags correctly', async ({ page }) => {
    await addTransaction(page, {
      description: "Tagged Transaction",
      amount: 50.0,
      type: 'expense',
      category: 'shopping',
      tags: 'urgent important, business'
    });

    await expect(page.locator('.tag-badge:has-text("urgent")')).toBeVisible();
    await expect(page.locator('.tag-badge:has-text("important")')).toBeVisible();
    await expect(page.locator('.tag-badge:has-text("business")')).toBeVisible();
  });

  test('category dropdown should not show category: prefix', async ({ page }) => {
    // The add-transaction category select should show clean names
    const options = await page.locator('#category option').allTextContents();
    const hasPrefix = options.some(o => o.startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });
});
