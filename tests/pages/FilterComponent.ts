import { Page, Locator, expect } from '@playwright/test';
import type { Response } from '@playwright/test';

export class FilterComponent {
  readonly page: Page;
  readonly categoryOptionsList: Locator;
  readonly categoryDetails: Locator;
  readonly categorySummary: Locator;
  readonly tagDetails: Locator;
  readonly tagOptionsList: Locator;
  readonly tagSummary: Locator;
  readonly categoryFilterOption: Locator;
  readonly tagFilterOption: Locator;
  readonly timeRange: Locator;
  readonly customRangePicker: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryOptionsList = page.locator('#category-options-list .filter-option');
    this.categoryDetails = page.locator('#category-details');
    this.categorySummary = page.locator('#category-summary');
    this.tagDetails = page.locator('#tag-details');
    this.tagOptionsList = page.locator('#tag-options-list .filter-option');
    this.tagSummary = page.locator('#tag-summary');
    this.categoryFilterOption = page.locator('#category-options-list .filter-option');
    this.tagFilterOption = page.locator('#tag-options-list .filter-option');
    this.timeRange = page.getByRole('combobox', { name: 'Time Range:' });
    this.customRangePicker = page.locator('#custom-range-picker');
  }

  // ── Open helpers ────────────────────────────────────────────────────────────

  async openCategoryFilter(): Promise<void> {
    if ((await this.categoryDetails.getAttribute('open')) === null) {
      await this.categoryDetails.locator('summary').click();
    }
    // Wait for async loadCategories() fetch to populate options.
    await expect(this.categoryFilterOption.first()).toBeVisible({ timeout: 5_000 });
  }

  async openTagFilter(): Promise<void> {
    if ((await this.tagDetails.getAttribute('open')) === null) {
      await this.tagDetails.locator('summary').click();
    }
    // Wait for async loadTags() fetch — may be empty if no tags exist yet.
    await expect(this.tagFilterOption.first()).toBeVisible({ timeout: 5_000 });
  }

  // ── Filter actions ──────────────────────────────────────────────────────────

  async selectCategory(name: string): Promise<void> {
    await this.openCategoryFilter();
    const opt = this.categoryFilterOption.filter({ hasText: new RegExp(`^${name}$`, 'i') });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    await opt.click();
  }

  async selectTag(name: string): Promise<void> {
    await this.openTagFilter();
    // tagFilterOption is scoped to #tag-options-list — not the category list.
    const opt = this.tagFilterOption.filter({ hasText: new RegExp(`^${name}$`, 'i') });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    await opt.click();
  }

  async resetCategoryFilter(): Promise<void> {
    await this.openCategoryFilter();
    await this.page.locator('#category-details .filter-option[data-value=""]').click();
  }

  async resetTagFilter(): Promise<void> {
    await this.openTagFilter();
    await this.page.locator('#tag-details .filter-option[data-value=""]').click();
  }

  async selectTime(option: string, start?: string, end?: string): Promise<void> {
    if (option !== "custom") {
      await this.timeRange.selectOption(option);
    }
    else if (!start || !end) {
      throw new Error('missing start or end parameter');
    }
    else {
      await this.timeRange.selectOption(option);
      await this.customRangePicker.waitFor({ state: 'visible', timeout: 5_000 });
      await this.page.getByLabel('Start Date:').fill(start);
      await this.page.getByLabel('End Date:').fill(end);
      await this.page.getByRole('button', { name: 'Apply' }).click();
    }
  }
}
