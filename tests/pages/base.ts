import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly url: string;
  readonly title: Promise<string>;


  constructor(page: Page) {
    this.page = page;
    this.url = page.url();
    this.title = page.title();
  }

  async goto() {
    await this.page.goto(this.url);
  }
}

