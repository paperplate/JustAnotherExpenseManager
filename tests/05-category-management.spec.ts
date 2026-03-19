import { test, expect } from './fixtures';

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
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page).toHaveTitle(/Settings - Expense Manager/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings');
  });

  test('should load existing categories without category: prefix', async ({ page }) => {
    await expect(page.locator('#categories-list')).toBeVisible();
    const items = page.locator('#categories-list .category-item');
    await expect(items.first()).toBeVisible({ timeout: 5000 });

    const texts = await items.allTextContents();
    const hasPrefix = texts.some(t => t.includes('category:'));
    expect(hasPrefix).toBe(false);
  });

  test('should add a new category', async ({ page }) => {
    const uniqueName = `testcat${Date.now()}`;
    await page.getByPlaceholder('Enter category name').fill(uniqueName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    await expect(page.locator('#categories-list .category-item', { hasText: uniqueName })).toBeVisible();
  });

  test('should display added category without category: prefix', async ({ page }) => {
    const uniqueName = `prefixtest${Date.now()}`;
    await page.getByPlaceholder('Enter category name').fill(uniqueName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    const item = page.locator('#categories-list .category-item', { hasText: uniqueName });
    await expect(item).toBeVisible();

    const text = await item.textContent();
    expect(text).not.toContain('category:');
  });

  test('should reject empty category name', async ({ page }) => {
    await page.getByPlaceholder('Enter category name').fill('   ');
    await page.getByRole('button', { name: 'Add Category' }).click();

    await expect(page.locator('#add-category-result')).toContainText('enter a category name');
  });

  test('should reject duplicate category', async ({ page }) => {
    const categoryName = `duptest${Date.now()}`;

    await page.getByPlaceholder('Enter category name').fill(categoryName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Enter category name').fill(categoryName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('already exists')).toBeVisible();
  });

  test('should edit a category', async ({ page }) => {
    const originalName = `edit${Date.now()}`;
    await page.getByPlaceholder('Enter category name').fill(originalName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.category-item', { hasText: originalName })
      .getByRole('button', { name: 'Edit' })
      .click();

    await expect(page.locator('#editCategoryModal')).toBeVisible();

    // Modal should pre-fill with bare name, not "category:..."
    const prefilled = await page.getByLabel('Category Name').inputValue();
    expect(prefilled).toBe(originalName);
    expect(prefilled).not.toContain('category:');

    const newName = `edited${Date.now()}`;
    await page.getByLabel('Category Name').fill(newName);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    await expect(page.getByText(newName)).toBeVisible();
    await expect(page.getByText(originalName)).not.toBeVisible();
  });

  test('should delete a category', async ({ page }) => {
    const categoryName = `delete${Date.now()}`;
    await page.getByPlaceholder('Enter category name').fill(categoryName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure');
      dialog.accept();
    });

    await page.locator('.category-item', { hasText: categoryName })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(categoryName)).not.toBeAttached();
  });

  test('should reject invalid category characters', async ({ page }) => {
    await page.getByPlaceholder('Enter category name').fill('test@#$%');
    await page.getByRole('button', { name: 'Add Category' }).click();

    await expect(page.locator('#add-category-result')).toContainText('can only contain');
  });

  test('should reject very long category name', async ({ page }) => {
    await page.getByPlaceholder('Enter category name').fill('a'.repeat(60));
    await page.getByRole('button', { name: 'Add Category' }).click();

    await expect(page.locator('#add-category-result')).toContainText('too long');
  });

  test('edited category should appear in transactions category dropdown', async ({ page }) => {
    const catName = `dropdtest${Date.now()}`;
    await page.getByPlaceholder('Enter category name').fill(catName);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForLoadState('networkidle');

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // The add-transaction category select should contain the new category
    const option = page.getByLabel('Category').locator(`option[value="${catName}"]`);
    await expect(option).toBeAttached();

    // And it should NOT contain "category:" prefix
    const optionText = await option.textContent();
    expect(optionText).not.toContain('category:');
  });
});
