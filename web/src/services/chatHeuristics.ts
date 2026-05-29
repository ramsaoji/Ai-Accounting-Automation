import type { MasterSummary } from '../types';

/**
 * Local simulated response fallback reasoning engine for offline use.
 */
export function generateOfflineHeuristicResponse(query: string, isDebitors: boolean, summary: MasterSummary): string {
  const q = query.toLowerCase();
  
  if (isDebitors) {
    const totalPending = summary.aggregates?.totalPendingSum || 0;
    const successRate = summary.aggregates?.collectionSuccessRate || '0%';
    const topName = summary.aggregates?.topDebtorName || 'None';
    const topVal = summary.aggregates?.topDebtorValue || 0;

    if (q.includes('rate') || q.includes('success') || q.includes('collection')) {
      return `Our credit collections success rate currently stands at **${successRate}%**. We have successfully collected ₹${(summary.aggregates?.totalCreditSum || 0).toLocaleString('en-IN')} out of ₹${(summary.aggregates?.totalDebitSum || 0).toLocaleString('en-IN')} in total credit extended. The remaining ₹${totalPending.toLocaleString('en-IN')} gap represents a major cashflow recovery opportunity!`;
    }
    if (q.includes('top') || q.includes('who') || q.includes('highest') || q.includes('debtor') || q.includes('client')) {
      return `Our top outstanding debtor account is **${topName}**, who carries a pending balance of **₹${topVal.toLocaleString('en-IN')}**. That single account represents approximately **${((topVal / Math.max(totalPending, 1)) * 100).toFixed(1)}%** of all our outstanding uncollected tabs! I highly advise scheduling a direct, friendly phone call with them this week to set up a structured weekly installment clearance.`;
    }
    if (q.includes('checklist') || q.includes('staff') || q.includes('suggest') || q.includes('action') || q.includes('policy') || q.includes('limit') || q.includes('cap')) {
      return `Here is the recommended **Client Credit Limit Policy**:\n\n1. **High Dues Restriction:** Place a temporary credit freeze on **${topName}** and any other accounts above ₹20,000 until they clear at least 50% of their current tab.\n2. **Counter Ledger Inquiries:** Ask your billing counter staff to politely verify credit statuses with repeat customers *before* their table orders exceed ₹2,000.\n3. **Structured Recoveries:** Reach out to **SURAJ KHARCHE** and request a small weekend installment plan to begin clearing their ₹27,000 outstanding dues incrementally.`;
    }
  } else {
    const netProfit = summary.masterTotals?.netCashflow || 0;
    const liqPct = summary.benchmarks?.liquorPercentage || '0';
    const foodPct = summary.benchmarks?.foodPercentage || '0';
    const bestMonth = summary.benchmarks?.bestRevenueMonth || 'N/A';
    const bestVal = summary.benchmarks?.bestRevenueValue || 0;
    const peakMonth = summary.benchmarks?.peakExpenseMonth || 'N/A';
    const peakVal = summary.benchmarks?.peakExpenseValue || 0;

    if (q.includes('best') || q.includes('profit') || q.includes('revenue') || q.includes('highest') || q.includes('month')) {
      return `Our highest monthly performance occurred in **${bestMonth}**, generating a peak revenue of **₹${bestVal.toLocaleString('en-IN')}**! Overall, the business shows a cumulative Net cash surplus of **₹${netProfit.toLocaleString('en-IN')}** across the audited timeframe. That proves the underlying sales volume is incredibly strong!`;
    }
    if (q.includes('liquor') || q.includes('food') || q.includes('compare') || q.includes('ratio') || q.includes('markup')) {
      return `The menu sales split is currently **${liqPct}% Liquor** (Bar Counter) vs. **${foodPct}% Food** (Restaurant). While bar sales drive high receipts, we can boost our margins further by having tables upsell premium starter platters and specialty combos to drink orders. This leverages the high volume of the bar to drive double-digit food margins!`;
    }
    if (q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('expense') || q.includes('credit')) {
      return `Yes, the system flagged **${summary.alerts.length} operational alerts**. Specifically, in **${peakMonth}**, supplier expenses spiked to **₹${peakVal.toLocaleString('en-IN')}**, breaching our standard safety budget limits. I recommend cross-auditing supplier statements from that period to identify if there was any cost leakage or duplicate supplier billing.`;
    }
  }

  return `I hear you! Looking at "${summary.fileName}", our numbers indicate a strong financial base with ₹${(isDebitors ? summary.aggregates?.totalPendingSum : summary.masterTotals?.netCashflow)?.toLocaleString('en-IN')} in play. To optimize this, I recommend scheduling a quick staff sync to review billing entries, capping high credit extensions, and setting target sales goals. What specific numbers would you like me to pull next?`;
}
