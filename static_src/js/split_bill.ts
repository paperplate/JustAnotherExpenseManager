interface Person {
  id: string;
  name: string;
  percentage: number;
  locked: boolean;
}

interface SplitBillUpdateEvent {
  total: number;
  source: "summary" | "transactions";
}

const STORAGE_KEY = "splitBillPeople";

class SplitBillComponent {
  private container: HTMLElement;
  private total: number = 0;
  private people: Person[] = [];
  private nextId: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadPeople();
    this.render();
    this.bindGlobalEvent();
  }

  private loadPeople(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Person[];
        this.people = parsed;
        this.nextId =
          Math.max(0, ...parsed.map((p) => parseInt(p.id, 10))) + 1;
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
      const detail = (e as CustomEvent<SplitBillUpdateEvent>).detail;
      this.total = detail.total;
      this.renderTotalAndTable();
    });
  }

  private generateId(): string {
    return String(this.nextId++);
  }

  private evenSplit(): void {
    if (this.people.length === 0) return;
    const each = Math.round((100 / this.people.length) * 10) / 10;
    const remainder =
      Math.round((100 - each * (this.people.length - 1)) * 10) / 10;
    this.people = this.people.map((p, i) => ({
      ...p,
      percentage: i === this.people.length - 1 ? remainder : each,
      locked: false,
    }));
    this.savePeople();
    this.renderTotalAndTable();
  }

  private rebalanceUnlocked(): void {
    const locked = this.people.filter((p) => p.locked);
    const unlocked = this.people.filter((p) => !p.locked);
    if (unlocked.length === 0) return;
    const lockedSum = locked.reduce((s, p) => s + p.percentage, 0);
    const available = Math.max(0, 100 - lockedSum);
    const each = Math.round((available / unlocked.length) * 10) / 10;
    const lastShare =
      Math.round((available - each * (unlocked.length - 1)) * 10) / 10;
    unlocked.forEach((p, i) => {
      const person = this.people.find((x) => x.id === p.id)!;
      person.percentage = i === unlocked.length - 1 ? lastShare : each;
    });
    this.savePeople();
  }

  private addPerson(name: string): void {
    if (!name.trim()) return;
    this.people.push({
      id: this.generateId(),
      name: name.trim(),
      percentage: 0,
      locked: false,
    });
    this.evenSplit();
  }

  private removePerson(id: string): void {
    this.people = this.people.filter((p) => p.id !== id);
    if (this.people.length > 0) this.evenSplit();
    else {
      this.savePeople();
      this.renderTotalAndTable();
    }
  }

  private updatePercentage(id: string, value: number): void {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    person.percentage = Math.min(100, Math.max(0, value));
    person.locked = true;
    this.rebalanceUnlocked();
    this.savePeople();
    this.renderTotalAndTable();
  }

  private toggleLock(id: string): void {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    person.locked = !person.locked;
    this.savePeople();
    this.renderTotalAndTable();
  }

  private totalPercentage(): number {
    return Math.round(
      this.people.reduce((s, p) => s + p.percentage, 0) * 10
    ) / 10;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
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
      tableBody.innerHTML = `<tr><td colspan="4" class="split-empty">Add people above to split the bill.</td></tr>`;
      return;
    }

    const totalPct = this.totalPercentage();
    const remainderPct = Math.round((100 - totalPct) * 10) / 10;
    const remainderAmount = (this.total * remainderPct) / 100;

    tableBody.innerHTML = this.people
      .map(
        (p) => `
      <tr class="split-row" data-person-id="${p.id}">
        <td class="split-name">${this.escapeHtml(p.name)}</td>
        <td class="split-pct-cell">
          <div class="split-pct-wrap">
            <input
              type="number"
              class="split-pct-input"
              data-action="pct"
              data-id="${p.id}"
              value="${p.percentage}"
              min="0" max="100" step="0.1"
            />
            <span class="split-pct-symbol">%</span>
            <button class="split-lock-btn ${p.locked ? "locked" : ""}" data-action="lock" data-id="${p.id}" title="${p.locked ? "Unlock" : "Lock"} percentage">
              ${p.locked ? "🔒" : "🔓"}
            </button>
          </div>
        </td>
        <td class="split-amount">${this.formatCurrency((this.total * p.percentage) / 100)}</td>
        <td class="split-remove-cell">
          <button class="split-remove-btn" data-action="remove" data-id="${p.id}" title="Remove">×</button>
        </td>
      </tr>`
      )
      .join("");

    // Remainder row
    const remainderRow = document.createElement("tr");
    remainderRow.className = `split-remainder-row ${Math.abs(remainderPct) > 0.05 ? "split-remainder-nonzero" : ""}`;
    remainderRow.innerHTML = `
      <td colspan="2" class="split-remainder-label">Unallocated (${remainderPct}%)</td>
      <td class="split-remainder-amount">${this.formatCurrency(remainderAmount)}</td>
      <td></td>`;
    tableBody.appendChild(remainderRow);
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="split-bill-card card">
        <div class="card-header split-card-header">
          <h5 class="mb-0">
            <span class="split-bill-icon">🧾</span> Split Bill
          </h5>
          <div class="split-total-display">
            Total: <strong data-split-total>${this.formatCurrency(this.total)}</strong>
          </div>
        </div>
        <div class="card-body">
          <div class="split-add-row">
            <input
              type="text"
              class="form-control split-name-input"
              placeholder="Person name…"
              maxlength="40"
              data-action="name-input"
            />
            <button class="btn btn-primary split-add-btn" data-action="add">+ Add Person</button>
            <button class="btn btn-outline-secondary split-even-btn" data-action="even">↺ Even Split</button>
          </div>
          <div class="split-table-wrap">
            <table class="split-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Split %</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody data-split-tbody></tbody>
            </table>
          </div>
        </div>
      </div>`;

    this.renderTotalAndTable();
    this.bindEvents();
  }

  private bindEvents(): void {
    const nameInput = this.container.querySelector<HTMLInputElement>(
      "[data-action='name-input']"
    )!;

    this.container
      .querySelector("[data-action='add']")!
      .addEventListener("click", () => {
        this.addPerson(nameInput.value);
        nameInput.value = "";
        nameInput.focus();
      });

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.addPerson(nameInput.value);
        nameInput.value = "";
      }
    });

    this.container
      .querySelector("[data-action='even']")!
      .addEventListener("click", () => this.evenSplit());

    // Delegate tbody events
    const tbody = this.container.querySelector<HTMLElement>("[data-split-tbody]")!;
    tbody.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!id) return;
      if (action === "remove") this.removePerson(id);
      if (action === "lock") this.toggleLock(id);
    });

    tbody.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.dataset.action === "pct" && target.dataset.id) {
        this.updatePercentage(target.dataset.id, parseFloat(target.value) || 0);
      }
    });

    tbody.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.dataset.action === "pct" && target.dataset.id) {
        this.updatePercentage(target.dataset.id, parseFloat(target.value) || 0);
      }
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
