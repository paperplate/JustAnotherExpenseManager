//#region static_src/js/transactions.ts
var addTagify = null;
var editTagify = null;
document.addEventListener("DOMContentLoaded", () => {
	const dateInput = document.getElementById("date");
	if (dateInput) dateInput.valueAsDate = /* @__PURE__ */ new Date();
	loadCategorySelect();
	initTagify();
	document.getElementById("add-transaction-form")?.addEventListener("submit", handleAddTransaction);
	document.getElementById("import-form")?.addEventListener("submit", handleCSVImport);
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
async function handleCSVImport(e) {
	e.preventDefault();
	const form = e.target;
	const formData = new FormData(form);
	const resultDiv = document.getElementById("import-result");
	if (resultDiv) resultDiv.innerHTML = "<p style=\"color: #666;\">⏳ Importing...</p>";
	try {
		const result = await (await fetch("/api/transactions/import", {
			method: "POST",
			body: formData
		})).json();
		if (result.success) {
			let message = `<p style="color: #00b894; font-weight: 600;">✓ Successfully imported ${result.imported} transaction(s)!</p>`;
			if (result.errors && result.errors.length > 0) {
				message += `<p style="color: #e17055; margin-top: 10px;">⚠️ ${result.errors.length} error(s):</p>`;
				message += "<ul style=\"margin-left: 20px; color: #e17055;\">";
				result.errors.forEach((err) => {
					message += `<li>${err}</li>`;
				});
				message += "</ul>";
			}
			if (resultDiv) resultDiv.innerHTML = message;
			form.reset();
			await loadTransactions(1);
			notifyTransactionsChanged();
		} else if (resultDiv) resultDiv.innerHTML = `<p style="color: #d63031;">❌ ${result.error}</p>`;
	} catch (error) {
		if (resultDiv) resultDiv.innerHTML = `<p style="color: #d63031;">❌ Error: ${error.message}</p>`;
	}
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
//#endregion
