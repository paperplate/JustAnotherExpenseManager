/**
 * Category & Tag Reorder Tests
 *
 * Verifies drag-to-reorder on the Settings page and confirms the persisted
 * order flows through to filter dropdowns and the add-transaction <select>.
 *
 * Drag mechanics note
 * -------------------
 * Sortable.js uses pointer/mouse events, not the HTML5 DnD API.
 * Playwright's page.dragAndDrop() dispatches HTML5 drag events → no effect.
 * All drags here use the low-level mouse API (mousedown → moves → mouseup).
 */

import { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { clearDatabase, seedTransactionsViaAPI } from './helpers';
import { SettingsPage } from './pages/SettingsPage';

// ── Shared drag helper ────────────────────────────────────────────────────────

async function dragItemToIndex(
  setPage: SettingsPage,
  listLocator: Locator,
  sourceIndex: number,
  targetIndex: number,
): Promise<void> {
  const source = listLocator.locator('.drag-handle').nth(sourceIndex);
  const target = listLocator.locator('.drag-handle').nth(targetIndex);

  await source.hover();
  await setPage.page.mouse.down();
  await setPage.page.mouse.move(0, 10);

  const box = await target.boundingBox();
  if (box) {
    await setPage.page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 5 },
    );
  }
  await setPage.page.mouse.up();
}

// ── Drag handle visibility ────────────────────────────────────────────────────

test.describe('Drag handle visibility', () => {
  test.beforeEach(async ({ request, settingsPage }) => {
    await clearDatabase(request);
    await settingsPage.goto();
  });

  test('each category item has a visible drag handle', async ({ settingsPage }) => {
    await settingsPage.addCategory('alpha');
    await settingsPage.addCategory('beta');
    const handles = settingsPage.categoriesList.locator('.drag-handle');
    await expect(handles.first()).toBeVisible();
  });

  test('each tag item has a visible drag handle', async ({ request, settingsPage, transactionsPage }) => {
    await transactionsPage.goto();
    await seedTransactionsViaAPI(request, [{
      description: 'Tagged A', amount: 10, type: 'expense',
      category: 'other', tags: 'urgent,planned',
    }]);
    await settingsPage.goto();
    await settingsPage.page.waitForLoadState('networkidle');

    const handles = settingsPage.tagList.locator('.drag-handle');
    await expect(handles).toHaveCount(2);
    await expect(handles.first()).toBeVisible();
  });

  test('drag handle has grab cursor', async ({ settingsPage }) => {
    await settingsPage.addCategory('alpha');
    await expect(settingsPage.categoriesList.locator('.drag-handle').first())
      .toHaveCSS('cursor', 'grab');
  });
});

// ── Category reordering ───────────────────────────────────────────────────────

// serial: tests depend on ordering established by earlier tests in the block.
test.describe.configure({ mode: 'serial' });

test.describe('Category reordering', () => {
  test.beforeEach(async ({ request, settingsPage }) => {
    await clearDatabase(request);
    await settingsPage.goto();
    for (const name of ['alpha', 'beta', 'gamma', 'delta']) {
      await settingsPage.addCategory(name);
    }
  });

  test('categories render in insertion order initially', async ({ settingsPage }) => {
    const names = await settingsPage.getListNames(settingsPage.categoriesList);
    const ours = names.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    expect(ours).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  test('dragging a category down reorders the list immediately', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const alphaIdx = before.indexOf('alpha');
    await dragItemToIndex(settingsPage, settingsPage.categoriesList, alphaIdx, alphaIdx + 1);
    const after = await settingsPage.getListNames(settingsPage.categoriesList);
    expect(after.indexOf('alpha')).toBeGreaterThan(after.indexOf('beta'));
  });

  test('dragging a category up reorders the list immediately', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const deltaIdx = before.indexOf('delta');
    await dragItemToIndex(settingsPage, settingsPage.categoriesList, deltaIdx, deltaIdx - 1);
    const after = await settingsPage.getListNames(settingsPage.categoriesList);
    expect(after.indexOf('delta')).toBeLessThan(before.indexOf('delta'));
  });

  test('reordered position persists after page reload', async ({ page, settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const alphaIdx = before.indexOf('alpha');
    const gammaIdx = before.indexOf('gamma');
    await dragItemToIndex(settingsPage, settingsPage.categoriesList, alphaIdx, gammaIdx);
    const afterDrag = await settingsPage.getListNames(settingsPage.categoriesList);

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await settingsPage.getListNames(settingsPage.categoriesList);

    expect(afterReload.indexOf('alpha')).toBe(afterDrag.indexOf('alpha'));
    expect(afterReload.indexOf('gamma')).toBe(afterDrag.indexOf('gamma'));
  });

  test('custom order reflected in Summary page category filter', async ({ settingsPage, summaryPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const deltaIdx = before.indexOf('delta');
    const alphaIdx = before.indexOf('alpha');
    await dragItemToIndex(settingsPage, settingsPage.categoriesList, deltaIdx, alphaIdx);

    await summaryPage.goto();
    await summaryPage.filter.openCategoryFilter();

    const filterTexts = await summaryPage.filter.categoryFilterOption.allTextContents();
    const filterNames = filterTexts.map(t => t.trim().toLowerCase());

    expect(filterNames.indexOf('delta')).toBeLessThan(filterNames.indexOf('alpha'));
    expect(['alpha', 'beta', 'gamma', 'delta'].every(n => filterNames.includes(n))).toBe(true);
  });

  test('custom order reflected in Transactions page category filter', async ({ settingsPage, transactionsPage }) => {
    const settingsOrder = await settingsPage.getListNames(settingsPage.categoriesList);

    await transactionsPage.goto();
    await transactionsPage.filter.openCategoryFilter();

    const filterTexts = await transactionsPage.filter.categoryFilterOption.allTextContents();
    const filterNames = filterTexts.map(t => t.trim().toLowerCase());

    const settingsOurs = settingsOrder.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    const filterOurs = filterNames.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('custom order reflected in add-transaction category <select>', async ({ settingsPage, transactionsPage }) => {
    const settingsOrder = await settingsPage.getListNames(settingsPage.categoriesList);
    const settingsOurs = settingsOrder.filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));

    // Wait for loadCategorySelect() to finish populating the <select>.
    const categoriesResponse = transactionsPage.page.waitForResponse(
      res => res.url().includes('/api/categories') && res.status() === 200,
    );
    await transactionsPage.goto();
    await categoriesResponse;

    // Confirm at least one of our options is present before reading all.
    await expect(
      transactionsPage.page.getByLabel('Category').locator('option', { hasText: 'Alpha' }),
    ).toBeAttached();

    // scope to <option> children — allTextContents() on <select> returns a single blob.
    const options = await transactionsPage.categorySelect.locator('option').allTextContents();
    const selectOurs = options
      .map(t => t.trim().toLowerCase())
      .filter(n => ['alpha', 'beta', 'gamma', 'delta'].includes(n));

    expect(selectOurs).toEqual(settingsOurs);
  });

  test('new category added after reordering lands at the bottom', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    await settingsPage.addCategory('zeta');
    await expect(settingsPage.categoryItem.filter({ hasText: 'zeta' })).toBeVisible();

    const after = await settingsPage.getListNames(settingsPage.categoriesList);
    expect(after[after.length - 1]).toBe('zeta');

    const beforeOurs = before.filter(n => after.includes(n));
    expect(after.filter(n => n !== 'zeta')).toEqual(beforeOurs);
  });

  test('deleting a category does not disturb remaining order', async ({ page, settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const expected = before.filter(n => n !== 'delta');

    page.once('dialog', d => d.accept());
    await settingsPage.categoryItem.filter({ hasText: 'delta' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForLoadState('networkidle');

    const after = await settingsPage.getListNames(settingsPage.categoriesList);
    expect(after).toEqual(expected);
  });
});

// ── Tag reordering ────────────────────────────────────────────────────────────

test.describe('Tag reordering', () => {
  test.beforeEach(async ({ request, settingsPage, transactionsPage }) => {
    await clearDatabase(request);
    await transactionsPage.goto();
    for (const tag of ['urgent', 'planned', 'recurring', 'personal']) {
      await seedTransactionsViaAPI(request, [{
        description: `Trans ${tag}`, amount: 10, type: 'expense',
        category: 'other', tags: tag,
      }]);
    }
    await settingsPage.goto();
  });

  test('tags render in insertion order initially', async ({ settingsPage }) => {
    const names = await settingsPage.getListNames(settingsPage.tagList);
    expect(names).toEqual(['urgent', 'planned', 'recurring', 'personal']);
  });

  test('dragging a tag down reorders list immediately', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.tagList);
    const urgentIdx = before.indexOf('urgent');
    await dragItemToIndex(settingsPage, settingsPage.tagList, urgentIdx, urgentIdx + 1);
    const after = await settingsPage.getListNames(settingsPage.tagList);
    expect(after.indexOf('urgent')).toBeGreaterThan(after.indexOf('planned'));
  });

  test('dragging a tag up reorders list immediately', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.tagList);
    const personalIdx = before.indexOf('personal');
    await dragItemToIndex(settingsPage, settingsPage.tagList, personalIdx, personalIdx - 1);
    const after = await settingsPage.getListNames(settingsPage.tagList);
    expect(after.indexOf('personal')).toBeLessThan(before.indexOf('personal'));
  });

  test('reordered tag position persists after page reload', async ({ page, settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.tagList);
    const recurringIdx = before.indexOf('recurring');
    const urgentIdx = before.indexOf('urgent');
    await dragItemToIndex(settingsPage, settingsPage.tagList, recurringIdx, urgentIdx);
    const afterDrag = await settingsPage.getListNames(settingsPage.tagList);

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await settingsPage.getListNames(settingsPage.tagList);
    expect(afterReload.indexOf('recurring')).toBe(afterDrag.indexOf('recurring'));
  });

  test('custom tag order reflected in Summary page tag filter', async ({ page, summaryPage, settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.tagList);
    const personalIdx = before.indexOf('personal');
    await dragItemToIndex(settingsPage, settingsPage.tagList, personalIdx, 0);
    const settingsOrder = await settingsPage.getListNames(settingsPage.tagList);

    await summaryPage.goto();
    await summaryPage.filter.openTagFilter();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'personal' }),
    ).toBeVisible({ timeout: 5_000 });

    const filterTexts = await summaryPage.filter.tagFilterOption.allTextContents();
    const filterNames = filterTexts.map(t => t.trim());

    expect(filterNames.indexOf('personal')).toBeLessThan(filterNames.indexOf('urgent'));

    const tags = ['urgent', 'planned', 'recurring', 'personal'];
    const settingsOurs = settingsOrder.filter(n => tags.includes(n));
    const filterOurs = filterNames.filter(n => tags.includes(n));
    expect(filterOurs).toEqual(settingsOurs);
  });

  test('custom tag order reflected in Transactions page tag filter', async ({ page, transactionsPage, settingsPage }) => {
    const settingsOrder = await settingsPage.getListNames(settingsPage.tagList);

    await transactionsPage.goto();
    await transactionsPage.filter.openTagFilter();
    await expect(
      page.locator('#tag-options-list').filter({ hasText: 'urgent' }),
    ).toBeVisible({ timeout: 5_000 });

    const filterTexts = await transactionsPage.filter.tagFilterOption.allTextContents();
    const filterNames = filterTexts.map(t => t.trim());

    const tags = ['urgent', 'planned', 'recurring', 'personal'];
    expect(settingsOrder.filter(n => tags.includes(n))).toEqual(filterNames.filter(n => tags.includes(n)));
  });

  test('deleting a tag does not disturb remaining order', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.tagList);
    await settingsPage.deleteTag('personal');
    const after = await settingsPage.getListNames(settingsPage.tagList);
    expect(after).toEqual(before.filter(n => n !== 'personal'));
  });
});

// ── Rename preserves sort_order ───────────────────────────────────────────────

test.describe('Rename preserves sort order', () => {
  test.beforeEach(async ({ request, settingsPage }) => {
    await clearDatabase(request);
    await settingsPage.goto();
    for (const name of ['first', 'second', 'third']) {
      await settingsPage.addCategory(name);
    }
  });

  test('renaming the middle category keeps it in the middle', async ({ settingsPage }) => {
    const before = await settingsPage.getListNames(settingsPage.categoriesList);
    const secondIdx = before.indexOf('second');

    await settingsPage.openEditModal('second');
    await settingsPage.submitRename('middle');
    await expect(settingsPage.categoryItem.filter({ hasText: 'middle' })).toBeVisible();

    const after = await settingsPage.getListNames(settingsPage.categoriesList);
    expect(after.indexOf('middle')).toBe(secondIdx);
  });
});

// ── API contract ──────────────────────────────────────────────────────────────

test.describe('Order API contract', () => {
  test.beforeEach(async ({ request, settingsPage }) => {
    await clearDatabase(request);
    await settingsPage.goto();
    for (const name of ['cat1', 'cat2', 'cat3']) {
      await settingsPage.addCategory(name);
    }
  });

  test('PATCH /api/categories/order returns 200 with valid payload', async ({ page }) => {
    const res = await page.request.patch('/api/categories/order', {
      data: { order: ['cat3', 'cat1', 'cat2'] },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  test('PATCH /api/categories/order with non-array body returns 400', async ({ page }) => {
    const res = await page.request.patch('/api/categories/order', {
      data: { order: 'not-an-array' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/categories returns categories in PATCH order', async ({ page }) => {
    await page.request.patch('/api/categories/order', {
      data: { order: ['cat3', 'cat1', 'cat2'] },
    });
    const res = await page.request.get('/api/categories');
    const cats: { category_name: string }[] = await res.json();
    const names = cats.map(c => c.category_name).filter(n => ['cat1', 'cat2', 'cat3'].includes(n));
    expect(names).toEqual(['cat3', 'cat1', 'cat2']);
  });

  test('PATCH /api/tags/order returns 200 with valid payload', async ({ page, transactionsPage }) => {
    await transactionsPage.goto();
    await transactionsPage.addTransactionViaUI({
      description: 'T1', amount: 5, type: 'expense', category: 'other', tags: 'tagA,tagB,tagC',
    });
    const res = await page.request.patch('/api/tags/order', {
      data: { order: ['tagC', 'tagA', 'tagB'] },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  test('GET /api/tags returns tags in PATCH order', async ({ page, transactionsPage }) => {
    await transactionsPage.goto();
    await transactionsPage.addTransactionViaUI({
      description: 'T2', amount: 5, type: 'expense', category: 'other', tags: 'tagA,tagB,tagC',
    });
    await page.request.patch('/api/tags/order', {
      data: { order: ['tagC', 'tagA', 'tagB'] },
    });
    const tags: string[] = await (await page.request.get('/api/tags')).json();
    expect(tags.filter(t => ['tagA', 'tagB', 'tagC'].includes(t))).toEqual(['tagC', 'tagA', 'tagB']);
  });
});
