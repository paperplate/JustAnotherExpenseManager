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
  readonly table: Locator;
  filter: FilterComponent;

  constructor(page: Page) {
    super(page, '/transactions', 'Transactions - Expense Manager');
    this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
    this.amountInput = page.getByRole('spinbutton', { name: 'Amount ($)' });
    this.typeSelect = page.getByRole('combobox', { name: 'Type' });
    this.dateInput = page.getByRole('textbox', { name: 'Date' });
    this.categorySelect = page.getByRole('combobox', { name: 'Category' });
    this.addTagInput = page.locator('#add-transaction-form .tagify__input');
    this.editTagInput = page.locator('#edit-form .tagify__input');
    this.submitButton = page.getByRole('button', { name: 'Add Transaction' });
    this.transactionsList = page.locator('#transactions-list');
    this.editModal = page.locator('#editModal');
    this.addTransactionBtn = page.getByRole('button', { name: 'Add Transaction' });
    this.csvFile = page.getByLabel('CSV File');
    this.importCSVBtn = page.getByRole('button', { name: 'Preview Import' });
    this.importResult = page.locator('#import-result');
    this.table = page.getByRole('table');
    this.filter = new FilterComponent(page);
  }

  async addTransactionViaUI(opts: TransactionOptions): Promise<void> {
    await this.descriptionInput.fill(opts.description);
    await this.amountInput.fill(String(opts.amount));
    await this.typeSelect.selectOption(opts.type);
    await this.categorySelect.selectOption({ value: opts.category });

    if (opts.tags) {
      await this.addTagInput.waitFor({ state: 'visible' });
      await this.addTagInput.click();
      for (const tag of opts.tags.split(',').map(t => t.trim()).filter(Boolean)) {
        await this.addTagInput.pressSequentially(tag + ',');
      }
    }

    const responsePromise = this.page.waitForResponse(
      res => res.url().includes('/api/transactions') && res.status() === 200,
    );
    await this.submitButton.click();
    await responsePromise;
    await expect(this.page.getByRole('cell', { name: opts.description, exact: true })).toBeVisible();
  }

  /**
   * Wait for the monthly-totals bar to be present and stable.
   *
   * Uses a fresh `page.locator()` each call because `loadTransactions()`
   * replaces the entire `#transactions-list` DOM on every mutation, which
   * detaches any pre-bound Locator references.
   */
  async scrollToTotals(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('.monthly-totals')).toBeVisible({ timeout: 8_000 });
  }

  /** Convenience aliases for the monthly-total cells. */
  get income() { return this.page.locator('.total-income-value'); }
  get expenses() { return this.page.locator('.total-expense-value'); }
  get net() { return this.page.locator('.total-net-value'); }
  get monthlyTotals() { return this.page.locator('.monthly-totals'); }
}
