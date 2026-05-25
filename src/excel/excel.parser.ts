import ExcelJS from 'exceljs';
import { ExcelParsingResult, SheetParsingResult } from '../types/accounting.types.js';
import { extractStringValue } from './excel.mapper.js';
import { parseDebitorsWorkbook } from './parsers/debitors.parser.js';
import { parseHotelGauravSheet, parseStandardSheet } from './parsers/sales.parser.js';
import { logger } from '../logger/logger.js';

// =========================================================================
// 🚀 RUNTIME MONKEY PATCH: Bypass ExcelJS "History" tab name protection bug
// =========================================================================
try {
  const dummyWorkbook = new ExcelJS.Workbook();
  const dummySheet = dummyWorkbook.addWorksheet('dummy_temp_patch');
  const WorksheetClass = dummySheet.constructor;
  const descriptor = Object.getOwnPropertyDescriptor(WorksheetClass.prototype, 'name');
  if (descriptor && descriptor.set) {
    const originalSet = descriptor.set;
    descriptor.set = function (name: any) {
      if (name === 'History') {
        logger.info('Detected ExcelJS protected tab name "History". Safely renaming in-memory to "History_" to bypass crash.');
        name = 'History_';
      }
      originalSet.call(this, name);
    };
    Object.defineProperty(WorksheetClass.prototype, 'name', descriptor);
  }
} catch (err) {
  logger.warn({ err }, 'Failed to apply ExcelJS "History" patch. Proceeding with caution.');
}

export class ExcelParser {
  /**
   * Parses an Excel file buffer, auto-detecting types and delegating to specialized module parsers.
   */
  async parseBuffer(buffer: Buffer, fileName: string): Promise<ExcelParsingResult> {
    logger.info({ fileName, sizeBytes: buffer.length }, 'Parsing Excel buffer');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    // 1. Signature-based check for Outstanding Debitors Workbook
    const hasEntryList = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'entrylist');
    const hasBreakup = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'breakup');

    if (hasEntryList && hasBreakup) {
      return parseDebitorsWorkbook(workbook, fileName);
    }

    const matchingHotelGauravSheets: ExcelJS.Worksheet[] = [];

    // 2. Signature-based check for Hotel Gaurav specialized Multi-Month format
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount < 3) continue;

      const row1Val = extractStringValue(sheet.getRow(1).getCell(1).value).toLowerCase();
      const row3_col4 = extractStringValue(sheet.getRow(3).getCell(4).value).toLowerCase();
      const row3_col5 = extractStringValue(sheet.getRow(3).getCell(5).value).toLowerCase();
      const row3_col6 = extractStringValue(sheet.getRow(3).getCell(6).value).toLowerCase();

      const hasHotelName = row1Val.includes('hotel gaurav');
      const hasDailySalesHeaders = 
        row3_col6.includes('udhari jama') && 
        (row3_col4.includes('liquor') || row3_col4.includes('wine') || row3_col5.includes('food') || row3_col4.includes('sale'));

      if (hasHotelName && hasDailySalesHeaders) {
        matchingHotelGauravSheets.push(sheet);
      }
    }

    const sheets: SheetParsingResult[] = [];

    if (matchingHotelGauravSheets.length > 0) {
      logger.info({ count: matchingHotelGauravSheets.length }, 'Detected Hotel Gaurav monthly/yearly sheets to parse.');
      for (const sheet of matchingHotelGauravSheets) {
        const parsed = parseHotelGauravSheet(sheet, fileName);
        sheets.push(parsed);
      }
      return {
        fileName,
        sheets,
      };
    }

    // 3. Fallback: Parse as generic standard format (parse the first sheet)
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error(`The Excel file '${fileName}' contains no worksheets`);
    }

    const parsedStandard = parseStandardSheet(worksheet, fileName);
    return {
      fileName,
      sheets: [parsedStandard],
    };
  }
}

export const excelParser = new ExcelParser();
