import { Page, Locator, expect } from '@playwright/test';
import { TransactionOptions } from '../helpers';
import { BasePage } from './base';
import { FilterComponent } from './FilterComponent';

export class TransactionsPage extends BasePage {

  readonly descriptionInput: Locator;
  readonly amountInput: Locator;
  readonly typeSelect: Locator;
  readonly dateInput: Locator;
  readonly categorySelect: Locator;
  readonly addTagInput: Locator;
  readonly editTagInput: Locator;
  readonly submitButton: Locator;
  readonly transactionsList: Locator;
  readonly editModal: Locator;
  readonly addTransactionBtn: Locator;
  readonly csvFile: Locator;
  readonly importCSVBtn: Locator;
  readonly importResult: Locator;
  readonly monthlyTotals: Locator;
  readonly income: Locator;
  readonly expenses: Locator;
  readonly net: Locator;
  readonly table: Locator;
  filter: FilterComponent;

  constructor(page: Page) {
    super(page, '/transactions', 'Transactions - Expense Manager');
    this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
    this.amountInput = page.getByRole('spinbutton', { name: 'Amount ($)' });
    this.typeSelect = page.getByRole('combobox', { name: 'Type' });
    this.dateInput = page.getByRole('textbox', { name: 'Date' });
    this.categorySelect = page.getByRole('combobox', { name: 'Category' });
    //this.addTagInput = page.getByLabel('Tags input field');
    this.addTagInput = page.locator('#add-transaction-form .tagify');
    this.editTagInput = page.locator('#edit-form .tagify');
    this.submitButton = page.getByRole('button', { name: 'Add Transaction' });

    this.transactionsList = page.locator('#transactions-list');

    this.editModal = page.locator('#editModal');
    this.addTransactionBtn = page.getByRole('button', { name: 'Add Transaction' });

    this.csvFile = page.getByLabel('CSV File');
    this.importCSVBtn = page.getByRole('button', { name: 'Import CSV' });
    this.importResult = page.locator('#import-result');

    this.monthlyTotals = page.locator('.monthly-totals');
    this.income = page.locator('.total-income-value');
    this.expenses = page.locator('.total-expense-value');
    this.net = page.locator('.total-net-value');

    this.table = page.getByRole('table');

    this.filter = new FilterComponent(page);
  }

  async addTransactionViaUI(opts: TransactionOptions) {
    await this.descriptionInput.fill(opts.description);
    await this.amountInput.fill(String(opts.amount));
    await this.typeSelect.selectOption(opts.type);
    await this.categorySelect.selectOption({ value: opts.category });

    if (opts.tags) {
      await this.addTagInput.waitFor();
      await this.addTagInput.click();
      for (const tag of opts.tags.split(',').map(t => t.trim()).filter(Boolean)) {
        await this.addTagInput.fill(tag + ',');
      }
    }

    const responsePromise = this.page.waitForResponse(
      res => res.url().includes('/api/transactions') && res.status() === 200
    );

    await this.submitButton.click();
    await responsePromise;
    await this.page.getByRole('cell', { name: opts.description, exact: true }).isVisible();
  }

  async scrollToTotals(): Promise<void> {
    await this.monthlyTotals.waitFor({ state: 'attached' });
    await this.monthlyTotals.scrollIntoViewIfNeeded({ timeout: 3000 });
    await expect(this.monthlyTotals).toBeInViewport();
  }
}
