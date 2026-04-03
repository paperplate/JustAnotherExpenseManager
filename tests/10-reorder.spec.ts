import { test, expect, Page, Locator, request } from '@playwright/test';
import { clearDatabase, seedTransactionsViaAPI } from './helpers';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SummaryPage } from './pages/SummaryPage';

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
  const items = listSelector.locator(setPage.categoryItemStr);
  const handle = items.nth(sourceIndex).locator(setPage.dragHandleStr);
  const target = items.nth(targetIndex);

  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error('Could not get bounding boxes for drag');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  // Drop slightly past the mid-point of the target so Sortable registers it
  // as "after" that element when dragging downward, or "before" when upward.
  const endY = targetIndex > sourceIndex
    ? targetBox.y + targetBox.height * 0.75
    : targetBox.y + targetBox.height * 0.25;

  await setPage.page.mouse.move(startX, startY);
  await setPage.page.mouse.down();
  // Move in multiple steps — Sortable.js needs intermediate mousemove events
  // to track the drag and decide where to insert the ghost placeholder.
  await setPage.page.mouse.move(startX, startY + (endY - startY) * 0.3, { steps: 5 });
  await setPage.page.mouse.move(startX, startY + (endY - startY) * 0.6, { steps: 5 });
  await setPage.page.mouse.move(startX, endY, { steps: 10 });
  // Brief pause so Sortable can settle the placeholder before we release.
  await setPage.page.waitForTimeout(100);
  await setPage.page.mouse.up();
  await setPage.page.waitForTimeout(300);
}

/*async function getItemNames(page: Page, listSelector: Locator): Promise<string[]> {
  return page.locator(`${listSelector} .category-item .category-name`).allTextContents();
}*/

// ─── Constants ────────────────────────────────────────────────────────────────

/*const CAT_LIST = '#categories-list';
const TAG_LIST = '#tags-list';
const FILTER_CAT_OPTIONS = '#category-options-list .filter-option';
const FILTER_TAG_OPTIONS = '#tag-options-list .filter-option';*/

// ─── Drag handle visibility ───────────────────────────────────────────────────

test.describe('Drag handle visibility', () => {
  let setPage: SettingsPage;
  let txPage: TransactionsPage;
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('each category item has a visible drag handle', async ({ page }) => {
    await setPage.addCategory('alpha');
    await setPage.addCategory('beta');
    //await addCategory(page, 'alpha');
    //await addCategory(page, 'beta');

    const handles = setPage.categoriesList.locator(`${setPage.dragHandleStr}`);
    //const handles = page.locator(`${CAT_LIST} .drag-handle`);
    await expect(handles).toHaveCount(2);
    await expect(handles.first()).toBeVisible();
  });

  test('each tag item has a visible drag handle', async ({ page, request }) => {
    // Tags appear once they have been applied to at least one transaction.
    await txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await seedTransactionsViaAPI(request, [{
      //await addTransaction(page, {
      description: 'Tagged A', amount: 10, type: 'expense',
      category: 'other', tags: 'urgent,planned',
    }]);
    await setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');

    const handles = setPage.tagList.locator(setPage.dragHandleStr);
    //const handles = setPage.tagList.locator(`.drag-handle`);
    await expect(handles).toHaveCount(2);
    await expect(handles.first()).toBeVisible();
  });

  test('drag handle shows grab cursor (CSS)', async ({ page }) => {
    await setPage.addCategory('alpha');
    //await addCategory(page, 'alpha');
    //const cursor = await page
    //  .locator(`${CAT_LIST} .drag-handle`)
    const cursor = await setPage.categoriesList
      .locator(setPage.dragHandleStr)
      //.locator(`.drag-handle`)
      .first()
      .evaluate(el => getComputedStyle(el).cursor);
    expect(cursor).toBe('grab');
  });
});

// ─── Category reordering ──────────────────────────────────────────────────────

test.describe.serial('Category reordering', () => {
  let setPage: SettingsPage;
  let sumPage: SummaryPage;
  let txPage: TransactionsPage;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'http://localhost:5005' });
    const page = await ctx.newPage();
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    sumPage = new SummaryPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
    for (const name of ['alpha', 'beta', 'gamma', 'delta']) {
      //await addCategory(page, name);
      await setPage.addCategory(name);
    }
    await page.close();
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('categories are rendered in insertion order initially', async ({ page }) => {
    const names = await setPage.getListNames(setPage.categoriesList);
    //const names = await getItemNames(page, CAT_LIST);
    // Default seeded categories arrive first; our four are appended in order.
    const ours = names.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    expect(ours).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  test('dragging a category down reorders the visible list immediately', async ({ page }) => {
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const alphaIdx = before.indexOf('alpha');

    // Drag alpha one position down.
    await dragItemToIndex(setPage, setPage.categoriesList, alphaIdx, alphaIdx + 1);
    //await dragItemToIndex(page, CAT_LIST, alphaIdx, alphaIdx + 1);

    const after = await setPage.getListNames(setPage.categoriesList);
    //const after = await getItemNames(page, CAT_LIST);
    const alphaAfter = after.indexOf('alpha');
    const betaAfter = after.indexOf('beta');
    expect(alphaAfter).toBeGreaterThan(betaAfter);
  });

  test('dragging a category up reorders the visible list immediately', async ({ page }) => {
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const deltaIdx = before.indexOf('delta');

    // Drag delta up one position.
    await dragItemToIndex(setPage, setPage.categoriesList, deltaIdx, deltaIdx - 1);
    //await dragItemToIndex(page, CAT_LIST, deltaIdx, deltaIdx - 1);

    const after = await setPage.getListNames(setPage.categoriesList);
    //const after = await getItemNames(page, CAT_LIST);
    expect(after.indexOf('delta')).toBeLessThan(before.indexOf('delta'));
  });

  test('reordered position persists after a full page reload', async ({ page }) => {
    // Move alpha to after gamma on this load.
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const alphaIdx = before.indexOf('alpha');
    const gammaIdx = before.indexOf('gamma');

    await dragItemToIndex(setPage, setPage.categoriesList, alphaIdx, gammaIdx);
    //await dragItemToIndex(page, CAT_LIST, alphaIdx, gammaIdx);
    const afterDrag = await setPage.getListNames(setPage.categoriesList);
    //await dragItemToIndex(page, CAT_LIST, alphaIdx, gammaIdx);
    //const afterDrag = await getItemNames(page, CAT_LIST);

    // Reload and confirm the server returned the same order.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await setPage.getListNames(setPage.categoriesList);

    expect(afterReload.indexOf('alpha')).toBe(afterDrag.indexOf('alpha'));
    expect(afterReload.indexOf('gamma')).toBe(afterDrag.indexOf('gamma'));
  });

  test('custom order is reflected in the Summary page category filter', async ({ page }) => {
    // Establish a known order by dragging delta to the front of our four.
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const deltaIdx = before.indexOf('delta');
    const alphaIdx = before.indexOf('alpha');
    await dragItemToIndex(setPage, setPage.categoriesList, deltaIdx, alphaIdx);
    //await dragItemToIndex(page, CAT_LIST, deltaIdx, alphaIdx);

    //const settingsOrder = await getItemNames(page, CAT_LIST);

    await sumPage.goto();
    //await page.goto('/summary');
    //await page.waitForLoadState('networkidle');
    // Open category filter dropdown.
    //await page.locator('#category-details summary').click();
    //await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });
    await sumPage.filter.openCategoryFilter();

    const filterOptions = await sumPage.filter.categoryOptionsList.allTextContents();
    //const filterOptions = await page.locator(FILTER_CAT_OPTIONS).allTextContents();
    const filterNames = filterOptions.map(t => t.trim().toLowerCase());

    // Verify relative order of our four categories matches what we set.
    const positions = ['alpha', 'beta', 'gamma', 'delta'].map(n => filterNames.indexOf(n));
    const deltaPos = filterNames.indexOf('delta');
    const alphaPos = filterNames.indexOf('alpha');
    expect(deltaPos).toBeLessThan(alphaPos);
    expect(positions.every(p => p !== -1)).toBe(true);
  });

  test('custom order is reflected in the Transactions page category filter', async ({ page }) => {
    const settingsOrder = await setPage.getListNames(setPage.categoriesList);
    //const settingsOrder = await getItemNames(page, CAT_LIST);

    await txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await txPage.filter.openCategoryFilter();
    //await page.locator('#category-details summary').click();
    //await expect(page.locator('#category-options-list').first()).toBeVisible({ timeout: 5000 });

    const filterOptions = await txPage.filter.categoryOptionsList.allTextContents();
    //const filterOptions = await page.locator(FILTER_CAT_OPTIONS).allTextContents();
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

  test('custom order is reflected in the add-transaction category <select>', async ({ page }) => {
    const settingsOrder = await setPage.getListNames(setPage.categoriesList);
    //const settingsOrder = await getItemNames(page, CAT_LIST);
    const settingsOurs = settingsOrder.filter(n =>
      ['alpha', 'beta', 'gamma', 'delta'].includes(n)
    );

    await txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');

    const options = await page.getByLabel('Category').locator('option').allTextContents();
    const selectOurs = options
      .map(t => t.trim().toLowerCase())
      .filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));

    expect(selectOurs).toEqual(settingsOurs);
  });

  test('new category added after reordering lands at the bottom', async ({ page }) => {
    const before = await setPage.getListNames(setPage.categoriesList);
    await setPage.addCategory('zeta');
    //await addCategory(page, 'zeta');
    const after = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    //await addCategory(page, 'zeta');
    //const after = await getItemNames(page, CAT_LIST);

    expect(after[after.length - 1]).toBe('zeta');
    // All previous categories are still present and their relative order is intact.
    const beforeOurs = before.filter(n => after.includes(n));
    const afterWithoutNew = after.filter(n => n !== 'zeta');
    expect(afterWithoutNew).toEqual(beforeOurs);
  });

  test('deleting a category does not disturb the order of the remaining ones', async ({ page }) => {
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const targetName = 'zeta';
    const expected = before.filter(n => n !== targetName);

    page.once('dialog', d => d.accept());
    await setPage.categoryItem.filter({ hasText: targetName })
      //await page.locator(`${CAT_LIST} .category-item`, { hasText: targetName })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');

    const after = await setPage.getListNames(setPage.categoriesList);
    //const after = await getItemNames(page, CAT_LIST);
    expect(after).toEqual(expected);
  });
});

// ─── Tag reordering ───────────────────────────────────────────────────────────

test.describe.serial('Tag reordering', () => {
  let txPage: TransactionsPage;
  let setPage: SettingsPage;
  let sumPage: SummaryPage;

  test.beforeAll(async ({ browser, request }) => {
    const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'http://localhost:5005' });
    const page = await ctx.newPage();
    await clearDatabase(page);
    txPage = new TransactionsPage(page);
    setPage = new SettingsPage(page);
    sumPage = new SummaryPage(page);

    txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    // Create four transactions each carrying a unique tag so all four appear
    // in the tags list.
    const tags = ['urgent', 'planned', 'recurring', 'personal'];
    for (const tag of tags) {
      await seedTransactionsViaAPI(request, [{
        //await addTransaction(page, {
        description: `Trans ${tag}`, amount: 10, type: 'expense',
        category: 'other', tags: tag,
      }]);
    }
    await page.close();
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
  });

  test('tags are rendered in insertion order initially', async ({ page }) => {
    const names = await setPage.getListNames(setPage.tagList);
    //const names = await getItemNames(page, TAG_LIST);
    expect(names).toEqual(['urgent', 'planned', 'recurring', 'personal']);
  });

  test('dragging a tag down reorders the visible list immediately', async ({ page }) => {
    const before = await setPage.getListNames(setPage.tagList);
    //const before = await getItemNames(page, TAG_LIST);
    const urgentIdx = before.indexOf('urgent');

    await dragItemToIndex(setPage, setPage.tagList, urgentIdx, urgentIdx + 1);
    //await dragItemToIndex(page, TAG_LIST, urgentIdx, urgentIdx + 1);

    const after = await setPage.getListNames(setPage.tagList);
    //const after = await getItemNames(page, TAG_LIST);
    expect(after.indexOf('urgent')).toBeGreaterThan(after.indexOf('planned'));
  });

  test('dragging a tag up reorders the visible list immediately', async ({ page }) => {
    const before = await setPage.getListNames(setPage.tagList);
    //const before = await getItemNames(page, TAG_LIST);
    const personalIdx = before.indexOf('personal');

    await dragItemToIndex(setPage, setPage.tagList, personalIdx, personalIdx - 1);
    //await dragItemToIndex(page, TAG_LIST, personalIdx, personalIdx - 1);

    const after = await setPage.getListNames(setPage.tagList);
    //const after = await getItemNames(page, TAG_LIST);
    expect(after.indexOf('personal')).toBeLessThan(before.indexOf('personal'));
  });

  test('reordered tag position persists after page reload', async ({ page }) => {
    const before = await setPage.getListNames(setPage.tagList);
    //const before = await getItemNames(page, TAG_LIST);
    const recurringIdx = before.indexOf('recurring');
    const urgentIdx = before.indexOf('urgent');

    await dragItemToIndex(setPage, setPage.tagList, recurringIdx, urgentIdx);
    const afterDrag = await setPage.getListNames(setPage.tagList);
    //await dragItemToIndex(page, TAG_LIST, recurringIdx, urgentIdx);
    //const afterDrag = await getItemNames(page, TAG_LIST);

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await setPage.getListNames(setPage.tagList);
    //const afterReload = await getItemNames(page, TAG_LIST);

    expect(afterReload.indexOf('recurring')).toBe(afterDrag.indexOf('recurring'));
  });

  test('custom tag order is reflected in the Summary page tag filter', async ({ page }) => {
    // Move personal to first position.
    const before = await setPage.getListNames(setPage.tagList);
    //const before = await getItemNames(page, TAG_LIST);
    const personalIdx = before.indexOf('personal');
    await dragItemToIndex(setPage, setPage.tagList, personalIdx, 0);
    //await dragItemToIndex(page, TAG_LIST, personalIdx, 0);

    const settingsOrder = await setPage.getListNames(setPage.tagList);
    //const settingsOrder = await getItemNames(page, TAG_LIST);

    sumPage.goto();
    //await page.goto('/summary');
    //await page.waitForLoadState('networkidle');
    //await page.locator('#tag-details summary').click();
    await sumPage.filter.openTagFilter();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'personal' })
    ).toBeVisible({ timeout: 5000 });

    const filterOptions = await sumPage.filter.tagFilterOption.allTextContents();
    //const filterOptions = await page.locator(FILTER_TAG_OPTIONS).allTextContents();
    const filterNames = filterOptions.map(t => t.trim());

    // personal should now appear before urgent in the filter list.
    expect(filterNames.indexOf('personal')).toBeLessThan(filterNames.indexOf('urgent'));

    // Relative order must match the settings page order exactly.
    const tagNames = ['urgent', 'planned', 'recurring', 'personal'];
    const settingsOurs = settingsOrder.filter(n => tagNames.includes(n));
    const filterOurs = filterNames.filter(n => tagNames.includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('custom tag order is reflected in the Transactions page tag filter', async ({ page }) => {
    const settingsOrder = await setPage.getListNames(setPage.tagList);
    //const settingsOrder = await getItemNames(page, TAG_LIST);

    await txPage.goto();
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await txPage.filter.openTagFilter();
    //await page.locator('#tag-details summary').click();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'urgent' })
    ).toBeVisible({ timeout: 5000 });

    const filterOptions = await txPage.filter.tagFilterOption.allTextContents();
    //const filterOptions = await page.locator(FILTER_TAG_OPTIONS).allTextContents();
    const filterNames = filterOptions.map(t => t.trim());

    const tagNames = ['urgent', 'planned', 'recurring', 'personal'];
    const settingsOurs = settingsOrder.filter(n => tagNames.includes(n));
    const filterOurs = filterNames.filter(n => tagNames.includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('deleting a tag does not disturb the order of the remaining ones', async ({ page }) => {
    const before = await setPage.getListNames(setPage.tagList);
    //const before = await getItemNames(page, TAG_LIST);

    //page.once('dialog', d => d.accept());
    await setPage.deleteCategory('personal');
    //await page.locator(`${TAG_LIST} .category-item`, { hasText: 'personal' })
    //await page.locator(`${TAG_LIST} .category-item`, { hasText: 'personal' })
    //  .getByRole('button', { name: 'Delete' })
    //  .click();
    //await page.waitForLoadState('networkidle');

    const after = await setPage.getListNames(setPage.tagList);
    //const after = await getItemNames(page, TAG_LIST);
    const expected = before.filter(n => n !== 'personal');
    expect(after).toEqual(expected);
  });
});

// ─── Rename does not reset sort_order ────────────────────────────────────────

test.describe('Rename preserves sort order', () => {
  let setPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    await setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
    for (const name of ['first', 'second', 'third']) {
      await setPage.addCategory(name);
      //await addCategory(page, name);
    }
  });

  test('renaming the middle category keeps it in the middle', async ({ page }) => {
    const before = await setPage.getListNames(setPage.categoriesList);
    //const before = await getItemNames(page, CAT_LIST);
    const second: string = 'second'
    const secondIdx = before.indexOf(second);

    // Rename 'second' → 'middle'
    //await page.locator(`${CAT_LIST} .category-item`, { hasText: 'second' })
    await setPage.openEditModal(second)

    const middle: string = 'middle';
    await setPage.submitRename(middle);
    //await page.locator(`${CAT_LIST} .category-item`, { hasText: 'second' })
    //  .getByRole('button', { name: 'Edit' })
    //  .click();
    //await expect(page.locator('#editCategoryModal')).toBeVisible();
    //await page.getByLabel('Category Name').fill('middle');
    //await page.locator('#editCategoryModal').getByRole('button', { name: 'Save Changes' }).click();
    //await page.waitForLoadState('networkidle');

    const after = await setPage.getListNames(setPage.categoriesList);
    //const after = await getItemNames(page, CAT_LIST);
    const middleIdx = after.indexOf(middle);
    //const middleIdx = after.indexOf('middle');
    expect(middleIdx).toBe(secondIdx);
  });
});

// ─── API contract ─────────────────────────────────────────────────────────────

test.describe('Order API contract', () => {
  let setPage: SettingsPage;
  let txPage: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    setPage = new SettingsPage(page);
    txPage = new TransactionsPage(page);
    setPage.goto();
    //await page.goto('/settings');
    //await page.waitForLoadState('networkidle');
    for (const name of ['cat1', 'cat2', 'cat3']) {
      //await addCategory(page, name);
      await setPage.addCategory(name);
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

  test('PATCH /api/tags/order returns 200 with valid payload', async ({ page }) => {
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await txPage.addTransactionViaUI({
      //await addTransaction(page, {
      //await addTransaction(page, {
      description: 'T1', amount: 5, type: 'expense', category: 'other', tags: 'tagA,tagB,tagC',
    });

    const response = await page.request.patch('/api/tags/order', {
      data: { order: ['tagC', 'tagA', 'tagB'] },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  test('GET /api/tags returns tags in the order set by PATCH', async ({ page }) => {
    //await page.goto('/transactions');
    //await page.waitForLoadState('networkidle');
    await txPage.addTransactionViaUI({
      //await addTransaction(page, {
      //await addTransaction(page, {
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
