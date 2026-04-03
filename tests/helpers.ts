import { APIRequest, APIRequestContext, APIResponse, expect, Page } from '@playwright/test';

export const TODAY = new Date().toISOString().split('T')[0];

export async function clearDatabase(page: Page): Promise<void> {
  const response = await page.request.post('/api/transactions/clear-all');
  if (!response.ok()) {
    throw new Error(`clear-all failed: ${response.status()} ${await response.text()}`);
  }
}

export interface TransactionOptions {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  tags?: string;
  date?: string;
}

/*async function addTransaction(page: Page, opts: TransactionOptions): Promise<void> {
  const { description, amount, type, category, tags = '', date = TODAY } = opts;
  await page.getByRole('textbox', { name: 'Description' }).fill(description);
  await page.getByRole('spinbutton', { name: 'Amount ($)' }).fill(String(amount));
  await page.getByRole('combobox', { name: 'Type' }).selectOption(type);
  await page.getByRole('textbox', { name: 'Date' }).fill(date);
  await page.getByRole('combobox', { name: 'Category' }).selectOption({ value: category });
  if (tags) {
    // Tagify replaces the plain <input> with a contenteditable div.
    // Type each tag followed by Enter so Tagify converts it to a pill.
    //const tagifyInput = page.locator('.tagify__input');
    const tagifyInput = page.getByRole('textbox', { name: 'Tags input field' });
    await tagifyInput.click();
    for (const tag of tags.split(',').map(t => t.trim()).filter(Boolean)) {
      await tagifyInput.fill(tag + ',');
    }
  }
  const responsePromise = page.waitForResponse(
    res => res.url().includes('/api/transactions') && res.status() === 200);
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  await responsePromise;
  //await page.waitForLoadState('networkidle');
  await page.getByRole('cell', { name: description, exact: true }).isVisible();
}*/

export async function seedTransactionsViaAPI(request: APIRequestContext, opts: TransactionOptions[]): Promise<void> {
  const formData = new URLSearchParams();
  for (const o of opts) {
    formData.append('description', o.description);
    formData.append('amount', String(o.amount));
    formData.append('type', o.type);
    formData.append('date', o.date || TODAY);
    formData.append('category', o.category);
    formData.append('tags', o.tags || '');

    const response = await request.post('/api/transactions', {
      data: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencode' }
    });
    expect(response.ok()).toBeTruthy();
  }
}

/**
 * Parse a dollar string like "$1,234.56" or "$0.00" to a float.
 */
export function parseDollar(text: string | null): number {
  return parseFloat((text ?? '0').replace(/[$,]/g, ''));
}
