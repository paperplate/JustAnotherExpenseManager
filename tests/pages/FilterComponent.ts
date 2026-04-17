import { Page, Locator, expect } from '@playwright/test';

export class FilterComponent {

  readonly page: Page;
  readonly categoryOptionsList: Locator;
  readonly categoryDetails: Locator;
  readonly categorySummary: Locator;
  readonly tagDetails: Locator;
  readonly categoryFilterOption: Locator;
  readonly tagFilterOption: Locator;
  readonly timeRange: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryOptionsList = page.locator('#category-options-list');
    this.categoryDetails = page.locator('#category-details');
    this.categorySummary = page.locator('#category-summary');
    this.tagDetails = page.locator('#tag-details');
    this.categoryFilterOption = page.locator('#category-options-list .filter-option');
    this.tagFilterOption = page.locator('#tag-options-list .filter-option');
    this.timeRange = page.getByLabel('Time Range:');
  }

  async openCategoryFilter(): Promise<void> {
    if ((await this.categoryDetails.getAttribute('open')) === null) {
      await this.categoryDetails.locator('summary').click();
    }

    await this.categoryOptionsList.waitFor({ state: 'visible' });
    await expect(this.categoryOptionsList.locator('.filter-option').first()).toBeVisible({ timeout: 500 });
  }

  async openTagFilter(): Promise<void> {
    if ((await this.tagDetails.getAttribute('open')) === null) {
      await this.tagDetails.locator('summary').click();
    }
  }

  async selectCategory(name: string): Promise<void> {
    await this.openCategoryFilter();
    const regexp = new RegExp(`^${name}$`, 'i');
    const responsePromise = this.waitForFilterResponse();
    await this.categoryFilterOption.filter({ hasText: regexp }).click();
    await responsePromise;
  }

  async selectTag(name: string): Promise<void> {
    await this.openTagFilter();
    const regexp = new RegExp(`^${name}$`, 'i');
    const responsePromise = this.waitForFilterResponse();
    await this.tagFilterOption.filter({ hasText: regexp }).click();
    await responsePromise;
  }

  async resetCategoryFilter(): Promise<void> {
    await this.openCategoryFilter();
    const responsePromise = this.waitForFilterResponse();
    await this.page.locator('#category-details .filter-option[data-value=""]').click();
    await responsePromise;
  }

  async resetTagFilter(): Promise<void> {
    await this.openTagFilter();
    const responsePromise = this.waitForFilterResponse();
    await this.page.locator('#tag-details .filter-option[data-value=""]').click();
    await responsePromise;
  }

  private waitForFilterResponse() {
    return this.page.waitForResponse(res =>
      (res.url().includes('/api/transactions') || res.url().includes('/api/stats')) && res.status() === 200
    );
  }
}

