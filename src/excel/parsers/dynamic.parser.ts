import ExcelJS from 'exceljs';
import { ExcelParsingResult, SheetParsingResult, ParsingError, Transaction, DebitorSummary, GodownStockItem } from '../../types/accounting.types.js';
import { extractStringValue } from '../excel.mapper.js';
import { logger } from '../../logger/logger.js';
import { getHistoryRetentionDays } from '../../db/db.client.js';

export interface ParserConfigSchema {
  header_row_index?: number;
  data_start_row: number;
  file_category?: 'sales' | 'inventory' | 'receivables';
  columns?: {
    // for sales/expenses
    date?: { col_idx: number; type: 'date' | 'string' };
    invoice?: { col_idx: number; type: 'string' };
    
    // for inventory (stock items)
    itemName?: { col_idx: number };
    itemCode?: { col_idx: number };
    category?: { col_idx: number };
    unitOfMeasure?: { col_idx: number };
    specification?: { col_idx: number };
    openingStock?: { col_idx: number };
    stockIn?: { col_idx: number };
    stockOut?: { col_idx: number };
    closingStock?: { col_idx: number };
    costPrice?: { col_idx: number };
    sellingPrice?: { col_idx: number };
    location?: { col_idx: number };
    snapshotDate?: { col_idx: number };
  };
  expansions?: {
    col_index: number;
    type: 'credit' | 'debit';
    coa_id: string;
    coa_code?: string;
    default_vendor: string;
    default_particulars: string;
  }[];

  // For multi-sheet receivables (debtors) structures
  breakup?: {
    sheet_name: string;
    data_start_row: number;
    columns: {
      partyName: { col_idx: number };
      debit?: { col_idx: number };
      credit?: { col_idx: number };
      pending?: { col_idx: number };
    };
  };
  entrylist?: {
    sheet_name: string;
    data_start_row: number;
    columns: {
      partyName: { col_idx: number };
      date: { col_idx: number };
      debit?: { col_idx: number };
      credit?: { col_idx: number };
    };
  };
}

function getNum(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    if ('result' in val && val.result !== null && val.result !== undefined) {
      return Number(val.result) || fallback;
    }
    return fallback;
  }
  return Number(val) || fallback;
}

function parseDateValue(val: any): Date {
  if (!val) throw new Error('Date cell is empty');
  if (val instanceof Date) return val;
  const str = extractStringValue(val).trim();
  
  const dots = str.split('.');
  if (dots.length === 3) {
    const d = parseInt(dots[0], 10);
    const m = parseInt(dots[1], 10);
    const y = parseInt(dots[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        return date;
      }
    }
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  throw new Error(`Unrecognized date format: ${str}`);
}

/**
 * Universal dynamic sheet parser for standard cash/revenue transactions (sales/expenses).
 */
export async function parseDynamicSalesSheet(
  worksheet: ExcelJS.Worksheet,
  templateName: string,
  configSchema: ParserConfigSchema,
  branchId?: string
): Promise<SheetParsingResult> {
  logger.info({ sheetName: worksheet.name, templateName, totalRows: worksheet.rowCount }, 'Parsing sales worksheet dynamically using template schema');

  const transactions: Transaction[] = [];
  const errors: ParsingError[] = [];

  const historyDays = await getHistoryRetentionDays('sales', 0);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historyDays);
  cutoffDate.setHours(0, 0, 0, 0);

  const startRow = configSchema.data_start_row || 1;
  const cols = configSchema.columns || {};
  const dateColIdx = cols.date?.col_idx || 1;
  const invoiceColIdx = cols.invoice?.col_idx;

  for (let r = startRow; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const values = row.values as ExcelJS.CellValue[];
    if (!values || values.length === 0) continue;

    const dateCell = row.getCell(dateColIdx).value;
    if (!dateCell) continue;

    const dateStr = extractStringValue(dateCell);
    if (!dateStr || dateStr.toLowerCase().includes('total') || dateStr.toLowerCase().includes('grand')) {
      continue;
    }

    try {
      const dateObj = parseDateValue(dateCell);
      if (historyDays > 0 && dateObj < cutoffDate) {
        continue;
      }

      const formattedDate = dateObj.toISOString().split('T')[0];
      const invoiceVal = invoiceColIdx !== undefined ? extractStringValue(row.getCell(invoiceColIdx).value) : '';

      const expansions = configSchema.expansions || [];
      for (const exp of expansions) {
        const amount = getNum(values[exp.col_index]);
        if (amount <= 0) continue;

        transactions.push({
          date: dateObj,
          invoiceNumber: invoiceVal ? `${invoiceVal}-${exp.coa_id.slice(0, 4)}` : `AUTO-${formattedDate}-${exp.coa_id.slice(0, 4)}`,
          category: exp.default_particulars,
          description: exp.default_particulars,
          amount,
          type: exp.type,
          vendor: exp.default_vendor,
          branchId,
          coaId: exp.coa_id
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push({
        row: r,
        invoiceNumber: `ERR-ROW-${r}`,
        error: errorMessage,
      });
    }
  }

  return {
    sheetName: worksheet.name,
    transactions,
    errors,
  };
}

/**
 * Universal dynamic sheet parser for stock items (inventory).
 */
export async function parseDynamicInventorySheet(
  worksheet: ExcelJS.Worksheet,
  templateName: string,
  configSchema: ParserConfigSchema,
  branchId?: string
): Promise<SheetParsingResult> {
  logger.info({ sheetName: worksheet.name, templateName, totalRows: worksheet.rowCount }, 'Parsing inventory worksheet dynamically using template schema');

  const godownStockItems: GodownStockItem[] = [];
  const errors: ParsingError[] = [];
  const startRow = configSchema.data_start_row || 2;
  const cols = configSchema.columns || {};

  let defaultDate = new Date();
  for (let r = 1; r < startRow; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) {
      const val = row.getCell(c).value;
      if (typeof val === 'string') {
        const match = val.match(/date:\s*([\d./-]+)/i);
        if (match) {
          try {
            defaultDate = parseDateValue(match[1]);
          } catch (e) {}
        }
      }
    }
  }

  for (let r = startRow; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row.values || (row.values as any[]).length === 0) continue;

    const itemNameCol = cols.itemName?.col_idx;
    if (!itemNameCol) continue;

    const itemName = extractStringValue(row.getCell(itemNameCol).value).trim();
    if (!itemName || itemName.toLowerCase().includes('total') || itemName.toLowerCase().includes('grand')) {
      continue;
    }

    try {
      const itemCode = cols.itemCode ? extractStringValue(row.getCell(cols.itemCode.col_idx).value).trim() || null : null;
      const category = cols.category ? extractStringValue(row.getCell(cols.category.col_idx).value).trim() || 'General' : 'General';
      const unitOfMeasure = cols.unitOfMeasure ? extractStringValue(row.getCell(cols.unitOfMeasure.col_idx).value).trim() || 'units' : 'units';
      const specification = cols.specification ? extractStringValue(row.getCell(cols.specification.col_idx).value).trim() || null : null;
      const location = cols.location ? extractStringValue(row.getCell(cols.location.col_idx).value).trim() || 'main' : 'main';

      const openingStock = cols.openingStock ? getNum(row.getCell(cols.openingStock.col_idx).value) : 0;
      const stockIn = cols.stockIn ? getNum(row.getCell(cols.stockIn.col_idx).value) : 0;
      const stockOut = cols.stockOut ? getNum(row.getCell(cols.stockOut.col_idx).value) : 0;
      const closingStock = cols.closingStock ? getNum(row.getCell(cols.closingStock.col_idx).value) : 0;

      const costPrice = cols.costPrice ? getNum(row.getCell(cols.costPrice.col_idx).value) : null;
      const sellingPrice = cols.sellingPrice ? getNum(row.getCell(cols.sellingPrice.col_idx).value) : null;

      const totalCostValue = costPrice !== null ? openingStock * costPrice : null;
      const totalSellValue = sellingPrice !== null ? closingStock * sellingPrice : null;

      const snapshotDate = cols.snapshotDate ? parseDateValue(row.getCell(cols.snapshotDate.col_idx).value) : defaultDate;

      godownStockItems.push({
        snapshotDate,
        sheetName: worksheet.name,
        itemName,
        itemCode,
        category,
        bottleSizeMl: 0,
        unitOfMeasure,
        specification,
        openingStock,
        stockIn,
        stockOut,
        closingStock,
        costPrice,
        sellingPrice,
        totalCostValue,
        totalSellValue,
        quantity: closingStock,
        unitPrice: sellingPrice || costPrice || 0,
        totalValue: totalSellValue || totalCostValue || 0,
        location,
        metadata: {}
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push({
        row: r,
        invoiceNumber: `ERR-ROW-${r}`,
        error: errorMessage
      });
    }
  }

  return {
    sheetName: worksheet.name,
    transactions: [],
    errors,
    godownStockItems
  };
}

/**
 * Universal dynamic workbook parser for receivables/debtors outstanding ledgers.
 */
export async function parseDynamicReceivablesWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string,
  templateId: string,
  entityId: string,
  configSchema: ParserConfigSchema,
  branchId?: string
): Promise<ExcelParsingResult | null> {
  const breakupConfig = configSchema.breakup;
  const entrylistConfig = configSchema.entrylist;

  if (!breakupConfig || !entrylistConfig) {
    throw new Error('Receivables configuration requires breakup and entrylist sheet mappings.');
  }

  const breakupSheetName = breakupConfig.sheet_name.toLowerCase().replace(/\s/g, '');
  const entrylistSheetName = entrylistConfig.sheet_name.toLowerCase().replace(/\s/g, '');

  const breakupSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === breakupSheetName);
  const entrylistSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === entrylistSheetName);

  if (!breakupSheet || !entrylistSheet) {
    logger.warn({ breakupSheetName, entrylistSheetName }, 'Receivables workbook missing configured worksheets');
    return null;
  }

  const debitors: DebitorSummary[] = [];
  const errors: ParsingError[] = [];
  const transactions: Transaction[] = [];

  // 1. Parse Breakup sheet (Summary of outstanding debt)
  const breakupStart = breakupConfig.data_start_row || 2;
  const bCols = breakupConfig.columns;
  let breakupSumDebit = 0;
  let breakupSumCredit = 0;
  let breakupSumPending = 0;

  for (let r = breakupStart; r <= breakupSheet.rowCount; r++) {
    const row = breakupSheet.getRow(r);
    if (!row.values || (row.values as any[]).length === 0) continue;

    const name = extractStringValue(row.getCell(bCols.partyName.col_idx).value).trim();
    if (!name || name.toLowerCase().includes('total') || name.toLowerCase().includes('grand') || name.toLowerCase() === 'name') {
      continue;
    }

    const debit = bCols.debit ? getNum(row.getCell(bCols.debit.col_idx).value) : 0;
    const credit = bCols.credit ? getNum(row.getCell(bCols.credit.col_idx).value) : 0;
    const pending = bCols.pending ? getNum(row.getCell(bCols.pending.col_idx).value) : 0;

    breakupSumDebit += debit;
    breakupSumCredit += credit;
    breakupSumPending += pending;

    debitors.push({ name, debit, credit, pending });
  }

  // 2. Parse EntryList (Detailed debtor transaction lines)
  const entryStart = entrylistConfig.data_start_row || 2;
  const eCols = entrylistConfig.columns;

  for (let r = entryStart; r <= entrylistSheet.rowCount; r++) {
    const row = entrylistSheet.getRow(r);
    if (!row.values || (row.values as any[]).length === 0) continue;

    const name = extractStringValue(row.getCell(eCols.partyName.col_idx).value).trim();
    if (!name || name.toLowerCase().includes('total') || name.toLowerCase().includes('grand') || name.toLowerCase().includes('date')) {
      continue;
    }

    try {
      const dateCell = row.getCell(eCols.date.col_idx).value;
      const dateObj = parseDateValue(dateCell);
      const formattedDate = dateObj.toISOString().split('T')[0];

      const debit = eCols.debit ? getNum(row.getCell(eCols.debit.col_idx).value) : 0;
      const credit = eCols.credit ? getNum(row.getCell(eCols.credit.col_idx).value) : 0;

      if (debit > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `UD-DB-${r}`,
          category: 'Credit Extended',
          description: `Credit Extended to "${name}"`,
          amount: debit,
          type: 'debit',
          vendor: name,
          branchId
        });
      }

      if (credit > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `UD-CR-${r}`,
          category: 'Credit Recovery',
          description: `Credit Recovery from "${name}"`,
          amount: credit,
          type: 'credit',
          vendor: name,
          branchId
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push({
        row: r,
        invoiceNumber: `UD-ERR-ROW-${r}`,
        error: errorMessage
      });
    }
  }

  return {
    fileName,
    isDebitorsList: true,
    templateId,
    entityId,
    sheets: [
      {
        sheetName: entrylistSheet.name,
        transactions,
        errors,
        debitors
      }
    ]
  };
}

/**
 * High-level router that parses an entire workbook dynamically based on the matched template's schema category.
 */
export async function parseDynamicWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string,
  templateId: string,
  entityId: string,
  configSchema: ParserConfigSchema,
  branchId?: string
): Promise<ExcelParsingResult | null> {
  const fileCategory = configSchema.file_category || 'sales';
  
  if (fileCategory === 'receivables') {
    return parseDynamicReceivablesWorkbook(workbook, fileName, templateId, entityId, configSchema, branchId);
  }

  const sheets: SheetParsingResult[] = [];
  for (const sheet of workbook.worksheets) {
    if (fileCategory === 'inventory') {
      const parsed = await parseDynamicInventorySheet(sheet, fileName, configSchema, branchId);
      if (parsed.godownStockItems && parsed.godownStockItems.length > 0) {
        sheets.push(parsed);
      }
    } else {
      const headerRow = configSchema.header_row_index || 3;
      if (sheet.rowCount < headerRow) continue;
      
      const parsed = await parseDynamicSalesSheet(sheet, fileName, configSchema, branchId);
      if (parsed.transactions.length > 0) {
        sheets.push(parsed);
      }
    }
  }

  if (sheets.length === 0) return null;

  return {
    fileName,
    sheets,
    templateId,
    entityId,
    isGodownStockList: fileCategory === 'inventory'
  };
}
