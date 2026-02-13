/**
 * Filter Component JavaScript
 * Handles multi-select category and tag filtering
 * Works with both summary and transactions pages
 */

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    const categoryWrapper = document.querySelector('#category-display')?.closest('.multi-select-wrapper');
    const tagWrapper = document.querySelector('#tag-display')?.closest('.multi-select-wrapper');

    const categoryDropdown = document.getElementById('category-dropdown');
    const tagDropdown = document.getElementById('tag-dropdown');

    if (categoryWrapper && !categoryWrapper.contains(event.target) && categoryDropdown) {
        categoryDropdown.style.display = 'none';
    }
    if (tagWrapper && !tagWrapper.contains(event.target) && tagDropdown) {
        tagDropdown.style.display = 'none';
    }
});

function toggleCategoryDropdown() {
    const dropdown = document.getElementById('category-dropdown');
    const tagDropdown = document.getElementById('tag-dropdown');

    if (!dropdown) return;

    // FIX: Handle initial empty state or 'none'
    const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
    dropdown.style.display = isHidden ? 'block' : 'none';
    if (tagDropdown) tagDropdown.style.display = 'none';
}

function toggleTagDropdown() {
    const dropdown = document.getElementById('tag-dropdown');
    const categoryDropdown = document.getElementById('category-dropdown');

    if (!dropdown) return;

    // FIX: Handle initial empty state or 'none'
    const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
    dropdown.style.display = isHidden ? 'block' : 'none';
    if (categoryDropdown) categoryDropdown.style.display = 'none';
}

function updateCategorySelection() {
    const checkboxes = document.querySelectorAll('#category-dropdown input[type="checkbox"]');

    // Guard against empty checkboxes
    if (!checkboxes || checkboxes.length === 0) {
        console.warn('No category checkboxes found');
        return;
    }

    const allCheckbox = checkboxes[0];
    const otherCheckboxes = Array.from(checkboxes).slice(1);

    // Guard against missing "All" checkbox
    if (!allCheckbox) {
        console.warn('All checkbox not found');
        return;
    }

    // If "All" is checked, uncheck others
    if (allCheckbox.checked) {
        otherCheckboxes.forEach(cb => cb.checked = false);
    } else {
        // If any other is checked, uncheck "All"
        const anyChecked = otherCheckboxes.some(cb => cb.checked);
        if (anyChecked) {
            allCheckbox.checked = false;
        } else {
            // If none are checked, check "All"
            allCheckbox.checked = true;
        }
    }

    // Update display text
    const selected = otherCheckboxes.filter(cb => cb.checked);
    const displayText = selected.length === 0 ? 'All Categories' :
                       selected.length === 1 ? selected[0].value :
                       `${selected.length} categories`;

    const displayElement = document.getElementById('category-selected-text');
    if (displayElement) {
        displayElement.textContent = displayText;
    }

    // Apply filters
    applyFilters();
}

function updateTagSelection() {
    const checkboxes = document.querySelectorAll('#tag-dropdown input[type="checkbox"]');

    // Guard against empty checkboxes
    if (!checkboxes || checkboxes.length === 0) {
        console.warn('No tag checkboxes found');
        return;
    }

    const allCheckbox = checkboxes[0];
    const otherCheckboxes = Array.from(checkboxes).slice(1);

    // Guard against missing "All" checkbox
    if (!allCheckbox) {
        console.warn('All checkbox not found');
        return;
    }

    // If "All" is checked, uncheck others
    if (allCheckbox.checked) {
        otherCheckboxes.forEach(cb => cb.checked = false);
    } else {
        // If any other is checked, uncheck "All"
        const anyChecked = otherCheckboxes.some(cb => cb.checked);
        if (anyChecked) {
            allCheckbox.checked = false;
        } else {
            // If none are checked, check "All"
            allCheckbox.checked = true;
        }
    }

    // Update display text
    const selected = otherCheckboxes.filter(cb => cb.checked);
    const displayText = selected.length === 0 ? 'All Tags' :
                       selected.length === 1 ? selected[0].value :
                       `${selected.length} tags`;

    const displayElement = document.getElementById('tag-selected-text');
    if (displayElement) {
        displayElement.textContent = displayText;
    }

    // Apply filters
    applyFilters();
}

// Load categories for filter
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();

        const list = document.getElementById('category-options-list');
        if (!list) return;

        list.innerHTML = '';

        categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'multi-select-option';

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = cat.name;
            checkbox.onchange = updateCategorySelection;

            const text = document.createTextNode(cat.name.charAt(0).toUpperCase() + cat.name.slice(1));

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' '));
            label.appendChild(text);
            div.appendChild(label);
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load tags for filter
async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        const tags = await response.json();

        const list = document.getElementById('tag-options-list');
        if (!list) return;

        list.innerHTML = '';

        // Filter out category tags
        const nonCategoryTags = tags.filter(tag => !tag.startsWith('category:'));

        nonCategoryTags.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'multi-select-option';

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag;
            checkbox.onchange = updateTagSelection;

            const text = document.createTextNode(tag);

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' '));
            label.appendChild(text);
            div.appendChild(label);
            list.appendChild(div);
        });
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
    const categoryCheckboxes = Array.from(document.querySelectorAll('#category-options-list input[type="checkbox"]:checked'));
    const categories = categoryCheckboxes.map(cb => cb.value).filter(Boolean);

    // Get selected tags
    const tagCheckboxes = Array.from(document.querySelectorAll('#tag-options-list input[type="checkbox"]:checked'));
    const tags = tagCheckboxes.map(cb => cb.value).filter(Boolean);

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
        loadCategories();
        loadTags();
    }
});

// Make functions globally available
window.toggleCategoryDropdown = toggleCategoryDropdown;
window.toggleTagDropdown = toggleTagDropdown;
window.updateCategorySelection = updateCategorySelection;
window.updateTagSelection = updateTagSelection;
window.filterByTimeRange = filterByTimeRange;
window.applyCustomRange = applyCustomRange;
window.applyFilters = applyFilters;
