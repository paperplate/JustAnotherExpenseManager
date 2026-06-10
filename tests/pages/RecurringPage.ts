import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base';

export interface RecurringTransactionOptions {
  description: string;
  amount: number;
  type: string;
  category: string;
  frequency: string;
  startDate?: string;
  tags?: string;
}

export class RecurringPage extends BasePage {
  readonly descriptionInput: Locator;
  readonly amountInput: Locator;
  readonly typeSelect: Locator;
  readonly categorySelect: Locator;
  readonly frequencySelect: Locator;
  readonly startDateInput: Locator;
  readonly tagsInput: Locator;
  readonly submitButton: Locator;
  readonly recurringList: Locator;

  constructor(page: Page) {
    super(page, '/recurring', 'Recurring Transactions - Expense Manager');
    this.descriptionInput = page.getByLabel('Description');
    this.amountInput = page.getByLabel('Amount');
    this.typeSelect = page.getByLabel('Type');
    this.categorySelect = page.getByLabel('Category');
    this.frequencySelect = page.getByLabel('Frequency');
    this.startDateInput = page.getByLabel('Start Date');
    this.tagsInput = page.locator('.tagify__input');
    this.submitButton = page.getByRole('button', { name: 'Add Recurring Transaction' });
    this.recurringList = page.locator('#recurring-list');
  }

  async addRecurringTransaction(opts: RecurringTransactionOptions): Promise<void> {
    await this.descriptionInput.fill(opts.description);
    await this.amountInput.fill(String(opts.amount));
    await this.typeSelect.selectOption(opts.type);
    await this.categorySelect.selectOption(opts.category);
    await this.frequencySelect.selectOption(opts.frequency);
    
    if (opts.startDate) {
      await this.startDateInput.fill(opts.startDate);
    }
    
    if (opts.tags) {
      await this.tagsInput.waitFor({ state: 'visible' });
      await this.tagsInput.click();
      for (const tag of opts.tags.split(',').map(t => t.trim()).filter(Boolean)) {
        await this.tagsInput.pressSequentially(tag + ',');
      }
    }

    const responsePromise = this.page.waitForResponse(
      res => res.url().includes('/recurring/api') && res.status() === 201
    );
    await this.submitButton.click();
    await responsePromise;
    await expect(this.recurringList).toContainText(opts.description);
  }

  async deleteRecurringTransaction(description: string): Promise<void> {
    const row = this.recurringList.locator('tr').filter({ hasText: description }).first();
    this.page.on('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(this.recurringList).not.toContainText(description);
  }
}
