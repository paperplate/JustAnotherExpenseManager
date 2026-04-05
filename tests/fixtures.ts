import { test as base } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SummaryPage } from './pages/SummaryPage';
import { settings } from 'cluster';

type MyFixtures = {
  settingsPage: SettingsPage;
  transactionsPage: TransactionsPage;
  summaryPage: SummaryPage;
};

export const test = base.extend<MyFixtures>({
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
  summaryPage: async ({ page }, use) => {
    await use(new SummaryPage(page));
  },
});

export { expect } from '@playwright/test';

