//#region static_src/js/split_bill.ts
var STORAGE_KEY = "splitBillPeople";
var SplitBillComponent = class {
	container;
	total = 0;
	transactions = [];
	people = [];
	availableTags = [];
	nextId = 1;
	constructor(container) {
		this.container = container;
		this.loadPeople();
		this.loadTags().then(() => this.render());
		this.bindGlobalEvent();
	}
	async loadTags() {
		try {
			const response = await fetch("/api/tags");
			if (response.ok) this.availableTags = await response.json();
		} catch {
			this.availableTags = [];
		}
	}
	loadPeople() {
		try {
			const stored = sessionStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.people = JSON.parse(stored).map((p) => ({
					id: String(p.id),
					name: p.name
				}));
				this.nextId = Math.max(0, ...this.people.map((p) => parseInt(p.id, 10) || 0)) + 1;
			}
		} catch {
			this.people = [];
		}
	}
	savePeople() {
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.people));
		} catch {}
	}
	bindGlobalEvent() {
		window.addEventListener("splitBillUpdate", (e) => {
			const detail = e.detail ?? {};
			this.total = detail.total || 0;
			console.log("Received splitBillUpdate:", detail);
			if (detail.source === "transactions") this.transactions = (Array.isArray(detail.transactions) ? detail.transactions : []).map((tx) => ({
				amount: Number(tx?.amount) || 0,
				tags: Array.isArray(tx?.tags) ? tx.tags.filter((t) => typeof t === "string") : []
			}));
			this.renderTotalAndTable();
		});
	}
	generateId() {
		return String(this.nextId++);
	}
	addPerson(name) {
		const normalizedName = name.trim().toLowerCase();
		if (!normalizedName) return;
		if (this.people.some((p) => p.name.toLowerCase() === normalizedName)) return;
		this.people.push({
			id: this.generateId(),
			name: normalizedName
		});
		this.savePeople();
		this.renderTotalAndTable();
	}
	removePerson(id) {
		this.people = this.people.filter((p) => p.id !== id);
		this.savePeople();
		this.renderTotalAndTable();
	}
	formatCurrency(amount) {
		return new Intl.NumberFormat(void 0, {
			style: "currency",
			currency: "CAD",
			minimumFractionDigits: 2
		}).format(amount);
	}
	calculateSplits() {
		const tagAmounts = /* @__PURE__ */ new Map();
		this.people.forEach((p) => tagAmounts.set(p.name, 0));
		let unallocatedAmount = 0;
		console.log("Calculating splits with transactions:", this.transactions, "and people:", this.people);
		for (const tx of this.transactions) {
			const matchedPeople = this.people.filter((p) => tx.tags.some((t) => t.toLowerCase() === p.name.toLowerCase()));
			if (matchedPeople.length > 0) {
				const split = tx.amount / matchedPeople.length;
				for (const p of matchedPeople) tagAmounts.set(p.name, tagAmounts.get(p.name) + split);
			} else unallocatedAmount += tx.amount;
		}
		console.log("Calculated tagAmounts:", Object.fromEntries(tagAmounts), "unallocatedAmount:", unallocatedAmount);
		return {
			tagAmounts,
			unallocatedAmount
		};
	}
	renderTotalAndTable() {
		const totalEl = this.container.querySelector("[data-split-total]");
		if (totalEl) totalEl.textContent = this.formatCurrency(this.total);
		const tableBody = this.container.querySelector("[data-split-tbody]");
		if (!tableBody) return;
		if (this.people.length === 0) {
			tableBody.innerHTML = `<tr><td colspan="4" class="split-empty">Add people (tags) above to split the bill based on transaction tags.</td></tr>`;
			return;
		}
		const { tagAmounts, unallocatedAmount } = this.calculateSplits();
		const evenSplitAmount = this.people.length > 0 ? this.total / this.people.length : 0;
		tableBody.innerHTML = this.people.map((p) => {
			const amount = tagAmounts.get(p.name) || 0;
			const diff = evenSplitAmount - amount;
			let diffStr = this.formatCurrency(Math.abs(diff));
			if (diff > .005) diffStr = "+" + diffStr;
			else if (diff < -.005) diffStr = "-" + diffStr;
			else diffStr = this.formatCurrency(0);
			return `
      <tr class="split-row" data-person-id="${p.id}">
        <td class="split-name">
          <span class="tag-badge">${this.escapeHtml(p.name)}</span>
        </td>
        <td class="split-amount">${this.formatCurrency(amount)}</td>
        <td class="split-diff" style="${diff > .005 ? "color: var(--bs-danger, red);" : diff < -.005 ? "color: var(--bs-success, green); " : ""}">${diffStr}</td>
        <td class="split-remove-cell">
          <button type="button" class="split-remove-btn" data-action="remove" data-id="${p.id}" title="Remove">×</button>
        </td>
      </tr>`;
		}).join("");
		if (this.transactions.length > 0) {
			const remainderRow = document.createElement("tr");
			remainderRow.className = `split-remainder-row ${Math.abs(unallocatedAmount) > .05 ? "split-remainder-nonzero" : ""}`;
			remainderRow.innerHTML = `
        <td class="split-remainder-label">Unallocated</td>
        <td class="split-remainder-amount">${this.formatCurrency(unallocatedAmount)}</td>
        <td></td>
        <td></td>`;
			tableBody.appendChild(remainderRow);
		}
	}
	escapeHtml(s) {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}
	render() {
		const optionsHtml = this.availableTags.map((t) => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`).join("");
		const nameInput = this.container.querySelector("[data-action='name-input']");
		if (nameInput) nameInput.innerHTML = `<option value="">Select a tag...</option>\n${optionsHtml}`;
		this.renderTotalAndTable();
		this.bindEvents();
	}
	bindEvents() {
		const nameInput = this.container.querySelector("[data-action='name-input']");
		this.container.querySelector("[data-action='add']").addEventListener("click", () => {
			this.addPerson(nameInput.value);
			nameInput.value = "";
		});
		this.container.querySelector("[data-split-tbody]").addEventListener("click", (e) => {
			const target = e.target;
			const action = target.dataset.action;
			const id = target.dataset.id;
			if (!id) return;
			if (action === "remove") this.removePerson(id);
		});
	}
};
function initSplitBill() {
	document.querySelectorAll("[data-split-bill]").forEach((el) => {
		if (el.dataset.splitBillInit) return;
		el.dataset.splitBillInit = "true";
		new SplitBillComponent(el);
	});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSplitBill);
else initSplitBill();
//#endregion
