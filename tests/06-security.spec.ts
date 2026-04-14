import { test, expect } from './fixtures';
import { seedTransactionsViaAPI, TODAY } from './helpers';

/**
 * Security Tests
 * Tests protection against XSS, SQL injection, and other attacks.
 */

test.describe('Security', () => {
  test.describe('XSS Protection', () => {
    test.beforeEach(async ({ transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.goto();
    });

    test('should prevent XSS in transaction description', async ({ page, request }) => {
      await seedTransactionsViaAPI(request, [{
        description: '<script>alert("XSS")</script>',
        amount: 10,
        type: 'expense',
        category: 'other',
      }]);

      // Table should still be visible (no JS crash)
      await expect(page.getByRole('table')).toBeVisible();

      // The raw tag should appear as escaped text, not execute
      const cell = page.getByRole('cell').filter({ hasText: 'script' });
      const text = await cell.textContent();
      expect(text).toContain('<script>');
    });

    test('should prevent XSS in category names', async ({ settingsPage }) => {
      let setPage = settingsPage;
      await setPage.goto();

      await setPage.addCategory('<img src=x onerror="alert(1)">');

      // Should be rejected by server-side validation (invalid characters)
      await expect(setPage.addCategoryResult).toContainText('can only contain');
    });

    test('should handle quotes in transaction description safely', async ({ page, transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.addTransactionViaUI({
        description: `O'Malley's "Best" Pub`,
        amount: 25,
        type: 'expense',
        category: 'food',
      });

      // Edit modal should open without errors and load description correctly
      await page.getByRole('button', { name: 'Edit' }).first().click();
      await expect(txPage.editModal).toBeVisible();

      const descValue = await txPage.editModal.getByLabel('Description').inputValue();
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
    test.beforeEach(async ({ transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.goto();
    });

    test('should reject negative amounts via server', async ({ page, transactionsPage }) => {
      let txPage = transactionsPage;
      await page.getByRole('textbox', { name: 'Description' }).fill('Negative Test');
      // Bypass HTML5 number min validation via JS — addTransaction cannot do this
      await page.evaluate(() => {
        const el = document.getElementById('amount') as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '-50.00');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await txPage.typeSelect.selectOption('expense');
      await txPage.dateInput.fill(TODAY);
      await txPage.categorySelect.selectOption({ value: 'other' });
      await txPage.addTransactionBtn.click();

      await expect(page.getByText('-$-50.00')).not.toBeVisible();
    });

    test('should reject invalid date formats via server', async ({ page, transactionsPage }) => {
      let txPage = transactionsPage;
      await txPage.descriptionInput.fill('Date Test');
      await txPage.amountInput.fill(String(25.0));
      await txPage.typeSelect.selectOption('expense');
      await txPage.categorySelect.selectOption({ value: 'other' });
      // Bypass HTML5 date input validation via JS — addTransaction cannot do this
      await page.evaluate(() => {
        (document.getElementById('date') as HTMLInputElement).value = '2024-13-45';
      });
      await txPage.addTransactionBtn.click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Date Test')).not.toBeVisible();
    });

    test('amount input type should be "number" for browser validation', async ({ transactionsPage }) => {
      const type = await transactionsPage.amountInput.getAttribute('type');
      expect(type).toBe('number');
    });

    test('should reject non-numeric amounts via HTML5 validation', async ({ transactionsPage }) => {
      let txPage = transactionsPage;
      const isInvalid = await txPage.amountInput.evaluate(el => {
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
