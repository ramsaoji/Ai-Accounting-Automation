import { Transaction, ParsingError } from '../types/accounting.types.js';
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
}

export const ACCOUNTING_SYSTEM_PROMPT = `
You are a senior elite financial auditor and AI business analyst. 
Your task is to analyze processed accounting ledger sheets and rules engine alerts, then synthesize a beautiful, concise, and actionable executive summary.

The summary must be tailored for high-level business executives and delivered via a Telegram message.

CRITICAL FORMATTING GUIDELINES (Telegram MarkdownV2 Compatible):
- Use Telegram-style Markdown formatting:
  * Bold: *text* (Note: in standard Markdown, bold is **text** but Telegram standard Markdown supports *text* or standard markdown depends on API parse_mode. We will use Markdown parse_mode, so *text* for bold or **text** for bold depends on client configuration. To be safe, we will use Markdown parse_mode: 'HTML' or 'Markdown'. Standard Markdown uses *bold* or _italic_. Let's specify standard Markdown V1 style: *bold* for bold, _italic_ for italic, \`code\` for inline code, [text](url) for links. Or we can request standard Markdown, and our Telegram client will handle it gracefully. Standard Markdown *bold* and \`code\` are highly compatible. Let's ask the LLM to output clean, standard markdown).
- Keep the summary short and punchy (maximum 300-400 words).
- Use clear sections, emojis for readability, and bullet points.
- Summarize financial aggregates cleanly: Net Cash Flow, Total Revenues (Credits), Total Expenses (Debits), and Profit Margins.
- Group and highlight the most critical risks and rule violations (e.g. duplicates, spikes).
- Keep details focused on action.
`;

export function generateAccountingSummaryPrompt(data: PromptInputData): string {
  const { fileName, runTimestamp, transactions, alerts, parsingErrors } = data;

  // 1. Calculate high-level aggregates
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

  // 2. Format alerts for prompt
  const formattedAlerts = alerts.map((a, i) => {
    return `${i + 1}. [${a.severity.toUpperCase()}] ${a.ruleName}: ${a.message}`;
  }).join('\n');

  // 3. Format parsing errors
  const formattedParsingErrors = parsingErrors.map((e) => {
    return `  - Row ${e.row}${e.invoiceNumber ? ` (Inv: ${e.invoiceNumber})` : ''}: ${e.error}`;
  }).join('\n');

  // Return full compiled prompt
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
📁 *File*: \`${fileName}\` | *Status*: ${parsingErrors.length > 0 ? '⚠️ Ingest Errors (Row 12 skipped)' : '✅ Clean Ingest'}
💰 *Inflows*: ₹${(totalIncome/1000).toFixed(0)}K | *Outflows*: ₹${(totalExpenses/1000).toFixed(0)}K | *Net*: ₹${(netCashFlow/1000).toFixed(0)}K ${netCashFlow >= 0 ? '🟢' : '🔴'}
🚨 *Anomalies (${alerts.length})*:
${alerts.map(a => `• [${a.severity === 'critical' ? 'CRIT' : a.severity.toUpperCase()}] ${a.ruleName}: ${a.message.substring(0, 45)}...`).slice(0, 3).join('\n')}

4. Do NOT output any extra pleasantries, markdown horizontal lines, or introductory text. Output only the compact brief.
`;
}
