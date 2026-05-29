import type { Transaction } from '../types/accounting.types.js';

/**
 * Compiles a per-day aggregated sales array from a flat transaction list.
 */
export function buildDailySalesArray(transactions: Transaction[]): Array<{
  date: string;
  liquor: number;
  food: number;
  creditRecovery: number;
  expenses: number;
  creditExtended: number;
}> {
  const dailyMap = new Map<string, {
    date: string;
    liquor: number;
    food: number;
    creditRecovery: number;
    expenses: number;
    creditExtended: number;
  }>();

  for (const t of transactions) {
    if (!t.date || isNaN(t.date.getTime())) continue;
    const dateStr = t.date.toISOString().split('T')[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, liquor: 0, food: 0, creditRecovery: 0, expenses: 0, creditExtended: 0 });
    }
    const dayData = dailyMap.get(dateStr)!;
    const amt = t.amount || 0;
    if (t.category === 'Liquor Revenue') dayData.liquor += amt;
    else if (t.category === 'Food Revenue') dayData.food += amt;
    else if (t.category === 'Credit Recovery') dayData.creditRecovery += amt;
    else if (t.category === 'Operational Expense') dayData.expenses += amt;
    else if (t.category === 'Credit Extended') dayData.creditExtended += amt;
  }

  return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}
