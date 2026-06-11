import { test, expect } from './fixtures';
import { clearDatabase } from './helpers';

test.describe('Recurring Transactions UI', () => {
  test.beforeEach(async ({ recurringPage, request }) => {
    await clearDatabase(request);
    
    // Create a category tag first via API to use in the form
    await request.post('/api/categories', {
      data: { name: 'bills' }
    });
    
    await recurringPage.goto();
  });

  test('should create, list and delete a recurring transaction', async ({ recurringPage }) => {
    await recurringPage.addRecurringTransaction({
      description: 'Monthly Internet',
      amount: 65.00,
      type: 'expense',
      category: 'bills',
      frequency: 'monthly',
      startDate: '2023-01-01',
      tags: 'internet,utility'
    });
    
    // The assertions for listing are done in addRecurringTransaction.
    // However, let's also assert some other columns manually.
    await expect(recurringPage.recurringList).toContainText('$65.00');
    await expect(recurringPage.recurringList).toContainText('monthly');
    
    // Delete it
    await recurringPage.deleteRecurringTransaction('Monthly Internet');
  });
});
