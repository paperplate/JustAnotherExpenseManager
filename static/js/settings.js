/**
 * Settings Page JavaScript
 * Handles category management and test data generation
 */

// Load categories when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('categories-list')) {
        loadCategories();
    }
});

/**
 * Load and display all categories
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const list = document.getElementById('categories-list');
        
        if (categories.length === 0) {
            list.innerHTML = '<p style="color: #666; text-align: center;">No categories yet. Add one above!</p>';
            return;
        }
        
        list.innerHTML = '<div class="category-list"></div>';
        const categoryList = list.querySelector('.category-list');
        
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span class="category-name">${cat.name}</span>
                <div class="category-actions">
                    <button class="btn btn-edit btn-small" onclick="editCategory('${cat.name}')">Edit</button>
                    <button class="btn btn-delete btn-small" onclick="deleteCategory('${cat.name}')">Delete</button>
                </div>
            `;
            categoryList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Add a new category
 */
async function addCategory() {
    const input = document.getElementById('new-category');
    const categoryName = input.value.trim().toLowerCase();
    const resultDiv = document.getElementById('add-category-result');
    
    if (!categoryName) {
        resultDiv.innerHTML = '<p style="color: #d63031;">Please enter a category name</p>';
        return;
    }
    
    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: categoryName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultDiv.innerHTML = `<p style="color: #00b894; font-weight: 600;">✓ Category "${categoryName}" added successfully!</p>`;
            input.value = '';
            loadCategories();
            setTimeout(() => resultDiv.innerHTML = '', 3000);
        } else {
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
    }
}

/**
 * Open edit modal for a category
 */
function editCategory(name) {
    document.getElementById('edit-category-old').value = name;
    document.getElementById('edit-category-name').value = name;
    document.getElementById('editCategoryModal').style.display = 'block';
}

/**
 * Close edit category modal
 */
function closeEditCategoryModal() {
    document.getElementById('editCategoryModal').style.display = 'none';
}

/**
 * Save edited category
 */
async function saveEditCategory() {
    const oldName = document.getElementById('edit-category-old').value;
    const newName = document.getElementById('edit-category-name').value.trim().toLowerCase();
    
    if (!newName) {
        alert('Please enter a category name');
        return;
    }
    
    try {
        const response = await fetch(`/api/categories/${oldName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeEditCategoryModal();
            loadCategories();
        } else {
            alert('❌ ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

/**
 * Delete a category
 */
async function deleteCategory(name) {
    if (!confirm(`Are you sure you want to delete the category "${name}"? This will remove the category tag from all associated transactions.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/categories/${name}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadCategories();
        } else {
            alert('❌ ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

/**
 * Generate test data (debug mode only)
 */
async function populateTestData() {
    if (!confirm('This will add approximately 80 sample transactions to your database. Continue?')) {
        return;
    }
    
    const resultDiv = document.getElementById('test-data-result');
    resultDiv.innerHTML = '<p style="color: #666;">⏳ Generating test data...</p>';
    
    try {
        const response = await fetch('/api/populate-test-data', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultDiv.innerHTML = `<p style="color: #00b894; font-weight: 600;">✓ ${result.message}</p>`;
            setTimeout(() => {
                window.location.href = '/summary';
            }, 2000);
        } else {
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
    }
}

// Make functions globally available
window.addCategory = addCategory;
window.editCategory = editCategory;
window.closeEditCategoryModal = closeEditCategoryModal;
window.saveEditCategory = saveEditCategory;
window.deleteCategory = deleteCategory;
window.populateTestData = populateTestData;
