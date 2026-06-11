//#region static_src/js/recurring.ts
var addTagify = null;
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
async function initTagify() {
	let whitelist = [];
	try {
		whitelist = await (await fetch("/api/tags")).json();
	} catch (error) {
		console.error("Error fetching tags:", error);
	}
	const input = document.getElementById("tags");
	if (input) addTagify = new Tagify(input, {
		whitelist,
		enforceWhitelist: false,
		originalInputValueFormat: (values) => values.map((v) => v.value).join(","),
		dropdown: {
			maxItems: 10,
			enabled: 0,
			closeOnSelect: false
		}
	});
}
var loadRecurring = async () => {
	try {
		const data = await (await fetch("/recurring/api")).json();
		const listDiv = document.getElementById("recurring-list");
		if (!listDiv) return;
		if (data.length === 0) {
			listDiv.textContent = "No active recurring transactions.";
			return;
		}
		const table = document.createElement("table");
		table.className = "transactions-table";
		const thead = document.createElement("thead");
		thead.innerHTML = "<tr><th>Description</th><th>Amount</th><th>Type</th><th>Frequency</th><th>Next Date</th><th>Actions</th></tr>";
		table.appendChild(thead);
		const tbody = document.createElement("tbody");
		data.forEach((tx) => {
			const row = document.createElement("tr");
			const descCell = document.createElement("td");
			descCell.textContent = tx.description;
			row.appendChild(descCell);
			const amountCell = document.createElement("td");
			amountCell.className = `amount amount-${tx.type}`;
			amountCell.textContent = `$${(tx.amount_cents / 100).toFixed(2)}`;
			row.appendChild(amountCell);
			const typeCell = document.createElement("td");
			const typeBadge = document.createElement("span");
			typeBadge.className = `type-badge type-${tx.type}`;
			typeBadge.textContent = tx.type;
			typeCell.appendChild(typeBadge);
			row.appendChild(typeCell);
			const freqCell = document.createElement("td");
			freqCell.textContent = tx.frequency;
			row.appendChild(freqCell);
			const dateCell = document.createElement("td");
			dateCell.textContent = tx.next_date || "";
			row.appendChild(dateCell);
			const actionsCell = document.createElement("td");
			const deleteBtn = document.createElement("button");
			deleteBtn.className = "btn btn-delete";
			deleteBtn.textContent = "Delete";
			deleteBtn.addEventListener("click", () => deleteRecurring(tx.id));
			actionsCell.appendChild(deleteBtn);
			row.appendChild(actionsCell);
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		listDiv.textContent = "";
		listDiv.appendChild(table);
	} catch (e) {
		console.error("Error loading recurring:", e);
	}
};
var deleteRecurring = async (id) => {
	if (!confirm("Are you sure you want to delete this recurring transaction?")) return;
	try {
		if ((await fetch(`/recurring/api/${id}`, { method: "DELETE" })).ok) await loadRecurring();
		else alert("Failed to delete.");
	} catch (e) {
		console.error("Error deleting:", e);
	}
};
var submitRecurring = async (e) => {
	e.preventDefault();
	const form = e.target;
	const amountInput = form.querySelector("#amount");
	if (!amountInput.validity.valid) {
		alert("Please enter valid amount");
		return;
	}
	const data = {
		description: form.querySelector("#description").value,
		amount_dollars: parseFloat(amountInput.value),
		type: form.querySelector("#type").value,
		category: form.querySelector("#category").value,
		frequency: form.querySelector("#frequency").value,
		start_date: form.querySelector("#start_date").value,
		end_date: form.querySelector("#end_date").value || null
	};
	if (addTagify && addTagify.value) data.tags = addTagify.value.map((t) => t.value);
	try {
		const response = await fetch("/recurring/api", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		});
		if (response.ok) {
			form.reset();
			await loadRecurring();
		} else {
			const err = await response.json();
			alert(`Error: ${err.error || "Failed to create"}`);
		}
	} catch (e) {
		console.error("Error submitting:", e);
	}
};
window.loadRecurring = loadRecurring;
window.deleteRecurring = deleteRecurring;
window.submitRecurring = submitRecurring;
document.addEventListener("DOMContentLoaded", () => {
	if (document.getElementById("recurring-list")) {
		loadRecurring();
		loadCategorySelect();
		initTagify();
		const dateInput = document.getElementById("start_date");
		if (dateInput) dateInput.valueAsDate = /* @__PURE__ */ new Date();
	}
});
//#endregion
