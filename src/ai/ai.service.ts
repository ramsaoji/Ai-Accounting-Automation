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

function cleanPromptPoint(line: string): string {
  let cleaned = line.trim();
  // Strip common leading markers like bullet points, numbers, asterisks, brackets, or dashes
  cleaned = cleaned.replace(/^[\*\-\d\.\s\[\]\(\)]+/, '');
  // Strip trailing brackets/parentheses if present
  cleaned = cleaned.replace(/[\)\]]+$/, '');
  cleaned = cleaned.trim();
  if (cleaned.length === 0) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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

      // AI calls for weekly checklist, 3-month outlook and strategic intelligence specific to debitors
      let aiWeeklyChecklist = '';
      let aiProjections = '';
      let aiIntelligence = '';
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
        const unifiedPrompt = `
You are a friendly, encouraging local restaurant consultant advising the owner of "Hotel Gaurav" on how to recover uncollected customer tab balances (Udhari).
Review these outstanding credit collections stats:
${masterStatsText}
Top Debitor Accounts detailed breakdown:
${debtorsSummaryText}

INSTRUCTION:
Analyze the provided credit data and generate three separate sections of insights:

1. WEEKLY STAFF MEETING CHECKLIST: Write exactly 3 direct, practical business suggestions for their weekly staff meeting checklist to collect money back from these specific customers.
2. DYNAMIC 3-MONTH PROJECTIONS: Project the collections and recovery outlook for the NEXT 3 MONTHS in exactly 3 bullet points.
3. STRATEGIC INTELLIGENCE (DUES RISK & RECORD HABITS): Identify exactly 3 hidden insights, dues concentration risk alerts, or record-keeping recommendations (e.g. credit caps on top debtors, recovery velocity, off-hours bookkeeping posting habits).

Rules:
- Speak in a friendly, encouraging, and supportive consulting tone.
- Do NOT use dry corporate jargon (avoid: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline).
- Connect insights directly to their actual debtors and numbers (e.g. DILIP SAGADE, SURAJ KHARCHE).
- Keep introductory or formatting fluff out of your response.
- Format your response EXACTLY using these bracket delimiters so we can parse it:

[CHECKLIST_START]
(Checklist line 1)
(Checklist line 2)
(Checklist line 3)
[CHECKLIST_END]

[PROJECTIONS_START]
(Projection bullet 1)
(Projection bullet 2)
(Projection bullet 3)
[PROJECTIONS_END]

[INTELLIGENCE_START]
(Intelligence insight 1)
(Intelligence insight 2)
(Intelligence insight 3)
[INTELLIGENCE_END]
`;
        const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });
        
        const checklistMatch = responseText.match(/\[CHECKLIST_START\]([\s\S]*?)\[CHECKLIST_END\]/i);
        const projectionsMatch = responseText.match(/\[PROJECTIONS_START\]([\s\S]*?)\[PROJECTIONS_END\]/i);
        const intelligenceMatch = responseText.match(/\[INTELLIGENCE_START\]([\s\S]*?)\[INTELLIGENCE_END\]/i);

        aiWeeklyChecklist = checklistMatch ? checklistMatch[1].trim() : '';
        aiProjections = projectionsMatch ? projectionsMatch[1].trim() : '';
        aiIntelligence = intelligenceMatch ? intelligenceMatch[1].trim() : '';

        // Safest split fallback if formatting blocks completely failed
        if (!aiWeeklyChecklist || !aiProjections || !aiIntelligence) {
          const lines = responseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          aiWeeklyChecklist = lines.slice(0, 3).join('\n');
          aiProjections = lines.slice(3, 6).join('\n');
          aiIntelligence = lines.slice(6, 9).join('\n');
        }

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
        aiIntelligence = fallback.intelligence;
      }

      // Delegate all visual rendering calculations to our report-helper library
      const { generatedSvgChart } = generateDebitorsSvgChart(topDebitorsLimitList, maxPending, totalPendingSum);
      const htmlDebitorRows = generateDebitorsHtmlRows(topDebitorsLimitList, maxPending, totalPendingSum);

      const htmlChecklistPoints = aiWeeklyChecklist
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `
            <label class="checkbox-container">
              <input type="checkbox">
              <span class="checkmark"></span>
              <span class="checkbox-text"><strong>${cleaned}</strong></span>
            </label>
          `;
        })
        .join('\n');

      const htmlProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `<li><strong>${cleaned}</strong></li>`;
        })
        .join('\n');

      const htmlIntelligencePoints = aiIntelligence
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 1.1rem; color: var(--brand-gold);">✦</span>
              <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">${cleaned}</p>
            </div>
          `;
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
        htmlIntelligencePoints,
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
        .map(line => `> * [ ] **${cleanPromptPoint(line)}**`)
        .join('\n');

      const mdProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * **${cleanPromptPoint(line)}**`)
        .join('\n');

      const mdIntelligencePoints = aiIntelligence
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * **${cleanPromptPoint(line)}**`)
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

### 🏆 AI Strategic Intelligence & Hidden Dues Risks
${mdIntelligencePoints || '> * No strategic insights generated.'}

---

### 🚨 Ingestion Exceptions & Warnings
${mdAlertsList || '> * All balances and daily registers are cleanly matching with zero alerts!'}
`;

      const jsonSummary = JSON.stringify({
        fileName,
        timestamp: runTimestamp,
        runTimestamp,
        isDebitorsList: true,
        aiGenerated,
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
        allDebitors: data.debitors ? data.debitors.map(d => ({
          name: d.name,
          pending: Math.round(d.pending)
        })) : [],
        alerts: alerts.map(a => ({
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity,
          message: a.message,
        })),
        errors: parsingErrors,
        intelligence: aiIntelligence.split('\n').map(l => cleanPromptPoint(l)).filter(l => l.length > 0),
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

    // AI weekly suggestions, projections and strategic intelligence call
    let aiWeeklyChecklist = '';
    let aiProjections = '';
    let aiIntelligence = '';
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

      const unifiedPrompt = `
You are a friendly, encouraging local restaurant consultant advising the owner of "Hotel Gaurav".
Review these financial stats:
${masterStatsText}
Monthly breakdown:
${monthlySummaryText}

INSTRUCTION:
Analyze the provided financial data and generate three separate sections of insights:

1. WEEKLY STAFF MEETING CHECKLIST: Write exactly 3 direct, practical business suggestions for their weekly staff meeting checklist.
2. DYNAMIC 3-MONTH PROJECTIONS: Project the operational outlook for the NEXT 3 MONTHS in exactly 3 bullet points.
3. STRATEGIC INTELLIGENCE (HIDDEN LEAKS & RATIO OPPORTUNITIES): Identify exactly 3 hidden insights, ratio optimizations, or operational leak alerts (e.g. food vs liquor ratio, peak monthly expense leakage, credit collections gap risk).

Rules:
- Speak in a friendly, encouraging, and supportive consulting tone.
- Do NOT use dry corporate jargon (avoid: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline).
- Connect insights directly to their actual numbers and months.
- Keep introductory or formatting fluff out of your response.
- Format your response EXACTLY using these bracket delimiters so we can parse it:

[CHECKLIST_START]
(Checklist line 1)
(Checklist line 2)
(Checklist line 3)
[CHECKLIST_END]

[PROJECTIONS_START]
(Projection bullet 1)
(Projection bullet 2)
(Projection bullet 3)
[PROJECTIONS_END]

[INTELLIGENCE_START]
(Intelligence insight 1)
(Intelligence insight 2)
(Intelligence insight 3)
[INTELLIGENCE_END]
`;
      const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });

      const checklistMatch = responseText.match(/\[CHECKLIST_START\]([\s\S]*?)\[CHECKLIST_END\]/i);
      const projectionsMatch = responseText.match(/\[PROJECTIONS_START\]([\s\S]*?)\[PROJECTIONS_END\]/i);
      const intelligenceMatch = responseText.match(/\[INTELLIGENCE_START\]([\s\S]*?)\[INTELLIGENCE_END\]/i);

      aiWeeklyChecklist = checklistMatch ? checklistMatch[1].trim() : '';
      aiProjections = projectionsMatch ? projectionsMatch[1].trim() : '';
      aiIntelligence = intelligenceMatch ? intelligenceMatch[1].trim() : '';

      // Safest split fallback if formatting blocks completely failed
      if (!aiWeeklyChecklist || !aiProjections || !aiIntelligence) {
        const lines = responseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        aiWeeklyChecklist = lines.slice(0, 3).join('\n');
        aiProjections = lines.slice(3, 6).join('\n');
        aiIntelligence = lines.slice(6, 9).join('\n');
      }

      logger.info('AI successfully generated unified projections, checklist and strategic intelligence.');
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
      aiIntelligence = fallback.intelligence;
    }

    const mdChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * [ ] **${cleanPromptPoint(line)}**`)
      .join('\n');

    const mdProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * **${cleanPromptPoint(line)}**`)
      .join('\n');

    const mdIntelligencePoints = aiIntelligence
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * **${cleanPromptPoint(line)}**`)
      .join('\n');

    const htmlChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `
          <label class="checkbox-container">
            <input type="checkbox">
            <span class="checkmark"></span>
            <span class="checkbox-text"><strong>${cleaned}</strong></span>
          </label>
        `;
      })
      .join('\n');

    const htmlProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `<li><strong>${cleaned}</strong></li>`;
      })
      .join('\n');

    const htmlIntelligencePoints = aiIntelligence
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
            <span style="font-size: 1.1rem; color: var(--brand-gold);">✦</span>
            <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">${cleaned}</p>
          </div>
        `;
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

## 🏆 AI Strategic Intelligence & Hidden Operational Leaks

> [!TIP]
> **Operational insight, revenue-mix, and cost-leak optimizations**:
${mdIntelligencePoints}

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
      htmlIntelligencePoints,
      allTransactionsLength: allTransactions.length,
      allErrorsLength: allErrors.length,
      htmlErrors,
      htmlAlertsList,
      aiGenerated
    });

    const jsonSummary = JSON.stringify({
      fileName,
      runTimestamp,
      aiGenerated,
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
      })),
      intelligence: aiIntelligence.split('\n').map(l => cleanPromptPoint(l)).filter(l => l.length > 0)
    }, null, 2);

    return { markdownReport, htmlReport, jsonSummary };
  }
}

export const aiService = new AiService();
