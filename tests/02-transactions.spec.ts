import { test, expect } from '@playwright/test';
import { TransactionsPage } from './pages/TransactionsPage';

/**
 * Transaction CRUD Tests
 * Tests adding, editing, and deleting transactions
 */

test.describe('Transactions UI', () => {
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    txPage = new TransactionsPage(page);
    await txPage.goto();
  });

  test('should add a new expense transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: 'Test Grocery Shopping',
      amount: 45.5,
      type: 'expense',
      category: 'food',
      tags: 'test,automated'
    });

    await expect(page.getByText('Test Grocery Shopping')).toBeVisible();
    await expect(page.getByText('-$45.50')).toBeVisible();
    await expect(page.locator('.type-badge.type-expense')).toContainText('Expense');
  });

  test('should add a new income transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: 'Freelance Payment',
      amount: 1500,
      type: 'income',
      category: 'salary'
    });

    await expect(page.getByText('Freelance Payment')).toBeVisible();
    await expect(page.getByText('+$1500.00')).toBeVisible();
    await expect(page.locator('.type-badge.type-income')).toContainText('Income');
  });

  test('should validate required fields', async ({ page }) => {
    await txPage.addTransactionBtn.click();

    const descriptionInput = page.getByRole('textbox', { name: 'Description' });
    const isInvalid = await descriptionInput.evaluate(el => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should handle transaction with quotes in description', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: "O'Malley's Irish Pub",
      amount: 35.0,
      type: 'expense',
      category: 'food'
    });

    await expect(page.getByText("O'Malley's Irish Pub")).toBeVisible();
  });

  test('should edit a transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: "Original Description",
      amount: 25.0,
      type: 'expense',
      category: 'other'
    });

    await page.getByRole('button', { name: 'Edit' }).first().click();
    //await expect(page.locator('#editModal')).toBeVisible();
    await expect(txPage.editModal).toBeVisible();

    //await page.locator('#editModal').getByLabel('Description').fill('Updated Description');
    //await page.locator('#editModal').getByLabel('Amount ($)').fill('30.00');
    await txPage.editModal.getByLabel('Description').fill('Updated Description');
    await txPage.editModal.getByLabel('Amount ($)').fill('30.00');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(txPage.editModal).not.toBeVisible();
    //await expect(page.locator('#editModal')).not.toBeVisible();
    //await page.waitForLoadState('networkidle');

    await expect(page.getByText('Updated Description')).toBeVisible();
    await expect(page.getByText('-$30.00')).toBeVisible();
  });

  test('should pre-select current category in edit modal', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: "Category Check",
      amount: 20.0,
      type: 'expense',
      category: 'food'
    });

    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(txPage.editModal).toBeVisible();
    //await expect(page.locator('#editModal')).toBeVisible();

    // Category dropdown in modal should pre-select 'food', not show 'category:food'
    const selectedCategory = await txPage.editModal.getByLabel('Category').inputValue();
    //const selectedCategory = await page.locator('#editModal').getByLabel('Category').inputValue();
    expect(selectedCategory).toBe('food');
    expect(selectedCategory).not.toContain('category:');
  });

  test('should delete a transaction', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: "To Be Deleted",
      amount: 10.0,
      type: 'expense',
      category: 'other'
    });

    page.on('dialog', dialog => dialog.accept());

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('To Be Deleted')).not.toBeVisible();
  });

  test('should handle tags correctly', async ({ page }) => {
    await txPage.addTransactionViaUI({
      description: "Tagged Transaction",
      amount: 50.0,
      type: 'expense',
      category: 'shopping',
      tags: 'urgent important, business'
    });

    await expect(page.locator('.tag-badge', { hasText: 'urgent' })).toBeVisible();
    await expect(page.locator('.tag-badge', { hasText: 'important' })).toBeVisible();
    await expect(page.locator('.tag-badge', { hasText: 'business' })).toBeVisible();
  });

  test('category dropdown should not show category: prefix', async ({ page }) => {
    // The add-transaction category select should show clean names
    const options = await page.getByLabel('Category').locator('option').allTextContents();
    const hasPrefix = options.some(o => o.startsWith('category:'));
    expect(hasPrefix).toBe(false);
  });
});
