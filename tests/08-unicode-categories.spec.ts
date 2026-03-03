import { test, expect } from '@playwright/test';
import { addTransaction, clearDatabase, addCategory, openEditModal, submitRename } from './helpers'

/**
 * Unicode Category Management Tests
 *
 * Regression suite for the bug where category operations (rename, merge, delete)
 * failed with "JSON response line 1 is empty" when the source category name
 * contained non-ASCII characters (e.g. Chinese), because the fetch URL was
 * built without encodeURIComponent.
 *
 * Covers every combination that can appear in the URL path segment:
 *
 *   Rename:
 *     - Chinese  → English   (was broken)
 *     - English  → Chinese
 *     - Chinese  → Chinese
 *     - English  → English   (regression guard)
 *
 *   Merge (rename into existing category triggers 409 → merge flow):
 *     - Chinese source → English target  (was broken)
 *     - English source → Chinese target
 *     - Chinese source → Chinese target
 *     - English source → English target  (regression guard)
 *
 *   Delete:
 *     - Chinese category
 *     - English category    (regression guard)
 */

// ─── Rename tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — rename', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('rename Chinese → English succeeds', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await submitRename(page, 'food-renamed');

    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'food-renamed' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).not.toBeVisible();
  });

  test('rename English → Chinese succeeds', async ({ page }) => {
    await addCategory(page, 'food');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, 'food');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await submitRename(page, '食物');

    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'food' })).not.toBeVisible();
  });

  test('rename Chinese → Chinese succeeds', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await submitRename(page, '餐饮');

    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '餐饮' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).not.toBeVisible();
  });

  test('rename English → English succeeds (regression guard)', async ({ page }) => {
    await addCategory(page, 'groceries');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, 'groceries');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await submitRename(page, 'supermarket');

    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'supermarket' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'groceries' })).not.toBeVisible();
  });

  test('renamed Chinese category appears in transaction form dropdown', async ({ page }) => {
    await addCategory(page, '交通');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '交通');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await submitRename(page, 'transport');

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const option = page.locator('#category option[value="transport"]');
    await expect(option).toBeAttached();
    await expect(page.locator('#category option[value="交通"]')).not.toBeAttached();
  });
});

// ─── Merge tests ──────────────────────────────────────────────────────────────

test.describe('Unicode category — merge', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('merge Chinese source → English target succeeds', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    // Rename '食物' to 'food' — conflicts, prompting merge
    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', 'food2');

    page.once('dialog', dialog => dialog.accept());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: 'food2' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).not.toBeVisible();
  });

  test('merge English source → Chinese target succeeds', async ({ page }) => {
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    // Rename 'food' to '食物' — conflicts, prompting merge
    await openEditModal(page, 'food2');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', '食物');

    page.once('dialog', dialog => dialog.accept());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'food2' })).not.toBeVisible();
  });

  test('merge Chinese source → Chinese target succeeds', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, '饮食');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', '饮食');

    page.once('dialog', dialog => dialog.accept());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: '饮食' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).not.toBeVisible();
  });

  test('merge English source → English target succeeds (regression guard)', async ({ page }) => {
    await addCategory(page, 'groceries2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, 'groceries2');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', 'food2');

    page.once('dialog', dialog => dialog.accept());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: 'food2' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'groceries2' })).not.toBeVisible();
  });

  test('merge moves transactions from Chinese source to English target', async ({ page }) => {
    // Create a transaction under the Chinese category
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    await addTransaction(page, {
      description: 'Chinese cat transaction',
      amount: 50,
      type: 'expense',
      category: '食物'
    });

    // Now add the target English category and merge
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', 'food2');

    page.once('dialog', dialog => dialog.accept());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    // Verify the transaction is now visible under 'food' filter
    await page.goto('/transactions?categories=food2');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Chinese cat transaction')).toBeVisible();
  });

  test('declining merge prompt leaves both categories intact', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, '食物');
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', 'food2');

    // Dismiss the merge confirmation dialog
    page.once('dialog', dialog => dialog.dismiss());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForTimeout(500);

    // Both categories should still exist
    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).toBeVisible();
    await expect(page.locator('#categories-list .category-item', { hasText: 'food2' })).toBeVisible();
  });
});

// ─── Delete tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — delete', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('delete Chinese category succeeds', async ({ page }) => {
    await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: '食物' })
      .locator('button:has-text("Delete")')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: '食物' })).not.toBeVisible();
  });

  test('delete English category succeeds (regression guard)', async ({ page }) => {
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: 'food2' })
      .locator('button:has-text("Delete")')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#categories-list .category-item', { hasText: 'food2' })).not.toBeVisible();
  });

  test('deleting Chinese category removes it from transaction dropdown', async ({ page }) => {
    await addCategory(page, '交通');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: '交通' })
      .locator('button:has-text("Delete")')
      .click();
    await page.waitForLoadState('networkidle');

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#category option[value="交通"]')).not.toBeAttached();
  });
});
