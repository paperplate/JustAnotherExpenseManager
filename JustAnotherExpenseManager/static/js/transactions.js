//#region static_src/js/transactions.ts
var addTagify = null;
var editTagify = null;
document.addEventListener("DOMContentLoaded", () => {
	const dateInput = document.getElementById("date");
	if (dateInput) dateInput.valueAsDate = /* @__PURE__ */ new Date();
	loadCategorySelect();
	initTagify();
	document.getElementById("add-transaction-form")?.addEventListener("submit", handleAddTransaction);
	document.getElementById("import-form")?.addEventListener("submit", handleCSVPreview);
	window.location.search.slice(1);
	loadTransactions(1);
});
async function initTagify() {
	let whitelist = [];
	try {
		whitelist = await (await fetch("/api/tags")).json();
	} catch (error) {
		console.error("Error fetching tags for Tagify whitelist:", error);
	}
	const sharedSettings = {
		whitelist,
		enforceWhitelist: false,
		originalInputValueFormat: (values) => values.map((v) => v.value).join(","),
		dropdown: {
			maxItems: 10,
			enbled: 1,
			closeOnSelect: false
		}
	};
	const addInput = document.getElementById("tags");
	if (addInput) {
		addTagify = new Tagify(addInput, sharedSettings);
		addTagify.DOM.scope.setAttribute("data-testid", "tags-input");
	}
	const editInput = document.getElementById("edit-tags");
	if (editInput) {
		editTagify = new Tagify(editInput, sharedSettings);
		editTagify.DOM.scope.setAttribute("data-testid", "edit-tags-input");
	}
}
async function loadTransactions(page) {
	page = page || 1;
	const params = new URLSearchParams(window.location.search);
	params.set("page", String(page));
	const listEl = document.getElementById("transactions-list");
	if (!listEl) return;
	try {
		listEl.innerHTML = await (await fetch("/api/transactions?" + params.toString())).text();
	} catch (error) {
		console.error("Error loading transactions:", error);
		listEl.innerHTML = "<p style=\"color: #d63031;\">Error loading transactions.</p>";
	}
}
async function loadCategorySelect() {
	try {
		const categories = await (await fetch("/api/categories")).json();
		const select = document.getElementById("category");
		if (!select) return;
		select.innerHTML = "<option value=\"\">Select category...</option>";
		categories.forEach((cat) => {
			const option = document.createElement("option");
			option.value = cat.category_name;
			option.textContent = cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
			select.appendChild(option);
		});
	} catch (error) {
		console.error("Error loading categories:", error);
	}
}
async function handleAddTransaction(e) {
	e.preventDefault();
	const form = e.target;
	const formData = new FormData(form);
	try {
		const response = await fetch("/api/transactions", {
			method: "POST",
			body: formData
		});
		if (response.ok) {
			form.reset();
			const dateInput = form.querySelector("#date");
			if (dateInput) dateInput.valueAsDate = /* @__PURE__ */ new Date();
			if (addTagify) addTagify.removeAllTags();
			await loadTransactions(1);
			notifyTransactionsChanged();
		} else {
			const result = await response.json();
			alert(result.error ?? "Failed to add transaction");
		}
	} catch (error) {
		alert("Error: " + error.message);
	}
}
/** Escape HTML special characters for safe innerHTML insertion. */
function escapeHtml(str) {
	return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/**
* Handle import form submission: POST to /api/transactions/preview and
* render an editable review table instead of immediately saving.
*/
async function handleCSVPreview(e) {
	e.preventDefault();
	const form = e.target;
	const formData = new FormData(form);
	const resultDiv = document.getElementById("import-result");
	const previewContainer = document.getElementById("csv-preview-container");
	if (resultDiv) resultDiv.innerHTML = "<p style=\"color:#666;\">⏳ Parsing CSV…</p>";
	try {
		const [previewRes, categoriesRes] = await Promise.all([fetch("/api/transactions/preview", {
			method: "POST",
			body: formData
		}), fetch("/api/categories")]);
		const data = await previewRes.json();
		const categories = await categoriesRes.json();
		if (!previewRes.ok) {
			if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ ${data.error}</p>`;
			return;
		}
		if (!data.rows || data.rows.length === 0) {
			if (resultDiv) resultDiv.innerHTML = "<p style=\"color:#666;\">CSV has no data rows.</p>";
			return;
		}
		renderPreviewTable(data.rows, categories);
		if (previewContainer) {
			previewContainer.style.display = "";
			previewContainer.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
		}
		if (resultDiv) resultDiv.innerHTML = "";
		const commitResult = document.getElementById("commit-result");
		if (commitResult) commitResult.innerHTML = "";
	} catch (err) {
		if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ Error: ${err.message}</p>`;
	}
}
/**
* Populate the preview tbody with editable rows.
*/
function renderPreviewTable(rows, categories) {
	const tbody = document.getElementById("preview-tbody");
	const datalist = document.getElementById("preview-categories");
	if (!tbody) return;
	if (datalist) datalist.innerHTML = categories.map((c) => `<option value="${escapeHtml(c.category_name)}">`).join("");
	tbody.innerHTML = "";
	rows.forEach((row, idx) => {
		const tr = document.createElement("tr");
		tr.dataset.idx = String(idx);
		tr.className = row.error ? "preview-row-error" : "preview-row-ok";
		const statusHtml = row.error ? `<span class="preview-status-error" title="${escapeHtml(row.error)}">⚠ Error</span>` : `<span class="preview-status-ok">✓</span>`;
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
          <option value="expense" ${row.type === "expense" ? "selected" : ""}>Expense</option>
          <option value="income"  ${row.type === "income" ? "selected" : ""}>Income</option>
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
		tr.querySelectorAll(".preview-input").forEach((input) => {
			input.addEventListener("input", () => {
				tr.className = "preview-row-ok";
				const statusCell = tr.querySelector("td:nth-child(8)");
				if (statusCell) statusCell.innerHTML = `<span class="preview-status-ok">✓</span>`;
				updatePreviewBadges();
			});
		});
		tbody.appendChild(tr);
	});
	updatePreviewBadges();
}
/** Hide a preview row (mark as removed without deleting the DOM element). */
function removePreviewRow(idx) {
	const tr = document.querySelector(`#preview-tbody tr[data-idx="${idx}"]`);
	if (tr) tr.className = "preview-row-removed";
	updatePreviewBadges();
}
/** Recount visible/error/removed rows and update badge labels + button text. */
function updatePreviewBadges() {
	const tbody = document.getElementById("preview-tbody");
	if (!tbody) return;
	let valid = 0, errors = 0, removed = 0;
	tbody.querySelectorAll("tr").forEach((tr) => {
		if (tr.classList.contains("preview-row-removed")) {
			removed++;
			return;
		}
		if (tr.classList.contains("preview-row-error")) {
			errors++;
			return;
		}
		valid++;
	});
	const bv = document.getElementById("badge-valid");
	const be = document.getElementById("badge-errors");
	const br = document.getElementById("badge-removed");
	if (bv) bv.textContent = valid ? `${valid} valid` : "";
	if (be) be.textContent = errors ? `${errors} with errors` : "";
	if (br) br.textContent = removed ? `${removed} removed` : "";
	const btn = document.querySelector("#csv-preview-container .btn:first-child");
	const importable = valid + errors;
	if (btn) btn.textContent = `⬆ Import ${importable} Row${importable !== 1 ? "s" : ""}`;
}
/** Collect current field values from non-removed preview rows. */
function collectPreviewRows() {
	const tbody = document.getElementById("preview-tbody");
	if (!tbody) return [];
	const rows = [];
	tbody.querySelectorAll("tr[data-idx]").forEach((tr) => {
		if (tr.classList.contains("preview-row-removed")) return;
		const val = (field) => {
			const el = tr.querySelector(`[data-field="${field}"]`);
			return el ? el.value : "";
		};
		rows.push({
			description: val("description"),
			amount: val("amount"),
			type: val("type"),
			category: val("category"),
			date: val("date"),
			tags: val("tags")
		});
	});
	return rows;
}
/** POST collected rows to /api/transactions/commit-import. */
async function commitImport() {
	const rows = collectPreviewRows();
	const resultDiv = document.getElementById("commit-result");
	if (rows.length === 0) {
		if (resultDiv) resultDiv.innerHTML = "<p style=\"color:#e17055;\">No rows to import.</p>";
		return;
	}
	if (resultDiv) resultDiv.innerHTML = "<p style=\"color:#666;\">⏳ Importing…</p>";
	try {
		const result = await (await fetch("/api/transactions/commit-import", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ rows })
		})).json();
		if (result.success) {
			let msg = `<p style="color:#00b894; font-weight:600;">✓ ${result.message}</p>`;
			if (result.errors && result.errors.length > 0) {
				msg += `<p style="color:#e17055; margin-top:8px;">⚠️ ${result.errors.length} row(s) skipped:</p>`;
				msg += "<ul style=\"margin-left:20px; color:#e17055; font-size:13px;\">";
				result.errors.forEach((err) => {
					msg += `<li>${err}</li>`;
				});
				msg += "</ul>";
			}
			if (resultDiv) resultDiv.innerHTML = msg;
			setTimeout(() => {
				const container = document.getElementById("csv-preview-container");
				if (container) container.style.display = "none";
				const importForm = document.getElementById("import-form");
				if (importForm) importForm.reset();
				const importResult = document.getElementById("import-result");
				if (importResult) importResult.innerHTML = `<p style="color:#00b894; font-weight:600;">✓ ${result.message}</p>`;
			}, 1800);
			await loadTransactions(1);
			notifyTransactionsChanged();
		} else if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ ${result.error}</p>`;
	} catch (err) {
		if (resultDiv) resultDiv.innerHTML = `<p style="color:#d63031;">❌ Error: ${err.message}</p>`;
	}
}
/** Hide the preview panel without importing anything. */
function cancelPreview() {
	const container = document.getElementById("csv-preview-container");
	if (container) container.style.display = "none";
	const importResult = document.getElementById("import-result");
	if (importResult) importResult.innerHTML = "";
}
async function deleteTransaction(id) {
	if (!confirm("Are you sure you want to delete this transaction?")) return;
	try {
		if ((await fetch(`/api/transactions/${id}`, { method: "DELETE" })).ok) {
			await loadTransactions(1);
			notifyTransactionsChanged();
		} else alert("Failed to delete transaction");
	} catch (error) {
		alert("Error: " + error.message);
	}
}
async function editTransaction(button) {
	const id = button.dataset.transactionId ?? "";
	const description = button.dataset.description ?? "";
	const amount = button.dataset.amount ?? "";
	const type = button.dataset.type ?? "";
	const date = button.dataset.date ?? "";
	const category = button.dataset.category ?? "";
	const tags = button.dataset.tags ?? "";
	try {
		const categories = await (await fetch("/api/categories")).json();
		const select = document.getElementById("edit-category");
		if (select) {
			select.innerHTML = "<option value=\"\">Select category...</option>";
			categories.forEach((cat) => {
				const option = document.createElement("option");
				option.value = cat.category_name;
				option.textContent = cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1);
				if (cat.category_name === category) option.selected = true;
				select.appendChild(option);
			});
		}
	} catch (error) {
		console.error("Error loading categories:", error);
	}
	document.getElementById("edit-id").value = id;
	document.getElementById("edit-description").value = description;
	document.getElementById("edit-amount").value = amount;
	document.getElementById("edit-type").value = type;
	document.getElementById("edit-date").value = date;
	if (editTagify) {
		editTagify.removeAllTags({ withoutChangeEvent: true });
		if (tags) {
			const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
			editTagify.addTags(tagList);
		}
	} else {
		const editTagsElement = document.getElementById("edit-tags");
		if (editTagsElement) editTagsElement.value = tags || "";
	}
	const modal = document.getElementById("editModal");
	if (modal) modal.style.display = "block";
}
function closeEditModal() {
	const modal = document.getElementById("editModal");
	if (modal) modal.style.display = "none";
}
async function saveEditTransaction() {
	const id = document.getElementById("edit-id").value;
	const formData = new FormData();
	formData.append("description", document.getElementById("edit-description").value);
	formData.append("amount", document.getElementById("edit-amount").value);
	formData.append("type", document.getElementById("edit-type").value);
	formData.append("date", document.getElementById("edit-date").value);
	formData.append("category", document.getElementById("edit-category").value);
	formData.append("tags", document.getElementById("edit-tags").value);
	try {
		if ((await fetch(`/api/transactions/${id}`, {
			method: "PUT",
			body: formData
		})).ok) {
			closeEditModal();
			await loadTransactions(1);
			notifyTransactionsChanged();
		} else alert("Failed to update transaction");
	} catch (error) {
		alert("Error: " + error.message);
	}
}
function notifyTransactionsChanged() {
	document.dispatchEvent(new CustomEvent("transactionsChanged"));
}
window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;
window.editTransaction = editTransaction;
window.closeEditModal = closeEditModal;
window.saveEditTransaction = saveEditTransaction;
window.commitImport = commitImport;
window.cancelPreview = cancelPreview;
window.removePreviewRow = removePreviewRow;
//#endregion
