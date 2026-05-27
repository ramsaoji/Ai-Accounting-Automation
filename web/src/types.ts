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

export interface Alert {
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface ParsingError {
  row: number;
  error: string;
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
  totalTransactions: number;
  totalMonths?: number;
  aggregates?: {
    totalDebitSum: number;
    totalCreditSum: number;
    totalPendingSum: number;
    collectionSuccessRate: string;
    averageOutstandingDues: number;
    activeDebitorsCount: number;
    topDebtorName: string;
    topDebtorValue: number;
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
  alerts: Alert[];
  errors: ParsingError[];
  intelligence: string[];
  aiGenerated?: boolean;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}
