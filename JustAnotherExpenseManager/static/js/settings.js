/**
 * Settings Page
 * Handles category management, tag management, and test data generation.
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        const list = document.getElementById('categories-list');
        if (!list)
            return;
        if (categories.length === 0) {
            list.innerHTML = '<p style="color: #666; text-align: center;">No categories yet. Add one above!</p>';
            return;
        }
        list.innerHTML = '<div class="category-list"></div>';
        const categoryList = list.querySelector('.category-list');
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = cat.category_name;
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'category-actions';
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-edit btn-small';
            editBtn.textContent = 'Edit';
            editBtn.dataset.name = cat.category_name;
            editBtn.addEventListener('click', () => editCategory(cat.category_name));
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-delete btn-small';
            deleteBtn.textContent = 'Delete';
            deleteBtn.dataset.name = cat.category_name;
            deleteBtn.addEventListener('click', () => deleteCategory(cat.category_name));
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            item.appendChild(nameSpan);
            item.appendChild(actionsDiv);
            categoryList.appendChild(item);
        });
    }
    catch (error) {
        console.error('Error loading categories:', error);
    }
}
async function addCategory() {
    const input = document.getElementById('new-category');
    const categoryName = input.value.trim().toLowerCase();
    const resultDiv = document.getElementById('add-category-result');
    if (!categoryName) {
        if (resultDiv)
            resultDiv.innerHTML = '<p style="color: #d63031;">Please enter a category name</p>';
        return;
    }
    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName }),
        });
        const result = await response.json();
        if (result.success) {
            if (resultDiv) {
                resultDiv.innerHTML =
                    `<p style="color: #00b894; font-weight: 600;">✓ Category "${categoryName}" added successfully!</p>`;
                setTimeout(() => { resultDiv.innerHTML = ''; }, 3000);
            }
            input.value = '';
            loadCategories();
        }
        else {
            if (resultDiv)
                resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
        }
    }
    catch (error) {
        if (resultDiv) {
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
        }
    }
}
function editCategory(name) {
    document.getElementById('edit-category-old').value = name;
    document.getElementById('edit-category-name').value = name;
    const modal = document.getElementById('editCategoryModal');
    if (modal)
        modal.style.display = 'block';
}
function closeEditCategoryModal() {
    const modal = document.getElementById('editCategoryModal');
    if (modal)
        modal.style.display = 'none';
}
/**
 * Save edited category.
 * Names are sent in the request body to avoid URL-encoding issues with
 * characters such as '/', which Flask's router decodes before matching.
 */
async function saveEditCategory() {
    const oldName = document.getElementById('edit-category-old').value;
    const newName = document.getElementById('edit-category-name').value.trim().toLowerCase();
    if (!newName) {
        alert('Please enter a category name');
        return;
    }
    try {
        const response = await fetch('/api/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: oldName, new_name: newName }),
        });
        const result = await response.json();
        if (result.success) {
            closeEditCategoryModal();
            loadCategories();
        }
        else if (response.status === 409 && !result.success && 'conflict' in result && result.conflict) {
            const confirmed = confirm(`The category "${newName}" already exists.\n\n` +
                `Would you like to merge "${oldName}" into "${newName}"?\n\n` +
                `All transactions currently in "${oldName}" will be moved to "${newName}" and "${oldName}" will be deleted.`);
            if (!confirmed)
                return;
            const mergeResponse = await fetch('/api/categories/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: oldName, target: newName }),
            });
            const mergeResult = await mergeResponse.json();
            if (mergeResult.success) {
                closeEditCategoryModal();
                loadCategories();
            }
            else {
                alert('❌ Merge failed: ' + mergeResult.error);
            }
        }
        else {
            alert('❌ ' + result.error);
        }
    }
    catch (error) {
        alert('❌ Error: ' + error.message);
    }
}
/**
 * Delete a category.
 * The name is sent in the request body to avoid URL-encoding issues.
 */
async function deleteCategory(name) {
    if (!confirm(`Are you sure you want to delete the category "${name}"? ` +
        `This will remove the category tag from all associated transactions.`))
        return;
    try {
        const response = await fetch('/api/categories', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const result = await response.json();
        if (result.success) {
            loadCategories();
        }
        else {
            alert('❌ ' + result.error);
        }
    }
    catch (error) {
        alert('❌ Error: ' + error.message);
    }
}
async function populateTestData() {
    if (!confirm('This will add approximately 80 sample transactions to your database. Continue?'))
        return;
    const resultDiv = document.getElementById('test-data-result');
    if (resultDiv)
        resultDiv.innerHTML = '<p style="color: #666;">⏳ Generating test data...</p>';
    try {
        const response = await fetch('/api/populate-test-data', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            if (resultDiv) {
                resultDiv.innerHTML = `<p style="color: #00b894; font-weight: 600;">✓ ${result.message}</p>`;
            }
            setTimeout(() => { window.location.href = '/summary'; }, 2000);
        }
        else {
            if (resultDiv)
                resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
        }
    }
    catch (error) {
        if (resultDiv) {
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
        }
    }
}
async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        const tags = await response.json();
        const list = document.getElementById('tags-list');
        if (!list)
            return;
        if (tags.length === 0) {
            list.innerHTML =
                '<p style="color: #666; text-align: center;">No tags yet. Add tags to transactions to see them here.</p>';
            return;
        }
        list.innerHTML = '<div class="category-list"></div>';
        const tagList = list.querySelector('.category-list');
        tags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'category-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = tag;
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'category-actions';
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-edit btn-small';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editTag(tag));
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-delete btn-small';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => deleteTag(tag));
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            item.appendChild(nameSpan);
            item.appendChild(actionsDiv);
            tagList.appendChild(item);
        });
    }
    catch (error) {
        console.error('Error loading tags:', error);
    }
}
function editTag(name) {
    document.getElementById('edit-tag-old').value = name;
    document.getElementById('edit-tag-name').value = name;
    const modal = document.getElementById('editTagModal');
    if (modal)
        modal.style.display = 'block';
}
function closeEditTagModal() {
    const modal = document.getElementById('editTagModal');
    if (modal)
        modal.style.display = 'none';
}
/**
 * Save renamed tag.
 * Names are sent in the request body to avoid URL-encoding issues.
 */
async function saveEditTag() {
    const oldName = document.getElementById('edit-tag-old').value;
    const newName = document.getElementById('edit-tag-name').value.trim();
    if (!newName) {
        alert('Please enter a tag name');
        return;
    }
    try {
        const response = await fetch('/api/tags', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: oldName, new_name: newName }),
        });
        const result = await response.json();
        if (result.success) {
            closeEditTagModal();
            loadTags();
        }
        else if (response.status === 409 && !result.success && 'conflict' in result && result.conflict) {
            const confirmed = confirm(`The tag "${newName}" already exists.\n\n` +
                `Would you like to merge "${oldName}" into "${newName}"?\n\n` +
                `All transactions currently tagged "${oldName}" will also be tagged "${newName}" and "${oldName}" will be deleted.`);
            if (!confirmed)
                return;
            const mergeResponse = await fetch('/api/tags/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: oldName, target: newName }),
            });
            const mergeResult = await mergeResponse.json();
            if (mergeResult.success) {
                closeEditTagModal();
                loadTags();
            }
            else {
                alert('❌ Merge failed: ' + mergeResult.error);
            }
        }
        else {
            alert('❌ ' + result.error);
        }
    }
    catch (error) {
        alert('❌ Error: ' + error.message);
    }
}
/**
 * Delete a tag.
 * The name is sent in the request body to avoid URL-encoding issues.
 */
async function deleteTag(name) {
    if (!confirm(`Are you sure you want to delete the tag "${name}"? ` +
        `This will remove it from all associated transactions.`))
        return;
    try {
        const response = await fetch('/api/tags', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const result = await response.json();
        if (result.success) {
            loadTags();
        }
        else {
            alert('❌ ' + result.error);
        }
    }
    catch (error) {
        alert('❌ Error: ' + error.message);
    }
}
async function exportTransactions() {
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;
    const resultDiv = document.getElementById('export-result');
    if (startDate && endDate && startDate > endDate) {
        if (resultDiv)
            resultDiv.innerHTML = '<p style="color: #d63031;">❌ Start date must be before end date.</p>';
        return;
    }
    const params = new URLSearchParams();
    if (startDate)
        params.set('start_date', startDate);
    if (endDate)
        params.set('end_date', endDate);
    const url = '/api/transactions/export' + (params.toString() ? '?' + params.toString() : '');
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (resultDiv)
                resultDiv.innerHTML = '<p style="color: #d63031;">❌ Export failed. Please try again.</p>';
            return;
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = 'transactions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        if (resultDiv) {
            resultDiv.innerHTML = '<p style="color: #00b894; font-weight: 600;">✓ Export downloaded successfully!</p>';
            setTimeout(() => { resultDiv.innerHTML = ''; }, 3000);
        }
    }
    catch (error) {
        if (resultDiv)
            resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
    }
}
window.addCategory = addCategory;
window.exportTransactions = exportTransactions;
window.editCategory = editCategory;
window.closeEditCategoryModal = closeEditCategoryModal;
window.saveEditCategory = saveEditCategory;
window.deleteCategory = deleteCategory;
window.editTag = editTag;
window.closeEditTagModal = closeEditTagModal;
window.saveEditTag = saveEditTag;
window.deleteTag = deleteTag;
window.populateTestData = populateTestData;
export {};
