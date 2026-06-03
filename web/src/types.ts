/**
 * Frontend type definitions for the AI Accounting Automation console.
 *
 * Types shared with the backend are re-imported via the `@backend-types` Vite alias
 * (resolves to src/types/ in the backend). Frontend-specific types (e.g. those using
 * string dates vs the backend's Date objects) are defined locally.
 *
 * Note: The Transaction and DebitorSummary types differ between frontend and backend:
 * - Backend Transaction.date is a Date object (Zod transform)
 * - Frontend uses string dates from JSON serialization
 * Alert and ParsingError are structurally identical and safely shared.
 */

export interface Alert {
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface ParsingError {
  row: number;
  invoiceNumber?: string;
  error: string;
}

// ─── Frontend-only types ─────────────────────────────────────────────────────

export interface Transaction {
  date: string;
  invoice: string;
  category: string;
  particulars: string;
  amount: number;
  type: 'credit' | 'debit';
  vendor: string;
}

export interface DebitorSummary {
  name: string;
  debit: number;
  credit: number;
  pending: number;
}

export interface MonthlySummary {
  sheetName: string;
  liquor: number;
  food: number;
  creditRecovery: number;
  expenses: number;
  creditExtended: number;
  inflows: number;
  outflows: number;
  net: number;
  status: 'Surplus' | 'Deficit';
}

export interface MasterSummary {
  fileName: string;
  runTimestamp: string;
  isDebitorsList?: boolean;
  isGodownStockList?: boolean;
  totalTransactions: number;
  totalItems?: number;
  totalMonths?: number;
  aggregates?: {
    totalDebitSum?: number;
    totalCreditSum?: number;
    totalPendingSum?: number;
    collectionSuccessRate?: string;
    averageOutstandingDues?: number;
    activeDebitorsCount?: number;
    topDebtorName?: string;
    topDebtorValue?: number;
    // Stock specific aggregates
    totalClosingValue?: number;
    totalSellingValue?: number;
    totalItemsCount?: number;
    totalVolumeLiters?: number;
    activeItemsCount?: number;
  };
  masterTotals?: {
    liquorSales: number;
    foodSales: number;
    creditRecovery: number;
    expenses: number;
    creditExtended: number;
    totalInflows: number;
    totalOutflows: number;
    netCashflow: number;
    surplusStatus: 'Surplus' | 'Deficit';
  };
  benchmarks?: {
    bestRevenueMonth: string;
    bestRevenueValue: number;
    bestProfitMonth: string;
    bestProfitValue: number;
    peakExpenseMonth: string;
    peakExpenseValue: number;
    liquorPercentage: string;
    foodPercentage: string;
    creditRecoveryRate: string;
    creditOutstandingGap: number;
  };
  topDebitors?: DebitorSummary[];
  months?: MonthlySummary[];
  transactions?: Transaction[];
  items?: any[];
  historicalTrends?: any[];
  categoryAggregates?: any[];
  // Using inline imports to reference shared backend types
  alerts: Alert[];
  errors: ParsingError[];
  intelligence: string[];
  aiGenerated?: boolean;
  /** Only medium/high/critical severity alerts (excludes info/low noise) */
  highAlertCount?: number;
  /** Earliest and latest data coverage labels for the dataset */
  dateRange?: { from: string; to: string } | null;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}
