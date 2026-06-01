import { test, expect } from '@playwright/test';
test('test split bill', async ({ page }) => {
  await page.goto('http://localhost:5000/transactions');
  await page.waitForTimeout(1000);
  
  const results = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr[data-amount]')).map(row => {
      const editBtn = row.querySelector('.btn-edit');
      return editBtn ? editBtn.getAttribute('data-tags') : 'NO_BTN';
    });
  });
  console.log('Results:', results);
});
