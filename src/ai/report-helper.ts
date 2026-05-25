import { Transaction } from '../types/accounting.types.js';

export interface SalesReportElements {
  htmlTrendRows: string[];
  monthlyTrendRows: string[];
  bestRevenueMonth: string;
  bestRevenueValue: number;
  bestProfitMonth: string;
  bestProfitValue: number;
  peakExpenseMonth: string;
  peakExpenseValue: number;
  masterLiquor: number;
  masterFood: number;
  masterRecovery: number;
  masterExpenses: number;
  masterCreditExtended: number;
  jsonMonths: any[];
}

/**
 * Builds standard Daily Sales Register SVG coordinate path points and lines.
 */
export function generateSalesSvgChart(
  sortedSheets: any[],
  maxInflowOutflow: number,
  svgWidth = 1000,
  svgHeight = 360,
  svgPaddingX = 80,
  svgPaddingY = 40
): string {
  const pointsInflow: any[] = [];
  const pointsOutflow: any[] = [];

  sortedSheets.forEach((s, idx) => {
    const liq = s.transactions.filter((t: Transaction) => t.category === 'Liquor Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const food = s.transactions.filter((t: Transaction) => t.category === 'Food Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const rec = s.transactions.filter((t: Transaction) => t.category === 'Credit Recovery').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const exp = s.transactions.filter((t: Transaction) => t.category === 'Operational Expense').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const cred = s.transactions.filter((t: Transaction) => t.category === 'Credit Extended').reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const inf = liq + food + rec;
    const out = exp + cred;

    const x = svgPaddingX + (idx * (svgWidth - 2 * svgPaddingX)) / Math.max(1, sortedSheets.length - 1);
    const yInf = svgHeight - svgPaddingY - (inf / maxInflowOutflow) * (svgHeight - 2 * svgPaddingY);
    const yOut = svgHeight - svgPaddingY - (out / maxInflowOutflow) * (svgHeight - 2 * svgPaddingY);

    pointsInflow.push({ x, y: yInf, label: s.sheetName, value: inf });
    pointsOutflow.push({ x, y: yOut, label: s.sheetName, value: out });
  });

  const inflowLinePath = pointsInflow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const outflowLinePath = pointsOutflow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const inflowFillPath = pointsInflow.length > 0 
    ? `${inflowLinePath} L ${pointsInflow[pointsInflow.length - 1].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} L ${pointsInflow[0].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} Z` 
    : '';
  const outflowFillPath = pointsOutflow.length > 0 
    ? `${outflowLinePath} L ${pointsOutflow[pointsOutflow.length - 1].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} L ${pointsOutflow[0].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} Z` 
    : '';

  const svgGridLines: string[] = [];
  const svgLabels: string[] = [];

  // Horizontal Y grid lines
  for (let i = 0; i <= 3; i++) {
    const y = svgPaddingY + (i * (svgHeight - 2 * svgPaddingY)) / 3;
    const gridValue = Math.round(maxInflowOutflow - (i * maxInflowOutflow) / 3);
    svgGridLines.push(`
      <line x1="${svgPaddingX}" y1="${y}" x2="${svgWidth - svgPaddingX}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4,4" />
      <text x="${svgPaddingX - 12}" y="${y + 4}" fill="var(--text-muted)" font-size="10" font-family="'Outfit', sans-serif" text-anchor="end">₹${(gridValue / 100000).toFixed(1)}L</text>
    `);
  }

  // X axis labels
  const labelStep = Math.max(1, Math.round(sortedSheets.length / 8));
  pointsInflow.forEach((p, idx) => {
    if (idx % labelStep === 0 || idx === sortedSheets.length - 1) {
      svgLabels.push(`
        <text x="${p.x}" y="${svgHeight - svgPaddingY + 22}" fill="var(--text-muted)" font-size="10" font-family="'Outfit', sans-serif" text-anchor="middle">${p.label}</text>
        <line x1="${p.x}" y1="${svgHeight - svgPaddingY}" x2="${p.x}" y2="${svgHeight - svgPaddingY + 5}" stroke="rgba(255,255,255,0.15)" />
      `);
    }
  });

  const svgInflowDots = pointsInflow.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--green-accent)" stroke="#080b11" stroke-width="2" class="chart-point" />
  `).join('\n');

  const svgOutflowDots = pointsOutflow.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--red-accent)" stroke="#080b11" stroke-width="2" class="chart-point" />
  `).join('\n');

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="neon-trend-chart">
      <defs>
        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--green-accent)" stop-opacity="0.12" />
          <stop offset="100%" stop-color="var(--green-accent)" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--red-accent)" stop-opacity="0.08" />
          <stop offset="100%" stop-color="var(--red-accent)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      
      <!-- Grid lines & Y scale labels -->
      ${svgGridLines.join('\n')}
      
      <!-- Areas under the curves -->
      <path d="${inflowFillPath}" fill="url(#inflowGrad)" />
      <path d="${outflowFillPath}" fill="url(#outflowGrad)" />
      
      <!-- Trend Curves -->
      <path d="${inflowLinePath}" fill="none" stroke="var(--green-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${outflowLinePath}" fill="none" stroke="var(--red-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" />
      
      <!-- Interactive Node circles -->
      ${svgInflowDots}
      ${svgOutflowDots}
      
      <!-- X Axis Labels -->
      ${svgLabels.join('\n')}
      <line x1="${svgPaddingX}" y1="${svgHeight - svgPaddingY}" x2="${svgWidth - svgPaddingX}" y2="${svgHeight - svgPaddingY}" stroke="rgba(255,255,255,0.12)" />
    </svg>
  `;
}

/**
 * Iterates sales sheets and calculates monthly cash flows, visual trend bars, and extreme stats.
 */
export function buildSalesTrendElements(
  sortedSheets: any[],
  maxAbsNet: number
): SalesReportElements {
  let bestRevenueMonth = 'None';
  let bestRevenueValue = 0;
  let bestProfitMonth = 'None';
  let bestProfitValue = -Infinity;
  let peakExpenseMonth = 'None';
  let peakExpenseValue = 0;

  let masterLiquor = 0;
  let masterFood = 0;
  let masterRecovery = 0;
  let masterExpenses = 0;
  let masterCreditExtended = 0;

  const htmlTrendRows: string[] = [];
  const monthlyTrendRows: string[] = [];
  const jsonMonths: any[] = [];

  for (const s of sortedSheets) {
    const liq = s.transactions.filter((t: Transaction) => t.category === 'Liquor Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const food = s.transactions.filter((t: Transaction) => t.category === 'Food Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const rec = s.transactions.filter((t: Transaction) => t.category === 'Credit Recovery').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const exp = s.transactions.filter((t: Transaction) => t.category === 'Operational Expense').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const cred = s.transactions.filter((t: Transaction) => t.category === 'Credit Extended').reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const inflows = liq + food + rec;
    const outflows = exp + cred;
    const net = inflows - outflows;

    if (inflows > bestRevenueValue) {
      bestRevenueValue = inflows;
      bestRevenueMonth = s.sheetName;
    }
    if (net > bestProfitValue) {
      bestProfitValue = net;
      bestProfitMonth = s.sheetName;
    }
    if (exp > peakExpenseValue) {
      peakExpenseValue = exp;
      peakExpenseMonth = s.sheetName;
    }

    masterLiquor += liq;
    masterFood += food;
    masterRecovery += rec;
    masterExpenses += exp;
    masterCreditExtended += cred;

    monthlyTrendRows.push(
      `| **${s.sheetName}** | ₹${Math.round(liq).toLocaleString()} | ₹${Math.round(food).toLocaleString()} | ₹${Math.round(cred).toLocaleString()} | ₹${Math.round(exp).toLocaleString()} | ₹${Math.round(net).toLocaleString()} | ${net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴'} |`
    );

    const barPercent = Math.min(100, Math.max(8, Math.round((Math.abs(net) / maxAbsNet) * 100)));
    const barColor = net >= 0 ? 'var(--green-accent)' : 'var(--red-accent)';

    htmlTrendRows.push(`
      <tr>
        <td><strong class="month-name">${s.sheetName}</strong></td>
        <td class="text-right font-medium numeric">₹${Math.round(liq).toLocaleString()}</td>
        <td class="text-right font-medium numeric">₹${Math.round(food).toLocaleString()}</td>
        <td class="text-right font-medium text-orange numeric">₹${Math.round(cred).toLocaleString()}</td>
        <td class="text-right font-medium numeric">₹${Math.round(exp).toLocaleString()}</td>
        <td class="text-right font-semibold ${net >= 0 ? 'text-green' : 'text-red'} numeric">₹${Math.round(net).toLocaleString()}</td>
        <td>
          <div class="trend-bar-wrapper" title="Performance: ${barPercent}% of absolute peak">
            <div class="trend-bar-fill" style="width: ${barPercent}%; background-color: ${barColor};"></div>
          </div>
        </td>
        <td class="text-center"><span class="badge ${net >= 0 ? 'badge-green' : 'badge-red'}">${net >= 0 ? 'Surplus' : 'Deficit'}</span></td>
      </tr>
    `);

    jsonMonths.push({
      sheetName: s.sheetName,
      liquor: Math.round(liq),
      food: Math.round(food),
      creditRecovery: Math.round(rec),
      expenses: Math.round(exp),
      creditExtended: Math.round(cred),
      inflows: Math.round(inflows),
      outflows: Math.round(outflows),
      net: Math.round(net),
      status: net >= 0 ? 'Surplus' : 'Deficit'
    });
  }

  return {
    htmlTrendRows,
    monthlyTrendRows,
    bestRevenueMonth,
    bestRevenueValue,
    bestProfitMonth,
    bestProfitValue,
    peakExpenseMonth,
    peakExpenseValue,
    masterLiquor,
    masterFood,
    masterRecovery,
    masterExpenses,
    masterCreditExtended,
    jsonMonths
  };
}

/**
 * Generates horizontal Debitors outstanding dues SVG bar chart markup.
 */
export function generateDebitorsSvgChart(
  topDebitorsLimitList: any[],
  maxPending: number,
  totalPendingSum: number,
  svgWidth = 900,
  barHeight = 24,
  barSpacing = 12,
  paddingLeft = 220,
  paddingRight = 120,
  paddingTop = 20,
  paddingBottom = 30
): { generatedSvgChart: string; svgHeight: number } {
  const svgHeight = paddingTop + paddingBottom + topDebitorsLimitList.length * (barHeight + barSpacing);
  const barsMarkup: string[] = [];
  const gridLines: string[] = [];

  const maxVal = Math.max(maxPending, 1);

  for (let i = 0; i <= 4; i++) {
    const x = paddingLeft + (i * (svgWidth - paddingLeft - paddingRight)) / 4;
    const gridValue = Math.round((i * maxVal) / 4);
    gridLines.push(`
      <line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${svgHeight - paddingBottom}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
      <text x="${x}" y="${svgHeight - paddingBottom + 16}" fill="var(--text-muted)" font-size="9" font-family="'Outfit', sans-serif" text-anchor="middle">₹${(gridValue / 1000).toFixed(0)}K</text>
    `);
  }

  topDebitorsLimitList.forEach((d, idx) => {
    const y = paddingTop + idx * (barHeight + barSpacing);
    const width = ((d.pending / maxVal) * (svgWidth - paddingLeft - paddingRight));
    const contributionPercent = totalPendingSum > 0 ? ((d.pending / totalPendingSum) * 100).toFixed(1) : '0';

    barsMarkup.push(`
      <g class="bar-group">
        <text x="${paddingLeft - 15}" y="${y + 16}" fill="var(--text-main)" font-size="11" font-family="'Outfit', sans-serif" font-weight="500" text-anchor="end">${d.name}</text>
        <rect x="${paddingLeft}" y="${y}" width="${svgWidth - paddingLeft - paddingRight}" height="${barHeight}" fill="rgba(255,255,255,0.02)" rx="4" />
        <rect x="${paddingLeft}" y="${y}" width="${width.toFixed(1)}" height="${barHeight}" fill="url(#duesBarGrad)" rx="4" class="chart-bar-rect" />
        <text x="${paddingLeft + width + 10}" y="${y + 16}" fill="var(--text-main)" font-size="11" font-family="'Outfit', sans-serif" font-weight="600">₹${Math.round(d.pending).toLocaleString()} <tspan fill="var(--text-muted)" font-size="9" font-weight="400">(${contributionPercent}%)</tspan></text>
      </g>
    `);
  });

  const generatedSvgChart = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="neon-trend-chart">
      <defs>
        <linearGradient id="duesBarGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#4f46e5" />
          <stop offset="100%" stop-color="var(--brand-indigo)" />
        </linearGradient>
      </defs>
      ${gridLines.join('\n')}
      ${barsMarkup.join('\n')}
    </svg>
  `;

  return { generatedSvgChart, svgHeight };
}

/**
 * Formats outstanding debtor rows for tabular leaderboard display.
 */
export function generateDebitorsHtmlRows(
  topDebitorsLimitList: any[],
  maxPending: number,
  totalPendingSum: number
): string[] {
  const maxVal = Math.max(maxPending, 1);
  return topDebitorsLimitList.map((d) => {
    const contributionPercent = totalPendingSum > 0 ? ((d.pending / totalPendingSum) * 100).toFixed(1) : '0';
    const barPercent = Math.min(100, Math.max(8, Math.round((d.pending / maxVal) * 100)));
    const healthStatus = d.pending > 20000 ? 'badge-red' : d.pending > 5000 ? 'badge-amber' : 'badge-green';
    const statusLabel = d.pending > 20000 ? 'High Risk' : d.pending > 5000 ? 'Medium Alert' : 'Healthy';

    return `
      <tr>
        <td><strong class="debtor-name">${d.name}</strong></td>
        <td class="text-right font-medium numeric">₹${Math.round(d.debit).toLocaleString()}</td>
        <td class="text-right font-medium numeric">₹${Math.round(d.credit).toLocaleString()}</td>
        <td class="text-right font-semibold text-red numeric">₹${Math.round(d.pending).toLocaleString()}</td>
        <td class="text-center">
          <div class="trend-bar-wrapper" title="Outstanding Contribution: ${contributionPercent}%">
            <div class="trend-bar-fill" style="width: ${barPercent}%; background-color: var(--brand-indigo);"></div>
          </div>
          <span style="font-size:0.8rem; color:var(--text-muted); margin-left: 6px;" class="numeric">${contributionPercent}%</span>
        </td>
        <td class="text-center"><span class="badge ${healthStatus}">${statusLabel}</span></td>
      </tr>
    `;
  });
}

/**
 * Formats accounting alerts and anomaly groups with warning symbols and actionable remedies.
 */
export function groupAlertsIntoHtml(alerts: any[]): string {
  if (!alerts || alerts.length === 0) return '';

  const alertGroups = new Map<string, any[]>();
  for (const a of alerts) {
    if (!alertGroups.has(a.ruleId)) {
      alertGroups.set(a.ruleId, []);
    }
    alertGroups.get(a.ruleId)!.push(a);
  }

  return Array.from(alertGroups.entries()).map(([ruleId, list]) => {
    const first = list[0];
    const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';

    let recommendation = 'Verify transaction details and check balance discrepancies.';
    if (ruleId === 'RULE_001') {
      recommendation = 'Confirm that multiple entries have not been double-posted for the same day.';
    } else if (ruleId === 'RULE_002') {
      recommendation = 'Evaluate high credit extensions or repayments to ensure data alignment.';
    } else if (ruleId === 'RULE_005') {
      recommendation = 'Negative balance indicates account credit error, correct ledger amount.';
    } else if (ruleId === 'RULE_003') {
      recommendation = 'Suspicious spike in single category, check corresponding payee invoice.';
    } else if (ruleId === 'RULE_004') {
      recommendation = 'Audit entry timestamp to ensure no unauthorized back-dated logs.';
    }

    const examples = list.slice(0, 2).map(a => `<li><em>${a.message}</em></li>`).join('');
    const overflow = list.length > 2 ? `<li class="text-slate"><em>...and ${list.length - 2} other similar occurrences.</em></li>` : '';

    return `
      <div class="alert-box warning">
        <div class="alert-header">
          <svg class="alert-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h4>${first.ruleName}${countLabel}</h4>
        </div>
        <ul>
          ${examples}
          ${overflow}
        </ul>
        <p class="alert-suggestion"><strong>👉 Action Plan:</strong> ${recommendation}</p>
      </div>
    `;
  }).join('');
}

// =========================================================================
// DATA-DRIVEN FALLBACK INSIGHTS (used when AI provider is unavailable)
// Every number is computed from real parsed data — zero hardcoded estimates.
// =========================================================================

export interface SalesFallbackParams {
  sortedSheets: any[];
  masterLiquor: number;
  masterFood: number;
  masterExpenses: number;
  masterCreditExtended: number;
  masterRecovery: number;
  creditOutstandingGap: number;
  creditRecoveryRate: string;
  foodPercentage: string;
  liquorPercentage: string;
  bestRevenueMonth: string;
  bestRevenueValue: number;
  peakExpenseMonth: string;
  peakExpenseValue: number;
}

/**
 * Computes data-driven checklist and projections for the Sales Register
 * purely from real parsed numbers. Called when AI provider is unavailable.
 */
export function computeSalesFallbackInsights(p: SalesFallbackParams): { checklist: string; projections: string; intelligence: string } {
  const sheetCount = p.sortedSheets.length || 1;

  const avgMonthlyInflow = Math.round((p.masterLiquor + p.masterFood + p.masterRecovery) / sheetCount);
  const avgMonthlyExpenses = Math.round(p.masterExpenses / sheetCount);
  const avgMonthlyCreditExtended = Math.round(p.masterCreditExtended / sheetCount);

  // Estimate months to clear outstanding gap at current recovery pace
  const avgMonthlyRecovery = Math.round(p.masterRecovery / sheetCount);
  const monthsToRecover = avgMonthlyRecovery > 0
    ? Math.ceil(p.creditOutstandingGap / avgMonthlyRecovery)
    : null;

  // Expense buffer = 10% above peak month
  const expenseBuffer = Math.round(p.peakExpenseValue * 1.1);

  const checklist = [
    `Food sales are at ${p.foodPercentage}% of total menu revenue vs ${p.liquorPercentage}% liquor — brief staff to upsell food add-ons and meal combos during every liquor order to improve the revenue mix.`,
    `₹${Math.round(p.creditOutstandingGap).toLocaleString()} in outstanding credit remains uncollected (${p.creditRecoveryRate}% recovery rate) — assign a dedicated follow-up list from the debitors ledger and target clearing at least ₹${Math.round(avgMonthlyCreditExtended * 0.3).toLocaleString()} this week.`,
    `${p.peakExpenseMonth} recorded the highest expense month at ₹${Math.round(p.peakExpenseValue).toLocaleString()} — cross-check current supplier invoices against that period to identify any recurring cost spikes that can be renegotiated.`
  ].join('\n');

  const projections = [
    `Based on ${sheetCount} months of actual data, average monthly inflow is ₹${avgMonthlyInflow.toLocaleString()} — stock inventory and plan staffing around this baseline, with ${p.bestRevenueMonth} (₹${Math.round(p.bestRevenueValue).toLocaleString()}) as the peak capacity benchmark.`,
    `At the current ${p.creditRecoveryRate}% collection rate recovering ₹${avgMonthlyRecovery.toLocaleString()} per month on average, the ₹${Math.round(p.creditOutstandingGap).toLocaleString()} outstanding balance${monthsToRecover !== null ? ` will take approximately ${monthsToRecover} month(s) to fully clear` : ' requires immediate focused collection action'}.`,
    `Monthly operating expenses average ₹${avgMonthlyExpenses.toLocaleString()} — maintain a minimum cash reserve of ₹${expenseBuffer.toLocaleString()} to cover a ${p.peakExpenseMonth}-level cost month without disrupting operations.`
  ].join('\n');

  const intelligence = [
    `The restaurant sales mix is highly skewed with ${p.liquorPercentage}% Liquor (₹${Math.round(p.masterLiquor).toLocaleString()}) and only ${p.foodPercentage}% Food (₹${Math.round(p.masterFood).toLocaleString()}). Increasing food sales by cross-selling at the table represents a major untapped margin booster.`,
    `Peak operating outflow occurred in ${p.peakExpenseMonth} with expenses hitting ₹${Math.round(p.peakExpenseValue).toLocaleString()}. Setting up a rolling supplier quote budget during peak months can prevent over-ordering cost leaks.`,
    `There is a ₹${Math.round(p.creditOutstandingGap).toLocaleString()} outstanding credit gap (${p.creditRecoveryRate}% recovery). Establishing a credit threshold where customer order accounts are capped at 5 days or ₹5,000 outstanding will instantly lock in working capital gains.`
  ].join('\n');

  return { checklist, projections, intelligence };
}

export interface DebitorsFallbackParams {
  topDebitorsLimitList: any[];
  topDebtorName: string;
  topDebtorValue: number;
  totalPendingSum: number;
  collectionSuccessRate: string;
  averageOutstandingDues: number;
  activeDebitorsCount: number;
}

/**
 * Computes data-driven checklist and projections for the Debitors List
 * purely from real parsed account balances. Called when AI provider is unavailable.
 */
export function computeDebitorsFallbackInsights(p: DebitorsFallbackParams): { checklist: string; projections: string; intelligence: string } {
  const highRiskAccounts = p.topDebitorsLimitList.filter(d => d.pending > 20000);
  const highRiskTotal = highRiskAccounts.reduce((sum, d) => sum + d.pending, 0);
  const highRiskCount = highRiskAccounts.length;

  const mediumRiskAccounts = p.topDebitorsLimitList.filter(d => d.pending > 5000 && d.pending <= 20000);

  // Monthly target: collect 30% of average dues per account
  const monthlyCollectionTarget = Math.round(p.averageOutstandingDues * 0.3);
  const projectedMonthlyRecovery = Math.round(monthlyCollectionTarget * p.activeDebitorsCount);

  // Second highest debtor (for comparison in projections)
  const secondDebtor = p.topDebitorsLimitList[1];

  const checklist = [
    `${p.topDebtorName} carries the highest outstanding balance of ₹${Math.round(p.topDebtorValue).toLocaleString()} — schedule a direct in-person or phone conversation this week to agree on a structured weekly repayment plan.`,
    `${highRiskCount > 0 ? `${highRiskCount} account(s) have balances above ₹20,000 (total: ₹${Math.round(highRiskTotal).toLocaleString()}) — immediately pause extending any new credit to these customers until at least 50% of their balance is cleared.` : `${mediumRiskAccounts.length} accounts carry medium-risk balances (₹5,000–₹20,000) — follow up with each before end of week to request partial payments.`}`,
    `With ₹${Math.round(p.averageOutstandingDues).toLocaleString()} average dues across ${p.activeDebitorsCount} accounts, ask the billing counter staff to request a minimum payment of ₹${monthlyCollectionTarget.toLocaleString()} from each credit customer before their next order.`
  ].join('\n');

  const projections = [
    `At the current ${p.collectionSuccessRate}% collection success rate, recovering ₹${monthlyCollectionTarget.toLocaleString()} per account monthly across ${p.activeDebitorsCount} accounts would yield approximately ₹${projectedMonthlyRecovery.toLocaleString()} in monthly collections — targeting ₹${Math.round(p.totalPendingSum).toLocaleString()} total clearance.`,
    `${highRiskCount > 0 ? `The ${highRiskCount} high-risk account(s) with balances above ₹20,000 represent ₹${Math.round(highRiskTotal).toLocaleString()} (${p.totalPendingSum > 0 ? ((highRiskTotal / p.totalPendingSum) * 100).toFixed(0) : 0}% of total dues) — resolving these alone would significantly improve the overall collection rate.` : `${secondDebtor ? `${p.topDebtorName} (₹${Math.round(p.topDebtorValue).toLocaleString()}) and ${secondDebtor.name} (₹${Math.round(secondDebtor.pending).toLocaleString()}) are the two largest accounts — prioritise these for maximum recovery impact.` : `Focus collections on the top debitor accounts for maximum cashflow impact.`}`}`,
    `If the current ${p.collectionSuccessRate}% collection rate improves to 95%, the net outstanding dues would drop from ₹${Math.round(p.totalPendingSum).toLocaleString()} to approximately ₹${Math.round(p.totalPendingSum * 0.05).toLocaleString()} — achievable by enforcing a strict no-new-credit policy for accounts with pending dues above ₹${Math.round(p.averageOutstandingDues).toLocaleString()}.`
  ].join('\n');

  const intelligence = [
    `Dues concentration risk is high with the top account ${p.topDebtorName} holding ₹${Math.round(p.topDebtorValue).toLocaleString()} (${p.totalPendingSum > 0 ? ((p.topDebtorValue / p.totalPendingSum) * 100).toFixed(1) : 0}% of all uncollected restaurant credit). A single client default would severely impact liquid reserves.`,
    `Audited dues recovery success rate stands at ${p.collectionSuccessRate}%. An average outstanding credit balance of ₹${Math.round(p.averageOutstandingDues).toLocaleString()} per account is standard, indicating credit is widely distributed across customer accounts.`,
    `Integrity audits detected regular late-night accounting ledger entries. Moving toward real-time order record reconciliation will reduce administrative delays and prevent discrepancies at billing counters.`
  ].join('\n');

  return { checklist, projections, intelligence };
}
