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

  constructor(page: Page) {
    this.page = page;
    this.categoryOptionsList = page.locator('#category-options-list');
    this.categoryDetails    = page.locator('#category-details');
    this.categorySummary    = page.locator('#category-summary');
    this.tagDetails         = page.locator('#tag-details');
    this.tagOptionsList     = page.locator('#tag-options-list');
    this.tagSummary         = page.locator('#tag-summary');
    this.categoryFilterOption = page.locator('#category-options-list .filter-option');
    this.tagFilterOption      = page.locator('#tag-options-list .filter-option');
    this.timeRange          = page.getByLabel('Time Range:');
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
    await this.tagOptionsList.waitFor({ state: 'visible', timeout: 5_000 });
  }

  // ── Filter actions ──────────────────────────────────────────────────────────

  async selectCategory(name: string): Promise<void> {
    await this.openCategoryFilter();
    const opt = this.categoryFilterOption.filter({ hasText: new RegExp(`^${name}$`, 'i') });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    const responsePromise = this.waitForFilterResponse();
    await opt.click();
    await responsePromise;
  }

  async selectTag(name: string): Promise<void> {
    await this.openTagFilter();
    // tagFilterOption is scoped to #tag-options-list — not the category list.
    const opt = this.tagFilterOption.filter({ hasText: new RegExp(`^${name}$`, 'i') });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    const responsePromise = this.waitForFilterResponse();
    await opt.click();
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

  // ── Private ─────────────────────────────────────────────────────────────────

  private waitForFilterResponse(): Promise<Response> {
    return this.page.waitForResponse(
      res =>
        (res.url().includes('/api/transactions') || res.url().includes('/api/stats')) &&
        res.status() === 200,
    );
  }
}
