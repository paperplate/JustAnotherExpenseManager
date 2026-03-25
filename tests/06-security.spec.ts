import { test, expect } from '@playwright/test';
import { addTransaction, addCategory, TODAY } from './helpers';

/**
 * Security Tests
 * Tests protection against XSS, SQL injection, and other attacks.
 */

test.describe('Security', () => {
  test.describe('XSS Protection', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
    });

    test('should prevent XSS in transaction description', async ({ page }) => {
      await addTransaction(page, {
        description: '<script>alert("XSS")</script>',
        amount: 10,
        type: 'expense',
        category: 'other',
      });

      // Table should still be visible (no JS crash)
      await expect(page.getByRole('table')).toBeVisible();

      // The raw tag should appear as escaped text, not execute
      const cell = page.getByRole('cell').filter({ hasText: 'script' });
      const text = await cell.textContent();
      expect(text).toContain('<script>');
    });

    test('should prevent XSS in category names', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await addCategory(page, '<img src=x onerror="alert(1)">');

      // Should be rejected by server-side validation (invalid characters)
      await expect(page.locator('#add-category-result')).toContainText('can only contain');
    });

    test('should handle quotes in transaction description safely', async ({ page }) => {
      await addTransaction(page, {
        description: `O'Malley's "Best" Pub`,
        amount: 25,
        type: 'expense',
        category: 'food',
      });

      await expect(page.getByText(`O'Malley's "Best" Pub`)).toBeVisible();

      // Edit modal should open without errors and load description correctly
      await page.getByRole('button', { name: 'Edit' }).first().click();
      await expect(page.locator('#editModal')).toBeVisible();

      const descValue = await page.locator('#editModal').getByLabel('Description').inputValue();
      expect(descValue).toBe(`O'Malley's "Best" Pub`);
    });
  });

  test.describe('SQL Injection Protection', () => {
    test('should handle SQL injection in URL category filter gracefully', async ({ page }) => {
      await page.goto("/api/stats?categories=test' OR '1'='1");

      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('SQL');
      expect(bodyText).not.toContain('syntax error');
      expect(bodyText).not.toContain('OperationalError');
    });

    test('should handle SQL injection in time range filter gracefully', async ({ page }) => {
      const response = await page.goto("/api/stats?range='; DROP TABLE transactions; --");
      expect(response!.status()).toBe(200);
    });
  });

  test.describe('Input Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
    });

    test('should reject negative amounts via server', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Description' }).fill('Negative Test');
      // Bypass HTML5 number min validation via JS — addTransaction cannot do this
      await page.evaluate(() => {
        const el = document.getElementById('amount') as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '-50.00');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.getByRole('combobox', { name: 'Type' }).selectOption('expense');
      await page.getByRole('textbox', { name: 'Date' }).fill(TODAY);
      await page.getByRole('combobox', { name: 'Category' }).selectOption({ value: 'other' });
      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForTimeout(500);

      await expect(page.getByText('-$-50.00')).not.toBeVisible();
    });

    test('should reject invalid date formats via server', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Description' }).fill('Date Test');
      await page.getByRole('spinbutton', { name: 'Amount ($)' }).fill(String(25.0));
      await page.getByRole('combobox', { name: 'Type' }).selectOption('expense');
      // Bypass HTML5 date input validation via JS — addTransaction cannot do this
      await page.evaluate(() => {
        (document.getElementById('date') as HTMLInputElement).value = '2024-13-45';
      });
      await page.getByRole('combobox', { name: 'Category' }).selectOption({ value: 'other' });
      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Date Test')).not.toBeVisible();
    });

    test('amount input type should be "number" for browser validation', async ({ page }) => {
      const type = await page.getByRole('spinbutton', { name: 'Amount ($)' }).getAttribute('type');
      expect(type).toBe('number');
    });

    test('should reject non-numeric amounts via HTML5 validation', async ({ page }) => {
      const isInvalid = await page.getByRole('spinbutton', { name: 'Amount ($)' }).evaluate(el => {
        const input = el as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'abc');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return !input.validity.valid;
      })
      // HTML5 number input should prevent submission with non-numeric value
      expect(isInvalid).toBe(true);
    });
  });
});
