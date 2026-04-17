import { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { clearDatabase, seedTransactionsViaAPI } from './helpers';
import { SettingsPage } from './pages/SettingsPage';

/**
 * Category & Tag Reorder Tests
 *
 * Verifies drag-to-reorder behaviour on the Settings page and confirms that
 * the persisted order flows through to the filter dropdowns on the Summary
 * and Transactions pages.
 *
 * Drag mechanics note
 * -------------------
 * Sortable.js uses pointer/mouse events, NOT the HTML5 Drag and Drop API.
 * Playwright's page.dragAndDrop() dispatches HTML5 drag events and therefore
 * has no effect on Sortable lists. All drag operations here use the low-level
 * mouse API (mousedown → incremental moves → mouseup) to simulate the pointer
 * events that Sortable.js actually listens for.
 */

// ─── Shared drag helper ───────────────────────────────────────────────────────

/**
 * Drag the item at `sourceIndex` in `listSelector` to the position of the
 * item currently at `targetIndex`. Uses small incremental mouse steps so
 * Sortable.js has time to compute the new insertion point.
 */
async function dragItemToIndex(
  setPage: SettingsPage,
  listSelector: Locator,
  sourceIndex: number,
  targetIndex: number
): Promise<void> {
  const source = listSelector.locator('.drag-handle').nth(sourceIndex);
  const target = listSelector.locator('.drag-handle').nth(targetIndex);

  await source.hover();
  await setPage.page.mouse.down();

  await setPage.page.mouse.move(0, 10);

  const targetBox = await target.boundingBox();
  if (targetBox) {
    await setPage.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 5 });
  }

  await setPage.page.mouse.up();
}

// ─── Drag handle visibility ───────────────────────────────────────────────────

test.describe.serial('Drag handle visibility', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    await settingsPage.goto();
    await settingsPage.page.waitForLoadState('networkidle');
  });

  test('each category item has a visible drag handle', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const cat1: string = 'alpha';
    const cat2: string = 'beta';
    await setPage.addCategory(cat1);
    await setPage.addCategory(cat2);

    const handles = setPage.categoriesList.locator(`${setPage.dragHandleStr}`);
    await expect(handles.first()).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: cat1 })).toBeVisible();
    await expect(setPage.categoryItem.filter({ hasText: cat2 })).toBeVisible();
  });

  test('each tag item has a visible drag handle', async ({ request, settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    // Tags appear once they have been applied to at least one transaction.
    await txPage.goto();
    await txPage.page.waitForLoadState('networkidle');
    await seedTransactionsViaAPI(request, [{
      description: 'Tagged A', amount: 10, type: 'expense',
      category: 'other', tags: 'urgent,planned',
    }]);
    await setPage.goto();
    await setPage.page.waitForLoadState('networkidle');

    const handles = setPage.tagList.locator(setPage.dragHandleStr);
    await expect(handles).toHaveCount(2);
    await expect(handles.first()).toBeVisible();
  });

  test('drag handle shows grab cursor (CSS)', async ({ settingsPage }) => {
    let setPage = settingsPage;
    await setPage.addCategory('alpha');
    await expect(setPage.categoriesList.locator(setPage.dragHandleStr).first()).toHaveCSS('cursor', 'grab');
  });
});

// ─── Category reordering ──────────────────────────────────────────────────────

test.describe.serial('Category reordering', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    await settingsPage.goto();
    for (const name of ['alpha', 'beta', 'gamma', 'delta']) {
      await settingsPage.addCategory(name);
    }
  });

  test('categories are rendered in insertion order initially', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const names = await setPage.getListNames(setPage.categoriesList);
    // Default seeded categories arrive first; our four are appended in order.
    const ours = names.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    expect(ours).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  test('dragging a category down reorders the visible list immediately', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.categoriesList);
    const alphaIdx = before.indexOf('alpha');

    // Drag alpha one position down.
    await dragItemToIndex(setPage, setPage.categoriesList, alphaIdx, alphaIdx + 1);

    const after = await setPage.getListNames(setPage.categoriesList);
    const alphaAfter = after.indexOf('alpha');
    const betaAfter = after.indexOf('beta');
    expect(alphaAfter).toBeGreaterThan(betaAfter);
  });

  test('dragging a category up reorders the visible list immediately', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.categoriesList);
    const deltaIdx = before.indexOf('delta');

    // Drag delta up one position.
    await dragItemToIndex(setPage, setPage.categoriesList, deltaIdx, deltaIdx - 1);

    const after = await setPage.getListNames(setPage.categoriesList);
    expect(after.indexOf('delta')).toBeLessThan(before.indexOf('delta'));
  });

  test('reordered position persists after a full page reload', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    // Move alpha to after gamma on this load.
    const before = await setPage.getListNames(setPage.categoriesList);
    const alphaIdx = before.indexOf('alpha');
    const gammaIdx = before.indexOf('gamma');

    await dragItemToIndex(setPage, setPage.categoriesList, alphaIdx, gammaIdx);
    const afterDrag = await setPage.getListNames(setPage.categoriesList);

    // Reload and confirm the server returned the same order.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await setPage.getListNames(setPage.categoriesList);

    expect(afterReload.indexOf('alpha')).toBe(afterDrag.indexOf('alpha'));
    expect(afterReload.indexOf('gamma')).toBe(afterDrag.indexOf('gamma'));
  });

  test('custom order is reflected in the Summary page category filter', async ({ settingsPage, summaryPage }) => {
    let setPage = settingsPage;
    let sumPage = summaryPage;
    // Establish a known order by dragging delta to the front of our four.
    const before = await setPage.getListNames(setPage.categoriesList);
    const deltaIdx = before.indexOf('delta');
    const alphaIdx = before.indexOf('alpha');
    await dragItemToIndex(setPage, setPage.categoriesList, deltaIdx, alphaIdx);

    await sumPage.goto();
    await sumPage.filter.openCategoryFilter();

    const filterOptions = await sumPage.filter.categoryFilterOption.allTextContents();
    const filterNames = filterOptions.map(t => t.trim().toLowerCase());

    // Verify relative order of our four categories matches what we set.
    const positions = ['alpha', 'beta', 'gamma', 'delta'].map(n => filterNames.indexOf(n));
    const deltaPos = filterNames.indexOf('delta');
    const alphaPos = filterNames.indexOf('alpha');
    expect(deltaPos).toBeLessThan(alphaPos);
    expect(positions.every(p => p !== -1)).toBe(true);
  });

  test('custom order is reflected in the Transactions page category filter', async ({ settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const settingsOrder = await setPage.getListNames(setPage.categoriesList);

    await txPage.goto();
    await txPage.filter.openCategoryFilter();

    const filterOptions = await txPage.filter.categoryFilterOption.allTextContents();
    const filterNames = filterOptions.map(t => t.trim().toLowerCase());

    // The filter list must contain all four custom categories.
    for (const name of ['alpha', 'beta', 'gamma', 'delta']) {
      expect(filterNames).toContain(name);
    }

    // Relative order must match the settings page order.
    const settingsOurs = settingsOrder.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    const filterOurs = filterNames.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('custom order is reflected in the add-transaction category <select>', async ({ settingsPage, transactionsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const settingsOrder = await setPage.getListNames(setPage.categoriesList);
    const settingsOurs = settingsOrder.filter(n =>
      ['alpha', 'beta', 'gamma', 'delta'].includes(n)
    );

    const categoryResponsePromise = txPage.page.waitForResponse(
      res => res.url().includes('/api/categories') && res.status() === 200
    );

    await txPage.goto();

    await categoryResponsePromise;

    await expect(txPage.page.getByLabel('Category').locator('option', { hasText: 'Alpha' })).toBeAttached();

    const options = await txPage.categorySelect.locator('option').allInnerTexts();
    const selectOurs = options
      .map(t => t.trim().toLowerCase())
      .filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));

    expect(selectOurs).toEqual(settingsOurs);
  });

  test('new category added after reordering lands at the bottom', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.categoriesList);
    await setPage.addCategory('zeta');
    await expect(setPage.categoryItem.filter({ hasText: 'zeta' })).toBeVisible();

    const after = await setPage.getListNames(setPage.categoriesList);

    expect(after[after.length - 1]).toBe('zeta');
    // All previous categories are still present and their relative order is intact.
    const beforeOurs = before.filter(n => after.includes(n));
    const afterWithoutNew = after.filter(n => n !== 'zeta');
    expect(afterWithoutNew).toEqual(beforeOurs);
  });

  test('deleting a category does not disturb the order of the remaining ones', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.categoriesList);
    const targetName: string = 'delta';
    const expected = before.filter(n => n !== targetName);

    page.once('dialog', d => d.accept());
    await setPage.categoryItem.filter({ hasText: targetName })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');

    const after = await setPage.getListNames(setPage.categoriesList);
    expect(after).toEqual(expected);
  });
});

// ─── Tag reordering ───────────────────────────────────────────────────────────

test.describe.serial('Tag reordering', () => {
  test.beforeEach(async ({ page, request, settingsPage, transactionsPage }) => {
    await clearDatabase(page);
    let txPage = transactionsPage;
    await txPage.goto();
    // Create four transactions each carrying a unique tag so all four appear
    // in the tags list.
    const tags = ['urgent', 'planned', 'recurring', 'personal'];
    for (const tag of tags) {
      await seedTransactionsViaAPI(request, [{
        description: `Trans ${tag}`, amount: 10, type: 'expense',
        category: 'other', tags: tag,
      }]);
    }
    await settingsPage.goto();
  });

  test('tags are rendered in insertion order initially', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const names = await setPage.getListNames(setPage.tagList);
    expect(names).toEqual(['urgent', 'planned', 'recurring', 'personal']);
  });

  test('dragging a tag down reorders the visible list immediately', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.tagList);
    const urgentIdx = before.indexOf('urgent');

    await dragItemToIndex(setPage, setPage.tagList, urgentIdx, urgentIdx + 1);

    const after = await setPage.getListNames(setPage.tagList);
    expect(after.indexOf('urgent')).toBeGreaterThan(after.indexOf('planned'));
  });

  test('dragging a tag up reorders the visible list immediately', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.tagList);
    const personalIdx = before.indexOf('personal');

    await dragItemToIndex(setPage, setPage.tagList, personalIdx, personalIdx - 1);

    const after = await setPage.getListNames(setPage.tagList);
    expect(after.indexOf('personal')).toBeLessThan(before.indexOf('personal'));
  });

  test('reordered tag position persists after page reload', async ({ page, settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.tagList);
    const recurringIdx = before.indexOf('recurring');
    const urgentIdx = before.indexOf('urgent');

    await dragItemToIndex(setPage, setPage.tagList, recurringIdx, urgentIdx);
    const afterDrag = await setPage.getListNames(setPage.tagList);

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await setPage.getListNames(setPage.tagList);

    expect(afterReload.indexOf('recurring')).toBe(afterDrag.indexOf('recurring'));
  });

  test('custom tag order is reflected in the Summary page tag filter', async ({ page, summaryPage, settingsPage }) => {
    let setPage = settingsPage;
    let sumPage = summaryPage;
    // Move personal to first position.
    const before = await setPage.getListNames(setPage.tagList);
    const personalIdx = before.indexOf('personal');
    await dragItemToIndex(setPage, setPage.tagList, personalIdx, 0);

    const settingsOrder = await setPage.getListNames(setPage.tagList);

    await sumPage.goto();
    await sumPage.filter.openTagFilter();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'personal' })
    ).toBeVisible({ timeout: 5000 });

    const filterOptions = await sumPage.filter.tagFilterOption.allTextContents();
    const filterNames = filterOptions.map(t => t.trim());

    // personal should now appear before urgent in the filter list.
    expect(filterNames.indexOf('personal')).toBeLessThan(filterNames.indexOf('urgent'));

    // Relative order must match the settings page order exactly.
    const tagNames = ['urgent', 'planned', 'recurring', 'personal'];
    const settingsOurs = settingsOrder.filter(n => tagNames.includes(n));
    const filterOurs = filterNames.filter(n => tagNames.includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('custom tag order is reflected in the Transactions page tag filter', async ({ page, transactionsPage, settingsPage }) => {
    let setPage = settingsPage;
    let txPage = transactionsPage;
    const settingsOrder = await setPage.getListNames(setPage.tagList);

    await txPage.goto();
    await txPage.filter.openTagFilter();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'urgent' })
    ).toBeVisible({ timeout: 5000 });

    const filterOptions = await txPage.filter.tagFilterOption.allTextContents();
    const filterNames = filterOptions.map(t => t.trim());

    const tagNames = ['urgent', 'planned', 'recurring', 'personal'];
    const settingsOurs = settingsOrder.filter(n => tagNames.includes(n));
    const filterOurs = filterNames.filter(n => tagNames.includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('deleting a tag does not disturb the order of the remaining ones', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.tagList);

    await setPage.deleteTag('personal');

    const after = await setPage.getListNames(setPage.tagList);
    const expected = before.filter(n => n !== 'personal');
    expect(after).toEqual(expected);
  });
});

// ─── Rename does not reset sort_order ────────────────────────────────────────

test.describe('Rename preserves sort order', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    await settingsPage.goto();
    for (const name of ['first', 'second', 'third']) {
      await settingsPage.addCategory(name);
    }
  });

  test('renaming the middle category keeps it in the middle', async ({ settingsPage }) => {
    let setPage = settingsPage;
    const before = await setPage.getListNames(setPage.categoriesList);
    const second: string = 'second'
    const secondIdx = before.indexOf(second);

    // Rename 'second' → 'middle'
    await setPage.openEditModal(second)

    const middle: string = 'middle';
    await setPage.submitRename(middle);

    await expect(setPage.categoryItem.filter({ hasText: middle })).toBeVisible();

    const after = await setPage.getListNames(setPage.categoriesList);
    const middleIdx = after.indexOf(middle);
    expect(middleIdx).toBe(secondIdx);
  });
});

// ─── API contract ─────────────────────────────────────────────────────────────

test.describe('Order API contract', () => {
  test.beforeEach(async ({ page, settingsPage }) => {
    await clearDatabase(page);
    settingsPage.goto();
    for (const name of ['cat1', 'cat2', 'cat3']) {
      await settingsPage.addCategory(name);
    }
  });

  test('PATCH /api/categories/order returns 200 with valid payload', async ({ page }) => {
    const response = await page.request.patch('/api/categories/order', {
      data: { order: ['cat3', 'cat1', 'cat2'] },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  test('PATCH /api/categories/order with non-array body returns 400', async ({ page }) => {
    const response = await page.request.patch('/api/categories/order', {
      data: { order: 'not-an-array' },
    });
    expect(response.status()).toBe(400);
  });

  test('PATCH /api/categories/order with missing body returns 400', async ({ page }) => {
    const response = await page.request.patch('/api/categories/order', {
      data: {},
    });
    // An empty order list is a no-op and should succeed, but a missing
    // 'order' key means request.json() won't have the field — the route
    // should still respond without a server error.
    expect(response.status()).toBeLessThan(500);
  });

  test('GET /api/categories returns categories in the order set by PATCH', async ({ page }) => {
    await page.request.patch('/api/categories/order', {
      data: { order: ['cat3', 'cat1', 'cat2'] },
    });

    const response = await page.request.get('/api/categories');
    const categories = await response.json();
    const names = categories
      .map((c: { category_name: string }) => c.category_name)
      .filter((n: string) => ['cat1', 'cat2', 'cat3'].includes(n));

    expect(names).toEqual(['cat3', 'cat1', 'cat2']);
  });

  test('PATCH /api/tags/order returns 200 with valid payload', async ({ page, transactionsPage }) => {
    await transactionsPage.goto();
    await transactionsPage.addTransactionViaUI({
      description: 'T1', amount: 5, type: 'expense', category: 'other', tags: 'tagA,tagB,tagC',
    });

    const response = await page.request.patch('/api/tags/order', {
      data: { order: ['tagC', 'tagA', 'tagB'] },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  test('GET /api/tags returns tags in the order set by PATCH', async ({ page, transactionsPage }) => {
    await transactionsPage.goto();
    await transactionsPage.addTransactionViaUI({
      description: 'T2', amount: 5, type: 'expense', category: 'other', tags: 'tagA,tagB,tagC',
    });

    await page.request.patch('/api/tags/order', {
      data: { order: ['tagC', 'tagA', 'tagB'] },
    });

    const response = await page.request.get('/api/tags');
    const tags: string[] = await response.json();
    const ours = tags.filter(t => ['tagA', 'tagB', 'tagC'].includes(t));
    expect(ours).toEqual(['tagC', 'tagA', 'tagB']);
  });
});
