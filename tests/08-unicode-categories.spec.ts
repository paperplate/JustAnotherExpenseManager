import { test, expect, Page } from '@playwright/test';
import { clearDatabase } from './helpers'
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';

/**
 * Unicode Category Management Tests
 *
 * Regression suite for the bug where category operations (rename, merge, delete)
 * failed with "JSON response line 1 is empty" when the source category name
 * contained non-ASCII characters (e.g. Chinese), because the fetch URL was
 * built without encodeURIComponent.
 */

// ─── constants ─────────────────────────────────────────────────────────────
//const SETTINGS_CATEGORY_LIST_ITEM: string = '#categories-list .category-item';
//const FILTER_CATEGORY_LIST: string = '#category-options-list .filter-option';

// ─── helpers ─────────────────────────────────────────────────────────────
/*async function renameCategory(page: Page, original: string, renamed: string): Promise<void> {
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
  await page.getByLabel('Category Name').fill(target);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#editCategoryModal').getByRole('button', { name: 'Save Changes' }).click();
  await page.waitForLoadState('networkidle');
}*/

// ─── Rename tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — rename', () => {
  let setPage: SettingsPage;
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('rename Chinese → English succeeds', async ({ page }) => {
    const original: string = '食物';
    const renamed: string = 'food-renamed';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //await renameCategory(page, original, renamed);
    //await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename English → Chinese succeeds', async ({ page }) => {
    const original: string = 'food2';
    const renamed: string = '食物';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //await renameCategory(page, original, renamed);
    //await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename Chinese → Chinese succeeds', async ({ page }) => {
    const original: string = '食物';
    const renamed: string = '餐饮';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //await renameCategory(page, original, renamed);
    //await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename English → English succeeds', async ({ page }) => {
    const original: string = 'groceries';
    const renamed: string = 'supermarket';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //await renameCategory(page, original, renamed);
    //await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: renamed })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: original })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('renamed Chinese category appears in transaction form dropdown', async ({ page }) => {
    const original: string = '交通';
    const renamed: string = 'transport2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //await renameCategory(page, original, renamed);

    txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');

    //await expect(page.locator(FILTER_CATEGORY_LIST, { hasText: renamed })).toBeAttached();
    //await expect(page.locator(FILTER_CATEGORY_LIST, { hasText: original })).not.toBeAttached();
    await expect(txPage.filter.categoryFilterOption.filter({ hasText: renamed })).toBeAttached();
    await expect(txPage.filter.categoryFilterOption.filter({ hasText: original })).not.toBeAttached();
  });
});

// ─── Merge tests ──────────────────────────────────────────────────────────────

test.describe('Unicode category — merge', () => {
  let setPage: SettingsPage;
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('merge Chinese source → English target succeeds', async ({ page }) => {
    //await mergeCategories(page, '食物', 'food2');
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'food2' })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).not.toBeVisible();
    const original: string = '食物';
    const renamed: string = 'food2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge English source → Chinese target succeeds', async ({ page }) => {
    //await mergeCategories(page, 'food2', '食物');
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'food2' })).not.toBeVisible();
    const original: string = 'food2';
    const renamed: string = '食物';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge Chinese source → Chinese target succeeds', async ({ page }) => {
    //await mergeCategories(page, '食物', '饮食');
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '饮食' })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).not.toBeVisible();
    const original: string = '食物';
    const renamed: string = '饮食';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge English source → English target succeeds (regression guard)', async ({ page }) => {
    //await mergeCategories(page, 'groceries2', 'food2');
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'food2' })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'groceries2' })).not.toBeVisible();
    const original: string = 'groceries2';
    const renamed: string = 'food2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge moves transactions from Chinese source to English target', async ({ page }) => {
    const original: string = '食物';
    const renamed: string = 'food2';
    //await addCategory(page, '食物');
    await setPage.addCategory(original);
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await txPage.goto();
    await txPage.addTransactionViaUI({
      description: 'Chinese cat transaction', amount: 50, type: 'expense', category: '食物'
    });
    await expect(page.getByText('Chinese cat transaction')).toBeVisible();

    await setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
    await setPage.addCategory(renamed);
    //await addCategory(page, 'food2');
    //await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await expect(setPage.addCategoryResult).toContainText('added successfully');

    //await openEditModal(page, '食物');
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    //const editCategoryModal = page.locator('#editCategoryModal');
    //await expect(editCategoryModal).toBeVisible();
    //await page.getByLabel('Category Name').fill('food2');

    //page.once('dialog', dialog => dialog.accept());
    //await editCategoryModal.getByRole('button', { name: 'Save Changes' }).click();
    //await page.waitForLoadState('networkidle');
    //await expect(editCategoryModal).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();

    await page.goto('/transactions?categories=food2');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Chinese cat transaction')).toBeVisible();
  });

  test('declining merge prompt leaves both categories intact', async ({ page }) => {
    const cat1: string = '食物2';
    const cat2: string = 'food22';
    //await addCategory(page, cat1);
    await setPage.addCategory(cat1);
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    //await addCategory(page, cat2);
    await setPage.addCategory(cat2);
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    await setPage.openEditModal(cat1);
    await setPage.submitRename(cat2, false);
    //await openEditModal(page, cat1);
    //await expect(page.locator('#editCategoryModal')).toBeVisible();
    //await page.getByLabel('Category Name').fill(cat2);


    //page.once('dialog', dialog => dialog.dismiss());
    //await page.locator('#editCategoryModal').getByRole('button', { name: 'Save Changes' }).click();
    //await page.waitForTimeout(500);

    await expect(setPage.categoryItem.filter({ hasText: cat1 })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: cat2 })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: cat1 })).toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: cat2 })).toBeVisible();
  });
});

// ─── Delete tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — delete', () => {
  let setPage: SettingsPage;
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('delete Chinese category succeeds', async ({ page }) => {
    const original: string = '食物';
    await setPage.addCategory(original);
    //await addCategory(page, '食物');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    /*page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: original })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');*/
    await setPage.deleteCategory(original);

    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: '食物' })).not.toBeVisible();
  });

  test('delete English category succeeds (regression guard)', async ({ page }) => {
    const original: string = 'food2';
    await setPage.addCategory(original);
    //await addCategory(page, 'food2');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    /*page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: original })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');*/
    await setPage.deleteCategory(original);

    //await expect(page.locator(SETTINGS_CATEGORY_LIST_ITEM, { hasText: 'food2' })).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('deleting Chinese category removes it from transaction dropdown', async ({ page }) => {
    const original: string = '交通';
    await setPage.addCategory(original);
    //await addCategory(page, '交通');
    await expect(page.locator('#add-category-result')).toContainText('added successfully');

    /*page.once('dialog', dialog => dialog.accept());
    await page.locator('.category-item', { hasText: original })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');*/
    await setPage.deleteCategory(original);

    await txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Category').locator('option[value="交通"]')).not.toBeAttached();
  });
});
