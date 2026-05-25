import ExcelJS from 'exceljs';
import { SheetParsingResult, ParsingError, Transaction } from '../../types/accounting.types.js';
import { buildHeaderMap, mapRowToTransaction, extractStringValue } from '../excel.mapper.js';
import { logger } from '../../logger/logger.js';

export function parseHotelGauravSheet(worksheet: ExcelJS.Worksheet, fileName: string): SheetParsingResult {
  logger.info({ sheetName: worksheet.name, totalRows: worksheet.rowCount }, 'Specialized parsing for Hotel Gaurav Daily Sales Register');
  
  const transactions: Transaction[] = [];
  const errors: ParsingError[] = [];

  for (let r = 4; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const values = row.values as ExcelJS.CellValue[];
    if (!values) continue;

    const srNo = values[1];
    const rawDate = values[2];
    
    if (!srNo || !rawDate) continue;

    const dateStr = extractStringValue(rawDate);
    if (!dateStr || dateStr.toLowerCase().includes('total') || dateStr.toLowerCase().includes('grand')) {
      continue;
    }

    const getNum = (idx: number): number => {
      const val = values[idx];
      if (val === null || val === undefined) return 0;
      if (typeof val === 'object' && 'result' in val) {
        return Number(val.result) || 0;
      }
      return Number(val) || 0;
    };

    try {
      const liquorSale = getNum(4);
      const foodSale = getNum(5);
      const udhariJama = getNum(6); // Credit Recovery
      const udhariGiven = getNum(8); // Credit Extended
      const expenses = getNum(10); // Operational Expenses

      if (liquorSale === 0 && foodSale === 0 && udhariJama === 0 && udhariGiven === 0 && expenses === 0) {
        continue;
      }

      const dateObj = new Date(dateStr);
      const formattedDate = isNaN(dateObj.getTime()) ? dateStr : dateObj.toISOString().split('T')[0];

      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }

      if (liquorSale > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `LQ-${formattedDate}`,
          category: 'Liquor Revenue',
          description: 'Daily Counter Liquor Sales',
          amount: liquorSale,
          type: 'credit',
          vendor: 'Bar Counter',
        });
      }

      if (foodSale > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `FD-${formattedDate}`,
          category: 'Food Revenue',
          description: 'Daily Restaurant Food Sales',
          amount: foodSale,
          type: 'credit',
          vendor: 'Restaurant Counter',
        });
      }

      if (udhariJama > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `UJ-${formattedDate}`,
          category: 'Credit Recovery',
          description: 'Outstanding customer dues recovered (Udhari Jama)',
          amount: udhariJama,
          type: 'credit',
          vendor: 'Customer Debtors',
        });
      }

      if (expenses > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `EX-${formattedDate}`,
          category: 'Operational Expense',
          description: 'Daily operational purchases and wages',
          amount: expenses,
          type: 'debit',
          vendor: 'Supplier Vendors',
        });
      }

      if (udhariGiven > 0) {
        transactions.push({
          date: dateObj,
          invoiceNumber: `UG-${formattedDate}`,
          category: 'Credit Extended',
          description: 'Meals and beverages served on credit (Udhari Given)',
          amount: udhariGiven,
          type: 'debit',
          vendor: 'Customer Debtors',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ row: r, error: errorMessage }, 'Hotel Gaurav daily row parsing failed');
      errors.push({
        row: r,
        invoiceNumber: `ERR-ROW-${r}`,
        error: errorMessage,
      });
    }
  }

  logger.info(
    { 
      fileName, 
      sheetName: worksheet.name,
      successfullyParsed: transactions.length, 
      failedRows: errors.length 
    }, 
    'Completed specialized Hotel Gaurav parsing'
  );

  return {
    sheetName: worksheet.name,
    transactions,
    errors,
  };
}

export function parseStandardSheet(worksheet: ExcelJS.Worksheet, fileName: string): SheetParsingResult {
  logger.info({ sheetName: worksheet.name, totalRows: worksheet.rowCount }, 'Parsing worksheet with standard ledger schema');

  const transactions: Transaction[] = [];
  const errors: ParsingError[] = [];
  
  let headerRowIndex = -1;
  let headerMap = new Map<string, number>();

  for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
    const row = worksheet.getRow(r);
    const values = row.values as ExcelJS.CellValue[];
    if (!values) continue;

    const potentialMap = buildHeaderMap(values);
    const criticalMatches = ['date', 'amount', 'vendor', 'invoiceNumber'].filter(h => potentialMap.has(h));
    
    if (criticalMatches.length >= 3) {
      headerRowIndex = r;
      headerMap = potentialMap;
      logger.info(
        { rowIndex: r, matches: criticalMatches, matchedHeaders: Array.from(headerMap.keys()) }, 
        'Detected header row successfully'
      );
      break;
    }
  }

  if (headerRowIndex === -1) {
    logger.warn('Could not auto-detect accounting headers. Falling back to row 1 as header row');
    headerRowIndex = 1;
    const firstRowValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
    if (firstRowValues) {
      headerMap = buildHeaderMap(firstRowValues);
    }
  }

  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const values = row.values as ExcelJS.CellValue[];

    if (!values || values.length === 0 || values.every(v => v === null || v === undefined || v === '')) {
      continue;
    }

    try {
      const transaction = mapRowToTransaction(values, headerMap);
      transactions.push(transaction);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      let invoiceNumber: string | undefined;
      const invoiceColIdx = headerMap.get('invoiceNumber');
      if (invoiceColIdx !== undefined && values[invoiceColIdx]) {
        invoiceNumber = extractStringValue(values[invoiceColIdx]);
      }

      logger.error({ row: r, invoiceNumber, error: errorMessage }, 'Row parsing validation failed');
      
      errors.push({
        row: r,
        invoiceNumber,
        error: errorMessage,
      });
    }
  }

  logger.info(
    { 
      fileName, 
      sheetName: worksheet.name,
      successfullyParsed: transactions.length, 
      failedRows: errors.length 
    }, 
    'Completed parsing standard Excel worksheet'
  );

  return {
    sheetName: worksheet.name,
    transactions,
    errors,
  };
}
