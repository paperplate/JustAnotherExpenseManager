const { test, expect } = require('@playwright/test');

/**
 * Security Tests
 * Tests protection against XSS, SQL injection, and other attacks.
 *
 * Note: the HTMX security section has been removed — HTMX is no longer
 * a dependency. All fetch() calls are plain JS, no eval() of server HTML.
 */

test.describe('Security', () => {
  test.describe('XSS Protection', () => {
    test('should prevent XSS in transaction description', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      const today = new Date().toISOString().split('T')[0];
      const xssPayload = '<script>alert("XSS")</script>';

      await page.fill('#description', xssPayload);
      await page.fill('#amount', '10.00');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'other');

      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForLoadState('networkidle');

      // Table should still be visible (no JS crash)
      await expect(page.locator('.transactions-table')).toBeVisible();

      // The raw tag should appear as escaped text, not execute
      const cell = page.locator('td', { hasText: 'script' });
      const text = await cell.textContent();
      expect(text).toContain('<script>');
    });

    test('should prevent XSS in category names', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const xssPayload = '<img src=x onerror="alert(1)">';
      await page.fill('#new-category', xssPayload);
      await page.click('button:has-text("Add Category")');
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

      await page.fill('#description', `O'Malley's "Best" Pub`);
      await page.fill('#amount', '25.00');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'food');

      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator(`text=O'Malley's "Best" Pub`)).toBeVisible();

      // Edit modal should open without errors and load description correctly
      await page.click('button.btn-edit:has-text("Edit")');
      await expect(page.locator('#editModal')).toBeVisible();

      const descValue = await page.locator('#edit-description').inputValue();
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

      await page.fill('#description', 'Negative Test');
      // Bypass HTML5 number min validation via JS
      await page.evaluate(() => {
        const el = document.getElementById('amount');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '-50.00');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'other');

      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForTimeout(500);

      // Server should reject; no new transaction with -$50.00 should appear
      await expect(page.locator('text=-$-50.00')).not.toBeVisible();
    });

    test('should reject invalid date formats via server', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      await page.fill('#description', 'Date Test');
      await page.fill('#amount', '25.00');
      await page.selectOption('#type', 'expense');

      // Bypass HTML5 date input validation
      await page.evaluate(() => {
        document.getElementById('date').value = '2024-13-45';
      });

      await page.selectOption('#category', 'other');
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForTimeout(500);

      // Either server rejects silently or shows an error;
      // the transaction must not appear with the invalid date
      await expect(page.locator('text=Date Test')).not.toBeVisible();
    });

    test('amount input type should be "number" for browser validation', async ({ page }) => {
      await page.goto('/transactions');

      const type = await page.locator('#amount').getAttribute('type');
      expect(type).toBe('number');
    });

    test('should reject non-numeric amounts via HTML5 validation', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      await page.fill('#description', 'Invalid Amount');
      await page.fill('#amount', 'abc');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', new Date().toISOString().split('T')[0]);
      await page.selectOption('#category', 'other');

      await page.click('button[type="submit"]:has-text("Add Transaction")');

      // HTML5 number input should prevent submission with non-numeric value
      const amountInput = page.locator('#amount');
      const isInvalid = await amountInput.evaluate(el => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });
  });

  test.describe('No HTMX Dependency', () => {
    test('page should function with no HTMX present', async ({ page }) => {
      await page.goto('/summary');

      // Confirm htmx is not defined on the page (we removed it)
      const htmxDefined = await page.evaluate(() => typeof window.htmx !== 'undefined');
      expect(htmxDefined).toBe(false);

      // Stats should still load via plain fetch
      await expect(page.locator('.summary-card.income')).toBeVisible({ timeout: 5000 });
    });

    test('filters should work without HTMX', async ({ page }) => {
      await page.goto('/summary');
      await page.waitForLoadState('networkidle');

      await page.selectOption('#time-range', 'current_month');
      await page.waitForLoadState('networkidle');

      // Stats should update
      await expect(page.locator('.summary-card.income')).toBeVisible();
    });
  });
});
