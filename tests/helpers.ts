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
  await page.fill('#description', description);
  await page.fill('#amount', String(amount));
  await page.selectOption('#type', type);
  await page.fill('#date', date);
  await page.selectOption('select#category', { value: category });
  if (tags) await page.fill('#tags', tags);
  await page.click('button[type="submit"]:has-text("Add Transaction")');
  await page.waitForLoadState('networkidle');
  if (tags) await page.fill('#tags', '');
}

/**
 * Parse a dollar string like "$1,234.56" or "$0.00" to a float.
 */
function parseDollar(text: string | null): number {
  return parseFloat((text ?? '0').replace(/[$,]/g, ''));
}

async function addCategory(page: Page, name: string): Promise<void> {
  await page.fill('#new-category', name);
  await page.click('button:has-text("Add Category")');
  await page.waitForLoadState('networkidle');
}

async function openEditModal(page: Page, categoryName: string): Promise<void> {
  const editBtn = page.locator('.category-item', { hasText: categoryName })
    .locator('button:has-text("Edit")');
  await editBtn.click();
}

async function submitRename(page: Page, newName: string): Promise<void> {
  await page.fill('#edit-category-name', newName);
  await page.click('#editCategoryModal button:has-text("Save Changes")');
  await page.waitForLoadState('networkidle');
}

export {
  clearDatabase,
  addTransaction,
  parseDollar,
  addCategory,
  openEditModal,
  submitRename,
  TODAY
};
