import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base';
import { FilterComponent } from './FilterComponent';

export class SummaryPage extends BasePage {

  readonly summaryExpenseValue: Locator;
  readonly summaryIncomeValue: Locator;
  readonly incomeCard: Locator;
  readonly expenseCard: Locator;
  readonly netCard: Locator;
  readonly charts: Locator;
  readonly categoryChart: Locator;
  readonly monthlyChart: Locator;
  readonly summaryGrid: Locator;

  filter: FilterComponent;

  constructor(page: Page) {
    super(page, '/summary', 'Summary - Expense Manager');
    this.summaryExpenseValue = page.locator('.summary-card.expense .summary-value');
    this.summaryIncomeValue = page.locator('.summary-card.income .summary-value');
    this.incomeCard = page.locator('.summary-card.income');
    this.expenseCard = page.locator('.summary-card.expense');
    this.netCard = page.locator('.summary-card.net');
    this.charts = page.locator('#charts-container');
    this.categoryChart = page.locator('#categoryChart');
    this.monthlyChart = page.locator('#monthlyChart');
    this.summaryGrid = page.locator('.summary-grid');
    this.filter = new FilterComponent(page);
  }

  async scrollToSummary(): Promise<void> {
    await this.summaryGrid.waitFor({ state: 'attached' });
    await this.summaryGrid.scrollIntoViewIfNeeded({ timeout: 3000 });
    await expect(this.summaryGrid).toBeInViewport();
  }
}
