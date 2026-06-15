import ExcelJS from 'exceljs';
import { ExcelParsingResult } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';
import { db } from '../db/db.client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { parseDynamicWorkbook, ParserConfigSchema } from './parsers/dynamic.parser.js';
import fs from 'fs';

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
   * Parses an Excel file buffer or path, matching against database-defined template configurations.
   */
  async parseBuffer(buffer: Buffer | string, fileName: string, entityId?: string): Promise<ExcelParsingResult> {
    const isPath = typeof buffer === 'string';
    const sizeBytes = isPath ? (await fs.promises.stat(buffer)).size : buffer.length;
    logger.info({ fileName, sizeBytes, entityId, isPath }, 'Parsing Excel resource');

    // Resolve active business entity context
    let activeEntity: typeof schema.businessEntities.$inferSelect | undefined;
    try {
      if (entityId) {
        activeEntity = await db.select().from(schema.businessEntities).where(eq(schema.businessEntities.id, entityId)).limit(1).then(r => r[0]);
      } else {
        // Fallback: get the first business entity in the database
        activeEntity = await db.select().from(schema.businessEntities).limit(1).then(r => r[0]);
      }
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Error fetching active business entity context');
    }

    const isHotelGaurav = activeEntity?.name === 'Hotel Gaurav';

    if (isHotelGaurav) {
      const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
      const isCounterStockFile = cleanFileName.toUpperCase().includes('COUNTER');
      const isGodownStockFile = !isCounterStockFile && (
        cleanFileName.toUpperCase().includes('GODWON') ||
        cleanFileName.toUpperCase().includes('GODOWN') ||
        cleanFileName.toUpperCase() === 'STOCK'
      );

      let gauravTemplateId: string | undefined;
      try {
        const gauravTemplate = await db.select().from(schema.parserTemplates).where(eq(schema.parserTemplates.templateName, 'Hotel Gaurav Daily Sales Template')).limit(1).then(r => r[0]);
        gauravTemplateId = gauravTemplate?.id;
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Error fetching Hotel Gaurav daily sales template context');
      }

      // Convert path to buffer for custom sub-parsers if needed
      const fileBuffer = isPath ? await fs.promises.readFile(buffer) : buffer;

      if (isCounterStockFile) {
        const { parseCounterStockWorkbookStreaming } = await import('./parsers/hotel-gaurav/counter.parser.js');
        const result = await parseCounterStockWorkbookStreaming(fileBuffer, fileName);
        return { ...result, entityId: activeEntity?.id };
      }

      if (isGodownStockFile) {
        const { parseGodownStockWorkbookStreaming } = await import('./parsers/hotel-gaurav/godown.parser.js');
        const result = await parseGodownStockWorkbookStreaming(fileBuffer, fileName);
        return { ...result, entityId: activeEntity?.id };
      }

      const workbook = new ExcelJS.Workbook();
      if (isPath) {
        await workbook.xlsx.readFile(buffer);
      } else {
        await workbook.xlsx.load(buffer as any);
      }

      const hasEntryList = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'entrylist');
      const hasBreakup = workbook.worksheets.some(s => s.name.toLowerCase().replace(/\s/g, '') === 'breakup');

      if (hasEntryList && hasBreakup) {
        const { parseDebitorsWorkbook } = await import('./parsers/hotel-gaurav/debitors.parser.js');
        const result = await parseDebitorsWorkbook(workbook, fileName);
        return { ...result, entityId: activeEntity?.id };
      }

      const { extractStringValue } = await import('./excel.mapper.js');
      const { parseHotelGauravSheet } = await import('./parsers/hotel-gaurav/sales.parser.js');
      const matchingHotelGauravSheets: ExcelJS.Worksheet[] = [];

      for (const sheet of workbook.worksheets) {
        if (sheet.rowCount < 3) continue;

        const row1Val = extractStringValue(sheet.getRow(1).getCell(1).value).toLowerCase();
        const row3_col4 = extractStringValue(sheet.getRow(3).getCell(4).value).toLowerCase();
        const row3_col5 = extractStringValue(sheet.getRow(3).getCell(5).value).toLowerCase();
        const row3_col6 = extractStringValue(sheet.getRow(3).getCell(6).value).toLowerCase();

        const hasHotelName = row1Val.includes('gaurav');
        const hasDailySalesHeaders = 
          row3_col6.includes('udhari jama') && 
          (row3_col4.includes('liquor') || row3_col4.includes('wine') || row3_col5.includes('food') || row3_col4.includes('sale'));

        if (hasHotelName && hasDailySalesHeaders) {
          matchingHotelGauravSheets.push(sheet);
        }
      }

      if (matchingHotelGauravSheets.length > 0) {
        logger.info({ count: matchingHotelGauravSheets.length }, 'Detected Hotel Gaurav monthly/yearly sheets to parse.');
        const sheets: any[] = [];
        for (const sheet of matchingHotelGauravSheets) {
          const parsed = await parseHotelGauravSheet(sheet, fileName);
          sheets.push(parsed);
        }
        return {
          fileName,
          sheets,
          entityId: activeEntity?.id,
          templateId: gauravTemplateId
        };
      }
    }

    const workbook = new ExcelJS.Workbook();
    if (isPath) {
      await workbook.xlsx.readFile(buffer);
    } else {
      await workbook.xlsx.load(buffer as any);
    }

    // 1. Dynamic DB Template Ingestion (Multi-Tenant SaaS)
    try {
      const dbTemplates = await db.select().from(schema.parserTemplates);
      for (const dbTemplate of dbTemplates) {
        const mappingSchema = dbTemplate.mappingSchema as ParserConfigSchema;
        const matchedResult = await parseDynamicWorkbook(
          workbook,
          fileName,
          dbTemplate.id,
          dbTemplate.entityId,
          mappingSchema
        );
        if (matchedResult) {
          logger.info({ templateName: dbTemplate.templateName, fileCategory: mappingSchema.file_category }, 'Successfully matched spreadsheet to database parser template.');
          return matchedResult;
        }
      }
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Database parser template lookup failed.');
    }

    // 2. Fallback: Parse the first worksheet as a generic transactions sheet
    logger.warn({ fileName }, 'No database parser template matched. Falling back to generic single-sheet transaction parser.');
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error(`The Excel file '${fileName}' contains no worksheets`);
    }

    const { parseDynamicSalesSheet } = await import('./parsers/dynamic.parser.js');
    const defaultFallbackSchema: ParserConfigSchema = {
      data_start_row: 2,
      columns: {
        date: { col_idx: 1, type: 'string' },
        invoice: { col_idx: 2, type: 'string' }
      },
      expansions: []
    };

    // Auto-detect numeric columns in fallback row
    if (worksheet.rowCount >= 2) {
      const row = worksheet.getRow(2);
      for (let c = 3; c <= Math.min(row.cellCount, 15); c++) {
        const cellVal = row.getCell(c).value;
        if (cellVal !== null && cellVal !== undefined) {
          defaultFallbackSchema.expansions?.push({
            col_index: c,
            type: 'credit',
            coa_id: 'fallback-coa',
            default_vendor: 'Counter',
            default_particulars: `Column ${c} Inflow`
          });
        }
      }
    }

    const parsedSheet = await parseDynamicSalesSheet(worksheet, 'Generic Sales', defaultFallbackSchema);
    return {
      fileName,
      sheets: [parsedSheet]
    };
  }
}

export const excelParser = new ExcelParser();
