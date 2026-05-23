import { CellValue } from 'exceljs';
import { Transaction, TransactionSchema } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';

// Header synonyms for dynamic matching
const HEADER_SYNONYMS: Record<string, string[]> = {
  date: ['date', 'transaction date', 'dt', 'invoice date'],
  invoiceNumber: ['invoice number', 'invoice no', 'invoice', 'inv #', 'inv number'],
  category: ['category', 'cat', 'expense category'],
  description: ['description', 'desc', 'particulars', 'memo'],
  amount: ['amount', 'amt', 'value', 'price'],
  type: ['type', 'transaction type', 'credit/debit', 'cr/dr', 'direction'],
  vendor: ['vendor', 'payee', 'merchant', 'supplier', 'party'],
};

/**
 * Normalizes a string for header comparison by trimming, lowercasing, and removing special characters.
 */
function normalizeHeader(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts a clean string value from an exceljs CellValue.
 * Handles cell formulas, objects, numbers, and dates.
 */
export function extractStringValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object') {
    // If it's a rich text cell or a formula result
    if ('result' in value) {
      return extractStringValue(value.result);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((rt) => rt.text || '').join('');
    }
    if ('text' in value) {
      return String(value.text);
    }
  }
  
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

/**
 * Maps a row array to the expected Transaction model based on column headers or fallback column indexes.
 */
export function mapRowToTransaction(
  rowValues: CellValue[],
  headerMap: Map<string, number>
): Transaction {
  const getVal = (field: string, fallbackIdx: number): string => {
    const idx = headerMap.get(field);
    const targetIdx = idx !== undefined ? idx : fallbackIdx;
    return extractStringValue(rowValues[targetIdx]);
  };

  // Extract raw fields
  const rawDate = getVal('date', 1);
  const rawInvoice = getVal('invoiceNumber', 2);
  const rawCategory = getVal('category', 3);
  const rawDescription = getVal('description', 4);
  const rawAmount = getVal('amount', 5);
  const rawType = getVal('type', 6);
  const rawVendor = getVal('vendor', 7);

  // Normalize and validate Type
  let normalizedType = rawType.toLowerCase().trim();
  if (normalizedType.includes('cr') || normalizedType.includes('credit') || normalizedType === 'in' || normalizedType === 'income') {
    normalizedType = 'credit';
  } else if (normalizedType.includes('dr') || normalizedType.includes('debit') || normalizedType === 'out' || normalizedType === 'expense') {
    normalizedType = 'debit';
  }

  // Parse and validate via Zod schema
  return TransactionSchema.parse({
    date: rawDate,
    invoiceNumber: rawInvoice,
    category: rawCategory,
    description: rawDescription,
    amount: rawAmount,
    type: normalizedType,
    vendor: rawVendor,
  });
}

/**
 * Examines a header row and returns a map of field name to column index (1-based for exceljs).
 */
export function buildHeaderMap(rowValues: CellValue[]): Map<string, number> {
  const map = new Map<string, number>();

  for (let i = 1; i < rowValues.length; i++) {
    const cellStr = normalizeHeader(extractStringValue(rowValues[i]));
    if (!cellStr) continue;

    // Search for a match in header synonyms
    for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      const isMatch = synonyms.some(syn => {
        const normSyn = syn.replace(/[^a-z0-9]/g, '');
        return cellStr.includes(normSyn) || normSyn.includes(cellStr);
      });

      if (isMatch && !map.has(field)) {
        map.set(field, i);
        logger.debug({ field, columnName: String(rowValues[i]), index: i }, 'Mapped column header');
        break;
      }
    }
  }

  return map;
}
