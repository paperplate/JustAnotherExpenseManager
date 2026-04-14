import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base';

export class SettingsPage extends BasePage {

  readonly categoriesList: Locator;
  readonly tagList: Locator;
  readonly categoryItem: Locator;
  readonly addCategoryBtn: Locator;
  readonly addCategoryResult: Locator;
  readonly categoryNameInput: Locator;
  readonly editCategoryModal: Locator;
  readonly editCategoryName: Locator;
  readonly editCategorySave: Locator;
  readonly editCategoryCancel: Locator;
  readonly dragHandleStr: string;
  readonly categoryItemStr: string;

  constructor(page: Page) {
    super(page, '/settings', 'Settings - Expense Manager');
    this.categoriesList = page.locator('#categories-list');
    this.tagList = page.locator('#tags-list');
    this.categoryItem = page.locator('#categories-list .category-item');
    this.addCategoryBtn = page.getByRole('button', { name: 'Add Category' });
    this.addCategoryResult = page.locator('#add-category-result');
    this.categoryNameInput = page.getByPlaceholder('Enter category name');
    this.editCategoryModal = page.locator('#editCategoryModal');
    this.editCategoryName = this.editCategoryModal.getByLabel('Category Name');
    this.editCategorySave = this.editCategoryModal.getByRole('button', { name: 'Save Changes' });
    this.editCategoryCancel = this.editCategoryModal.getByRole('button', { name: 'Cancel' });
    this.dragHandleStr = '.drag-handle';
    this.categoryItemStr = '.category-item';
  }

  async addCategory(name: string): Promise<void> {
    if (name.trim() !== '') {
      await this.categoryNameInput.fill(name);
      const responsePromise = this.page.waitForResponse(
        res => res.url().includes('/api/categories') && ((res.status() === 200) || (res.status() === 400)));
      await this.addCategoryBtn.click();
      await responsePromise;
    }
    else {
      await this.addCategoryBtn.click();
    }
  }

  async openEditModal(categoryName: string): Promise<void> {
    await this.categoryItem.filter({ hasText: categoryName })
      .getByRole('button', { name: 'Edit' })
      .click();
    expect(this.editCategoryModal).toBeVisible();
  }

  async submitRename(newName: string, accept: Boolean = true): Promise<void> {
    await this.editCategoryName.fill(newName);
    this.page.once('dialog', dialog => (accept ? dialog.accept() : dialog.dismiss())); // only emitted when dialog appears
    await this.editCategorySave.click();
    if (accept) {
      const responsePromise = this.page.waitForResponse(
        res => res.url().includes('/api/categories') &&
          ((res.status() === 200) || (res.status() === 400)));
      await responsePromise;
    }
    else {
      await this.editCategoryCancel.click();
    }
    expect(this.editCategoryModal).not.toBeVisible();
  }

  async deleteCategory(name: string): Promise<void> {
    this.page.once('dialog', dialog => dialog.accept());
    const item = this.categoryItem.filter({ hasText: name });
    item.getByRole('button', { name: "Delete" }).click();
    expect(item).not.toBeVisible();
  }

  /** Return the visible text content of every .category-item in a list. */
  async getListNames(list: Locator): Promise<string[]> {
    return list.locator(`.category-item .category-name`).allTextContents();
  }
}

