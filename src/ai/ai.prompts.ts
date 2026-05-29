import type { Transaction, ParsingError, DebitorSummary } from '../types/accounting.types.js';
import type { RuleAlert } from '../rules/rules.types.js';

/**
 * Describes parsed data for a single worksheet, used when passing multi-sheet context to the AI service.
 */
export interface SheetSummaryData {
  sheetName: string;
  transactions: Transaction[];
  errors: ParsingError[];
}

/**
 * The unified input shape passed to the AI service for all report generation.
 */
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

export function buildDebitorsPrompt(businessName: string, statsText: string, debtorsSummaryText: string): string {
  return `
You are a friendly, encouraging local restaurant consultant advising the owner of "${businessName}" on how to recover uncollected customer tab balances (Udhari).
Review these outstanding credit collections stats:
${statsText}
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
- Connect insights directly to their actual debtors and numbers.
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
}

export function buildSalesPrompt(businessName: string, statsText: string, monthlySummaryText: string): string {
  return `
You are a friendly, encouraging local restaurant consultant advising the owner of "${businessName}".
Review these financial stats:
${statsText}
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
}
