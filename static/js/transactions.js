/**
 * Transactions Page JavaScript
 * Handles transaction management, CSV import, and editing
 */

// Set today's date as default when page loads
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    
    // Load categories
    loadCategories();
    
    // Setup CSV import handler
    const importForm = document.getElementById('import-form');
    if (importForm) {
        importForm.addEventListener('submit', handleCSVImport);
    }
});

/**
 * Load categories for the category dropdown
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const select = document.getElementById('category');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select category...</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Handle CSV import
 */
async function handleCSVImport(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const resultDiv = document.getElementById('import-result');
    
    resultDiv.innerHTML = '<p style="color: #666;">⏳ Importing...</p>';
    
    try {
        const response = await fetch('/api/transactions/import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            let message = `<p style="color: #00b894; font-weight: 600;">✓ Successfully imported ${result.imported} transaction(s)!</p>`;
            
            if (result.errors && result.errors.length > 0) {
                message += `<p style="color: #e17055; margin-top: 10px;">⚠️ ${result.errors.length} error(s):</p>`;
                message += '<ul style="margin-left: 20px; color: #e17055;">';
                result.errors.forEach(error => {
                    message += `<li>${error}</li>`;
                });
                message += '</ul>';
            }
            
            resultDiv.innerHTML = message;
            
            // Refresh transactions list and stats
            htmx.trigger('#transactions-list', 'load');
            htmx.trigger('body', 'refreshStats');
            
            // Reset form
            e.target.reset();
        } else {
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
    }
}

/**
 * Edit transaction - opens modal with transaction data
 */
async function editTransaction(id, description, amount, type, date, category, tags) {
    // Load categories in modal
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const select = document.getElementById('edit-category');
        select.innerHTML = '<option value="">Select category...</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            if (cat.name === category) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
    
    // Populate form
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-description').value = description;
    document.getElementById('edit-amount').value = amount;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-date').value = date;
    
    // Handle tags - remove category tags
    const tagArray = tags.split(',').filter(t => t && !t.startsWith('category:'));
    document.getElementById('edit-tags').value = tagArray.join(', ');
    
    // Show modal
    document.getElementById('editModal').style.display = 'block';
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

/**
 * Save edited transaction
 */
async function saveEditTransaction() {
    const id = document.getElementById('edit-id').value;
    const formData = new FormData();
    formData.append('description', document.getElementById('edit-description').value);
    formData.append('amount', document.getElementById('edit-amount').value);
    formData.append('type', document.getElementById('edit-type').value);
    formData.append('date', document.getElementById('edit-date').value);
    formData.append('category', document.getElementById('edit-category').value);
    formData.append('tags', document.getElementById('edit-tags').value);
    
    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: 'PUT',
            body: formData
        });
        
        if (response.ok) {
            closeEditModal();
            // Refresh transactions list
            htmx.trigger('#transactions-list', 'load');
            htmx.trigger('body', 'refreshStats');
        } else {
            alert('Failed to update transaction');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make functions globally available
window.editTransaction = editTransaction;
window.closeEditModal = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
