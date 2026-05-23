import ExcelJS from 'exceljs';
import { ExcelParsingResult, ParsingError, Transaction } from '../types/accounting.types.js';
import { buildHeaderMap, mapRowToTransaction, extractStringValue } from './excel.mapper.js';
import { logger } from '../logger/logger.js';

export class ExcelParser {
  /**
   * Parses an Excel file buffer into structured transactions and errors.
   */
  async parseBuffer(buffer: Buffer, fileName: string): Promise<ExcelParsingResult> {
    logger.info({ fileName, sizeBytes: buffer.length }, 'Parsing Excel buffer');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    // Default to the first worksheet in the workbook
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error(`The Excel file '${fileName}' contains no worksheets`);
    }

    logger.info({ sheetName: worksheet.name, totalRows: worksheet.rowCount }, 'Parsing worksheet');

    const transactions: Transaction[] = [];
    const errors: ParsingError[] = [];
    
    let headerRowIndex = -1;
    let headerMap = new Map<string, number>();

    // 1. Identify the header row
    // We scan the first few rows (up to 10) to find one containing common headers like 'Date' or 'Amount'
    for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      const values = row.values as ExcelJS.CellValue[];
      if (!values) continue;

      const potentialMap = buildHeaderMap(values);
      // If we matched at least 3 critical headers, we treat this as the header row
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

    // Fallback: If no headers were auto-detected, assume Row 1 contains the headers
    if (headerRowIndex === -1) {
      logger.warn('Could not auto-detect accounting headers. Falling back to row 1 as header row');
      headerRowIndex = 1;
      const firstRowValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
      if (firstRowValues) {
        headerMap = buildHeaderMap(firstRowValues);
      }
    }

    // 2. Parse data rows starting after the header row
    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const values = row.values as ExcelJS.CellValue[];

      // Skip empty or near-empty rows
      if (!values || values.length === 0 || values.every(v => v === null || v === undefined || v === '')) {
        continue;
      }

      try {
        const transaction = mapRowToTransaction(values, headerMap);
        transactions.push(transaction);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Try to fetch invoice number for tracing, if possible
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
        successfullyParsed: transactions.length, 
        failedRows: errors.length 
      }, 
      'Completed parsing Excel buffer'
    );

    return {
      transactions,
      errors,
      fileName,
    };
  }
}
export const excelParser = new ExcelParser();
