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
