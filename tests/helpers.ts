import { APIRequestContext, expect, Page } from '@playwright/test';

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

export async function seedTransactionsViaAPI(request: APIRequestContext, opts: TransactionOptions[]): Promise<void> {
  for (const o of opts) {
    const response = await request.post('/api/transactions', {
      form: {
        description: o.description,
        amount: String(o.amount),
        type: o.type,
        date: o.date || TODAY,
        category: o.category,
        tags: o.tags || ''
      }
    });
    const responseText = await response.text();
    expect(response.ok(), `API Seeding failed: ${response.status()} - ${responseText}`).toBeTruthy();
  }
}

/**
 * Parse a dollar string like "$1,234.56" or "$0.00" to a float.
 */
export function parseDollar(text: string | null): number {
  return parseFloat((text ?? '0').replace(/[$,]/g, ''));
}
