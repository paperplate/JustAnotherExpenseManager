/**
 * Transactions Page
 * Handles transaction management, CSV import, and editing.
 */
import type { Category, ApiResult, ApiError } from "./types";

declare const Tagify: typeof import('@yaireo/tagify');

let currentFilterParams = '';

let addTagify: Tagify | null = null;
let editTagify: Tagify | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date') as HTMLInputElement | null;
  if (dateInput) dateInput.valueAsDate = new Date();

  loadCategorySelect();
  initTagify();

  const addForm = document.getElementById('add-transaction-form');
  addForm?.addEventListener('submit', handleAddTransaction);

  const importForm = document.getElementById('import-form');
  importForm?.addEventListener('submit', handleCSVImport);

  currentFilterParams = window.location.search.slice(1);
  loadTransactions(1);
});

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
    enforceWhitelist: false,
    originalInputValueFormat: (values: { value: string }[]) => values.map(v => v.value).join(','),
    dropdown: {
      maxItems: 10,
      enbled: 1,
      closeOnSelect: false,
    },
  };

  const addInput = document.getElementById('tags') as HTMLInputElement;
  if (addInput) {
    addTagify = new Tagify(addInput, sharedSettings);
    setTimeout(() => {
      const wrapper = addInput.closest('.tagify');
      if (wrapper) { wrapper.setAttribute('data-testid', 'tags-input'); }
    }, 0);
  }

  const editInput = document.getElementById('edit-tags') as HTMLInputElement;
  if (editInput) {
    editTagify = new Tagify(editInput, sharedSettings);
    setTimeout(() => {
      const wrapper = editInput.closest('.tagify');
      if (wrapper) { wrapper.setAttribute('data-testid', 'edit-tags-input'); }
    }, 0);
  }
}

async function loadTransactions(page: number): Promise<void> {
  page = page || 1;
  const params = new URLSearchParams(window.location.search);
  params.set('page', String(page));

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

async function loadCategorySelect(): Promise<void> {
  try {
    const response = await fetch('/api/categories');
    const categories: Category[] = await response.json();

    const select = document.getElementById('category') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '<option value="">Select category...</option>';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category_name;
      option.textContent =
        cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

async function handleAddTransaction(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);

  try {
    const response = await fetch('/api/transactions', { method: 'POST', body: formData });

    if (response.ok) {
      form.reset();
      const dateInput = form.querySelector<HTMLInputElement>('#date');
      if (dateInput) dateInput.valueAsDate = new Date();
      if (addTagify) { addTagify.removeAllTags(); }
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      const result: ApiError = await response.json();
      alert(result.error ?? 'Failed to add transaction');
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  }
}

async function handleCSVImport(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  const resultDiv = document.getElementById('import-result');

  if (resultDiv) resultDiv.innerHTML = '<p style="color: #666;">⏳ Importing...</p>';

  try {
    const response = await fetch('/api/transactions/import', { method: 'POST', body: formData });
    const result: ApiResult = await response.json();

    if (result.success) {
      let message =
        `<p style="color: #00b894; font-weight: 600;">✓ Successfully imported ${result.imported} transaction(s)!</p>`;

      if (result.errors && result.errors.length > 0) {
        message += `<p style="color: #e17055; margin-top: 10px;">⚠️ ${result.errors.length} error(s):</p>`;
        message += '<ul style="margin-left: 20px; color: #e17055;">';
        result.errors.forEach(err => { message += `<li>${err}</li>`; });
        message += '</ul>';
      }

      if (resultDiv) resultDiv.innerHTML = message;
      form.reset();
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      if (resultDiv) resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
    }
  } catch (error) {
    if (resultDiv) {
      resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${(error as Error).message}</p>`;
    }
  }
}

async function deleteTransaction(id: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this transaction?')) return;

  try {
    const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });

    if (response.ok) {
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      alert('Failed to delete transaction');
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  }
}

async function editTransaction(button: HTMLButtonElement): Promise<void> {
  const id = button.dataset.transactionId ?? '';
  const description = button.dataset.description ?? '';
  const amount = button.dataset.amount ?? '';
  const type = button.dataset.type ?? '';
  const date = button.dataset.date ?? '';
  const category = button.dataset.category ?? '';
  const tags = button.dataset.tags ?? '';

  try {
    const response = await fetch('/api/categories');
    const categories: Category[] = await response.json();

    const select = document.getElementById('edit-category') as HTMLSelectElement | null;
    if (select) {
      select.innerHTML = '<option value="">Select category...</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.category_name;
        option.textContent =
          cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
        if (cat.category_name === category) option.selected = true;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  (document.getElementById('edit-id') as HTMLInputElement).value = id;
  (document.getElementById('edit-description') as HTMLInputElement).value = description;
  (document.getElementById('edit-amount') as HTMLInputElement).value = amount;
  (document.getElementById('edit-type') as HTMLSelectElement).value = type;
  (document.getElementById('edit-date') as HTMLInputElement).value = date;

  if (editTagify) {
    editTagify.removeAllTags({ withoutChangeEvent: true });
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      editTagify.addTags(tagList);
    }
  }
  else {
    const editTagsElement = document.getElementById('edit-tags') as HTMLInputElement | null;
    if (editTagsElement) { editTagsElement.value = tags || ''; }
  }

  const modal = document.getElementById('editModal');
  if (modal) modal.style.display = 'block';
}

function closeEditModal(): void {
  const modal = document.getElementById('editModal');
  if (modal) modal.style.display = 'none';
}

async function saveEditTransaction(): Promise<void> {
  const id = (document.getElementById('edit-id') as HTMLInputElement).value;
  const formData = new FormData();
  formData.append('description', (document.getElementById('edit-description') as HTMLInputElement).value);
  formData.append('amount', (document.getElementById('edit-amount') as HTMLInputElement).value);
  formData.append('type', (document.getElementById('edit-type') as HTMLSelectElement).value);
  formData.append('date', (document.getElementById('edit-date') as HTMLInputElement).value);
  formData.append('category', (document.getElementById('edit-category') as HTMLSelectElement).value);
  formData.append('tags', (document.getElementById('edit-tags') as HTMLInputElement).value);

  try {
    const response = await fetch(`/api/transactions/${id}`, { method: 'PUT', body: formData });

    if (response.ok) {
      closeEditModal();
      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      alert('Failed to update transaction');
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  }
}

function notifyTransactionsChanged(): void {
  document.dispatchEvent(new CustomEvent('transactionsChanged'));
}

window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;
window.editTransaction = editTransaction;
window.closeEditModal = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
