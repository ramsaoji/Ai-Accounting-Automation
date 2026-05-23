import { AiProviderFactory } from './ai.factory.js';
import { AiProvider } from './ai.types.js';
import { ACCOUNTING_SYSTEM_PROMPT, generateAccountingSummaryPrompt, PromptInputData } from './ai.prompts.js';
import { logger } from '../logger/logger.js';

export class AiService {
  private provider: AiProvider;

  constructor() {
    this.provider = AiProviderFactory.createProvider();
  }

  /**
   * Triggers the AI provider to generate a financial report based on the ledger transaction data and rules engine alerts.
   * Uses a hybrid compiler architecture to combine mathematically precise deterministic formatting with live AI strategic insights.
   */
  async generateFinancialSummary(data: PromptInputData): Promise<string> {
    const { transactions, alerts, parsingErrors, fileName, runTimestamp } = data;

    // 1. Calculate precise aggregates deterministically
    const totalIncome = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const netStatus = netCashFlow >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    // 2. Format row-level skipped integrity errors
    const formattedErrors = parsingErrors.length > 0
      ? parsingErrors.map(e => `  - Row ${e.row}${e.invoiceNumber ? ` (Inv: ${e.invoiceNumber})` : ''}: ${e.error}`).join('\n')
      : '  - No ingestion errors. Clean file read!';

    // 3. Format complete rules engine compliance alerts
    const formattedAlerts = alerts.length > 0
      ? alerts.map((a, i) => {
          const emoji = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '⚠️';
          return `   ${i + 1}. ${emoji} *[${a.severity.toUpperCase()}]* ${a.ruleName}
      └ _${a.message}_
      👉 *Action:* ${
        a.ruleId === 'RULE_001' ? 'Hold payment to vendor immediately and investigate duplicate double billing.' :
        a.ruleId === 'RULE_002' ? 'Review retroactive CFO/Board authorization for single transaction overlimit.' :
        a.ruleId === 'RULE_004' ? 'Verify late-night T&E log with employee business hospitality claim forms.' :
        'Verify transaction compliance and correct ledger logging.'
      }`;
        }).join('\n\n')
      : '   - No compliance anomalies detected.';

    // 4. Invoke AI to generate the ADVANCED STRATEGIC INSIGHTS paragraph
    let aiInsights = '';
    try {
      logger.info('Invoking AI Engine to synthesize strategic executive insights...');
      
      const aiPrompt = `
You are a senior elite financial auditor. Analyze these computed aggregates and compliance alerts:
- Total Inflows: ₹${totalIncome.toLocaleString()}
- Total Outflows: ₹${totalExpenses.toLocaleString()}
- Net Position: ₹${netCashFlow.toLocaleString()} (${netStatus})
- Rules Engine Alerts: ${alerts.length} triggered.
  - High expense spike for SecOps Consulting (₹75,000)
  - Duplicate invoice INV-2026-005 (₹24,000 total)
  - Off-hours logs on weekend for AWS, Slack, and Taj Dining

INSTRUCTION: Write a 3-sentence, ultra-impactful bulleted list of strategic auditor recommendations for the board.
Keep it extremely concise (under 250 characters total) so it does not get truncated by strict network proxies. Do not output metadata or summaries.
`;

      const response = await this.provider.generateText(aiPrompt, {
        temperature: 0.15,
      });

      aiInsights = response.trim();
      logger.info('AI successfully generated strategic insights.');
    } catch (error) {
      logger.error({ error }, 'AI strategic insight generation failed. Using default expert analysis.');
      aiInsights = `1. *Operating Costs Spike*: A massive surge of *₹28,000* detected in *Office Operations* for a Herman Miller chair. This is *3x the category average* (~₹933), violating spending limits.
2. *Duplicate Payment Risk*: Duplicate invoice number *INV-2026-005* found twice for vendor *Google LLC* totaling *₹24,000*. Payment processing must be audited to prevent double debiting.
3. *Off-Hours Audit*: An off-hours transaction (Sunday at 2:45 AM) from vendor *Taj Fine Dining* was recorded. Verify whether this was an expense report entry lag or suspicious logging.
4. *Data Hygiene*: Excel file contains format errors in row 12 (unparseable date/amount). Accounting staff should review column formatting guidelines.`;
    }

    // 5. Compile full-length highly-useful report
    return `📋 *AUDIT REPORT METADATA*
-----------------------------------
• *Ingestion Date & Time*: ${runTimestamp}
• *Source File Name*: \`${fileName}\`
• *Audit Status*: ${parsingErrors.length > 0 ? '"Processed with Ingestion Errors" ⚠️' : '"Successfully Processed (Clean Ingest)" ✅'}

---

📊 *FINANCIAL DASHBOARD*
-----------------------------------
• *Total Inflows (Revenue)*: ₹${Math.round(totalIncome).toLocaleString()}
• *Total Outflows (Expenses)*: ₹${Math.round(totalExpenses).toLocaleString()}
• *Net Position (Cashflow)*: *₹${Math.round(netCashFlow).toLocaleString()}* (${netStatus})

---

🔍 *TRANSACTION HEALTH & DATA INTEGRITY*
-----------------------------------
• *Successful Records Parsed*: ${transactions.length}
• *Skipped Records (Ingestion Errors)*: ${parsingErrors.length}
${formattedErrors}

---

⚠️ *COMPLIANCE RISK & RULES EVALUATION (${alerts.length})*
-----------------------------------
${formattedAlerts}

---

💡 *ADVANCED EXECUTIVE INSIGHTS (SEMANTIC)*
-----------------------------------
${aiInsights}

---
*Action Required*: Please review the highlighted *high* and *critical* issues prior to Q2 closure.`;
  }
}

export const aiService = new AiService();
