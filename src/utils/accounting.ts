import type { Transaction } from '../types/accounting.types.js';

/**
 * Compiles a per-day aggregated sales array from a flat transaction list.
 */
export function buildDailySalesArray(
  transactions: Transaction[],
  coaList: any[] = []
): Array<{
  date: string;
  liquor: number;
  food: number;
  creditRecovery: number;
  expenses: number;
  creditExtended: number;
  departments: Record<string, number>;
}> {
  const dailyMap = new Map<string, {
    date: string;
    liquor: number;
    food: number;
    creditRecovery: number;
    expenses: number;
    creditExtended: number;
    inflows: number;
    outflows: number;
    departments: Record<string, number>;
  }>();

  const recoveryCoa = coaList.find(c =>
    c.accountType === 'REVENUE' &&
    (
      c.accountName.toLowerCase().includes('recover') ||
      c.accountName.toLowerCase().includes('jama') ||
      c.accountName.toLowerCase().includes('collected')
    )
  ) || coaList.find(c => c.accountCode === '4003');

  const creditExtendedCoa = coaList.find(c =>
    (c.accountType === 'OPEX' || c.accountType === 'EXPENSE') &&
    (
      c.accountName.toLowerCase().includes('extended') ||
      c.accountName.toLowerCase().includes('given') ||
      c.accountName.toLowerCase().includes('udhari')
    )
  ) || coaList.find(c => c.accountCode === '5002');

  const revenueCoas = coaList.filter(c => c.accountType === 'REVENUE' && c.id !== recoveryCoa?.id);
  const rev1 = revenueCoas[0];
  const rev2 = revenueCoas[1];

  // Derive fallbacks from transaction categories to prevent hardcoded liquor/food associations
  const creditCategories = Array.from(new Set(
    transactions
      .filter(t => t.type === 'credit' && !t.category?.toLowerCase().includes('recovery') && !t.category?.toLowerCase().includes('jama') && !t.category?.toLowerCase().includes('recover'))
      .map(t => t.category)
  ));
  const fallbackRev1Name = creditCategories[0];
  const fallbackRev2Name = creditCategories[1];

  for (const t of transactions) {
    if (!t.date || isNaN(t.date.getTime())) continue;
    const dateStr = t.date.toISOString().split('T')[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        liquor: 0,
        food: 0,
        creditRecovery: 0,
        expenses: 0,
        creditExtended: 0,
        inflows: 0,
        outflows: 0,
        departments: {}
      });
    }
    const dayData = dailyMap.get(dateStr)!;
    const amt = Number(t.amount) || 0;

    const coa = coaList.find(c => c.id === t.coaId || c.code === t.coaId || c.accountCode === t.coaId);
    const catName = coa ? coa.accountName : t.category;
    dayData.departments[catName] = (dayData.departments[catName] || 0) + amt;

    const coaCode = coa?.accountCode || coa?.code || '';
    const categoryLower = (t.category || '').toLowerCase();

    // Reconcile recovery
    const isRecovery =
      (recoveryCoa && (coa?.id === recoveryCoa.id || coaCode === recoveryCoa.accountCode)) ||
      categoryLower.includes('recover') ||
      categoryLower.includes('jama');

    // Reconcile primary/secondary revenue based on COA or dynamic category ordering
    let isPrimaryRev = false;
    let isSecondaryRev = false;

    if (coa) {
      if (rev1 && coa.id === rev1.id) {
        isPrimaryRev = true;
      } else if (rev2 && coa.id === rev2.id) {
        isSecondaryRev = true;
      }
    } else {
      if (rev1 && categoryLower.includes(rev1.accountName.toLowerCase())) {
        isPrimaryRev = true;
      } else if (rev2 && categoryLower.includes(rev2.accountName.toLowerCase())) {
        isSecondaryRev = true;
      } else if (fallbackRev1Name && categoryLower === fallbackRev1Name.toLowerCase()) {
        isPrimaryRev = true;
      } else if (fallbackRev2Name && categoryLower === fallbackRev2Name.toLowerCase()) {
        isSecondaryRev = true;
      }
    }

    const isCreditExtended =
      (creditExtendedCoa && (coa?.id === creditExtendedCoa.id || coaCode === creditExtendedCoa.accountCode)) ||
      categoryLower.includes('extended') ||
      categoryLower.includes('given') ||
      categoryLower.includes('udhari');

    if (t.type === 'credit') {
      dayData.inflows += amt;
      if (isPrimaryRev) {
        dayData.liquor += amt;
      } else if (isSecondaryRev) {
        dayData.food += amt;
      } else if (isRecovery) {
        dayData.creditRecovery += amt;
      } else {
        dayData.liquor += amt;
      }
    } else {
      dayData.outflows += amt;
      if (isCreditExtended) {
        dayData.creditExtended += amt;
      } else {
        dayData.expenses += amt;
      }
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

