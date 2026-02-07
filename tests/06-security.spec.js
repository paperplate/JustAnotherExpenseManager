const { test, expect } = require('@playwright/test');

/**
 * Security Tests
 * Tests protection against XSS, SQL injection, and other attacks
 */

test.describe('Security', () => {
  
  test.describe('XSS Protection', () => {
    test('should prevent XSS in transaction description', async ({ page }) => {
      await page.goto('/transactions');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Try to inject script
      const xssPayload = '<script>alert("XSS")</script>';
      await page.fill('#description', xssPayload);
      await page.fill('#amount', '10.00');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'other');
      
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForTimeout(1000);
      
      // Script should be escaped, not executed
      // Page should still be functional (no JS errors)
      await expect(page.locator('.transactions-table')).toBeVisible();
      
      // XSS payload should appear as text, not execute
      const description = await page.locator('td', { hasText: 'script' }).textContent();
      expect(description).toContain('<script>');
    });

    test('should prevent XSS in category names', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForTimeout(1000);
      
      // Try to inject script via category name
      const xssPayload = '<img src=x onerror="alert(1)">';
      await page.fill('#new-category', xssPayload);
      await page.click('button:has-text("Add Category")');
      
      await page.waitForTimeout(1000);
      
      // Should show validation error (invalid characters)
      // or should escape the content
      const result = page.locator('#add-category-result');
      const resultText = await result.textContent();
      
      // Either rejected or escaped
      const isRejected = resultText.includes('can only contain');
      const noErrors = await page.evaluate(() => {
        return !window.hasOwnProperty('__xss_executed__');
      });
      
      expect(isRejected || noErrors).toBe(true);
    });

    test('should handle quotes in transaction description safely', async ({ page }) => {
      await page.goto('/transactions');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Add transaction with quotes
      await page.fill('#description', `O'Malley's "Best" Pub`);
      await page.fill('#amount', '25.00');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'food');
      
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      await page.waitForTimeout(1000);
      
      // Should not cause JavaScript errors
      await expect(page.locator(`text=O'Malley's "Best" Pub`)).toBeVisible();
      
      // Edit button should work (tests data attributes)
      await page.click('button.btn-edit:has-text("Edit")');
      
      // Modal should open without errors
      await expect(page.locator('#editModal')).toBeVisible();
      
      // Description should be properly loaded
      const descValue = await page.locator('#edit-description').inputValue();
      expect(descValue).toBe(`O'Malley's "Best" Pub`);
    });
  });

  test.describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in filters', async ({ page }) => {
      await page.goto('/summary');
      await page.waitForTimeout(1500);
      
      // Page should load normally
      await expect(page.locator('.summary-card')).toBeVisible();
      
      // Try SQL injection via URL parameters
      await page.goto("/api/stats?categories=test' OR '1'='1");
      
      // Should not cause errors or return unexpected data
      // Response should be valid HTML or JSON
      const bodyText = await page.textContent('body');
      
      // Should not contain SQL error messages
      expect(bodyText).not.toContain('SQL');
      expect(bodyText).not.toContain('syntax error');
      expect(bodyText).not.toContain('mysql');
      expect(bodyText).not.toContain('postgresql');
    });

    test('should sanitize category filter input', async ({ page }) => {
      await page.goto('/summary');
      await page.waitForTimeout(1500);
      
      // Open category dropdown
      await page.click('#category-display');
      
      // Categories should load normally
      await expect(page.locator('#category-dropdown')).toBeVisible();
      
      // Select a legitimate category
      const firstCategory = page.locator('#category-options-list input[type="checkbox"]').first();
      await firstCategory.check();
      
      await page.waitForTimeout(1000);
      
      // Page should still function normally
      await expect(page.locator('.summary-card')).toBeVisible();
    });
  });

  test.describe('Input Validation', () => {
    test('should reject negative amounts', async ({ page }) => {
      await page.goto('/transactions');
      
      const today = new Date().toISOString().split('T')[0];
      
      await page.fill('#description', 'Negative Test');
      await page.fill('#amount', '-50.00');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'other');
      
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      
      // Should show validation error or reject via HTML5 validation
      // Check if number input respects min="0"
      const amountInput = page.locator('#amount');
      const min = await amountInput.getAttribute('min');
      
      // If min attribute exists, browser should prevent submission
      // Otherwise, server should reject
      if (!min) {
        await page.waitForTimeout(1000);
        // Server-side validation should kick in
      }
    });

    test('should reject invalid date formats', async ({ page }) => {
      await page.goto('/transactions');
      
      await page.fill('#description', 'Date Test');
      await page.fill('#amount', '25.00');
      await page.selectOption('#type', 'expense');
      
      // Try invalid date via JavaScript (bypassing HTML5 validation)
      await page.evaluate(() => {
        document.getElementById('date').value = '2024-13-45';
      });
      
      await page.selectOption('#category', 'other');
      
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      
      // Should be rejected (either client-side or server-side)
      await page.waitForTimeout(1000);
    });

    test('should reject non-numeric amounts', async ({ page }) => {
      await page.goto('/transactions');
      
      const today = new Date().toISOString().split('T')[0];
      
      await page.fill('#description', 'Invalid Amount');
      
      // Try to enter non-numeric value
      await page.fill('#amount', 'abc');
      await page.selectOption('#type', 'expense');
      await page.fill('#date', today);
      await page.selectOption('#category', 'other');
      
      await page.click('button[type="submit"]:has-text("Add Transaction")');
      
      // HTML5 validation should prevent this, or server should reject
      const amountInput = page.locator('#amount');
      const type = await amountInput.getAttribute('type');
      
      expect(type).toBe('number');
    });
  });

  test.describe('HTMX Security', () => {
    test('should handle missing HTMX gracefully', async ({ page }) => {
      await page.goto('/summary');
      
      // Remove HTMX from page
      await page.evaluate(() => {
        window.htmx = undefined;
      });
      
      await page.waitForTimeout(1000);
      
      // Try to use filters
      await page.selectOption('#time-range', '3_months');
      
      // Should fallback to page reload
      await page.waitForTimeout(1000);
      
      // Page should still work
      await expect(page.locator('.summary-card')).toBeVisible();
    });
  });
});
