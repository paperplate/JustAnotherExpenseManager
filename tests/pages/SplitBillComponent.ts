import { Page, Locator } from '@playwright/test';

export class SplitBillComponent {
  readonly page: Page;
  readonly root: Locator;
  readonly nameInput: Locator;
  readonly addBtn: Locator;
  readonly evenBtn: Locator;
  readonly totalDisplay: Locator;
  readonly tbody: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('[data-split-bill]');
    this.nameInput = this.root.locator('[data-action="name-input"]');
    this.addBtn = this.root.locator('[data-action="add"]');
    this.evenBtn = this.root.locator('[data-action="even"]');
    this.totalDisplay = this.root.locator('[data-split-total]');
    this.tbody = this.root.locator('[data-split-tbody]');
  }

  async addPerson(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.addBtn.click();
  }

  async addPersonViaEnter(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.nameInput.press('Enter');
  }

  row(name: string): Locator {
    return this.tbody.locator('.split-row').filter({ hasText: name });
  }

  percentageInput(name: string): Locator {
    return this.row(name).locator('[data-action="pct"]');
  }

  amountCell(name: string): Locator {
    return this.row(name).locator('.split-amount');
  }

  lockBtn(name: string): Locator {
    return this.row(name).locator('[data-action="lock"]');
  }

  removeBtn(name: string): Locator {
    return this.row(name).locator('[data-action="remove"]');
  }

  remainderRow(): Locator {
    return this.tbody.locator('.split-remainder-row');
  }

  async setPct(name: string, pct: number): Promise<void> {
    const input = this.percentageInput(name);
    await input.fill(String(pct));
    await input.dispatchEvent('input');
  }

  async clearSessionStorage(): Promise<void> {
    await this.page.evaluate(() => sessionStorage.removeItem('splitBillPeople'));
  }
}
