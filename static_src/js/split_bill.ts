interface Person {
  id: string;
  name: string;
}

interface SplitBillTransaction {
  amount: number;
  tags: string[];
}

interface SplitBillUpdateEvent {
  total: number;
  source: "summary" | "transactions";
  transactions?: SplitBillTransaction[];
}

const STORAGE_KEY = "splitBillPeople";

class SplitBillComponent {
  private container: HTMLElement;
  private total: number = 0;
  private transactions: SplitBillTransaction[] = [];
  private people: Person[] = [];
  private availableTags: string[] = [];
  private nextId: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadPeople();
    this.loadTags().then(() => this.render());
    this.bindGlobalEvent();
  }

  private async loadTags(): Promise<void> {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        this.availableTags = await response.json();
      }
    } catch {
      this.availableTags = [];
    }
  }

  private loadPeople(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Person[];
        this.people = parsed.map(p => ({ id: String(p.id), name: p.name }));
        this.nextId =
          Math.max(0, ...this.people.map((p) => parseInt(p.id, 10) || 0)) + 1;
      }
    } catch {
      this.people = [];
    }
  }

  private savePeople(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.people));
    } catch {
      // storage unavailable — ignore
    }
  }

  private bindGlobalEvent(): void {
    window.addEventListener("splitBillUpdate", (e: Event) => {
      const detail = (e as CustomEvent<SplitBillUpdateEvent>).detail ?? {};
      this.total = detail.total || 0;
      console.log('Received splitBillUpdate:', detail);
      if (detail.source === 'transactions') {
        const txs = Array.isArray(detail.transactions) ? detail.transactions : [];
        //this.transactions = detail.transactions || [];
        this.transactions = txs.map((tx) => ({
          amount: Number(tx?.amount) || 0,
          tags: Array.isArray(tx?.tags) ? tx.tags.filter((t) => typeof t === 'string') : []
        }));
      }
      this.renderTotalAndTable();
    });
  }

  private generateId(): string {
    return String(this.nextId++);
  }

  private addPerson(name: string): void {
    const normalizedName: string = name.trim().toLowerCase();
    if (!normalizedName) { return; }
    // Don't add duplicate tags
    if (this.people.some(p => p.name.toLowerCase() === normalizedName)) { return; }

    this.people.push({
      id: this.generateId(),
      name: normalizedName,
    });
    this.savePeople();
    this.renderTotalAndTable();
  }

  private removePerson(id: string): void {
    this.people = this.people.filter((p) => p.id !== id);
    this.savePeople();
    this.renderTotalAndTable();
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  private calculateSplits() {
    const tagAmounts = new Map<string, number>();
    this.people.forEach(p => tagAmounts.set(p.name, 0));

    let unallocatedAmount = 0;
    console.log('Calculating splits with transactions:', this.transactions, 'and people:', this.people);

    for (const tx of this.transactions) {
      const matchedPeople = this.people.filter(p =>
        tx.tags.some(t => t.toLowerCase() === p.name.toLowerCase())
      );

      if (matchedPeople.length > 0) {
        const split = tx.amount / matchedPeople.length;
        for (const p of matchedPeople) {
          tagAmounts.set(p.name, tagAmounts.get(p.name)! + split);
        }
      } else {
        unallocatedAmount += tx.amount;
      }
    }

    console.log('Calculated tagAmounts:', Object.fromEntries(tagAmounts), 'unallocatedAmount:', unallocatedAmount);
    return { tagAmounts, unallocatedAmount };
  }

  private renderTotalAndTable(): void {
    const totalEl = this.container.querySelector<HTMLElement>(
      "[data-split-total]"
    );
    if (totalEl) {
      totalEl.textContent = this.formatCurrency(this.total);
    }

    const tableBody = this.container.querySelector<HTMLElement>(
      "[data-split-tbody]"
    );
    if (!tableBody) return;

    if (this.people.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="split-empty">Add people (tags) above to split the bill based on transaction tags.</td></tr>`;
      return;
    }

    const { tagAmounts, unallocatedAmount } = this.calculateSplits();
    const evenSplitAmount = this.people.length > 0 ? this.total / this.people.length : 0;

    tableBody.innerHTML = this.people
      .map((p) => {
        const amount = tagAmounts.get(p.name) || 0;
        const diff = evenSplitAmount - amount;
        let diffStr = this.formatCurrency(Math.abs(diff));
        if (diff > 0.005) {
          diffStr = "+" + diffStr;
        } else if (diff < -0.005) {
          diffStr = "-" + diffStr;
        } else {
          diffStr = this.formatCurrency(0);
        }

        return `
      <tr class="split-row" data-person-id="${p.id}">
        <td class="split-name">
          <span class="tag-badge">${this.escapeHtml(p.name)}</span>
        </td>
        <td class="split-amount">${this.formatCurrency(amount)}</td>
        <td class="split-diff" style="${diff > 0.005 ? 'color: var(--bs-danger, red);' : diff < -0.005 ? 'color: var(--bs-success, green); ' : ''}">${diffStr}</td>
        <td class="split-remove-cell">
          <button type="button" class="split-remove-btn" data-action="remove" data-id="${p.id}" title="Remove">×</button>
        </td>
      </tr>`;
      })
      .join("");

    // Remainder row
    if (this.transactions.length > 0) {
      const remainderRow = document.createElement("tr");
      remainderRow.className = `split-remainder-row ${Math.abs(unallocatedAmount) > 0.05 ? "split-remainder-nonzero" : ""}`;
      remainderRow.innerHTML = `
        <td class="split-remainder-label">Unallocated</td>
        <td class="split-remainder-amount">${this.formatCurrency(unallocatedAmount)}</td>
        <td></td>
        <td></td>`;
      tableBody.appendChild(remainderRow);
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private render(): void {
    const optionsHtml = this.availableTags
      .map(t => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`)
      .join("");

    const nameInput = this.container.querySelector<HTMLSelectElement>("[data-action='name-input']");
    if (nameInput) {
      nameInput.innerHTML = `<option value="">Select a tag...</option>\n${optionsHtml}`;
    }

    this.renderTotalAndTable();
    this.bindEvents();
  }

  private bindEvents(): void {
    const nameInput = this.container.querySelector<HTMLSelectElement>(
      "[data-action='name-input']"
    )!;

    this.container
      .querySelector("[data-action='add']")!
      .addEventListener("click", () => {
        this.addPerson(nameInput.value);
        nameInput.value = "";
      });

    // Delegate tbody events
    const tbody = this.container.querySelector<HTMLElement>("[data-split-tbody]")!;
    tbody.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!id) return;
      if (action === "remove") this.removePerson(id);
    });
  }
}

function initSplitBill(): void {
  document.querySelectorAll<HTMLElement>("[data-split-bill]").forEach((el) => {
    if (el.dataset.splitBillInit) {
      return;
    }
    el.dataset.splitBillInit = 'true';
    new SplitBillComponent(el);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSplitBill);
} else {
  initSplitBill();
}

export { SplitBillComponent, SplitBillUpdateEvent };

