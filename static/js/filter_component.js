/**
 * Filter Component JavaScript
 * Handles multi-select category and tag filtering
 */

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    const categoryWrapper = document.querySelector('#category-display')?.closest('.multi-select-wrapper');
    const tagWrapper = document.querySelector('#tag-display')?.closest('.multi-select-wrapper');
    
    if (categoryWrapper && !categoryWrapper.contains(event.target)) {
        document.getElementById('category-dropdown').style.display = 'none';
    }
    if (tagWrapper && !tagWrapper.contains(event.target)) {
        document.getElementById('tag-dropdown').style.display = 'none';
    }
});

function toggleCategoryDropdown() {
    const dropdown = document.getElementById('category-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    document.getElementById('tag-dropdown').style.display = 'none';
}

function toggleTagDropdown() {
    const dropdown = document.getElementById('tag-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    document.getElementById('category-dropdown').style.display = 'none';
}

function updateCategorySelection() {
    const checkboxes = document.querySelectorAll('#category-dropdown input[type="checkbox"]');
    const allCheckbox = checkboxes[0];
    const otherCheckboxes = Array.from(checkboxes).slice(1);
    
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
    document.getElementById('category-selected-text').textContent = displayText;
    
    // Apply filters
    applyFilters();
}

function updateTagSelection() {
    const checkboxes = document.querySelectorAll('#tag-dropdown input[type="checkbox"]');
    const allCheckbox = checkboxes[0];
    const otherCheckboxes = Array.from(checkboxes).slice(1);
    
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
    document.getElementById('tag-selected-text').textContent = displayText;
    
    // Apply filters
    applyFilters();
}

// Load categories for filter
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const list = document.getElementById('category-options-list');
        list.innerHTML = '';
        
        categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'multi-select-option';
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${cat.name}" onchange="updateCategorySelection()">
                    ${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                </label>
            `;
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
        list.innerHTML = '';
        
        // Filter out category tags
        const nonCategoryTags = tags.filter(tag => !tag.startsWith('category:'));
        
        nonCategoryTags.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'multi-select-option';
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${tag}" onchange="updateTagSelection()">
                    ${tag}
                </label>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function filterByTimeRange(range) {
    const customPicker = document.getElementById('custom-range-picker');
    
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
    const timeRange = document.getElementById('time-range').value;
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    
    // Get selected categories
    const categoryCheckboxes = Array.from(document.querySelectorAll('#category-options-list input[type="checkbox"]:checked'));
    const categories = categoryCheckboxes.map(cb => cb.value);
    
    // Get selected tags
    const tagCheckboxes = Array.from(document.querySelectorAll('#tag-options-list input[type="checkbox"]:checked'));
    const tags = tagCheckboxes.map(cb => cb.value);
    
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
    
    htmx.ajax('GET', url, {target: targetElement, swap: 'innerHTML'});
}

// Initialize filters when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('category-options-list')) {
        loadCategories();
        loadTags();
    }
});
