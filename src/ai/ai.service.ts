import { AiProviderFactory } from './ai.factory.js';
import { AiProvider } from './ai.types.js';
import { PromptInputData, buildDebitorsPrompt, buildSalesPrompt } from './ai.prompts.js';
import { ParsingError, Transaction } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';
import { generateHtmlReport } from './report-template.js';
import { generateDebitorsHtmlReport } from './debitors-template.js';
import { config } from '../config/config.js';
import {
  calculateDebitorMetrics,
  calculateSalesMetrics
} from './ai.calculator.js';
import {
  cleanPromptPoint,
  parseAiResponse
} from './ai.parser.js';
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
    const { transactions, alerts, parsingErrors, fileName, runTimestamp } = data;
    const businessName = config.BUSINESS_NAME;

    // =========================================================================
    // BRANCH A: Specialized Udhari & Debitors Register Orchestrator
    // =========================================================================
    if (data.isDebitorsList && data.debitors) {
      logger.info({ fileName }, `Generating specialized report for Debitors List (${businessName})`);

      const calc = calculateDebitorMetrics(data);
      const {
        totalDebitSum,
        totalCreditSum,
        totalPendingSum,
        collectionSuccessRate,
        activeDebitorsCount,
        averageOutstandingDues,
        topDebtorName,
        topDebtorValue,
        maxPending,
        topDebitorsLimitList
      } = calc;

      const debitorsLimit = data.debitorsLimit || 10;

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
        const unifiedPrompt = buildDebitorsPrompt(businessName, masterStatsText, debtorsSummaryText);
        const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });
        
        const parsed = parseAiResponse(responseText);
        aiWeeklyChecklist = parsed.checklist;
        aiProjections = parsed.projections;
        aiIntelligence = parsed.intelligence;

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

      const markdownReport = `# 📋 ${businessName} Udhari & Debitors Register — Master Audit Summary\n\n` +
        `> [!NOTE]\n` +
        `> **Source File**: \`${fileName}\`  \n` +
        `> **Total Outstanding Accounts**: \`${activeDebitorsCount} Customers\`  \n` +
        `> **Status**: ${parsingErrors.length > 0 ? 'Processed with Ingestion Warnings ⚠️' : 'Successfully Parsed & Synced ✅'}  \n\n` +
        `---\n\n` +
        `### 💳 Core Udhari & Debitors Aggregates\n` +
        `* **Total Credit Invoiced (Extended):** ₹${Math.round(totalDebitSum).toLocaleString()}\n` +
        `* **Total Repayments Collected (Recovered):** ₹${Math.round(totalCreditSum).toLocaleString()}\n` +
        `* **Net Outstanding Customer Balance (Current Gap):** **₹${Math.round(totalPendingSum).toLocaleString()}**\n` +
        `* **Collections Recovery Success Rate:** \`${collectionSuccessRate}%\`\n` +
        `* **Average Outstanding Balance Dues:** ₹${Math.round(averageOutstandingDues).toLocaleString()} per account\n` +
        `* **Top Customer Dues Account:** **${topDebtorName}** (₹${Math.round(topDebtorValue).toLocaleString()} pending)\n\n` +
        `---\n\n` +
        `### 🏆 Top Outstanding Dues Leaderboard (Top ${debitorsLimit})\n` +
        `| Rank | Customer Debitor | Total Debit (Purchased) | Total Credit (Repayed) | Outstanding Pending | Pending Contribution % |\n` +
        `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
        `${mdDebitorRowsList}\n\n` +
        `---\n\n` +
        `### ⚡ Collections & Accounts Recovery Projections\n` +
        `${mdProjectionsPoints || '> * No projections generated.'}\n\n` +
        `---\n\n` +
        `### 📋 Staff Meeting Weekly Recovery Checklist\n` +
        `${mdChecklistPoints || '> * No checklist items generated.'}\n\n` +
        `---\n\n` +
        `### 🏆 AI Strategic Intelligence & Hidden Dues Risks\n` +
        `${mdIntelligencePoints || '> * No strategic insights generated.'}\n\n` +
        `---\n\n` +
        `### 🚨 Ingestion Exceptions & Warnings\n` +
        `${mdAlertsList || '> * All balances and daily registers are cleanly matching with zero alerts!'}\n`;

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
    const salesCalc = calculateSalesMetrics(data);
    const { sortedSheets, maxAbsNet, maxInflowOutflow } = salesCalc;

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
      allErrors.push(...s.errors.map((e: any) => ({
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
      logger.info({ sheetCount: sortedSheets.length }, 'Invoking AI to generate Strategic Projections & Action Checklist...');
      
      const monthlySummaryText = sortedSheets.map((s: any) => {
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

      const unifiedPrompt = buildSalesPrompt(businessName, masterStatsText, monthlySummaryText);
      const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });

      const parsed = parseAiResponse(responseText);
      aiWeeklyChecklist = parsed.checklist;
      aiProjections = parsed.projections;
      aiIntelligence = parsed.intelligence;

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

    const markdownReport = `# 📋 ${businessName} Daily Sales Register — Master Performance Summary\n\n` +
      `> [!NOTE]\n` +
      `> **Source File**: \`${fileName}\`  \n` +
      `> **Total Months Audited**: \`${sortedSheets.length} Months\`  \n` +
      `> **Status**: ${allErrors.length > 0 ? 'Processed with Errors ⚠️' : 'Successfully Processed ✅'}  \n` +
      `> **Processed On**: ${runTimestamp}  \n\n` +
      `---\n\n` +
      `### 🏆 Executive Highlights & Benchmarks\n` +
      `> [!NOTE]\n` +
      `> * **🥇 Best Sales Month**: **${bestRevenueMonth}** (Total Revenue: **₹${Math.round(bestRevenueValue).toLocaleString()}**)\n` +
      `> * **💰 Best Cash Surplus Month**: **${bestProfitMonth}** (Net Surplus: **₹${Math.round(bestProfitValue).toLocaleString()}**)\n` +
      `> * **🛠️ Peak Expense Month**: **${peakExpenseMonth}** (Supplier Costs: **₹${Math.round(peakExpenseValue).toLocaleString()}**)\n` +
      `> * **🍺 Restaurant Menu Ratio**: **${liquorPercentage}% Bar Counter Sales** vs. **${foodPercentage}% Food Sales**\n` +
      `> * **💳 Credit Recovery Efficiency**: **${creditRecoveryRate}%** of extended customer credit successfully collected! \n` +
      `>   * _Outstanding Customer Balance_: **₹${Math.round(creditOutstandingGap).toLocaleString()}** (currently unrecovered)\n\n` +
      `---\n\n` +
      `## 📊 Combined Performance Overview (All Months)\n\n` +
      `| Category | Combined Inflows | Combined Outflows | Description & Master Bookkeeping Notes |\n` +
      `| :--- | :---: | :---: | :--- |\n` +
      `| **🍸 Liquor Sales** | **₹${Math.round(masterLiquor).toLocaleString()}** | — | Combined bar counter revenue |\n` +
      `| **🍽️ Food Sales** | **₹${Math.round(masterFood).toLocaleString()}** | — | Combined restaurant food revenue |\n` +
      `| **📥 Credit Recovered (Udhari Jama)** | **₹${Math.round(masterRecovery).toLocaleString()}** | — | Total customer outstanding dues collected |\n` +
      `| **🛠️ Daily Expenses** | — | **₹${Math.round(masterExpenses).toLocaleString()}** | Total daily supplier, wage & inventory outflows |\n` +
      `| **📤 Credit Extended (Udhari Given)** | — | **₹${Math.round(masterCreditExtended).toLocaleString()}** | Total food & drink served to customers on credit |\n` +
      `| **📊 MASTER TOTALS** | **₹${Math.round(masterIncome).toLocaleString()}** | **₹${Math.round(masterOutflow).toLocaleString()}** | Total financial volume combined |\n` +
      `| **⚖️ NET POSITION** | **₹${Math.round(masterNet).toLocaleString()}** | **[${masterStatus.toUpperCase()}]** | **Overall Cumulative Cash Surplus** |\n\n` +
      `---\n\n` +
      `## 📅 Month-by-Month Trend Analysis\n\n` +
      `| Month / Year | Liquor Sales | Food Sales | Credit Extended | Expenses | Net Cashflow | Status |\n` +
      `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n` +
      `${monthlyTrendRows.join('\n')}\n\n` +
      `---\n\n` +
      `## 🔮 Dynamic 3-Month Projections (AI Predictive Forecasting)\n\n` +
      `> [!NOTE]\n` +
      `> **Seasonal Trends & Financial Outlook**:\n` +
      `${mdProjectionsPoints}\n\n` +
      `---\n\n` +
      `## 💡 Weekly Operational Action Checklist\n\n` +
      `> [!TIP]\n` +
      `> **Action items for your next staff meeting**:\n` +
      `${mdChecklistPoints}\n\n` +
      `---\n\n` +
      `## 🏆 AI Strategic Intelligence & Hidden Operational Leaks\n\n` +
      `> [!TIP]\n` +
      `> **Operational insight, revenue-mix, and cost-leak optimizations**:\n` +
      `${mdIntelligencePoints}\n\n` +
      `---\n\n` +
      `## 🔍 File & Records Integrity\n\n` +
      `* **Total Months Processed**: \`${sortedSheets.length}\`\n` +
      `* **Total Transactions Audited**: \`${allTransactions.length}\`\n` +
      `* **Format Errors / Skipped Rows**: \`${allErrors.length}\`\n` +
      `${allErrors.length > 0 ? `\n### Format Error Log (First 10):\n${formattedErrors}` : ''}\n\n` +
      `---\n\n` +
      `## ⚠️ Key Operational Alerts (Top Exceptions)\n\n` +
      `${mdAlertsList || '> [!NOTE]\n> ✅ No alerts or exceptions detected across the entire historical data.'}\n`;

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
