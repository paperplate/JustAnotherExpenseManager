/**
 * Transactions Page
 * Handles transaction management, CSV preview/edit/import, and editing.
 */
import type { Category, ApiResult, ApiError } from "./types";
import type { SplitBillUpdateEvent } from "./split_bill";

declare const Tagify: typeof import('@yaireo/tagify');

let currentFilterParams = '';

let addTagify: Tagify | null = null;
let editTagify: Tagify | null = null;

/** Row object returned by POST /api/transactions/preview */
interface PreviewRow {
  row_num: number;
  description: string;
  amount: string;
  type: string;
  category: string;
  date: string;
  tags: string;
  error: string | null;
}

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date') as HTMLInputElement | null;
  if (dateInput) dateInput.valueAsDate = new Date();

  loadCategorySelect();
  initTagify();

  const addForm = document.getElementById('add-transaction-form');
  addForm?.addEventListener('submit', handleAddTransaction);

  // CSV import now goes through the preview flow
  const importForm = document.getElementById('import-form');
  importForm?.addEventListener('submit', handleCSVPreview);

  currentFilterParams = window.location.search.slice(1);
  loadTransactions(1);
});

// ── Tagify ────────────────────────────────────────────────────────────────────

async function initTagify() {
  let whitelist: string[] = [];
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
    addTagify.DOM.scope.setAttribute('data-testid', 'tags-input');
  }

  const editInput = document.getElementById('edit-tags') as HTMLInputElement;
  if (editInput) {
    editTagify = new Tagify(editInput, sharedSettings);
    editTagify.DOM.scope.setAttribute('data-testid', 'edit-tags-input');
  }
}

// ── Transaction list ──────────────────────────────────────────────────────────

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

// ── Add transaction ───────────────────────────────────────────────────────────

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

<<<<<<< splitBill
=======
// ── CSV Preview ───────────────────────────────────────────────────────────────

>>>>>>> main
/** Escape HTML special characters for safe innerHTML insertion. */
function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Handle import form submission: POST to /api/transactions/preview and
 * render an editable review table instead of immediately saving.
 */
async function handleCSVPreview(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  const resultDiv = document.getElementById('import-result');
  const previewContainer = document.getElementById('csv-preview-container');

  if (resultDiv) resultDiv.innerHTML = '<p style="color:#666;">⏳ Parsing CSV…</p>';

  try {
    const [previewRes, categoriesRes] = await Promise.all([
      fetch('/api/transactions/preview', { method: 'POST', body: formData }),
      fetch('/api/categories'),
    ]);

    const data: { rows?: PreviewRow[]; error?: string } = await previewRes.json();
    const categories: Category[] = await categoriesRes.json();

    if (!previewRes.ok) {
      if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ ${data.error}</p>`;
      return;
    }

    if (!data.rows || data.rows.length === 0) {
      if (resultDiv) resultDiv.innerHTML = '<p style="color:#666;">CSV has no data rows.</p>';
      return;
    }

    renderPreviewTable(data.rows, categories);

    if (previewContainer) {
      previewContainer.style.display = '';
      previewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (resultDiv) resultDiv.innerHTML = '';

    const commitResult = document.getElementById('commit-result');
    if (commitResult) commitResult.innerHTML = '';

  } catch (err) {
    if (resultDiv)
      resultDiv.innerHTML = `<p style="color:#d63031;">❌ Error: ${(err as Error).message}</p>`;
  }
}

/**
 * Populate the preview tbody with editable rows.
 */
function renderPreviewTable(rows: PreviewRow[], categories: Category[]): void {
  const tbody = document.getElementById('preview-tbody');
  const datalist = document.getElementById('preview-categories');
  if (!tbody) return;

  if (datalist) {
    datalist.innerHTML = categories
      .map(c => `<option value="${escapeHtml(c.category_name)}">`)
      .join('');
  }

  tbody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = String(idx);
    tr.className = row.error ? 'preview-row-error' : 'preview-row-ok';

    const statusHtml = row.error
      ? `<span class="preview-status-error" title="${escapeHtml(row.error)}">⚠ Error</span>`
      : `<span class="preview-status-ok">✓</span>`;

    tr.innerHTML = `
      <td style="padding:6px 10px; color:#999; font-size:12px;">${row.row_num}</td>
      <td>
        <input class="preview-input" data-field="description" data-idx="${idx}"
               type="text" value="${escapeHtml(row.description)}" style="width:155px;">
      </td>
      <td>
        <input class="preview-input" data-field="amount" data-idx="${idx}"
               type="number" step="0.01" min="0" value="${escapeHtml(row.amount)}"
               style="width:88px;">
      </td>
      <td>
        <select class="preview-input" data-field="type" data-idx="${idx}" style="width:94px;">
          <option value="expense" ${row.type === 'expense' ? 'selected' : ''}>Expense</option>
<<<<<<< splitBill
          <option value="income"  ${row.type === 'income' ? 'selected' : ''}>Income</option>
=======
          <option value="income"  ${row.type === 'income'  ? 'selected' : ''}>Income</option>
>>>>>>> main
        </select>
      </td>
      <td>
        <input class="preview-input" data-field="category" data-idx="${idx}"
               type="text" value="${escapeHtml(row.category)}"
               list="preview-categories" style="width:118px;">
      </td>
      <td>
        <input class="preview-input" data-field="date" data-idx="${idx}"
               type="date" value="${escapeHtml(row.date)}" style="width:130px;">
      </td>
      <td>
        <input class="preview-input" data-field="tags" data-idx="${idx}"
               type="text" value="${escapeHtml(row.tags)}"
               style="width:135px;" placeholder="tag1, tag2">
      </td>
      <td>${statusHtml}</td>
      <td>
        <button onclick="removePreviewRow(${idx})" title="Remove this row"
                style="background:none; border:none; cursor:pointer; color:#d63031;
                       font-size:18px; padding:0 4px; line-height:1;">×</button>
      </td>
    `;

    // Clear error highlight on any user edit
    tr.querySelectorAll<HTMLElement>('.preview-input').forEach(input => {
      input.addEventListener('input', () => {
        tr.className = 'preview-row-ok';
        const statusCell = tr.querySelector('td:nth-child(8)');
        if (statusCell)
          statusCell.innerHTML = `<span class="preview-status-ok">✓</span>`;
        updatePreviewBadges();
      });
    });

    tbody.appendChild(tr);
  });

  updatePreviewBadges();
}

/** Hide a preview row (mark as removed without deleting the DOM element). */
function removePreviewRow(idx: number): void {
  const tr = document.querySelector<HTMLElement>(`#preview-tbody tr[data-idx="${idx}"]`);
  if (tr) tr.className = 'preview-row-removed';
  updatePreviewBadges();
}
<<<<<<< splitBill

/** Recount visible/error/removed rows and update badge labels + button text. */
function updatePreviewBadges(): void {
  const tbody = document.getElementById('preview-tbody');
  if (!tbody) return;

  let valid = 0, errors = 0, removed = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    if (tr.classList.contains('preview-row-removed')) { removed++; return; }
    if (tr.classList.contains('preview-row-error')) { errors++; return; }
    valid++;
  });

  const bv = document.getElementById('badge-valid');
  const be = document.getElementById('badge-errors');
  const br = document.getElementById('badge-removed');
  if (bv) bv.textContent = valid ? `${valid} valid` : '';
  if (be) be.textContent = errors ? `${errors} with errors` : '';
  if (br) br.textContent = removed ? `${removed} removed` : '';

  const btn = document.querySelector<HTMLElement>('#csv-preview-container .btn:first-child');
  const importable = valid + errors;
  if (btn) btn.textContent = `⬆ Import ${importable} Row${importable !== 1 ? 's' : ''}`;
}

=======

/** Recount visible/error/removed rows and update badge labels + button text. */
function updatePreviewBadges(): void {
  const tbody = document.getElementById('preview-tbody');
  if (!tbody) return;

  let valid = 0, errors = 0, removed = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    if (tr.classList.contains('preview-row-removed')) { removed++; return; }
    if (tr.classList.contains('preview-row-error'))   { errors++;  return; }
    valid++;
  });

  const bv = document.getElementById('badge-valid');
  const be = document.getElementById('badge-errors');
  const br = document.getElementById('badge-removed');
  if (bv) bv.textContent = valid   ? `${valid} valid`        : '';
  if (be) be.textContent = errors  ? `${errors} with errors` : '';
  if (br) br.textContent = removed ? `${removed} removed`    : '';

  const btn = document.querySelector<HTMLElement>('#csv-preview-container .btn:first-child');
  const importable = valid + errors;
  if (btn) btn.textContent = `⬆ Import ${importable} Row${importable !== 1 ? 's' : ''}`;
}

>>>>>>> main
/** Collect current field values from non-removed preview rows. */
function collectPreviewRows(): object[] {
  const tbody = document.getElementById('preview-tbody');
  if (!tbody) return [];
  const rows: object[] = [];
  tbody.querySelectorAll<HTMLElement>('tr[data-idx]').forEach(tr => {
    if (tr.classList.contains('preview-row-removed')) return;
    const val = (field: string) => {
      const el = tr.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${field}"]`);
      return el ? el.value : '';
    };
    rows.push({
      description: val('description'),
<<<<<<< splitBill
      amount: val('amount'),
      type: val('type'),
      category: val('category'),
      date: val('date'),
      tags: val('tags'),
=======
      amount:      val('amount'),
      type:        val('type'),
      category:    val('category'),
      date:        val('date'),
      tags:        val('tags'),
>>>>>>> main
    });
  });
  return rows;
}

/** POST collected rows to /api/transactions/commit-import. */
async function commitImport(): Promise<void> {
  const rows = collectPreviewRows();
  const resultDiv = document.getElementById('commit-result');

  if (rows.length === 0) {
    if (resultDiv) resultDiv.innerHTML = '<p style="color:#e17055;">No rows to import.</p>';
    return;
  }

  if (resultDiv) resultDiv.innerHTML = '<p style="color:#666;">⏳ Importing…</p>';

  try {
    const response = await fetch('/api/transactions/commit-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const result = await response.json();

    if (result.success) {
      let msg = `<p style="color:#00b894; font-weight:600;">✓ ${result.message}</p>`;
      if (result.errors && result.errors.length > 0) {
        msg += `<p style="color:#e17055; margin-top:8px;">⚠️ ${result.errors.length} row(s) skipped:</p>`;
        msg += '<ul style="margin-left:20px; color:#e17055; font-size:13px;">';
        result.errors.forEach((err: string) => { msg += `<li>${err}</li>`; });
        msg += '</ul>';
      }
      if (resultDiv) resultDiv.innerHTML = msg;

      setTimeout(() => {
        const container = document.getElementById('csv-preview-container');
        if (container) container.style.display = 'none';
        const importForm = document.getElementById('import-form') as HTMLFormElement | null;
        if (importForm) importForm.reset();
        const importResult = document.getElementById('import-result');
        if (importResult)
          importResult.innerHTML = `<p style="color:#00b894; font-weight:600;">✓ ${result.message}</p>`;
      }, 1800);

      await loadTransactions(1);
      notifyTransactionsChanged();
    } else {
      if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ ${result.error}</p>`;
    }
  } catch (err) {
    if (resultDiv)
      resultDiv.innerHTML = `<p style="color:#d63031;">❌ Error: ${(err as Error).message}</p>`;
  }
}

/** Hide the preview panel without importing anything. */
function cancelPreview(): void {
  const container = document.getElementById('csv-preview-container');
  if (container) container.style.display = 'none';
  const importResult = document.getElementById('import-result');
  if (importResult) importResult.innerHTML = '';
}

<<<<<<< splitBill
=======
// ── Edit / Delete ─────────────────────────────────────────────────────────────

>>>>>>> main
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
  } else {
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

<<<<<<< splitBill
function emitSplitBillTotal(): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>(
    '.split-select-checkbox'
  );

  let checked: number = 0;
  let unchecked: number = 0;

  document.querySelectorAll<HTMLElement>('tr[data-amount]').forEach((row, index) => {
    const amount = parseFloat(row.dataset.amount ?? '0');
    if (isNaN(amount)) {
      console.error('row: ' + index + ' amount is NAN');
      return;
    }
    if (checkboxes[index].checked) {
      checked += amount;
    }
    else {
      unchecked += amount;
    }
  });

  const total: number = (checked === 0 ? unchecked : checked);
  window.dispatchEvent(
    new CustomEvent<SplitBillUpdateEvent>('splitBillUpdate', {
      detail: { total, source: 'transactions' },
    })
  );
}

document.querySelector('#filter-form')?.addEventListener('submit', () => {
  setTimeout(emitSplitBillTotal, 100);
});

document.addEventListener('change', (e) => {
  if ((e.target as HTMLElement).classList.contains('split-select-checkbox')) {
    emitSplitBillTotal();
  }
});

document.getElementById('split-select-toggle')?.addEventListener('click', () => {
  const cells = document.querySelectorAll('.split-select-cell');
  const isHidden = cells[0]?.classList.contains('d-none');
  cells.forEach((c) => c.classList.toggle('d-none', !isHidden));
  if (isHidden) {
    emitSplitBillTotal();
  } else {
    document.querySelectorAll<HTMLInputElement>('.split-select-checkbox').forEach((cb) => (cb.checked = false));
    emitSplitBillTotal();
  }
});

window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;
window.editTransaction = editTransaction;
window.closeEditModal = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
window.commitImport = commitImport;
window.cancelPreview = cancelPreview;
window.removePreviewRow = removePreviewRow;
=======
// ── Global exports ────────────────────────────────────────────────────────────
window.loadTransactions    = loadTransactions;
window.deleteTransaction   = deleteTransaction;
window.editTransaction     = editTransaction;
window.closeEditModal      = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
window.commitImport        = commitImport;
window.cancelPreview       = cancelPreview;
window.removePreviewRow    = removePreviewRow;
>>>>>>> main
