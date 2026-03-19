import { test, expect } from './fixtures';

/**
 * Security Tests
 * Tests protection against XSS, SQL injection, and other attacks.
 *
 */

test.describe('Security', () => {
  test.describe('XSS Protection', () => {
    test('should prevent XSS in transaction description', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      const today = new Date().toISOString().split('T')[0];
      const xssPayload = '<script>alert("XSS")</script>';

      await page.getByLabel('Description').fill(xssPayload);
      await page.getByLabel('Amount ($)').fill('10.00');
      await page.getByLabel('Type').selectOption('expense');
      await page.getByLabel('Date').fill(today);
      await page.getByLabel('Category').selectOption('other');

      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForLoadState('networkidle');

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

      const xssPayload = '<img src=x onerror="alert(1)">';
      await page.getByPlaceholder('Enter category name').fill(xssPayload);
      await page.getByRole('button', { name: 'Add Category' }).click();
      await page.waitForTimeout(500);

      // Should be rejected by server-side validation (invalid characters)
      const result = page.locator('#add-category-result');
      const resultText = await result.textContent();
      expect(resultText).toContain('can only contain');
    });

    test('should handle quotes in transaction description safely', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      const today = new Date().toISOString().split('T')[0];

      await page.getByLabel('Description').fill(`O'Malley's "Best" Pub`);
      await page.getByLabel('Amount ($)').fill('25.00');
      await page.getByLabel('Type').selectOption('expense');
      await page.getByLabel('Date').fill(today);
      await page.getByLabel('Category').selectOption('food');

      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForLoadState('networkidle');

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
      await page.goto("/api/stats?range='; DROP TABLE transactions; --");

      // Should return valid response (empty or filtered, not a crash)
      const response = await page.waitForResponse(resp => resp.url().includes('/api/stats'));
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Input Validation', () => {
    test('should reject negative amounts via server', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      const today = new Date().toISOString().split('T')[0];

      await page.getByLabel('Description').fill('Negative Test');
      // Bypass HTML5 number min validation via JS
      await page.evaluate(() => {
        const el = document.getElementById('amount') as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '-50.00');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.getByLabel('Type').selectOption('expense');
      await page.getByLabel('Date').fill(today);
      await page.getByLabel('Category').selectOption('other');

      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForTimeout(500);

      // Server should reject; no new transaction with -$50.00 should appear
      await expect(page.getByText('-$-50.00')).not.toBeVisible();
    });

    test('should reject invalid date formats via server', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      await page.getByLabel('Description').fill('Date Test');
      await page.getByLabel('Amount ($)').fill('25.00');
      await page.getByLabel('Type').selectOption('expense');

      // Bypass HTML5 date input validation
      await page.evaluate(() => {
        (document.getElementById('date') as HTMLInputElement).value = '2024-13-45';
      });

      await page.getByLabel('Category').selectOption('other');
      await page.getByRole('button', { name: 'Add Transaction' }).click();
      await page.waitForTimeout(500);

      // Either server rejects silently or shows an error;
      // the transaction must not appear with the invalid date
      await expect(page.getByText('Date Test')).not.toBeVisible();
    });

    test('amount input type should be "number" for browser validation', async ({ page }) => {
      await page.goto('/transactions');

      const type = await page.getByLabel('Amount ($)').getAttribute('type');
      expect(type).toBe('number');
    });

    test('should reject non-numeric amounts via HTML5 validation', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      await page.getByLabel('Description').fill('Invalid Amount');
      await page.getByLabel('Amount ($)').fill('abc');
      await page.getByLabel('Type').selectOption('expense');
      await page.getByLabel('Date').fill(new Date().toISOString().split('T')[0]);
      await page.getByLabel('Category').selectOption('other');

      await page.getByRole('button', { name: 'Add Transaction' }).click();

      // HTML5 number input should prevent submission with non-numeric value
      const amountInput = page.getByLabel('Amount ($)');
      const isInvalid = await amountInput.evaluate(el => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });
  });
});
