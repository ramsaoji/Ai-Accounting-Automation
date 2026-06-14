import type { MasterSummary } from '../types';

/**
 * Local simulated response fallback reasoning engine for offline use.
 */
export function generateOfflineHeuristicResponse(query: string, isDebitors: boolean, summary: MasterSummary): string {
  const q = query.toLowerCase();
  
  const profile = summary.businessMetadata?.industryProfile || 'HOSPITALITY';
  const isHospitality = profile === 'HOSPITALITY';

  if (summary.isGodownStockList) {
    const totalClosingValue = summary.aggregates?.totalClosingValue || 0;
    const totalSellingValue = summary.aggregates?.totalSellingValue || 0;
    const totalItemsCount = summary.aggregates?.totalItemsCount || 0;
    const totalVolume = summary.aggregates?.totalVolumeLiters || 0;

    if (q.includes('valuation') || q.includes('value') || q.includes('cost') || q.includes('retail')) {
      return `Our total stock valuation stands at **₹${totalClosingValue.toLocaleString('en-IN')}** at Cost Price, and **₹${totalSellingValue.toLocaleString('en-IN')}** at Retail Selling Price. This represents a potential margin difference of **₹${(totalSellingValue - totalClosingValue).toLocaleString('en-IN')}** when fully sold!`;
    }
    if (q.includes('volume') || q.includes('liter') || q.includes('liquor') || q.includes('beer') || q.includes('wine') || q.includes('quantity') || q.includes('items')) {
      if (isHospitality) {
        return `We currently hold a total liquid volume of **${totalVolume.toLocaleString('en-IN')} Liters** in active stock across **${totalItemsCount}** distinct items. This volume includes all categories like Liquor, Strong Beer, Mild Beer, and Wine.`;
      } else {
        return `We currently hold a total quantity of **${totalItemsCount.toLocaleString('en-IN')}** active items in stock across our categories. This includes all inventory materials and retail product SKU units.`;
      }
    }
    if (q.includes('alert') || q.includes('warning') || q.includes('discrepancy') || q.includes('audit')) {
      return `Yes, the system flagged **${summary.alerts?.length || 0} inventory alerts**. This includes audit anomalies like items with negative stock calculations or pricing mismatches. I recommend reviewing the Auditor page in the console for the full itemized list.`;
    }
  } else if (isDebitors) {
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
      return `Here is the recommended **Client Credit Limit Policy**:\n\n1. **High Dues Restriction:** Place a temporary credit freeze on **${topName}** and any other accounts above ₹20,000 until they clear at least 50% of their current tab.\n2. **Counter Ledger Inquiries:** Ask your billing counter staff to politely verify credit statuses with repeat customers *before* their table orders exceed ₹2,000.\n3. **Structured Recoveries:** Reach out to outstanding customer accounts and request a small weekend installment plan to begin clearing outstanding dues incrementally.`;
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
    if (q.includes('liquor') || q.includes('food') || q.includes('compare') || q.includes('ratio') || q.includes('markup') || q.includes('split') || q.includes('category') || q.includes('departments')) {
      const splitTitle = summary.masterTotals && (summary.masterTotals as any).splitTitle ? (summary.masterTotals as any).splitTitle : "Liquor vs Food Split";
      const splitValue = summary.masterTotals && (summary.masterTotals as any).splitValue ? (summary.masterTotals as any).splitValue : `${liqPct}% / ${foodPct}%`;

      if (isHospitality) {
        return `The menu sales split is currently **${liqPct}% Liquor** (Bar Counter) vs. **${foodPct}% Food** (Restaurant). While bar sales drive high receipts, we can boost our margins further by having tables upsell premium starter platters and specialty combos to drink orders. This leverages the high volume of the bar to drive double-digit food margins!`;
      } else {
        return `The dynamic revenue category split is currently **${splitValue}** (representing our primary revenue departments: **${splitTitle}**). To boost margins further, I recommend analyzing the lower-performing category and training staff to cross-sell products or services at checkout to improve ticket sizes.`;
      }
    }
    if (q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('expense') || q.includes('credit')) {
      return `Yes, the system flagged **${summary.alerts.length} operational alerts**. Specifically, in **${peakMonth}**, supplier expenses spiked to **₹${peakVal.toLocaleString('en-IN')}**, breaching our standard safety budget limits. I recommend cross-auditing supplier statements from that period to identify if there was any cost leakage or duplicate supplier billing.`;
    }
  }

  return `I hear you! Looking at "${summary.fileName}", our numbers indicate a strong financial base with ₹${(summary.isGodownStockList ? summary.aggregates?.totalClosingValue : (isDebitors ? summary.aggregates?.totalPendingSum : summary.masterTotals?.netCashflow))?.toLocaleString('en-IN')} in play. To optimize this, I recommend scheduling a quick staff sync to review billing entries, capping high credit extensions, and setting target sales goals. What specific numbers would you like me to pull next?`;
}
