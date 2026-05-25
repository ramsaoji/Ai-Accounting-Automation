import { AiProviderFactory } from './ai.factory.js';
import { AiProvider } from './ai.types.js';
import { PromptInputData } from './ai.prompts.js';
import { ParsingError, Transaction } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';
import { generateHtmlReport } from './report-template.js';
import { generateDebitorsHtmlReport } from './debitors-template.js';
import {
  generateSalesSvgChart,
  buildSalesTrendElements,
  generateDebitorsSvgChart,
  generateDebitorsHtmlRows,
  groupAlertsIntoHtml,
  computeSalesFallbackInsights,
  computeDebitorsFallbackInsights
} from './report-helper.js';

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

    // =========================================================================
    // BRANCH A: Specialized Udhari & Debitors Register Orchestrator
    // =========================================================================
    if (data.isDebitorsList && data.debitors) {
      logger.info({ fileName }, 'Generating specialized report for Debitors List');

      const debitors = data.debitors;
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

      // AI calls for weekly checklist & 3-month outlook specific to debitors
      let aiWeeklyChecklist = '';
      let aiProjections = '';
      let aiGenerated = false;

      const masterStatsText = `
Master Debitor Accounts Cumulative Totals:
- Total Outstanding Accounts: ${activeDebitorsCount} customers on books
- Total Credit Extended (Udhari Extended): ₹${Math.round(totalDebitSum).toLocaleString()}
- Total Credit Recovered (Recovery Collected): ₹${Math.round(totalCreditSum).toLocaleString()}
- Net Outstanding Balance Dues: ₹${Math.round(totalPendingSum).toLocaleString()} (Collections Recovery Success Rate: ${collectionSuccessRate}%)
- Average Outstanding Dues: ₹${Math.round(averageOutstandingDues).toLocaleString()} per customer
- Top Outstanding Account: ${topDebtorName} (₹${Math.round(topDebtorValue).toLocaleString()} pending dues)
      `;

      const debtorsSummaryText = topDebitorsLimitList.map((d, i) => {
        return `${i + 1}. ${d.name}: Total Dues: ₹${Math.round(d.pending).toLocaleString()} (Extended: ₹${Math.round(d.debit).toLocaleString()}, Paid: ₹${Math.round(d.credit).toLocaleString()})`;
      }).join('\n');

      try {
        const checklistPrompt = `
You are a friendly, encouraging local restaurant consultant advising the owner of "Hotel Gaurav" on how to recover uncollected customer tab balances (Udhari).
Review these outstanding credit collections stats:
${masterStatsText}
Top Debitor Accounts detailed breakdown:
${debtorsSummaryText}

INSTRUCTION:
Write exactly 3 direct, practical business suggestions for their weekly staff meeting checklist to collect money back from these specific customers.
Rules:
1. Speak in a direct, supportive tone. No dry corporate jargon (avoid: CFO, compliance, governance, board).
2. Connect suggestions directly to their actual debtors and numbers (e.g. referencing ${topDebtorName}'s ₹${Math.round(topDebtorValue).toLocaleString()} balance).
3. Do not add introductory fluff. Keep the response to exactly 3 distinct lines.
`;
        const checklistResponse = await this.provider.generateText(checklistPrompt, { temperature: 0.15 });
        aiWeeklyChecklist = checklistResponse.trim();

        const projectionsPrompt = `
You are an expert credit collections risk planner. Look at the outstanding customer debtor balances for Hotel Gaurav:
${masterStatsText}
Top Debitors Ledger detail list:
${debtorsSummaryText}

INSTRUCTION:
Project the collections and recovery outlook for the NEXT 3 MONTHS in exactly 3 bullet points:
- Point 1 (Expected recovery momentum of outstanding dues and payment patterns).
- Point 2 (Specific accounts collection risk analysis referencing top debtors by name).
- Point 3 (Credit caps or policy changes to put in place to prevent outstanding balances from scaling further).
Rules:
1. Make them highly specific to Hotel Gaurav's actual debtor numbers.
2. Avoid dry corporate jargon (no: compliance framework, leverage, executive, board). Speak in a friendly, helpful consulting tone.
3. Do not add introductory fluff. Keep the response to exactly 3 lines.
`;
        const projectionsResponse = await this.provider.generateText(projectionsPrompt, { temperature: 0.2 });
        aiProjections = projectionsResponse.trim();
        aiGenerated = true;

      } catch (error) {
        logger.error({ error }, 'AI debtor collection suggestions generation failed. Using data-driven fallback.');
        const fallback = computeDebitorsFallbackInsights({
          topDebitorsLimitList,
          topDebtorName,
          topDebtorValue,
          totalPendingSum,
          collectionSuccessRate,
          averageOutstandingDues,
          activeDebitorsCount
        });
        aiWeeklyChecklist = fallback.checklist;
        aiProjections = fallback.projections;
      }

      // Delegate all visual rendering calculations to our report-helper library
      const { generatedSvgChart } = generateDebitorsSvgChart(topDebitorsLimitList, maxPending, totalPendingSum);
      const htmlDebitorRows = generateDebitorsHtmlRows(topDebitorsLimitList, maxPending, totalPendingSum);

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

      const htmlAlertsList = groupAlertsIntoHtml(alerts);
      const htmlErrors = parsingErrors.slice(0, 10).map(e => `<li><strong>Row ${e.row}</strong>: ${e.error}</li>`).join('');

      const htmlReport = generateDebitorsHtmlReport({
        fileName,
        runTimestamp,
        totalDebitorsCount: activeDebitorsCount,
        totalTransactionsCount: transactions.length,
        totalDebitSum,
        totalCreditSum,
        totalPendingSum,
        collectionSuccessRate,
        averageOutstandingDues,
        topDebtorName,
        topDebtorValue,
        debitorsLimit,
        sortedDebitorsList: topDebitorsLimitList,
        generatedSvgChart,
        htmlDebitorRows,
        htmlChecklistPoints,
        htmlProjectionsPoints,
        htmlErrors,
        allErrorsLength: parsingErrors.length,
        htmlAlertsList,
        aiGenerated
      });

      // Format Markdown checklist and projections
      const mdChecklistPoints = aiWeeklyChecklist
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * [ ] **${line.replace(/^[\*\-\d\.\s\[\]]+/, '')}**`)
        .join('\n');

      const mdProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * **${line.replace(/^[\*\-\d\.\s]+/, '')}**`)
        .join('\n');

      // Group alerts map for markdown warning block
      const alertGroups = new Map<string, typeof alerts>();
      for (const a of alerts) {
        if (!alertGroups.has(a.ruleId)) alertGroups.set(a.ruleId, []);
        alertGroups.get(a.ruleId)!.push(a);
      }
      const mdAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
        const first = list[0];
        const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
        const examples = list.slice(0, 2).map(a => `... ${a.message}`).join('\n');
        return `> [!WARNING]\n> **${first.ruleName}${countLabel}**:\n${examples}`;
      }).join('\n\n');

      const mdDebitorRowsList = topDebitorsLimitList.map((d, i) => {
        const pct = totalPendingSum > 0 ? ((d.pending / totalPendingSum) * 100).toFixed(0) : '0';
        return `| **#${i + 1}** | **${d.name}** | ₹${Math.round(d.debit).toLocaleString()} | ₹${Math.round(d.credit).toLocaleString()} | ₹${Math.round(d.pending).toLocaleString()} | ${pct}% |`;
      }).join('\n');

      const markdownReport = `# 📋 Hotel Gaurav Udhari & Debitors Register — Master Audit Summary

> [!NOTE]
> **Source File**: \`${fileName}\`  
> **Total Outstanding Accounts**: \`${activeDebitorsCount} Customers\`  
> **Status**: ${parsingErrors.length > 0 ? 'Processed with Ingestion Warnings ⚠️' : 'Successfully Parsed & Synced ✅'}  

---

### 💳 Core Udhari & Debitors Aggregates
* **Total Credit Invoiced (Extended):** ₹${Math.round(totalDebitSum).toLocaleString()}
* **Total Repayments Collected (Recovered):** ₹${Math.round(totalCreditSum).toLocaleString()}
* **Net Outstanding Customer Balance (Current Gap):** **₹${Math.round(totalPendingSum).toLocaleString()}**
* **Collections Recovery Success Rate:** \`${collectionSuccessRate}%\`
* **Average Outstanding Balance Dues:** ₹${Math.round(averageOutstandingDues).toLocaleString()} per account
* **Top Customer Dues Account:** **${topDebtorName}** (₹${Math.round(topDebtorValue).toLocaleString()} pending)

---

### 🏆 Top Outstanding Dues Leaderboard (Top ${debitorsLimit})
| Rank | Customer Debitor | Total Debit (Purchased) | Total Credit (Repayed) | Outstanding Pending | Pending Contribution % |
| :--- | :--- | :--- | :--- | :--- | :--- |
${mdDebitorRowsList}

---

### ⚡ Collections & Accounts Recovery Projections
${mdProjectionsPoints || '> * No projections generated.'}

---

### 📋 Staff Meeting Weekly Recovery Checklist
${mdChecklistPoints || '> * No checklist items generated.'}

---

### 🚨 Ingestion Exceptions & Warnings
${mdAlertsList || '> * All balances and daily registers are cleanly matching with zero alerts!'}
`;

      const jsonSummary = JSON.stringify({
        fileName,
        timestamp: runTimestamp,
        isDebitorsList: true,
        aggregates: {
          totalDebitSum: Math.round(totalDebitSum),
          totalCreditSum: Math.round(totalCreditSum),
          totalPendingSum: Math.round(totalPendingSum),
          collectionSuccessRate,
          averageOutstandingDues: Math.round(averageOutstandingDues),
          activeDebitorsCount,
          topDebtorName,
          topDebtorValue: Math.round(topDebtorValue),
        },
        topDebitors: topDebitorsLimitList.map(d => ({
          name: d.name,
          debit: Math.round(d.debit),
          credit: Math.round(d.credit),
          pending: Math.round(d.pending),
        })),
        alerts: alerts.map(a => ({
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity,
          message: a.message,
        })),
        errors: parsingErrors,
      }, null, 2);

      return { markdownReport, htmlReport, jsonSummary };
    }

    // =========================================================================
    // BRANCH B: Combined Multi-month Daily Sales Register Orchestrator
    // =========================================================================
    const activeSheets = sheets && sheets.length > 0 
      ? sheets 
      : [{ sheetName: 'General Ledger', transactions, errors: parsingErrors }];

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

    // Call report helper functions to generate SVG visual lines and tabular cashflows
    const generatedSvgChart = generateSalesSvgChart(sortedSheets, maxInflowOutflow);
    const trendElements = buildSalesTrendElements(sortedSheets, maxAbsNet);

    const {
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
    } = trendElements;

    const masterIncome = masterLiquor + masterFood + masterRecovery;
    const masterOutflow = masterExpenses + masterCreditExtended;
    const masterNet = masterIncome - masterOutflow;
    const masterStatus = masterNet >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    const liquorPercentage = masterLiquor + masterFood > 0 
      ? ((masterLiquor / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';
    const foodPercentage = masterLiquor + masterFood > 0 
      ? ((masterFood / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';

    const creditOutstandingGap = masterCreditExtended - masterRecovery;
    const creditRecoveryRate = masterCreditExtended > 0
      ? ((masterRecovery / masterCreditExtended) * 100).toFixed(1)
      : '100.0';

    const allTransactions: Transaction[] = [];
    const allErrors: ParsingError[] = [];
    for (const s of sortedSheets) {
      allTransactions.push(...s.transactions);
      allErrors.push(...s.errors.map(e => ({
        ...e,
        error: `[${s.sheetName}] ${e.error}`
      })));
    }

    // AI weekly suggestions & projections call
    let aiWeeklyChecklist = '';
    let aiProjections = '';
    let aiGenerated = false;

    try {
      logger.info({ sheetCount: activeSheets.length }, 'Invoking AI to generate Strategic Projections & Action Checklist...');
      
      const monthlySummaryText = sortedSheets.map(s => {
        const liq = s.transactions.filter((t: Transaction) => t.category === 'Liquor Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const food = s.transactions.filter((t: Transaction) => t.category === 'Food Revenue').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const rec = s.transactions.filter((t: Transaction) => t.category === 'Credit Recovery').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const exp = s.transactions.filter((t: Transaction) => t.category === 'Operational Expense').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const cred = s.transactions.filter((t: Transaction) => t.category === 'Credit Extended').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
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
      aiGenerated = true;
    } catch (error) {
      logger.error({ error }, 'AI strategic trend and projections generation failed. Using data-driven fallback.');
      const fallback = computeSalesFallbackInsights({
        sortedSheets,
        masterLiquor,
        masterFood,
        masterExpenses,
        masterCreditExtended,
        masterRecovery,
        creditOutstandingGap,
        creditRecoveryRate,
        foodPercentage,
        liquorPercentage,
        bestRevenueMonth,
        bestRevenueValue,
        peakExpenseMonth,
        peakExpenseValue
      });
      aiWeeklyChecklist = fallback.checklist;
      aiProjections = fallback.projections;
    }

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

    const htmlAlertsList = groupAlertsIntoHtml(alerts);

    // Group alerts map for markdown warning block
    const alertGroups = new Map<string, typeof alerts>();
    for (const a of alerts) {
      if (!alertGroups.has(a.ruleId)) alertGroups.set(a.ruleId, []);
      alertGroups.get(a.ruleId)!.push(a);
    }
    const mdAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
      const first = list[0];
      const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
      const examples = list.slice(0, 2).map(a => `... ${a.message}`).join('\n');
      return `> [!WARNING]\n> **${first.ruleName}${countLabel}**:\n${examples}`;
    }).join('\n\n');

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
`;

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
      htmlAlertsList,
      aiGenerated
    });

    const jsonSummary = JSON.stringify({
      fileName,
      runTimestamp,
      totalMonths: sortedSheets.length,
      totalTransactions: transactions.length,
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

    return { markdownReport, htmlReport, jsonSummary };
  }
}

export const aiService = new AiService();
