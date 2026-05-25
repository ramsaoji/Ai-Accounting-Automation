import ExcelJS from 'exceljs';
import { ExcelParsingResult, SheetParsingResult, ParsingError, Transaction, DebitorSummary } from '../types/accounting.types.js';
import { buildHeaderMap, mapRowToTransaction, extractStringValue } from './excel.mapper.js';
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
   * Parses an Excel file buffer, detecting and extracting ALL matching worksheets.
   */
  async parseBuffer(buffer: Buffer, fileName: string): Promise<ExcelParsingResult> {
    logger.info({ fileName, sizeBytes: buffer.length }, 'Parsing Excel buffer');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    // Auto-detect Debitors List workbook based on worksheet names
    const hasEntryList = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'entrylist');
    const hasBreakup = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'breakup');

    if (hasEntryList && hasBreakup) {
      return this.parseDebitorsWorkbook(workbook, fileName);
    }

    const matchingHotelGauravSheets: ExcelJS.Worksheet[] = [];

    // Identify all sheets matching the Hotel Gaurav format signature
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount < 3) continue;

      const row1Val = extractStringValue(sheet.getRow(1).getCell(1).value).toLowerCase();
      const row3_col4 = extractStringValue(sheet.getRow(3).getCell(4).value).toLowerCase(); // Column 4: Liquor Sale
      const row3_col5 = extractStringValue(sheet.getRow(3).getCell(5).value).toLowerCase(); // Column 5: Food Sale
      const row3_col6 = extractStringValue(sheet.getRow(3).getCell(6).value).toLowerCase(); // Column 6: Udhari Jama

      const hasHotelName = row1Val.includes('hotel gaurav');
      const hasDailySalesHeaders = 
        row3_col6.includes('udhari jama') && 
        (row3_col4.includes('liquor') || row3_col4.includes('wine') || row3_col5.includes('food') || row3_col4.includes('sale'));

      if (hasHotelName && hasDailySalesHeaders) {
        matchingHotelGauravSheets.push(sheet);
      }
    }

    const sheets: SheetParsingResult[] = [];

    // Case 1: specialized Hotel Gaurav daily register worksheets detected
    if (matchingHotelGauravSheets.length > 0) {
      logger.info({ count: matchingHotelGauravSheets.length }, 'Detected Hotel Gaurav monthly/yearly sheets to parse.');
      for (const sheet of matchingHotelGauravSheets) {
        const parsed = this.parseHotelGauravSheet(sheet, fileName);
        sheets.push(parsed);
      }
      return {
        fileName,
        sheets,
      };
    }

    // Case 2: standard ledger fallback (parse first sheet)
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error(`The Excel file '${fileName}' contains no worksheets`);
    }

    const parsedStandard = this.parseStandardSheet(worksheet, fileName);
    return {
      fileName,
      sheets: [parsedStandard],
    };
  }

  /**
   * Specialized parsing for the Debitors list sheets (Breakup and EntryList)
   */
  private parseDebitorsWorkbook(workbook: ExcelJS.Workbook, fileName: string): ExcelParsingResult {
    logger.info({ fileName }, 'Routing to specialized Debitors List Workbook parser');

    const entryListSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === 'entrylist')!;
    const breakupSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === 'breakup')!;

    const debitors: DebitorSummary[] = [];

    // Helper to extract values or formula results safely
    const getNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'object' && 'result' in val) {
        return Number(val.result) || 0;
      }
      return Number(val) || 0;
    };

    // 1. Parse Breakup sheet (Summary of outstanding debt)
    // Row 1: NAME, Debit, Credit, Total Pending
    for (let r = 2; r <= breakupSheet.rowCount; r++) {
      const row = breakupSheet.getRow(r);
      const values = row.values as any[];
      if (!values || values.length === 0) continue;

      const name = extractStringValue(row.getCell(1).value).trim();
      if (!name || name.toLowerCase() === 'name' || name.toLowerCase().includes('total') || name.toLowerCase().includes('recovery') || name.toLowerCase().includes('actual') || name.toLowerCase().includes('bhau')) {
        continue;
      }

      const debit = getNum(row.getCell(2).value);
      const credit = getNum(row.getCell(3).value);
      const pending = getNum(row.getCell(4).value);

      if (debit > 0 || credit > 0 || pending !== 0) {
        debitors.push({
          name,
          debit,
          credit,
          pending
        });
      }
    }

    // 2. Parse EntryList (Detailed debtor transaction lines)
    const transactions: Transaction[] = [];
    const errors: ParsingError[] = [];

    // Row 5 onwards contain actual entries: serial, name, date, debit, credit
    for (let r = 5; r <= entryListSheet.rowCount; r++) {
      const row = entryListSheet.getRow(r);
      const values = row.values as any[];
      if (!values || values.length === 0) continue;

      const name = extractStringValue(row.getCell(2).value).trim();
      const rawDate = row.getCell(3).value;

      if (!name || !rawDate) continue;

      const dateStr = extractStringValue(rawDate).trim();
      if (dateStr.toLowerCase().includes('total') || dateStr.toLowerCase().includes('grand') || dateStr.toLowerCase().includes('date')) {
        continue;
      }

      try {
        const debit = getNum(row.getCell(4).value);
        const credit = getNum(row.getCell(5).value);

        if (debit === 0 && credit === 0) continue;

        // Parse date from DD.MM.YYYY
        let dateObj = new Date();
        const dateParts = dateStr.split('.');
        if (dateParts.length === 3) {
          const d = parseInt(dateParts[0], 10);
          const m = parseInt(dateParts[1], 10);
          const y = parseInt(dateParts[2], 10);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            dateObj = new Date(y, m - 1, d);
          }
        } else {
          const standardDate = new Date(dateStr);
          if (!isNaN(standardDate.getTime())) {
            dateObj = standardDate;
          }
        }

        const formattedDate = dateObj.toISOString().split('T')[0];

        // Map outstanding debit as outflow (udhari given) and payments received as inflow (repayed credit)
        if (debit > 0) {
          transactions.push({
            date: dateObj,
            invoiceNumber: `UD-DB-${r}`,
            category: 'Credit Extended',
            description: `Udhari Extended to customer "${name}"`,
            amount: debit,
            type: 'debit',
            vendor: name
          });
        }

        if (credit > 0) {
          transactions.push({
            date: dateObj,
            invoiceNumber: `UD-CR-${r}`,
            category: 'Credit Recovery',
            description: `Outstanding payment collected from customer "${name}"`,
            amount: credit,
            type: 'credit',
            vendor: name
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

    logger.info({
      fileName,
      parsedDebitorsCount: debitors.length,
      parsedTransactionsCount: transactions.length,
      errorsCount: errors.length
    }, 'Completed specialized Debitors List parsing');

    return {
      fileName,
      isDebitorsList: true,
      sheets: [
        {
          sheetName: 'EntryList',
          transactions,
          errors,
          debitors
        }
      ]
    };
  }

  /**
   * Specialized daily register parser for Hotel Gaurav format
   */
  private parseHotelGauravSheet(worksheet: ExcelJS.Worksheet, fileName: string): SheetParsingResult {
    logger.info({ sheetName: worksheet.name, totalRows: worksheet.rowCount }, 'Specialized parsing for Hotel Gaurav Daily Sales Register');
    
    const transactions: Transaction[] = [];
    const errors: ParsingError[] = [];

    // Header row is Row 3. Data starts at Row 4
    for (let r = 4; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const values = row.values as ExcelJS.CellValue[];
      if (!values) continue;

      const srNo = values[1];
      const rawDate = values[2];
      
      // If SrNo is empty or Date is empty, skip
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

        // Skip dry days or empty rows
        if (liquorSale === 0 && foodSale === 0 && udhariJama === 0 && udhariGiven === 0 && expenses === 0) {
          continue;
        }

        const dateObj = new Date(dateStr);
        const formattedDate = isNaN(dateObj.getTime()) ? dateStr : dateObj.toISOString().split('T')[0];

        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }

        // 1. Liquor Sale (Credit / Inflow)
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

        // 2. Food Sale (Credit / Inflow)
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

        // 3. Udhari Jama (Credit Recovery)
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

        // 4. Expenses (Debit / Outflow)
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

        // 5. Udhari Given (Credit Extended)
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

  /**
   * Standard generic ledger spreadsheet parsing logic
   */
  private parseStandardSheet(worksheet: ExcelJS.Worksheet, fileName: string): SheetParsingResult {
    logger.info({ sheetName: worksheet.name, totalRows: worksheet.rowCount }, 'Parsing worksheet with standard ledger schema');

    const transactions: Transaction[] = [];
    const errors: ParsingError[] = [];
    
    let headerRowIndex = -1;
    let headerMap = new Map<string, number>();

    // Identify the header row
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

    // Fallback: assume Row 1 headers if auto-detect fails
    if (headerRowIndex === -1) {
      logger.warn('Could not auto-detect accounting headers. Falling back to row 1 as header row');
      headerRowIndex = 1;
      const firstRowValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
      if (firstRowValues) {
        headerMap = buildHeaderMap(firstRowValues);
      }
    }

    // Parse data rows
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
}

export const excelParser = new ExcelParser();
