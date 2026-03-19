import { Page } from '@playwright/test';

const TODAY = new Date().toISOString().split('T')[0];

async function clearDatabase(page: Page): Promise<void> {
  const response = await page.request.post('/api/transactions/clear-all');
  if (!response.ok()) {
    throw new Error(`clear-all failed: ${response.status()} ${await response.text()}`);
  }
}

interface TransactionOptions {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  tags?: string;
  date?: string;
}

async function addTransaction(page: Page, opts: TransactionOptions): Promise<void> {
  const { description, amount, type, category, tags = '', date = TODAY } = opts;
  await page.getByLabel('Description').fill(description);
  await page.getByLabel('Amount ($)').fill(String(amount));
  await page.getByLabel('Type').selectOption(type);
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Category').selectOption({ value: category });
  if (tags) await page.getByLabel('Tags (comma-separated, optional)').fill(tags);
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  await page.waitForLoadState('networkidle');
  if (tags) await page.getByLabel('Tags (comma-separated, optional)').fill('');
}

/**
 * Parse a dollar string like "$1,234.56" or "$0.00" to a float.
 */
function parseDollar(text: string | null): number {
  return parseFloat((text ?? '0').replace(/[$,]/g, ''));
}

async function addCategory(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder('Enter category name').fill(name);
  await page.getByRole('button', { name: 'Add Category' }).click();
  await page.waitForLoadState('networkidle');
}

async function openEditModal(page: Page, categoryName: string): Promise<void> {
  await page.locator('.category-item', { hasText: categoryName })
    .getByRole('button', { name: 'Edit' })
    .click();
}

async function submitRename(page: Page, newName: string): Promise<void> {
  await page.getByLabel('Category Name').fill(newName);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.waitForLoadState('networkidle');
}

async function openCategoryFilter(page: Page): Promise<void> {
  const details = page.locator('#category-details');
  if (!(await details.getAttribute('open'))) {
    await details.locator('summary').click();
  }
}

async function openTagFilter(page: Page): Promise<void> {
  const details = page.locator('#tag-details');
  if (!(await details.getAttribute('open'))) {
    await details.locator('summary').click();
  }
}

async function selectCategory(page: Page, name: string): Promise<void> {
  await openCategoryFilter(page);
  const regexp = new RegExp(`^${name}$`, 'i');
  await page.locator('#category-options-list')
    .getByRole('listitem')
    .filter({ hasText: regexp })
    .click();
  await page.waitForLoadState('networkidle');
}

async function selectTag(page: Page, name: string): Promise<void> {
  await openTagFilter(page);
  const regexp = new RegExp(`^${name}$`, 'i');
  await page.locator('#tag-options-list')
    .getByRole('listitem')
    .filter({ hasText: regexp })
    .click();
  await page.waitForLoadState('networkidle');
}

async function resetCategoryFilter(page: Page): Promise<void> {
  await openCategoryFilter(page);
  await page.locator('#category-details')
    .getByRole('listitem', { name: 'All Categories' })
    .click();
  await page.waitForLoadState('networkidle');
}

async function resetTagFilter(page: Page): Promise<void> {
  await openTagFilter(page);
  await page.locator('#tag-details')
    .getByRole('listitem', { name: 'All Tags' })
    .click();
  await page.waitForLoadState('networkidle');
}

async function scrollToTotals(page: Page): Promise<void> {
  await page.locator('.monthly-totals').scrollIntoViewIfNeeded();
}

export {
  clearDatabase,
  addTransaction,
  parseDollar,
  addCategory,
  openCategoryFilter,
  openEditModal,
  submitRename,
  TODAY,
  selectCategory,
  selectTag,
  resetCategoryFilter,
  resetTagFilter,
  scrollToTotals
};
