import type { Transaction, TransactionType } from './sales.types.js';
import { TransactionSchema, TransactionTypeSchema } from './sales.types.js';
import type { DebitorSummary } from './debitors.types.js';

export type { Transaction, TransactionType, DebitorSummary };
export { TransactionSchema, TransactionTypeSchema };

export interface ParsingError {
  row: number;
  invoiceNumber?: string;
  error: string;
}

export interface SheetParsingResult {
  sheetName: string;
  transactions: Transaction[];
  errors: ParsingError[];
  debitors?: DebitorSummary[];
}

export interface ExcelParsingResult {
  fileName: string;
  sheets: SheetParsingResult[];
  isDebitorsList?: boolean;
}
