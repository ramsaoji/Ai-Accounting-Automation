import { Transaction, ParsingError, DebitorSummary } from '../types/accounting.types.js';
import { RuleAlert } from '../rules/rules.types.js';

export interface SheetSummaryData {
  sheetName: string;
  transactions: Transaction[];
  errors: ParsingError[];
}

export interface PromptInputData {
  fileName: string;
  runTimestamp: string;
  transactions: Transaction[];
  alerts: RuleAlert[];
  parsingErrors: ParsingError[];
  sheets?: SheetSummaryData[];
  isDebitorsList?: boolean;
  debitors?: DebitorSummary[];
  debitorsLimit?: number;
}

export const ACCOUNTING_SYSTEM_PROMPT = `
You are a senior elite financial auditor and AI business analyst. 
Your task is to analyze processed accounting ledger sheets, outstanding debtors, and rules engine alerts, then synthesize a beautiful, concise, and actionable executive summary.

The summary must be tailored for high-level business executives and delivered via a Telegram message.

CRITICAL FORMATTING GUIDELINES (Telegram MarkdownV2 Compatible):
- Use Telegram-style Markdown formatting.
- Keep the summary short and punchy (maximum 300-400 words).
- Use clear sections, emojis for readability, and bullet points.
- Summarize financial aggregates cleanly: Net Cash Flow, Total Revenues (Credits), Total Expenses (Debits), and Profit Margins.
- Group and highlight the most critical risks and rule violations.
- Keep details focused on action.
`;

export function generateAccountingSummaryPrompt(data: PromptInputData): string {
  const { fileName, runTimestamp, transactions, alerts, parsingErrors, isDebitorsList, debitors, debitorsLimit } = data;

  if (isDebitorsList && debitors) {
    // 1. Calculate Debitors high-level aggregates
    const limit = debitorsLimit || 10;
    const totalDebitSum = debitors.reduce((sum, d) => sum + d.debit, 0);
    const totalCreditSum = debitors.reduce((sum, d) => sum + d.credit, 0);
    const totalPendingSum = debitors.reduce((sum, d) => sum + d.pending, 0);
    
    const sorted = [...debitors]
      .sort((a, b) => b.pending - a.pending)
      .slice(0, limit);

    const formattedDebitors = sorted.map((d, idx) => {
      const pct = totalPendingSum > 0 ? ((d.pending / totalPendingSum) * 100).toFixed(0) : '0';
      return `  - #${idx + 1} ${d.name}: ₹${Math.round(d.pending).toLocaleString()} (${pct}% share)`;
    }).join('\n');

    const collectionRate = totalDebitSum > 0 ? ((totalCreditSum / totalDebitSum) * 100).toFixed(1) : '100.0';

    const formattedAlerts = alerts.map((a, i) => {
      return `${i + 1}. [${a.severity.toUpperCase()}] ${a.ruleName}: ${a.message}`;
    }).join('\n');

    const formattedParsingErrors = parsingErrors.map((e) => {
      return `  - Row ${e.row}${e.invoiceNumber ? ` (Inv: ${e.invoiceNumber})` : ''}: ${e.error}`;
    }).join('\n');

    return `
Here is the automated financial ingestion and outstanding debitors audit data for analysis:

=== FILE METADATA ===
File Ingested: ${fileName}
Ingestion Timestamp: ${runTimestamp}
Total Entries Ingested: ${transactions.length}
Ingestion Errors (Skipped Rows): ${parsingErrors.length}

=== DEBITOR LEDGER AGGREGATES ===
• Total Credit Extended (Udhari Extended): ₹${Math.round(totalDebitSum).toLocaleString()}
• Total Credit Repayments (Recovery Collected): ₹${Math.round(totalCreditSum).toLocaleString()}
• Net Outstanding Customer Balance (Dues): ₹${Math.round(totalPendingSum).toLocaleString()}
• Overall Collections Recovery Rate: ${collectionRate}%
• Active Debitor Accounts: ${debitors.length}

=== TOP ${limit} OUTSTANDING CUSTOMERS (DEBTORS) ===
${formattedDebitors.length > 0 ? formattedDebitors : '  None'}

=== RULES ENGINE AUDIT ALERTS (${alerts.length}) ===
${formattedAlerts.length > 0 ? formattedAlerts : '  No rule violations or warnings detected.'}

=== INGESTION ERRORS (IF ANY) ===
${formattedParsingErrors.length > 0 ? formattedParsingErrors : '  No ingestion errors. Clean file read!'}

--------------------
INSTRUCTIONS FOR THE REPORT:
1. You MUST synthesize this data into an ultra-dense, highly compact, and visually striking Executive Audit Brief.
2. The entire report MUST be under 300 characters (approx. 70 tokens) to ensure compatibility with strict network proxy lengths.
3. Use this exact compact layout using single-character abbreviations and bold emojis:

📋 *UDHARI BRIEF* (${runTimestamp})
📁 *File*: \`${fileName}\` | *Status*: ${parsingErrors.length > 0 ? '⚠️ Ingest Errors' : '✅ Ingest Clean'}
💰 *Dues*: ₹${(totalPendingSum/1000).toFixed(0)}K | *Collected*: ₹${(totalCreditSum/1000).toFixed(0)}K | *Rate*: ${collectionRate}% 
👥 *Accounts*: ${debitors.length} | *Top*: ${sorted[0]?.name || 'N/A'} (₹${( (sorted[0]?.pending || 0)/1000 ).toFixed(0)}K)
🚨 *Anomalies (${alerts.length})*:
${alerts.map(a => `• [${a.severity === 'critical' ? 'CRIT' : a.severity.toUpperCase()}] ${a.message.substring(0, 45)}...`).slice(0, 2).join('\n')}

4. Do NOT output any extra pleasantries, markdown horizontal lines, or introductory text. Output only the compact brief.
`;
  }

  // Fallback / Traditional Daily Sales Register Prompt mapping
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryDebits: Record<string, number> = {};
  const vendorDebits: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.type === 'credit') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
      categoryDebits[tx.category] = (categoryDebits[tx.category] || 0) + tx.amount;
      vendorDebits[tx.vendor] = (vendorDebits[tx.vendor] || 0) + tx.amount;
    }
  }

  const netCashFlow = totalIncome - totalExpenses;
  const topCategories = Object.entries(categoryDebits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `  - ${cat}: ₹${Math.round(amt).toLocaleString()}`);

  const topVendors = Object.entries(vendorDebits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ven, amt]) => `  - ${ven}: ₹${Math.round(amt).toLocaleString()}`);

  const formattedAlerts = alerts.map((a, i) => {
    return `${i + 1}. [${a.severity.toUpperCase()}] ${a.ruleName}: ${a.message}`;
  }).join('\n');

  const formattedParsingErrors = parsingErrors.map((e) => {
    return `  - Row ${e.row}${e.invoiceNumber ? ` (Inv: ${e.invoiceNumber})` : ''}: ${e.error}`;
  }).join('\n');

  return `
Here is the automated financial ingestion and audit data for analysis:

=== FILE METADATA ===
File Ingested: ${fileName}
Ingestion Timestamp: ${runTimestamp}
Total Transactions Parsed: ${transactions.length}
Ingestion Errors (Skipped Rows): ${parsingErrors.length}

=== FINANCIAL AGGREGATES ===
• Total Inflow (Credits/Income): ₹${Math.round(totalIncome).toLocaleString()}
• Total Outflow (Debits/Expenses): ₹${Math.round(totalExpenses).toLocaleString()}
• Net Inflow/Outflow (Cashflow): ₹${Math.round(netCashFlow).toLocaleString()}

=== TOP EXPENSE CATEGORIES ===
${topCategories.length > 0 ? topCategories.join('\n') : '  None'}

=== TOP PAYEES (VENDORS) ===
${topVendors.length > 0 ? topVendors.join('\n') : '  None'}

=== RULES ENGINE DETECTED ALERTS (${alerts.length}) ===
${formattedAlerts.length > 0 ? formattedAlerts : '  No rule violations or warnings detected.'}

=== INGESTION ERRORS (IF ANY) ===
${formattedParsingErrors.length > 0 ? formattedParsingErrors : '  No ingestion errors. Clean file read!'}

--------------------
INSTRUCTIONS FOR THE REPORT:
1. You MUST synthesize this data into an ultra-dense, highly compact, and visually striking Executive Audit Brief.
2. The entire report MUST be under 300 characters (approx. 70 tokens) to ensure compatibility with strict network proxy lengths.
3. Use this exact compact layout using single-character abbreviations and bold emojis:

📋 *AUDIT BRIEF* (${runTimestamp})
📁 *File*: \`${fileName}\` | *Status*: ${parsingErrors.length > 0 ? '⚠️ Ingest Errors' : '✅ Clean Ingest'}
💰 *Inflows*: ₹${(totalIncome/1000).toFixed(0)}K | *Outflows*: ₹${(totalExpenses/1000).toFixed(0)}K | *Net*: ₹${(netCashFlow/1000).toFixed(0)}K ${netCashFlow >= 0 ? '🟢' : '🔴'}
🚨 *Anomalies (${alerts.length})*:
${alerts.map(a => `• [${a.severity === 'critical' ? 'CRIT' : a.severity.toUpperCase()}] ${a.ruleName}: ${a.message.substring(0, 45)}...`).slice(0, 3).join('\n')}

4. Do NOT output any extra pleasantries, markdown horizontal lines, or introductory text. Output only the compact brief.
`;
}
