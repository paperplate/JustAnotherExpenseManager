const { test, expect } = require('@playwright/test');

/**
 * Category Management Tests
 * Tests category CRUD operations in Settings page
 */

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page).toHaveTitle(/Settings - Expense Manager/);
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should load existing categories', async ({ page }) => {
    // Wait for categories to load
    await page.waitForTimeout(1000);
    
    // Categories list should be visible
    await expect(page.locator('#categories-list')).toBeVisible();
    
    // Should show at least some default categories
    const categoriesList = page.locator('#categories-list');
    const hasCategories = await categoriesList.locator('.category-item').count();
    
    expect(hasCategories).toBeGreaterThan(0);
  });

  test('should add a new category', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Fill in category name
    const uniqueName = `testcat${Date.now()}`;
    await page.fill('#new-category', uniqueName);
    
    // Click add button
    await page.click('button:has-text("Add Category")');
    
    // Wait for category to be added
    await page.waitForTimeout(1000);
    
    // Success message should appear
    await expect(page.locator('#add-category-result')).toContainText('added successfully');
    
    // Category should appear in list
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible();
  });

  test('should reject empty category name', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Try to add empty category
    await page.fill('#new-category', '   ');
    await page.click('button:has-text("Add Category")');
    
    await page.waitForTimeout(500);
    
    // Error message should appear
    await expect(page.locator('#add-category-result')).toContainText('enter a category name');
  });

  test('should reject duplicate category', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Add a category
    const categoryName = `duptest${Date.now()}`;
    await page.fill('#new-category', categoryName);
    await page.click('button:has-text("Add Category")');
    await page.waitForTimeout(1000);
    
    // Try to add the same category again
    await page.fill('#new-category', categoryName);
    await page.click('button:has-text("Add Category")');
    await page.waitForTimeout(500);
    
    // Should show error
    await expect(page.locator('#add-category-result')).toContainText('already exists');
  });

  test('should edit a category', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Add a category first
    const originalName = `edit${Date.now()}`;
    await page.fill('#new-category', originalName);
    await page.click('button:has-text("Add Category")');
    await page.waitForTimeout(1000);
    
    // Click edit button for the category
    const editButton = page.locator('.category-item', { hasText: originalName })
                           .locator('button:has-text("Edit")');
    await editButton.click();
    
    // Modal should open
    await expect(page.locator('#editCategoryModal')).toBeVisible();
    
    // Change the name
    const newName = `edited${Date.now()}`;
    await page.fill('#edit-category-name', newName);
    
    // Save
    await page.click('button:has-text("Save Changes")');
    
    // Wait for modal to close
    await page.waitForTimeout(1000);
    
    // Modal should be closed
    await expect(page.locator('#editCategoryModal')).not.toBeVisible();
    
    // New name should appear
    await expect(page.locator(`text=${newName}`)).toBeVisible();
    
    // Old name should not appear
    await expect(page.locator(`text=${originalName}`)).not.toBeVisible();
  });

  test('should delete a category', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Add a category to delete
    const categoryName = `delete${Date.now()}`;
    await page.fill('#new-category', categoryName);
    await page.click('button:has-text("Add Category")');
    await page.waitForTimeout(1000);
    
    // Listen for confirmation dialog
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure');
      dialog.accept();
    });
    
    // Click delete button
    const deleteButton = page.locator('.category-item', { hasText: categoryName })
                             .locator('button:has-text("Delete")');
    await deleteButton.click();
    
    // Wait for deletion
    await page.waitForTimeout(1000);
    
    // Category should be gone
    await expect(page.locator(`text=${categoryName}`)).not.toBeVisible();
  });

  test('should reject invalid category characters', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Try to add category with special characters
    await page.fill('#new-category', 'test@#$%');
    await page.click('button:has-text("Add Category")');
    
    await page.waitForTimeout(500);
    
    // Should show error
    await expect(page.locator('#add-category-result')).toContainText('can only contain');
  });

  test('should reject very long category name', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Try to add very long category name
    const longName = 'a'.repeat(60);
    await page.fill('#new-category', longName);
    await page.click('button:has-text("Add Category")');
    
    await page.waitForTimeout(500);
    
    // Should show error
    await expect(page.locator('#add-category-result')).toContainText('too long');
  });
});
