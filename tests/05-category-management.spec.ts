import { test, expect } from './fixtures';
import { TODAY } from './helpers';


/**
 * Category Management Tests
 * Tests category CRUD operations on the Settings page.
 *
 * Key facts (post-refactor):
 *  - Categories are displayed using cat.category_name (no "category:" prefix)
 *  - Edit/delete send bare names to /api/categories/<name>
 *  - settings.js has its own loadCategories() (for the settings list)
 */


test.describe('Category Management', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.goto();
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings');
  });

  test('should load existing categories without category: prefix', async ({ settingsPage }) => {
    let setPage = settingsPage;
    await expect(setPage.categoriesList).toBeVisible();
    await expect(setPage.categoryItem.first()).toBeVisible({ timeout: 5000 });

    const texts = await setPage.categoryItem.allTextContents();
    const hasPrefix = texts.some(t => t.includes('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should add a new category', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const uniqueName = `testcat${TODAY}`;
    await setPage.addCategory(uniqueName);

    await expect(setPage.addCategoryResult).toContainText('added successfully');
    await expect(setPage.categoryItem.filter({ hasText: uniqueName })).toBeVisible();
  });

  test('should display added category without category: prefix', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const uniqueName = `prefixtest${TODAY}`;
    await setPage.addCategory(uniqueName);

    const item = setPage.categoryItem.filter({ hasText: uniqueName });
    await expect(item).toBeVisible();

    const text = await item.textContent();
    expect(text).not.toContain('category:');
  });

  test('should reject empty category name', async ({ settingsPage }) => {
    let setPage = settingsPage;
    await setPage.addCategory('   ');

    await expect(setPage.addCategoryResult).toContainText('enter a category name');
  });

  test('should reject duplicate category', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const categoryName = `duptest${TODAY}`;

    await setPage.addCategory(categoryName);
    await setPage.addCategory(categoryName);

    await expect(page.getByText('already exists')).toBeVisible();
  });

  test('should edit a category', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const originalName = `edit${Date.now()}`;
    await setPage.addCategory(originalName);

    await setPage.openEditModal(originalName);
    await expect(setPage.editCategoryModal).toBeVisible();

    // Modal should pre-fill with bare name, not "category:..."
    const prefilled = await page.getByLabel('Category Name').inputValue();
    expect(prefilled).toBe(originalName);
    expect(prefilled).not.toContain('category:');

    const newName = `edited${Date.now()}`;
    await setPage.submitRename(newName, true);

    await expect(setPage.editCategoryModal).not.toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: newName })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: originalName })).not.toBeVisible();
  });

  test('should delete a category', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const categoryName = `delete${Date.now()}`;
    await setPage.addCategory(categoryName);

    await setPage.deleteCategory(categoryName);
    await expect(page.getByText(categoryName)).not.toBeAttached();
  });

  test('should reject invalid category characters', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const categoryName = 'test@#$%';
    await setPage.addCategory(categoryName);

    await expect(setPage.addCategoryResult).toContainText('can only contain');
  });

  test('should reject very long category name', async ({ settingsPage }) => {
    let setPage = settingsPage;
    await setPage.addCategory('a'.repeat(60));

    await expect(setPage.addCategoryResult).toContainText('too long');
  });

  test('edited category should appear in transactions category dropdown', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const catName = `dropdtest${Date.now()}`;
    await setPage.addCategory(catName);

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const option = page.getByLabel('Category').locator(`option[value="${catName}"]`);
    await expect(option).toBeAttached();

    // And it should NOT contain "category:" prefix
    const optionText = await option.textContent();
    expect(optionText).not.toContain('category:');
  });
});
