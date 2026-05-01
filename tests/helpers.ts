import { APIRequestContext } from '@playwright/test';

export const TODAY = new Date().toISOString().split('T')[0];

export async function clearDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/transactions/clear-all');
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

export async function seedTransactionsViaAPI(
  request: APIRequestContext,
  opts: TransactionOptions[],
): Promise<void> {
  for (const o of opts) {
    const response = await request.post('/api/transactions', {
      form: {
        description: o.description,
        amount: String(o.amount),
        type: o.type,
        date: o.date ?? TODAY,
        category: o.category,
        tags: o.tags ?? '',
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `API seeding failed for "${o.description}": HTTP ${response.status()}\n${body}`
      );
    }
  }
}

export function parseDollar(text: string | null): number {
  return parseFloat((text ?? '0').replace(/[$,]/g, ''));
}

export function parsePercent(text: string | null): number {
  return parseFloat((text ?? '0').replace('%', '').trim());
}
