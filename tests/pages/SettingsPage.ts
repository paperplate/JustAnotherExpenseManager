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
  readonly editCateogrySave: Locator;
  readonly dragHandleStr: string;
  readonly categoryItemStr: string;

  constructor(page: Page) {
    super(page);
    this.categoriesList = page.locator('#categories-list');
    this.tagList = page.locator('#tags-list');
    this.categoryItem = page.locator('#categories-list .category-item');
    this.addCategoryBtn = page.getByRole('button', { name: 'Add Category' });
    this.addCategoryResult = page.locator('#add-category-result');
    this.categoryNameInput = page.getByPlaceholder('Enter category name');
    this.editCategoryModal = page.locator('#editCategoryModal');
    this.editCategoryName = this.editCategoryModal.getByLabel('Category Name');
    this.editCateogrySave = this.editCategoryModal.getByRole('button', { name: 'Save Changes' });
    this.dragHandleStr = '.drag-handle';
    this.categoryItemStr = '.category-item';
  }

  async goto() {
    await this.page.goto('/settings');
    expect(this.page).toHaveTitle('Settings - Expense Manager');
  }

  async addCategory(name: string): Promise<void> {
    await this.categoryNameInput.fill(name);
    const responsePromise = this.page.waitForResponse(
      res => res.url().includes('/api/categories') && res.status() === 200);
    await this.addCategoryBtn.click();
    await responsePromise;
  }

  async openEditModal(categoryName: string): Promise<void> {
    await this.categoryItem.filter({ hasText: categoryName })
      .getByRole('button', { name: 'Edit' })
      .click();
    expect(this.editCategoryModal).toBeVisible();
  }

  async submitRename(newName: string, accept: Boolean = true): Promise<void> {
    await this.editCategoryName.fill(newName);
    const responsePromise = this.page.waitForResponse(
      res => res.url().includes('/api/categories') && res.status() === 200);
    await this.editCateogrySave.click();
    this.page.once('dialog', dialog => (accept ? dialog.accept() : dialog.dismiss())); // only emitted when dialog appears
    await responsePromise;
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

