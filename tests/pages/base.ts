import { Page, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly url: string;
  readonly title: string;


  constructor(page: Page, url: string, title: string) {
    this.page = page;
    this.url = url;
    this.title = title;
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForURL('**' + this.url);
    await expect(this.page).toHaveTitle(this.title);
  }
}

