import ExcelJS from 'exceljs';
import { ExcelParsingResult, ParsingError, Transaction, DebitorSummary } from '../../types/accounting.types.js';
import { extractStringValue } from '../excel.mapper.js';
import { logger } from '../../logger/logger.js';

export function parseDebitorsWorkbook(workbook: ExcelJS.Workbook, fileName: string): ExcelParsingResult {
  logger.info({ fileName }, 'Routing to specialized Debitors List Workbook parser');

  const entryListSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === 'entrylist')!;
  const breakupSheet = workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === 'breakup')!;

  const debitors: DebitorSummary[] = [];

  const getNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'object' && 'result' in val) {
      return Number(val.result) || 0;
    }
    return Number(val) || 0;
  };

  // 1. Parse Breakup sheet (Summary of outstanding debt)
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
