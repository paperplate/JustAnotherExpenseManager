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
			listDiv.innerHTML = "<p>No active recurring transactions.</p>";
			return;
		}
		let html = "<table class=\"transactions-table\"><thead><tr><th>Description</th><th>Amount</th><th>Type</th><th>Frequency</th><th>Next Date</th><th>Actions</th></tr></thead><tbody>";
		data.forEach((tx) => {
			html += `
                <tr>
                    <td>${tx.description}</td>
                    <td class="amount amount-${tx.type}">$${(tx.amount_cents / 100).toFixed(2)}</td>
                    <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
                    <td>${tx.frequency}</td>
                    <td>${tx.next_date}</td>
                    <td>
                        <button class="btn btn-delete" onclick="window.deleteRecurring(${tx.id})">Delete</button>
                    </td>
                </tr>
            `;
		});
		html += "</tbody></table>";
		listDiv.innerHTML = html;
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
