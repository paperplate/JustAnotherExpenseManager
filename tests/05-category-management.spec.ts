import { test, expect } from './fixtures';
import { clearDatabase } from './helpers';

const TODAY = new Date().toISOString().split('T')[0];

// ── ASCII category management ─────────────────────────────────────────────────

test.describe('Category Management', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.goto();
  });

  test('displays settings page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings');
  });

  test('loads existing categories without category: prefix', async ({ settingsPage }) => {
    await expect(settingsPage.categoriesList).toBeVisible();
    await expect(settingsPage.categoryItem.first()).toBeVisible({ timeout: 5_000 });

    const texts = await settingsPage.categoryItem.allTextContents();
    expect(texts.some(t => t.includes('category:'))).toBe(false);
  });

  test('adds a new category', async ({ settingsPage }) => {
    const name = `testcat${TODAY}`;
    await settingsPage.addCategory(name);
    await expect(settingsPage.addCategoryResult).toContainText('added successfully');
    await expect(settingsPage.categoryItem.filter({ hasText: name })).toBeVisible();
  });

  test('added category shows no category: prefix', async ({ settingsPage }) => {
    const name = `prefixtest${TODAY}`;
    await settingsPage.addCategory(name);
    const item = settingsPage.categoryItem.filter({ hasText: name });
    await expect(item).toBeVisible();
    expect(await item.textContent()).not.toContain('category:');
  });

  test('rejects empty category name', async ({ settingsPage }) => {
    await settingsPage.addCategory('   ');
    await expect(settingsPage.addCategoryResult).toContainText('enter a category name');
  });

  test('rejects duplicate category', async ({ page, settingsPage }) => {
    const name = `duptest${TODAY}`;
    await settingsPage.addCategory(name);
    await settingsPage.addCategory(name);
    await expect(page.getByText('already exists')).toBeVisible();
  });

  test('edits a category — pre-fills bare name (no prefix)', async ({ page, settingsPage }) => {
    const original = `edit${Date.now()}`;
    await settingsPage.addCategory(original);
    await settingsPage.openEditModal(original);
    await expect(settingsPage.editCategoryModal).toBeVisible();

    const prefilled = await page.getByLabel('Category Name').inputValue();
    expect(prefilled).toBe(original);
    expect(prefilled).not.toContain('category:');

    const newName = `edited${Date.now()}`;
    await settingsPage.submitRename(newName, true);

    await expect(settingsPage.editCategoryModal).not.toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: newName })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: original })).not.toBeVisible();
  });

  test('deletes a category', async ({ settingsPage }) => {
    const name = `delete${Date.now()}`;
    await settingsPage.addCategory(name);
    await settingsPage.deleteCategory(name);
    await expect(settingsPage.categoriesList.filter({ hasText: name })).not.toBeAttached();
  });

  test('rejects invalid characters in category name', async ({ settingsPage }) => {
    await settingsPage.addCategory('test@#$%');
    await expect(settingsPage.addCategoryResult).toContainText('can only contain');
  });

  test('rejects category name that is too long', async ({ settingsPage }) => {
    await settingsPage.addCategory('a'.repeat(60));
    await expect(settingsPage.addCategoryResult).toContainText('too long');
  });

  test('edited category appears in transactions category dropdown', async ({ page, settingsPage }) => {
    const name = `dropdtest${Date.now()}`;
    await settingsPage.addCategory(name);
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const option = page.getByLabel('Category').locator(`option[value="${name}"]`);
    await expect(option).toBeAttached();
    expect(await option.textContent()).not.toContain('category:');
  });
});

// ── Unicode category management ───────────────────────────────────────────────
//
// Regression suite for the bug where category operations failed with non-ASCII
// names because names were URL-encoded incorrectly.  All operations now send
// names in the request body instead of the URL path.

const ADD_CAT_RESULT = '#add-category-result';

test.describe('Category Management — Unicode names', () => {
  test.beforeEach(async ({ request, settingsPage }) => {
    await clearDatabase(request);
    await settingsPage.goto();
  });

  // ── Rename ──────────────────────────────────────────────────────────────────

  test('rename Chinese → English succeeds', async ({ settingsPage }) => {
    await settingsPage.addCategory('食物');
    await settingsPage.openEditModal('食物');
    await settingsPage.submitRename('food-renamed');
    await expect(settingsPage.categoryItem.filter({ hasText: 'food-renamed' })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: '食物' })).not.toBeVisible();
  });

  test('rename English → Chinese succeeds', async ({ settingsPage }) => {
    await settingsPage.addCategory('food2');
    await settingsPage.openEditModal('food2');
    await settingsPage.submitRename('食物');
    await expect(settingsPage.categoryItem.filter({ hasText: '食物' })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: 'food2' })).not.toBeVisible();
  });

  test('rename Chinese → Chinese succeeds', async ({ settingsPage }) => {
    await settingsPage.addCategory('食物');
    await settingsPage.openEditModal('食物');
    await settingsPage.submitRename('餐饮');
    await expect(settingsPage.categoryItem.filter({ hasText: '餐饮' })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: '食物' })).not.toBeVisible();
  });

  test('renamed Chinese category appears in transaction form dropdown', async ({ settingsPage, transactionsPage }) => {
    await settingsPage.addCategory('交通');
    await settingsPage.openEditModal('交通');
    await settingsPage.submitRename('transport2');

    await transactionsPage.goto();
    await expect(transactionsPage.filter.categoryFilterOption.filter({ hasText: 'transport2' })).toBeAttached();
    await expect(transactionsPage.filter.categoryFilterOption.filter({ hasText: '交通' })).not.toBeAttached();
  });

  // ── Merge (rename onto existing = conflict → confirm merge) ─────────────────

  test('merge Chinese source → English target succeeds', async ({ settingsPage }) => {
    await settingsPage.addCategory('食物');
    await settingsPage.addCategory('food-target');
    await settingsPage.openEditModal('食物');
    await settingsPage.submitRename('food-target'); // triggers conflict → confirm
    await expect(settingsPage.categoryItem.filter({ hasText: 'food-target' })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: '食物' })).not.toBeVisible();
  });

  test('declining merge leaves both categories intact', async ({ settingsPage }) => {
    await settingsPage.addCategory('食物2');
    await settingsPage.addCategory('food22');

    await settingsPage.openEditModal('食物2');
    await settingsPage.submitRename('food22', false); // dismiss dialog

    await expect(settingsPage.categoryItem.filter({ hasText: '食物2' })).toBeVisible();
    await expect(settingsPage.categoryItem.filter({ hasText: 'food22' })).toBeVisible();
  });

  test('merge moves transactions from Chinese source to English target', async ({
    page, settingsPage, transactionsPage,
  }) => {
    await settingsPage.addCategory('食物');
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    await transactionsPage.goto();
    await transactionsPage.addTransactionViaUI({
      description: 'Chinese cat transaction', amount: 50, type: 'expense', category: '食物',
    });

    await settingsPage.goto();
    await settingsPage.addCategory('food2');
    await expect(settingsPage.addCategoryResult).toContainText('added successfully');

    await settingsPage.openEditModal('食物');
    await settingsPage.submitRename('food2'); // merge confirm

    await page.goto('/transactions?categories=food2');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Chinese cat transaction')).toBeVisible();
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  test('delete Chinese category succeeds', async ({ page, settingsPage }) => {
    await settingsPage.addCategory('食物');
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');
    await settingsPage.deleteCategory('食物');
    await expect(settingsPage.categoryItem.filter({ hasText: '食物' })).not.toBeVisible();
  });

  test('deleting Chinese category removes it from transaction dropdown', async ({
    page, settingsPage, transactionsPage,
  }) => {
    await settingsPage.addCategory('交通');
    await expect(page.locator(ADD_CAT_RESULT)).toContainText('added successfully');

    const deleteResponse = page.waitForResponse(
      res => res.url().includes('/api/categories') && res.request().method() === 'DELETE',
    );
    await settingsPage.deleteCategory('交通');
    await deleteResponse;

    await transactionsPage.goto();
    await expect(page.getByLabel('Category').locator('option[value="交通"]')).not.toBeAttached();
  });
});
