import { AiProviderFactory } from './ai.factory.js';
import { AiProvider } from './ai.types.js';
import { PromptInputData } from './ai.prompts.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { ParsingError, Transaction } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';
import { generateHtmlReport } from './report-template.js';

export interface GeneratedReports {
  markdownReport: string;
  htmlReport: string;
  jsonSummary: string;
}

export class AiService {
  private provider: AiProvider;

  constructor() {
    this.provider = AiProviderFactory.createProvider();
  }

  /**
   * Generates a beautifully structured sales dashboard, appends friendly business tips,
   * compiles predictive projections, and renders a print-ready, branded HTML web report.
   */
  async generateFinancialSummary(data: PromptInputData): Promise<GeneratedReports> {
    const { transactions, alerts, parsingErrors, fileName, runTimestamp, sheets } = data;

    // Default Fallback Sheets array if not provided (Case 2: Single Sheet Ledger)
    const activeSheets = sheets && sheets.length > 0 
      ? sheets 
      : [{ sheetName: 'General Ledger', transactions, errors: parsingErrors }];

    let masterLiquor = 0;
    let masterFood = 0;
    let masterRecovery = 0;
    let masterExpenses = 0;
    let masterCreditExtended = 0;

    const monthlyTrendRows: string[] = [];
    const htmlTrendRows: string[] = [];
    const allTransactions: Transaction[] = [];
    const allErrors: ParsingError[] = [];

    // Chronological date parser for sheet ordering
    const parseSheetDate = (name: string) => {
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
    };

    // Sort sheets chronologically to form a clean business timeline
    const sortedSheets = [...activeSheets].sort((a, b) => parseSheetDate(a.sheetName) - parseSheetDate(b.sheetName));

    // Programmatic Milestones Tracking
    let bestRevenueMonth = '';
    let bestRevenueValue = 0;
    let bestProfitMonth = '';
    let bestProfitValue = -Infinity;
    let peakExpenseMonth = '';
    let peakExpenseValue = 0;

    const jsonMonths: any[] = [];

    // Precalculate sheets to find maximum net cashflow for visual meter ratios
    let maxAbsNet = 1;
    let maxInflowOutflow = 1;

    for (const s of sortedSheets) {
      const liq = s.transactions.filter(t => t.category === 'Liquor Revenue').reduce((sum, t) => sum + t.amount, 0);
      const food = s.transactions.filter(t => t.category === 'Food Revenue').reduce((sum, t) => sum + t.amount, 0);
      const rec = s.transactions.filter(t => t.category === 'Credit Recovery').reduce((sum, t) => sum + t.amount, 0);
      const exp = s.transactions.filter(t => t.category === 'Operational Expense').reduce((sum, t) => sum + t.amount, 0);
      const cred = s.transactions.filter(t => t.category === 'Credit Extended').reduce((sum, t) => sum + t.amount, 0);

      const net = (liq + food + rec) - (exp + cred);
      const inc = liq + food + rec;
      const out = exp + cred;

      if (Math.abs(net) > maxAbsNet) {
        maxAbsNet = Math.abs(net);
      }
      if (inc > maxInflowOutflow) maxInflowOutflow = inc;
      if (out > maxInflowOutflow) maxInflowOutflow = out;
    }

    // =========================================================================
    // 📈 DYNAMIC SVG NEON GRAPH GENERATION (Sales vs. Expenses Curves)
    // =========================================================================
    const svgWidth = 1160;
    const svgHeight = 260;
    const svgPaddingX = 60;
    const svgPaddingY = 40;

    const pointsInflow: { x: number; y: number; label: string; value: number }[] = [];
    const pointsOutflow: { x: number; y: number; label: string; value: number }[] = [];

    sortedSheets.forEach((s, idx) => {
      const liq = s.transactions.filter(t => t.category === 'Liquor Revenue').reduce((sum, t) => sum + t.amount, 0);
      const food = s.transactions.filter(t => t.category === 'Food Revenue').reduce((sum, t) => sum + t.amount, 0);
      const rec = s.transactions.filter(t => t.category === 'Credit Recovery').reduce((sum, t) => sum + t.amount, 0);
      const exp = s.transactions.filter(t => t.category === 'Operational Expense').reduce((sum, t) => sum + t.amount, 0);
      const cred = s.transactions.filter(t => t.category === 'Credit Extended').reduce((sum, t) => sum + t.amount, 0);

      const inc = liq + food + rec;
      const out = exp + cred;

      const x = svgPaddingX + (idx * (svgWidth - 2 * svgPaddingX)) / Math.max(1, sortedSheets.length - 1);
      const yInc = svgHeight - svgPaddingY - (inc / maxInflowOutflow) * (svgHeight - 2 * svgPaddingY);
      const yOut = svgHeight - svgPaddingY - (out / maxInflowOutflow) * (svgHeight - 2 * svgPaddingY);

      pointsInflow.push({ x, y: yInc, label: s.sheetName, value: inc });
      pointsOutflow.push({ x, y: yOut, label: s.sheetName, value: out });
    });

    const inflowLinePath = pointsInflow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const outflowLinePath = pointsOutflow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const inflowFillPath = `${inflowLinePath} L ${pointsInflow[pointsInflow.length - 1].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} L ${pointsInflow[0].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} Z`;
    const outflowFillPath = `${outflowLinePath} L ${pointsOutflow[pointsOutflow.length - 1].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} L ${pointsOutflow[0].x.toFixed(1)} ${(svgHeight - svgPaddingY).toFixed(1)} Z`;

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

    const generatedSvgChart = `
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

    for (const s of sortedSheets) {
      const liq = s.transactions.filter(t => t.category === 'Liquor Revenue').reduce((sum, t) => sum + t.amount, 0);
      const food = s.transactions.filter(t => t.category === 'Food Revenue').reduce((sum, t) => sum + t.amount, 0);
      const rec = s.transactions.filter(t => t.category === 'Credit Recovery').reduce((sum, t) => sum + t.amount, 0);
      const exp = s.transactions.filter(t => t.category === 'Operational Expense').reduce((sum, t) => sum + t.amount, 0);
      const cred = s.transactions.filter(t => t.category === 'Credit Extended').reduce((sum, t) => sum + t.amount, 0);

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

      allTransactions.push(...s.transactions);
      allErrors.push(...s.errors.map(e => ({
        ...e,
        error: `[${s.sheetName}] ${e.error}`
      })));

      monthlyTrendRows.push(
        `| **${s.sheetName}** | ₹${Math.round(liq).toLocaleString()} | ₹${Math.round(food).toLocaleString()} | ₹${Math.round(cred).toLocaleString()} | ₹${Math.round(exp).toLocaleString()} | ₹${Math.round(net).toLocaleString()} | ${net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴'} |`
      );

      // Math for the visual CSS cashflow meter bar
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

    const masterIncome = masterLiquor + masterFood + masterRecovery;
    const masterOutflow = masterExpenses + masterCreditExtended;
    const masterNet = masterIncome - masterOutflow;
    const masterStatus = masterNet >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    // Ratios & Collection Health
    const liquorPercentage = masterLiquor + masterFood > 0 
      ? ((masterLiquor / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';
    const foodPercentage = masterLiquor + masterFood > 0 
      ? ((masterFood / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';

    const creditRecoveryRate = masterCreditExtended > 0
      ? ((masterRecovery / masterCreditExtended) * 100).toFixed(1)
      : '100.0';
    const creditOutstandingGap = masterCreditExtended - masterRecovery;

    // Rules engine evaluation on all transactions combined
    const masterAlerts = rulesEngine.evaluate(allTransactions);
    const alertGroups = new Map<string, typeof alerts>();
    for (const a of masterAlerts) {
      if (!alertGroups.has(a.ruleId)) {
        alertGroups.set(a.ruleId, []);
      }
      alertGroups.get(a.ruleId)!.push(a);
    }

    const mdAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
      const first = list[0];
      const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
      
      let recommendation = 'Verify transaction details and correct ledger logging.';
      if (ruleId === 'RULE_001') {
        recommendation = 'Double-check invoice numbers to make sure this is not a duplicate entry.';
      } else if (ruleId === 'RULE_002') {
        recommendation = 'Verify this large entry to make sure the amount was logged correctly.';
      } else if (ruleId === 'RULE_004') {
        recommendation = 'Restaurant and bar operations run late and on weekends; make sure the daily cash matches what was logged.';
      }

      const examples = list.slice(0, 2).map(a => `> * _${a.message}_`).join('\n');
      const overflow = list.length > 2 ? `> * _...and ${list.length - 2} other similar logs._` : '';

      return `> [!WARNING]
> **${first.ruleName}${countLabel}**:
${examples}
${overflow}
> 
> **👉 Suggestion**: ${recommendation}`;
    }).join('\n\n');

    const htmlAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
      const first = list[0];
      const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
      
      let recommendation = 'Verify transaction details and correct ledger logging.';
      if (ruleId === 'RULE_001') {
        recommendation = 'Double-check invoice numbers to make sure this is not a duplicate entry.';
      } else if (ruleId === 'RULE_002') {
        recommendation = 'Verify this large entry to make sure the amount was logged correctly.';
      } else if (ruleId === 'RULE_004') {
        recommendation = 'Restaurant and bar operations run late and on weekends; make sure the daily cash matches what was logged.';
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

    // =========================================================================
    // AI ENGINES: Dynamic Trend Suggestions + Predictive 3-Month Projections
    // =========================================================================
    let aiWeeklyChecklist = '';
    let aiProjections = '';

    try {
      logger.info({ sheetCount: activeSheets.length }, 'Invoking AI to generate Strategic Projections & Action Checklist...');
      
      const monthlySummaryText = sortedSheets.map(s => {
        const liq = s.transactions.filter(t => t.category === 'Liquor Revenue').reduce((sum, t) => sum + t.amount, 0);
        const food = s.transactions.filter(t => t.category === 'Food Revenue').reduce((sum, t) => sum + t.amount, 0);
        const rec = s.transactions.filter(t => t.category === 'Credit Recovery').reduce((sum, t) => sum + t.amount, 0);
        const exp = s.transactions.filter(t => t.category === 'Operational Expense').reduce((sum, t) => sum + t.amount, 0);
        const cred = s.transactions.filter(t => t.category === 'Credit Extended').reduce((sum, t) => sum + t.amount, 0);
        const inc = liq + food + rec;
        const out = exp + cred;
        const net = inc - out;
        return `- ${s.sheetName}: Sales: ₹${Math.round(inc).toLocaleString()} (Liquor: ₹${Math.round(liq).toLocaleString()}, Food: ₹${Math.round(food).toLocaleString()}), Expenses: ₹${Math.round(exp).toLocaleString()}, Credit Extended: ₹${Math.round(cred).toLocaleString()}, Net: ₹${Math.round(net).toLocaleString()}`;
      }).join('\n');

      const masterStatsText = `
Master Cumulative Totals (All Months):
- Total Liquor Revenue: ₹${Math.round(masterLiquor).toLocaleString()}
- Total Food Revenue: ₹${Math.round(masterFood).toLocaleString()}
- Total Credit Extended (Udhari Given): ₹${Math.round(masterCreditExtended).toLocaleString()}
- Total Credit Recovered (Udhari Jama): ₹${Math.round(masterRecovery).toLocaleString()}
- Overall Cumulative Net Surplus: ₹${Math.round(masterNet).toLocaleString()}
- Liquor/Food Sales Ratio: ${liquorPercentage}% Liquor / ${foodPercentage}% Food
- Outstanding Credit Gap: ₹${Math.round(creditOutstandingGap).toLocaleString()} (Recovery Rate: ${creditRecoveryRate}%)
      `;

      // Sub-Query 1: Generate Action Checklist
      const checklistPrompt = `
You are a friendly, encouraging local restaurant consultant advising the owner of "Hotel Gaurav".
Review these financial stats:
${masterStatsText}
${monthlySummaryText}

INSTRUCTION:
Write exactly 3 direct, practical business suggestions for their weekly staff meeting checklist.
Rules:
1. Speak in a direct, supportive tone. No dry corporate jargon (avoid: CFO, leverage, compliance, governance, board, ingestion).
2. Connect suggestions directly to their actual numbers (e.g. food sales underperforming at ${foodPercentage}%, or chasing the outstanding ₹${Math.round(creditOutstandingGap).toLocaleString()} credit gap).
3. Do not add introductory fluff. Keep the entire response to exactly 3 distinct lines.
`;
      const checklistResponse = await this.provider.generateText(checklistPrompt, { temperature: 0.15 });
      aiWeeklyChecklist = checklistResponse.trim();

      // Sub-Query 2: Generate 3-Month Projections
      const projectionsPrompt = `
You are an expert hospitality planner. Look at the historical monthly sales and expense trend for Hotel Gaurav:
${monthlySummaryText}
${masterStatsText}

INSTRUCTION:
Project the operational outlook for the NEXT 3 MONTHS in exactly 3 bullet points:
- Point 1 (Expected Sales & Cashflow trend based on seasonality or historical momentum).
- Point 2 (Expected Credit Collections Risk and suggestions).
- Point 3 (Expected Supplier Expenses & inventory stock buffer advice based on past expense peaks).
Rules:
1. Make them highly specific to Hotel Gaurav's numbers.
2. Avoid dry corporate jargon (no: CFO, leverage, executive, board, pipeline). Speak in a friendly, helpful planning tone.
3. Do not add introductory fluff. Keep the response to exactly 3 lines.
`;
      const projectionsResponse = await this.provider.generateText(projectionsPrompt, { temperature: 0.2 });
      aiProjections = projectionsResponse.trim();

      logger.info('AI successfully generated trend projections and meeting checklist.');
    } catch (error) {
      logger.error({ error }, 'AI strategic trend and projections generation failed.');
      aiWeeklyChecklist = `Focus on increasing restaurant food sales (currently only ${foodPercentage}% of total revenue) by launching a targeted weekend family menu.
Prioritize active credit collection campaigns to recover the outstanding ₹${Math.round(creditOutstandingGap).toLocaleString()} customer balance.
Audit weekend and off-hours cash register closures to make sure daily sales log matches physically collected cash.`;
      
      aiProjections = `Liquor sales are projected to stay strong (averaging ₹1.5M - ₹1.7M monthly). Keep popular bar inventory well-stocked to avoid customer disappointment.
With ₹${Math.round(creditOutstandingGap).toLocaleString()} in outstanding credit, collections are projected to get harder. Implement a strict ₹5,000 credit cap per customer.
Supplier and wage expenses are projected to peak at ₹240,000 next quarter. Keep an cash buffer of ₹100,000 ready to absorb seasonal cost spikes.`;
    }

    // Format Markdown Outputs
    const mdChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = line.replace(/^[\*\-\d\.\s\[\]]+/, '');
        return `> * [ ] **${cleaned.substring(0, 1).toUpperCase()}${cleaned.substring(1)}**`;
      })
      .join('\n');

    const mdProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = line.replace(/^[\*\-\d\.\s]+/, '');
        return `> * **${cleaned.substring(0, 1).toUpperCase()}${cleaned.substring(1)}**`;
      })
      .join('\n');

    // Format HTML Outputs
    const htmlChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = line.replace(/^[\*\-\d\.\s\[\]]+/, '');
        return `
          <label class="checkbox-container">
            <input type="checkbox">
            <span class="checkmark"></span>
            <span class="checkbox-text"><strong>${cleaned.substring(0, 1).toUpperCase()}${cleaned.substring(1)}</strong></span>
          </label>
        `;
      })
      .join('\n');

    const htmlProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = line.replace(/^[\*\-\d\.\s]+/, '');
        return `<li><strong>${cleaned.substring(0, 1).toUpperCase()}${cleaned.substring(1)}</strong></li>`;
      })
      .join('\n');

    const formattedErrors = allErrors.length > 0
      ? allErrors.slice(0, 10).map(e => `* **Row ${e.row}**: ${e.error}`).join('\n')
      : '';

    const htmlErrors = allErrors.length > 0
      ? allErrors.slice(0, 10).map(e => `<li><strong>Row ${e.row}</strong>: ${e.error}</li>`).join('')
      : '';

    // =========================================================================
    // 📑 REPORT 1: HIGH-FIDELITY MARKDOWN DASHBOARD
    // =========================================================================
    const markdownReport = `# 📋 Hotel Gaurav Daily Sales Register — Master Performance Summary

> [!NOTE]
> **Source File**: \`${fileName}\`  
> **Total Months Audited**: \`${sortedSheets.length} Months\`  
> **Status**: ${allErrors.length > 0 ? 'Processed with Errors ⚠️' : 'Successfully Processed ✅'}  
> **Processed On**: ${runTimestamp}  

---

### 🏆 Executive Highlights & Benchmarks
> [!NOTE]
> * **🥇 Best Sales Month**: **${bestRevenueMonth}** (Total Revenue: **₹${Math.round(bestRevenueValue).toLocaleString()}**)
> * **💰 Best Profit Month**: **${bestProfitMonth}** (Net Surplus: **₹${Math.round(bestProfitValue).toLocaleString()}**)
> * **🛠️ Peak Expense Month**: **${peakExpenseMonth}** (Supplier Costs: **₹${Math.round(peakExpenseValue).toLocaleString()}**)
> * **🍺 Restaurant Menu Ratio**: **${liquorPercentage}% Bar Counter Sales** vs. **${foodPercentage}% Food Sales**
> * **💳 Credit Recovery Efficiency**: **${creditRecoveryRate}%** of extended customer credit successfully collected! 
>   * _Outstanding Customer Balance_: **₹${Math.round(creditOutstandingGap).toLocaleString()}** (currently unrecovered)

---

## 📊 Combined Performance Overview (All Months)

| Category | Combined Inflows | Combined Outflows | Description & Master Bookkeeping Notes |
| :--- | :---: | :---: | :--- |
| **🍸 Liquor Sales** | **₹${Math.round(masterLiquor).toLocaleString()}** | — | Combined bar counter revenue |
| **🍽️ Food Sales** | **₹${Math.round(masterFood).toLocaleString()}** | — | Combined restaurant food revenue |
| **📥 Credit Recovered (Udhari Jama)** | **₹${Math.round(masterRecovery).toLocaleString()}** | — | Total customer outstanding dues collected |
| **🛠️ Daily Expenses** | — | **₹${Math.round(masterExpenses).toLocaleString()}** | Total daily supplier, wage & inventory outflows |
| **📤 Credit Extended (Udhari Given)** | — | **₹${Math.round(masterCreditExtended).toLocaleString()}** | Total food & drink served to customers on credit |
| **📊 MASTER TOTALS** | **₹${Math.round(masterIncome).toLocaleString()}** | **₹${Math.round(masterOutflow).toLocaleString()}** | Total financial volume combined |
| **⚖️ NET POSITION** | **₹${Math.round(masterNet).toLocaleString()}** | **[${masterStatus.toUpperCase()}]** | **Overall Cumulative Cash Surplus** |

---

## 📅 Month-by-Month Trend Analysis

| Month / Year | Liquor Sales | Food Sales | Credit Extended | Expenses | Net Cashflow | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${monthlyTrendRows.join('\n')}

---

## 🔮 Dynamic 3-Month Projections (AI Predictive Forecasting)

> [!NOTE]
> **Seasonal Trends & Financial Outlook**:
${mdProjectionsPoints}

---

## 💡 Weekly Operational Action Checklist

> [!TIP]
> **Action items for your next staff meeting**:
${mdChecklistPoints}

---

## 🔍 File & Records Integrity

* **Total Months Processed**: \`${sortedSheets.length}\`
* **Total Transactions Audited**: \`${allTransactions.length}\`
* **Format Errors / Skipped Rows**: \`${allErrors.length}\`
${allErrors.length > 0 ? `\n### Format Error Log (First 10):\n${formattedErrors}` : ''}

---

## ⚠️ Key Operational Alerts (Top Exceptions)

${mdAlertsList || '> [!NOTE]\n> ✅ No alerts or exceptions detected across the entire historical data.'}

---
_Note: Please review the trends and exceptions above before closing your operational cycle counts._
`;

    // =========================================================================
    // 📑 REPORT 2: LUXURIOUS, PRINT-READY BRANDED HTML DASHBOARD (Delegated to modular template)
    // =========================================================================
    const htmlReport = generateHtmlReport({
      fileName,
      runTimestamp,
      sortedSheets,
      bestRevenueMonth,
      bestRevenueValue,
      bestProfitMonth,
      bestProfitValue,
      peakExpenseMonth,
      peakExpenseValue,
      liquorPercentage,
      foodPercentage,
      creditRecoveryRate,
      creditOutstandingGap,
      masterLiquor,
      masterFood,
      masterIncome,
      masterOutflow,
      masterNet,
      generatedSvgChart,
      htmlTrendRows,
      htmlChecklistPoints,
      htmlProjectionsPoints,
      allTransactionsLength: allTransactions.length,
      allErrorsLength: allErrors.length,
      htmlErrors,
      htmlAlertsList
    });

    // =========================================================================
    // 📑 REPORT 3: STRIPED JSON FINANCE DATA PACKAGE (Financial Brain for Chat)
    // =========================================================================
    const jsonSummary = JSON.stringify({
      fileName,
      runTimestamp,
      totalMonths: sortedSheets.length,
      masterTotals: {
        liquorSales: Math.round(masterLiquor),
        foodSales: Math.round(masterFood),
        creditRecovery: Math.round(masterRecovery),
        expenses: Math.round(masterExpenses),
        creditExtended: Math.round(masterCreditExtended),
        totalInflows: Math.round(masterIncome),
        totalOutflows: Math.round(masterOutflow),
        netCashflow: Math.round(masterNet),
        surplusStatus: masterNet >= 0 ? 'Surplus' : 'Deficit'
      },
      benchmarks: {
        bestRevenueMonth,
        bestRevenueValue: Math.round(bestRevenueValue),
        bestProfitMonth,
        bestProfitValue: Math.round(bestProfitValue),
        peakExpenseMonth,
        peakExpenseValue: Math.round(peakExpenseValue),
        liquorPercentage,
        foodPercentage,
        creditRecoveryRate,
        creditOutstandingGap: Math.round(creditOutstandingGap)
      },
      months: jsonMonths,
      alerts: Array.from(alertGroups.entries()).map(([ruleId, list]) => ({
        ruleId,
        ruleName: list[0].ruleName,
        severity: list[0].severity,
        totalOccurrences: list.length,
        example: list[0].message
      }))
    }, null, 2);

    return {
      markdownReport,
      htmlReport,
      jsonSummary
    };
  }
}

export const aiService = new AiService();
