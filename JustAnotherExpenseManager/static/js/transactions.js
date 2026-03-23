/**
 * Transactions Page JavaScript
 * Handles transaction management, CSV import, and editing.
 * Uses Tagify for tag autocomplete on both the add form and edit modal.
 */

// Current filter query string, kept in sync with filter_component.js via URL
let currentFilterParams = '';

// Tagify instances — created once in initTagify(), reused across open/close cycles
let addTagify = null;
let editTagify = null;

// Set today's date as default when page loads
document.addEventListener('DOMContentLoaded', function() {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }

  loadCategorySelect();
  initTagify();

  const addForm = document.getElementById('add-transaction-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddTransaction);
  }

  const importForm = document.getElementById('import-form');
  if (importForm) {
    importForm.addEventListener('submit', handleCSVImport);
  }

  // Initial load of transactions
  currentFilterParams = window.location.search.slice(1);
  loadTransactions(1);
});

/**
 * Initialise Tagify on both the add-form and edit-modal tag inputs.
 * Fetches existing tags from /api/tags to populate the autocomplete whitelist.
 * Called once on DOMContentLoaded; Tagify instances are reused after that.
 */
async function initTagify() {
  let whitelist = [];
  try {
    const response = await fetch('/api/tags');
    whitelist = await response.json();
  } catch (error) {
    console.error('Error fetching tags for Tagify whitelist:', error);
  }

  const sharedSettings = {
    whitelist,
    // Allow the user to create tags that don't exist in the whitelist yet
    enforceWhitelist: false,
    // Keep the original <input> value as a plain comma-separated string so
    // FormData and manual .value reads work without any extra parsing
    originalInputValueFormat: values => values.map(v => v.value).join(','),
    dropdown: {
      maxItems: 10,
      enabled: 1,         // show suggestions after 1 character
      closeOnSelect: false,
    },
  };

  const addInput = document.getElementById('tags');
  if (addInput) {
    addTagify = new Tagify(addInput, sharedSettings);
    // Set data-testid on the Tagify wrapper so Playwright can locate the
    // inner contenteditable without relying on the now-hidden <input>
    setTimeout(() => {
      const wrapper = addInput.closest('.tagify');
      if (wrapper) wrapper.setAttribute('data-testid', 'tags-input');
    }, 0);
  }

  const editInput = document.getElementById('edit-tags');
  if (editInput) {
    editTagify = new Tagify(editInput, sharedSettings);
    setTimeout(() => {
      const wrapper = editInput.closest('.tagify');
      if (wrapper) wrapper.setAttribute('data-testid', 'edit-tags-input');
    }, 0);
  }
}

/**
 * Fetch and render the transactions list for the given page.
 * Preserves any active filter params from the URL.
 */
async function loadTransactions(page) {
  page = page || 1;
  const params = new URLSearchParams(window.location.search);
  params.set('page', page);

  const listEl = document.getElementById('transactions-list');
  if (!listEl) return;

  try {
    const response = await fetch('/api/transactions?' + params.toString());
    const html = await response.text();
    listEl.innerHTML = html;
  } catch (error) {
    console.error('Error loading transactions:', error);
    listEl.innerHTML = '<p style="color: #d63031;">Error loading transactions.</p>';
  }
}

/**
 * Load categories for the add-transaction category dropdown.
 */
async function loadCategorySelect() {
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();

    const select = document.getElementById('category');
    if (!select) return;

    select.innerHTML = '<option value="">Select category...</option>';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category_name;
      option.textContent = cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

/**
 * Handle add-transaction form submission.
 * Tagify writes the comma-separated tag string back to the original <input>
 * via originalInputValueFormat, so FormData picks it up automatically.
 */
async function handleAddTransaction(e) {
  e.preventDefault();

  const formData = new FormData(e.target);

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      e.target.reset();
      e.target.querySelector('#date').valueAsDate = new Date();
      // form.reset() clears the underlying <input> but leaves Tagify's rendered
      // pills intact — remove them explicitly so the UI stays in sync
      if (addTagify) addTagify.removeAllTags();
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      const result = await response.json();
      alert(result.error || 'Failed to add transaction');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

/**
 * Handle CSV import form submission.
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
      e.target.reset();
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
  }
}

/**
 * Delete a transaction by ID after confirmation.
 */
async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;

  try {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      alert('Failed to delete transaction');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

/**
 * Open the edit modal and populate it with data from the clicked button.
 * Loads the transaction's existing tags into the Tagify instance.
 */
async function editTransaction(button) {
  const id = button.dataset.transactionId;
  const description = button.dataset.description;
  const amount = button.dataset.amount;
  const type = button.dataset.type;
  const date = button.dataset.date;
  const category = button.dataset.category;
  const tags = button.dataset.tags;  // comma-separated string, may be empty

  // Load categories into the edit modal dropdown
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();

    const select = document.getElementById('edit-category');
    select.innerHTML = '<option value="">Select category...</option>';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category_name;
      option.textContent = cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
      if (cat.category_name === category) option.selected = true;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  document.getElementById('edit-id').value = id;
  document.getElementById('edit-description').value = description;
  document.getElementById('edit-amount').value = amount;
  document.getElementById('edit-type').value = type;
  document.getElementById('edit-date').value = date;

  // Populate the Tagify instance with the transaction's existing tags.
  // removeAllTags() clears current pills; addTags() renders the new ones and
  // writes their CSV representation back to the original <input> via
  // originalInputValueFormat so saveEditTransaction() can read it directly.
  if (editTagify) {
    editTagify.removeAllTags({ withoutChangeEvent: true });
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      editTagify.addTags(tagList);
    }
  } else {
    // Tagify not yet initialised (e.g. CDN load race) — fall back gracefully
    document.getElementById('edit-tags').value = tags || '';
  }

  document.getElementById('editModal').style.display = 'block';
}

/**
 * Close the edit modal.
 */
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

/**
 * Save changes from the edit modal.
 * Reads tags from the original <input> which Tagify keeps in sync as a
 * comma-separated string via originalInputValueFormat.
 */
async function saveEditTransaction() {
  const id = document.getElementById('edit-id').value;
  const formData = new FormData();
  formData.append('description', document.getElementById('edit-description').value);
  formData.append('amount', document.getElementById('edit-amount').value);
  formData.append('type', document.getElementById('edit-type').value);
  formData.append('date', document.getElementById('edit-date').value);
  formData.append('category', document.getElementById('edit-category').value);
  // Tagify keeps the original <input> in sync — .value is the plain CSV string
  formData.append('tags', document.getElementById('edit-tags').value);

  try {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      body: formData
    });

    if (response.ok) {
      closeEditModal();
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      alert('Failed to update transaction');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

/**
 * Dispatch a custom event so other pages (e.g. summary) can react to data changes.
 * On the transactions page itself this is a no-op since stats aren't shown here.
 */
function notifyTransactionsChanged() {
  document.dispatchEvent(new CustomEvent('transactionsChanged'));
}

// Make functions globally available (called from inline onclick in templates)
window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;
window.editTransaction = editTransaction;
window.closeEditModal = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
