import { Page, Locator, expect } from '@playwright/test';

export class SplitBillComponent {
  readonly page: Page;
  readonly root: Locator;
  readonly nameInput: Locator;
  readonly addBtn: Locator;
  readonly totalDisplay: Locator;
  readonly tbody: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('[data-split-bill]');
    this.nameInput = this.root.locator('[data-action="name-input"]');
    this.addBtn = this.root.locator('[data-action="add"]');
    this.totalDisplay = this.root.locator('[data-split-total]');
    this.tbody = this.root.locator('[data-split-tbody]');
  }

  async addPerson(name: string): Promise<void> {
    await this.nameInput.selectOption(name);
    await this.addBtn.click();
  }

  async addPersonViaEnter(name: string): Promise<void> {
    await this.nameInput.selectOption(name);
    await this.nameInput.press('Enter');
  }

  row(name: string): Locator {
    return this.tbody.locator('.split-row').filter({ hasText: name });
  }

  amountCell(name: string): Locator {
    return this.row(name).locator('.split-amount');
  }

  removeBtn(name: string): Locator {
    return this.row(name).locator('[data-action="remove"]');
  }

  remainderRow(): Locator {
    return this.tbody.locator('.split-remainder-row');
  }

  async clearSessionStorage(): Promise<void> {
    await this.page.evaluate(() => sessionStorage.removeItem('splitBillPeople'));
  }

  async expectTotal(amount: number): Promise<void> {
    await expect.poll(async () => {
      const text = await this.totalDisplay.textContent();
      return parseFloat(text?.replace(/[^0-9.-]+/g, '') || '0');
    }).toBeCloseTo(amount, 2);
  }

  async expectAmount(name: string, amount: number): Promise<void> {
    await expect.poll(async () => {
      const text = await this.amountCell(name).textContent();
      return parseFloat(text?.replace(/[^0-9.-]+/g, '') || '0');
    }).toBeCloseTo(amount, 2);
  }
}
