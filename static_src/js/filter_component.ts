/**
 * Filter Component
 * Handles multi-select category and tag filtering.
 * Works with both the Summary and Transactions pages.
 */

import type { Category } from "./types";

function selectCategory(li: HTMLLIElement): void {
  const isAll = li.dataset.value === '';
  const allItems = Array.from(
    li.closest('details')!.querySelectorAll<HTMLLIElement>('.filter-option')
  );
  const allLi = allItems.find(el => el.dataset.value === '');

  if (isAll) {
    allItems.forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
  } else {
    allLi?.classList.remove('selected');
    li.classList.toggle('selected');

    const anySelected = allItems.some(
      el => el.dataset.value !== '' && el.classList.contains('selected')
    );
    if (!anySelected) {
      allLi?.classList.add('selected');
    }
  }

  updateCategorySummary();
  applyFilters();
}

function selectTag(li: HTMLLIElement): void {
  const isAll = li.dataset.value === '';
  const allItems = Array.from(
    li.closest('details')!.querySelectorAll<HTMLLIElement>('.filter-option')
  );
  const allLi = allItems.find(el => el.dataset.value === '');

  if (isAll) {
    allItems.forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
  } else {
    allLi?.classList.remove('selected');
    li.classList.toggle('selected');

    const anySelected = allItems.some(
      el => el.dataset.value !== '' && el.classList.contains('selected')
    );
    if (!anySelected) {
      allLi?.classList.add('selected');
    }
  }

  updateTagSummary();
  applyFilters();
}

function updateCategorySummary(): void {
  const selected = Array.from(
    document.querySelectorAll<HTMLLIElement>('#category-options-list .filter-option.selected')
  );
  const summaryText =
    selected.length === 0 ? 'All Categories' :
      selected.length === 1 ? (selected[0].dataset.value ?? 'All Categories') :
        `${selected.length} categories`;

  const summary = document.getElementById('category-summary');
  if (summary) summary.textContent = summaryText;
}

function updateTagSummary(): void {
  const selected = Array.from(
    document.querySelectorAll<HTMLLIElement>('#tag-options-list .filter-option.selected')
  );
  const summaryText =
    selected.length === 0 ? 'All Tags' :
      selected.length === 1 ? (selected[0].dataset.value ?? 'All Tags') :
        `${selected.length} tags`;

  const summary = document.getElementById('tag-summary');
  if (summary) summary.textContent = summaryText;
}

interface UrlFilterParams {
  categories: string[];
  tags: string[];
  range: string;
  start_date: string;
  end_date: string;
}

function getUrlFilterParams(): UrlFilterParams {
  const params = new URLSearchParams(window.location.search);
  return {
    categories: params.get('categories')?.split(',').filter(Boolean) ?? [],
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
    range: params.get('range') ?? '',
    start_date: params.get('start_date') ?? '',
    end_date: params.get('end_date') ?? '',
  };
}

function restoreTimeRangeFromUrl(): void {
  const { range, start_date, end_date } = getUrlFilterParams();

  const timeRangeEl = document.getElementById('time-range') as HTMLSelectElement | null;
  if (!timeRangeEl) return;

  if (start_date && end_date) {
    timeRangeEl.value = 'custom';
    const customPicker = document.getElementById('custom-range-picker');
    if (customPicker) customPicker.style.display = 'block';
    const startEl = document.getElementById('start-date') as HTMLInputElement | null;
    const endEl = document.getElementById('end-date') as HTMLInputElement | null;
    if (startEl) startEl.value = start_date;
    if (endEl) endEl.value = end_date;
  } else if (range) {
    timeRangeEl.value = range;
  }
}

async function loadCategories(): Promise<void> {
  try {
    const response = await fetch('/api/categories');
    const categories: Category[] = await response.json();

    const list = document.getElementById('category-options-list');
    if (!list) return;

    list.innerHTML = '';

    const { categories: selectedCategories } = getUrlFilterParams();

    categories.forEach(cat => {
      const li = document.createElement('li');
      const displayName =
        cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);

      li.className = 'filter-option';
      li.dataset.value = cat.category_name;
      li.textContent = displayName;
      li.onclick = () => selectCategory(li);

      if (selectedCategories.includes(cat.category_name)) {
        li.classList.add('selected');
      }

      list.appendChild(li);
    });

    if (selectedCategories.length > 0) {
      const allLi = document.querySelector<HTMLLIElement>(
        '#category-details .filter-option[data-value=""]'
      );
      allLi?.classList.remove('selected');
      updateCategorySummary();
      const details = document.getElementById('category-details') as HTMLDetailsElement | null;
      if (details) details.open = true;
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

async function loadTags(): Promise<void> {
  try {
    const response = await fetch('/api/tags');
    const tags: string[] = await response.json();

    const list = document.getElementById('tag-options-list');
    if (!list) return;

    list.innerHTML = '';

    const { tags: selectedTags } = getUrlFilterParams();

    const nonCategoryTags = tags.filter(tag => !tag.startsWith('category:'));

    nonCategoryTags.forEach(tag => {
      const li = document.createElement('li');

      li.className = 'filter-option';
      li.dataset.value = tag;
      li.textContent = tag;
      li.onclick = () => selectTag(li);

      if (selectedTags.includes(tag)) {
        li.classList.add('selected');
      }

      list.appendChild(li);
    });

    if (selectedTags.length > 0) {
      const allLi = document.querySelector<HTMLLIElement>(
        '#tag-details .filter-option[data-value=""]'
      );
      allLi?.classList.remove('selected');
      updateTagSummary();
      const details = document.getElementById('tag-details') as HTMLDetailsElement | null;
      if (details) details.open = true;
    }
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

function filterByTimeRange(range: string): void {
  const customPicker = document.getElementById('custom-range-picker');

  if (!customPicker) {
    console.warn('Custom range picker element not found');
    if (range !== 'custom') {
      applyFilters();
    }
    return;
  }

  if (range === 'custom') {
    customPicker.style.display = 'block';
    return;
  } else {
    customPicker.style.display = 'none';
  }

  applyFilters();
}

function applyCustomRange(): void {
  const startDate = (document.getElementById('start-date') as HTMLInputElement | null)?.value;
  const endDate = (document.getElementById('end-date') as HTMLInputElement | null)?.value;

  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }

  applyFilters();
}

function applyFilters(): void {
  const timeRange = (document.getElementById('time-range') as HTMLSelectElement | null)?.value;
  const startDate = (document.getElementById('start-date') as HTMLInputElement | null)?.value;
  const endDate = (document.getElementById('end-date') as HTMLInputElement | null)?.value;

  const categories = Array.from(
    document.querySelectorAll<HTMLLIElement>('#category-options-list .filter-option.selected')
  ).map(el => el.dataset.value).filter((v): v is string => Boolean(v));

  const tags = Array.from(
    document.querySelectorAll<HTMLLIElement>('#tag-options-list .filter-option.selected')
  ).map(el => el.dataset.value).filter((v): v is string => Boolean(v));

  const filterSection = document.querySelector<HTMLElement>('.filter-section');
  const targetUrl = filterSection?.dataset.targetUrl ?? '/api/stats';
  const targetElement = filterSection?.dataset.targetElement ?? '#stats-container';

  const params: string[] = [];

  if (categories.length > 0) params.push(`categories=${categories.join(',')}`);
  if (tags.length > 0) params.push(`tags=${tags.join(',')}`);
  if (timeRange && timeRange !== 'custom') params.push(`range=${timeRange}`);
  if (startDate) params.push(`start_date=${startDate}`);
  if (endDate) params.push(`end_date=${endDate}`);

  const url = params.length > 0 ? `${targetUrl}?${params.join('&')}` : targetUrl;

  const newPageUrl = params.length > 0
    ? `${window.location.pathname}?${params.join('&')}`
    : window.location.pathname;
  history.pushState(null, '', newPageUrl);

  if (typeof window.refreshCharts === 'function') {
    window.refreshCharts(params.join('&'));
  }

  fetch(url)
    .then(response => response.text())
    .then(html => {
      const target = document.querySelector(targetElement);
      if (target) target.innerHTML = html;
    })
    .catch(error => console.error('Error applying filters:', error));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('category-options-list')) {
    restoreTimeRangeFromUrl();
    loadCategories();
    loadTags();
  }

  if (window.location.search) {
    const filterSection = document.querySelector<HTMLElement>('.filter-section');
    const targetUrl = filterSection?.dataset.targetUrl;
    const targetElement = filterSection?.dataset.targetElement;
    if (targetUrl && targetElement) {
      fetch(targetUrl + window.location.search)
        .then(response => response.text())
        .then(html => {
          const target = document.querySelector(targetElement);
          if (target) target.innerHTML = html;
        })
        .catch(error => console.error('Error restoring filters:', error));
    }
  }
});

window.selectCategory = selectCategory;
window.selectTag = selectTag;
window.filterByTimeRange = filterByTimeRange;
window.applyCustomRange = applyCustomRange;
window.applyFilters = applyFilters;
