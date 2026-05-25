import { Transaction, TransactionSchema, TransactionType, TransactionTypeSchema } from './sales.types.js';
import { DebitorSummary } from './debitors.types.js';

export { Transaction, TransactionSchema, TransactionType, TransactionTypeSchema, DebitorSummary };

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
