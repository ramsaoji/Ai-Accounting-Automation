import ExcelJS from 'exceljs';
import path from 'path';
import { logger } from '../logger/logger.js';

async function inspectExcel() {
  const filePath = path.resolve(process.cwd(), 'data', 'input', 'Hotel Gaurav Daily Sales Register.xlsx');
  logger.info({ filePath }, 'Starting inspection of Hotel Gaurav Daily Sales Register...');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  logger.info({ sheetCount: workbook.worksheets.length }, 'Loaded workbook successfully');

  workbook.worksheets.forEach((sheet, idx) => {
    logger.info(`Worksheet #${idx + 1}: Name: "${sheet.name}", RowCount: ${sheet.rowCount}`);
    
    // Print first 5 rows to see headers and data
    const rowsToPrint = Math.min(sheet.rowCount, 10);
    logger.info(`Printing first ${rowsToPrint} rows for header analysis:`);
    
    for (let r = 1; r <= rowsToPrint; r++) {
      const row = sheet.getRow(r);
      const values: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        values.push(cell.value);
      });
      logger.info(`  Row ${r}: ${JSON.stringify(values)}`);
    }
  });
}

inspectExcel().catch(err => {
  logger.error({ err }, 'Error during excel inspection');
});
