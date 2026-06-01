import { test, expect } from '@playwright/test';
test('test split bill', async ({ page }) => {
  await page.goto('http://localhost:5000/transactions');
  await page.waitForTimeout(1000);
  
  // Find a transaction and log its tags
  const tagsStr = await page.evaluate(() => {
    const editBtn = document.querySelector('.btn-edit');
    return editBtn ? editBtn.getAttribute('data-tags') : 'no button';
  });
  console.log('tagsStr:', tagsStr);
});
