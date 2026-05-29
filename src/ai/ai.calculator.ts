import type { PromptInputData, SheetSummaryData } from './ai.prompts.js';
import type { Transaction } from '../types/accounting.types.js';

export interface DebitorCalculations {
  totalDebitSum: number;
  totalCreditSum: number;
  totalPendingSum: number;
  collectionSuccessRate: string;
  activeDebitorsCount: number;
  averageOutstandingDues: number;
  topDebtorName: string;
  topDebtorValue: number;
  maxPending: number;
  sortedDebitors: any[];
  topDebitorsLimitList: any[];
}

export function calculateDebitorMetrics(data: PromptInputData): DebitorCalculations {
  const debitors = data.debitors ?? [];
  const totalDebitSum = debitors.reduce((sum, d) => sum + d.debit, 0);
  const totalCreditSum = debitors.reduce((sum, d) => sum + d.credit, 0);
  const totalPendingSum = debitors.reduce((sum, d) => sum + d.pending, 0);

  const debitorsLimit = data.debitorsLimit || 10;
  const sortedDebitors = [...debitors].sort((a, b) => b.pending - a.pending);
  const topDebitorsLimitList = sortedDebitors.slice(0, debitorsLimit);

  const collectionSuccessRate = totalDebitSum > 0 
    ? ((totalCreditSum / totalDebitSum) * 100).toFixed(1)
    : '100.0';

  const activeDebitorsCount = debitors.length;
  const averageOutstandingDues = activeDebitorsCount > 0 ? (totalPendingSum / activeDebitorsCount) : 0;
  const topDebtorName = sortedDebitors[0]?.name || 'None';
  const topDebtorValue = sortedDebitors[0]?.pending || 0;

  const maxPending = Math.max(...topDebitorsLimitList.map(d => d.pending), 1);

  return {
    totalDebitSum,
    totalCreditSum,
    totalPendingSum,
    collectionSuccessRate,
    activeDebitorsCount,
    averageOutstandingDues,
    topDebtorName,
    topDebtorValue,
    maxPending,
    sortedDebitors,
    topDebitorsLimitList,
  };
}

export interface SalesCalculations {
  sortedSheets: any[];
  maxAbsNet: number;
  maxInflowOutflow: number;
}

export function parseSheetDate(name: string): number {
  const parts = name.trim().split(/[\s\.\-]+/);
  if (parts.length >= 2) {
    const m = parts[0].substring(0, 3).toLowerCase();
    const y = parseInt(parts[1]);
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    if (!isNaN(y) && m in months) {
      return new Date(y, months[m]).getTime();
    }
  }
  return 0;
}

export function calculateSalesMetrics(data: PromptInputData): SalesCalculations {
  const { transactions, parsingErrors, sheets } = data;
  const activeSheets = sheets && sheets.length > 0 
    ? sheets 
    : [{ sheetName: 'General Ledger', transactions, errors: parsingErrors }];

  const sortedSheets = [...activeSheets].sort((a, b) => parseSheetDate(a.sheetName) - parseSheetDate(b.sheetName));

  let maxAbsNet = 1;
  let maxInflowOutflow = 1;

  for (const s of sortedSheets) {
    const liq = s.transactions.filter((t: Transaction) => t.category === 'Liquor Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const food = s.transactions.filter((t: Transaction) => t.category === 'Food Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const rec = s.transactions.filter((t: Transaction) => t.category === 'Credit Recovery').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const exp = s.transactions.filter((t: Transaction) => t.category === 'Operational Expense').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const cred = s.transactions.filter((t: Transaction) => t.category === 'Credit Extended').reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const net = (liq + food + rec) - (exp + cred);
    const inc = liq + food + rec;
    const out = exp + cred;

    if (Math.abs(net) > maxAbsNet) maxAbsNet = Math.abs(net);
    if (inc > maxInflowOutflow) maxInflowOutflow = inc;
    if (out > maxInflowOutflow) maxInflowOutflow = out;
  }

  return {
    sortedSheets,
    maxAbsNet,
    maxInflowOutflow,
  };
}
