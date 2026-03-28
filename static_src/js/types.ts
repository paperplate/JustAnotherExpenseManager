// ─── API response shapes ──────────────────────────────────────────────────────

interface Category {
  category_name: string;
}

interface ApiSuccess {
  success: true;
  message?: string;
  count?: number;
  imported?: number;
  errors?: string[];
}

interface ApiError {
  success?: false;
  error: string;
  conflict?: boolean;
}

type ApiResult = ApiSuccess | ApiError;

interface ChartApiData {
  categories: {
    labels: string[];
    expenses: number[];
    income: number[];
  };
  monthly: {
    labels: string[];
    expenses: number[];
    income: number[];
  };
}

// ─── Sortable.js (loaded via CDN <script> tag) ────────────────────────────────

interface SortableOptions {
  animation?: number;
  handle?: string;
  ghostClass?: string;
  chosenClass?: string;
  dragClass?: string;
  onEnd?: (evt: SortableEvent) => void;
}

interface SortableEvent {
  oldIndex?: number;
  newIndex?: number;
}

interface SortableInstance {
  destroy(): void;
}

declare const Sortable: {
  create(el: HTMLElement, options: SortableOptions): SortableInstance;
};

// ─── Window extensions ────────────────────────────────────────────────────────

declare global {
  interface Window {
    // filter_component.ts
    selectCategory: (li: HTMLLIElement) => void;
    selectTag: (li: HTMLLIElement) => void;
    filterByTimeRange: (range: string) => void;
    applyCustomRange: () => void;
    applyFilters: () => void;
    // stats.ts
    updateCharts: (breakdown: [string, number, number][], monthly: [string, number, number][], selected: string) => void;
    refreshCharts: (queryString: string) => void;
    loadStats: () => Promise<void>;
    // transactions.ts
    loadTransactions: (page: number) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    editTransaction: (button: HTMLButtonElement) => Promise<void>;
    closeEditModal: () => void;
    saveEditTransaction: () => Promise<void>;
    // settings.ts
    addCategory: () => Promise<void>;
    editCategory: (name: string) => void;
    closeEditCategoryModal: () => void;
    saveEditCategory: () => Promise<void>;
    deleteCategory: (name: string) => Promise<void>;
    editTag: (name: string) => void;
    closeEditTagModal: () => void;
    saveEditTag: () => Promise<void>;
    deleteTag: (name: string) => Promise<void>;
    populateTestData: () => Promise<void>;
    exportTransactions: () => Promise<void>;
  }

  // Chart.js loaded via CDN <script> tag
  const Chart: {
    new(ctx: HTMLCanvasElement, config: object): ChartInstance;
  };
}

interface ChartInstance {
  data: {
    labels: string[];
    datasets: Array<{ data: number[] }>;
  };
  update(): void;
}

export {
  Category,
  ApiResult,
  ApiError,
  ApiSuccess,
  ChartInstance,
  ChartApiData,
  SortableInstance,
  SortableOptions,
  SortableEvent,
};
