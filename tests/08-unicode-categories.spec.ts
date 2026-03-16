import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { addTransaction, clearDatabase, addCategory, openEditModal, submitRename, scrollToTotals } from './helpers'

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

// ─── constants ─────────────────────────────────────────────────────────────
const SETTINGS_CATEGORY_LIST_ITEM: string = '#categories-list .category-item';
const FILTER_CATEGORY_LIST: string = '#category-options-list .filter-option';

// ─── helpers ─────────────────────────────────────────────────────────────
async function renameCategory(page: Page, original: string, renamed: string): Promise<void> {
  await addCategory(page, original);
  await expect(page.locator('#add-category-result')).toContainText('added successfully');

  await openEditModal(page, original);
  await expect(page.locator('#editCategoryModal')).toBeVisible();
  await submitRename(page, renamed);
}

async function mergeCategories(page: Page, original: string, target: string): Promise<void> {
  await addCategory(page, original);
  await expect(page.locator('#add-category-result')).toContainText('added successfully');
  await addCategory(page, target);
  await expect(page.locator('#add-category-result')).toContainText('added successfully');

  await openEditModal(page, original);
  await expect(page.locator('#editCategoryModal')).toBeVisible();
  await page.fill('#edit-category-name', target);

  page.once('dialog', dialog => dialog.accept());
  await page.click('#editCategoryModal button:has-text("Save Changes")');
  await page.waitForLoadState('networkidle');
}
// ─── Rename tests ─────────────────────────────────────────────────────────────


test.describe('Unicode category — rename', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('rename Chinese → English succeeds', async ({ page }) => {
    const original: string = '食物';
    const renamed: string = 'food-renamed';
    await renameCategory(page, original, renamed);
    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('rename English → Chinese succeeds', async ({ page }) => {
    const original: string = 'food2';
    const renamed: string = '食物';
    await renameCategory(page, original, renamed);
    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('rename Chinese → Chinese succeeds', async ({ page }) => {
    const original: string = '食物';
    const renamed: string = '餐饮';
    await renameCategory(page, original, renamed);
    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('rename English → English succeeds', async ({ page }) => {
    const original: string = 'groceries';
    const renamed: string = 'supermarket';
    await renameCategory(page, original, renamed);
    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('renamed Chinese category appears in transaction form dropdown', async ({ page }) => {
    const original: string = '交通';
    const renamed: string = 'transport';
    await renameCategory(page, original, renamed);

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await scrollToTotals(page);

    await expect(page.locator(FILTER_CATEGORY_LIST, { hasText: renamed })).toBeAttached();
    await expect(page.locator(FILTER_CATEGORY_LIST, { hasText: original })).not.toBeAttached();
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
    const original: string = '食物';
    const target: string = 'food2';

    await mergeCategories(page, original, target);

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: target })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('merge English source → Chinese target succeeds', async ({ page }) => {
    const original: string = 'food2';
    const target: string = '食物';

    await mergeCategories(page, original, target);

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: target })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('merge Chinese source → Chinese target succeeds', async ({ page }) => {
    const original: string = '食物';
    const target: string = '饮食';

    await mergeCategories(page, original, target);

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: target })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
  });

  test('merge English source → English target succeeds (regression guard)', async ({ page }) => {
    const original: string = 'groceries2';
    const target: string = 'food2';

    await mergeCategories(page, original, target);

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: target })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
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
    await scrollToTotals(page);
    await expect(page.locator('text=Chinese cat transaction')).toBeVisible();
  });

  test('declining merge prompt leaves both categories intact', async ({ page }) => {
    const cat1: string = '食物2';
    const cat2: string = 'food22';
    await addCategory(page, cat1);
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await addCategory(page, cat2);
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await openEditModal(page, cat1);
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    await page.fill('#edit-category-name', cat2);

    // Dismiss the merge confirmation dialog
    page.once('dialog', dialog => dialog.dismiss());
    await page.click('#editCategoryModal button:has-text("Save Changes")');
    await page.waitForTimeout(500);

    // Both categories should still exist
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: cat1 })).toBeVisible();
    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: cat2 })).toBeVisible();
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

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).not.toBeVisible();
  });

  test('delete English category succeeds (regression guard)', async ({ page }) => {
    await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: 'food2' })
      .locator('button:has-text("Delete")')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'food2' })).not.toBeVisible();
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
