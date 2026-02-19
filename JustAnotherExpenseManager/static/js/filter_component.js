/**
 * Filter Component JavaScript
 * Handles multi-select category and tag filtering
 * Works with both summary and transactions pages
 */

function selectCategory(li) {
    const isAll = li.dataset.value === '';
    const allItems = Array.from(li.closest('details').querySelectorAll('.filter-option'));
    const allLi = allItems.find(el => el.dataset.value === '');

    if (isAll) {
        allItems.forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
    } else {
        if (allLi) allLi.classList.remove('selected');
        li.classList.toggle('selected');

        const anySelected = allItems.some(el => el.dataset.value !== '' && el.classList.contains('selected'));
        if (!anySelected) {
            if (allLi) allLi.classList.add('selected');
        }
    }

    updateCategorySummary();
    applyFilters();
}

function selectTag(li) {
    const isAll = li.dataset.value === '';
    const allItems = Array.from(li.closest('details').querySelectorAll('.filter-option'));
    const allLi = allItems.find(el => el.dataset.value === '');

    if (isAll) {
        allItems.forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
    } else {
        if (allLi) allLi.classList.remove('selected');
        li.classList.toggle('selected');

        const anySelected = allItems.some(el => el.dataset.value !== '' && el.classList.contains('selected'));
        if (!anySelected) {
            if (allLi) allLi.classList.add('selected');
        }
    }

    updateTagSummary();
    applyFilters();
}

function updateCategorySummary() {
    const selected = Array.from(
        document.querySelectorAll('#category-options-list .filter-option.selected')
    );
    const summaryText = selected.length === 0 ? 'All Categories' :
                        selected.length === 1 ? selected[0].dataset.value :
                        `${selected.length} categories`;

    const summary = document.getElementById('category-summary');
    if (summary) summary.textContent = summaryText;
}

function updateTagSummary() {
    const selected = Array.from(
        document.querySelectorAll('#tag-options-list .filter-option.selected')
    );
    const summaryText = selected.length === 0 ? 'All Tags' :
                        selected.length === 1 ? selected[0].dataset.value :
                        `${selected.length} tags`;

    const summary = document.getElementById('tag-summary');
    if (summary) summary.textContent = summaryText;
}

/**
 * Returns active filter params parsed from the current URL.
 */
function getUrlFilterParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        categories: params.get('categories') ? params.get('categories').split(',').filter(Boolean) : [],
        tags: params.get('tags') ? params.get('tags').split(',').filter(Boolean) : [],
        range: params.get('range') || '',
        start_date: params.get('start_date') || '',
        end_date: params.get('end_date') || '',
    };
}

/**
 * Restores the time-range select and custom date picker from URL params.
 */
function restoreTimeRangeFromUrl() {
    const { range, start_date, end_date } = getUrlFilterParams();

    const timeRangeEl = document.getElementById('time-range');
    if (!timeRangeEl) return;

    if (start_date && end_date) {
        timeRangeEl.value = 'custom';
        const customPicker = document.getElementById('custom-range-picker');
        if (customPicker) customPicker.style.display = 'block';
        const startEl = document.getElementById('start-date');
        const endEl = document.getElementById('end-date');
        if (startEl) startEl.value = start_date;
        if (endEl) endEl.value = end_date;
    } else if (range) {
        timeRangeEl.value = range;
    }
}

// Load categories for filter, restoring selected state from URL params
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();

        const list = document.getElementById('category-options-list');
        if (!list) return;

        list.innerHTML = '';

        const { categories: selectedCategories } = getUrlFilterParams();

        categories.forEach(cat => {
            const li = document.createElement('li');
            const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);

            li.className = 'filter-option';
            li.dataset.value = cat.name;
            li.textContent = displayName;
            li.onclick = () => selectCategory(li);

            if (selectedCategories.includes(cat.name)) {
                li.classList.add('selected');
            }

            list.appendChild(li);
        });

        // If specific categories are restored, deselect "All"
        if (selectedCategories.length > 0) {
            const allLi = document.querySelector('#category-details .filter-option[data-value=""]');
            if (allLi) allLi.classList.remove('selected');
            updateCategorySummary();
            const details = document.getElementById('category-details');
            if (details) details.open = true;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load tags for filter, restoring selected state from URL params
async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        const tags = await response.json();

        const list = document.getElementById('tag-options-list');
        if (!list) return;

        list.innerHTML = '';

        const { tags: selectedTags } = getUrlFilterParams();

        // Filter out category tags (defensive — API should not return them)
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

        // If specific tags are restored, deselect "All"
        if (selectedTags.length > 0) {
            const allLi = document.querySelector('#tag-details .filter-option[data-value=""]');
            if (allLi) allLi.classList.remove('selected');
            updateTagSummary();
            const details = document.getElementById('tag-details');
            if (details) details.open = true;
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function filterByTimeRange(range) {
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

function applyCustomRange() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    applyFilters();
}

function applyFilters() {
    const timeRange = document.getElementById('time-range')?.value;
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;

    // Get selected categories
    const categories = Array.from(
        document.querySelectorAll('#category-options-list .filter-option.selected')
    ).map(el => el.dataset.value).filter(Boolean);

    // Get selected tags
    const tags = Array.from(
        document.querySelectorAll('#tag-options-list .filter-option.selected')
    ).map(el => el.dataset.value).filter(Boolean);

    // Get target URL and element from data attributes or use defaults
    const filterSection = document.querySelector('.filter-section');
    const targetUrl = filterSection?.dataset.targetUrl || '/api/stats';
    const targetElement = filterSection?.dataset.targetElement || '#stats-container';

    let url = targetUrl;
    const params = [];

    if (categories.length > 0) params.push(`categories=${categories.join(',')}`);
    if (tags.length > 0) params.push(`tags=${tags.join(',')}`);
    if (timeRange && timeRange !== 'custom') params.push(`range=${timeRange}`);
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);

    if (params.length > 0) {
        url += '?' + params.join('&');
    }

    // Push filter state into the browser URL so state survives page reloads
    const newPageUrl = params.length > 0
        ? `${window.location.pathname}?${params.join('&')}`
        : window.location.pathname;
    history.pushState(null, '', newPageUrl);

    // Check if htmx is loaded
    if (typeof htmx !== 'undefined') {
        htmx.ajax('GET', url, {target: targetElement, swap: 'innerHTML'});
    } else {
        console.error('HTMX is not loaded - falling back to window.location');
        window.location.href = url;
    }
}

// Initialize filters when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('category-options-list')) {
        restoreTimeRangeFromUrl();
        loadCategories();
        loadTags();
    }

    // If URL already has filter params on initial load, trigger content update
    if (window.location.search) {
        const filterSection = document.querySelector('.filter-section');
        const targetUrl = filterSection?.dataset.targetUrl;
        const targetElement = filterSection?.dataset.targetElement;
        if (targetUrl && targetElement && typeof htmx !== 'undefined') {
            htmx.ajax('GET', targetUrl + window.location.search, {target: targetElement, swap: 'innerHTML'});
        }
    }
});

// Make functions globally available
window.selectCategory = selectCategory;
window.selectTag = selectTag;
window.filterByTimeRange = filterByTimeRange;
window.applyCustomRange = applyCustomRange;
window.applyFilters = applyFilters;
