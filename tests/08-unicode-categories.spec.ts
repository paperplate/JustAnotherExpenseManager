import { test, expect } from './fixtures';
import { clearDatabase } from './helpers'

/**
 * Unicode Category Management Tests
 *
 * Regression suite for the bug where category operations (rename, merge, delete)
 * failed with "JSON response line 1 is empty" when the source category name
 * contained non-ASCII characters (e.g. Chinese), because the fetch URL was
 * built without encodeURIComponent.
 */

// ─── constants ─────────────────────────────────────────────────────────────
const ADD_CAT_RESULT: string = '#add-category-result';

// ─── Rename tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — rename', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    let setPage = settingsPage;
    setPage.goto();
  });

  test('rename Chinese → English succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = '食物';
    const renamed: string = 'food-renamed';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename English → Chinese succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = 'food2';
    const renamed: string = '食物';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename Chinese → Chinese succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = '食物';
    const renamed: string = '餐饮';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('rename English → English succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = 'groceries';
    const renamed: string = 'supermarket';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('renamed Chinese category appears in transaction form dropdown', async ({ settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const original: string = '交通';
    const renamed: string = 'transport2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);

    txPage.goto();
    await expect(txPage.filter.categoryFilterOption.filter({ hasText: renamed })).toBeAttached();
    await expect(txPage.filter.categoryFilterOption.filter({ hasText: original })).not.toBeAttached();
  });
});

// ─── Merge tests ──────────────────────────────────────────────────────────────

test.describe('Unicode category — merge', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    let setPage = settingsPage;
    setPage.goto();
  });

  test('merge Chinese source → English target succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = '食物';
    const renamed: string = 'food2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge English source → Chinese target succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = 'food2';
    const renamed: string = '食物';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge Chinese source → Chinese target succeeds', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = '食物';
    const renamed: string = '饮食';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge English source → English target succeeds (regression guard)', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const original: string = 'groceries2';
    const renamed: string = 'food2';
    await setPage.addCategory(original);
    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('merge moves transactions from Chinese source to English target', async ({ page, settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const original: string = '食物';
    const renamed: string = 'food2';
    await setPage.addCategory(original);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    await txPage.goto();
    await txPage.addTransactionViaUI({
      description: 'Chinese cat transaction', amount: 50, type: 'expense', category: '食物'
    });
    await expect(page.getByText('Chinese cat transaction')).toBeVisible();

    await setPage.goto();
    await setPage.addCategory(renamed);
    await expect(setPage.addCategoryResult).toContainText('added successfully');

    await setPage.openEditModal(original);
    await setPage.submitRename(renamed);
    await expect(setPage.categoryItem.filter({ hasText: renamed })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();

    await page.goto('/transactions?categories=food2');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Chinese cat transaction')).toBeVisible();
  });

  test('declining merge prompt leaves both categories intact', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const cat1: string = '食物2';
    const cat2: string = 'food22';
    await setPage.addCategory(cat1);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');
    await setPage.addCategory(cat2);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    await setPage.openEditModal(cat1);
    await setPage.submitRename(cat2, false);

    await expect(setPage.categoryItem.filter({ hasText: cat1 })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: cat2 })).toBeVisible();
  });
});

// ─── Delete tests ─────────────────────────────────────────────────────────────

test.describe('Unicode category — delete', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    let setPage = settingsPage;
    setPage.goto();
  });

  test('delete Chinese category succeeds', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const original: string = '食物';
    await setPage.addCategory(original);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');
    await setPage.deleteCategory(original);

    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('delete English category succeeds (regression guard)', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const original: string = 'food2';
    await setPage.addCategory(original);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    await setPage.deleteCategory(original);

    await expect(setPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('deleting Chinese category removes it from transaction dropdown', async ({ page, settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const original: string = '交通';
    await setPage.addCategory(original);
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    const deletePromise = page.waitForResponse(res =>
      res.url().includes('/api/categories') && res.request().method() === 'DELETE'
    );

    await setPage.deleteCategory(original);

    await deletePromise;

    await txPage.goto();
    await expect(page.getByLabel('Category').locator('option[value="交通"]')).not.toBeAttached();
  });
});
