import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { SheetParsingResult, ParsingError, GodownStockItem, ExcelParsingResult } from '../../types/accounting.types.js';
import { extractStringValue } from '../excel.mapper.js';
import { logger } from '../../logger/logger.js';
import { getHistoryRetentionDays } from '../../db/db.client.js';

/**
 * Normalizes product name to handle spelling inconsistencies.
 */
function normalizeProductName(name: string): string {
  if (!name) return '';
  let norm = name.trim().toUpperCase();
  norm = norm.replace(/\s+/g, ' ');
  norm = norm.replace('MAGIC MONENT', 'MAGIC MOMENT');
  norm = norm.replace('ORENGE', 'ORANGE');
  norm = norm.replace('BUDWIRE', 'BUDWEISER');
  norm = norm.replace('KING FISHER STRON BEER', 'KINGFISHER STRONG BEER');
  norm = norm.replace('KING FISHER STRON', 'KINGFISHER STRONG');
  norm = norm.replace('ROYAL CHALLANG', 'ROYAL CHALLENGE');
  norm = norm.replace('ROMANOV VODKA/APPLE', 'ROMANOV VODKA');
  norm = norm.replace('CARLBERG', 'CARLSBERG');
  norm = norm.replace('LEGECY', 'LEGACY');
  return norm;
}

/**
 * Safe numeric cell value extraction.
 */
function getNum(row: ExcelJS.Row, colIdx: number, fallbackValue = 0): number {
  const cell = row.getCell(colIdx);
  const val = cell.value;
  if (val === null || val === undefined) return fallbackValue;
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return Number(val.result) || fallbackValue;
    }
    return fallbackValue;
  }
  return Number(val) || fallbackValue;
}

/**
 * Searches for a "DATE:DD/MM/YYYY" format in a row's cells.
 */
function findDateInRow(row: ExcelJS.Row): Date | null {
  const values = row.values as ExcelJS.CellValue[];
  if (!values) return null;
  for (const val of values) {
    if (typeof val === 'string') {
      const match = val.match(/DATE:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed month
        const year = parseInt(match[3], 10);
        return new Date(year, month, day);
      }
    }
  }
  return null;
}

/**
 * Parses the pricing section at the bottom of the "Current" sheet.
 */
function parsePriceLookup(worksheet: any): Map<string, { costPrice: number; sellingPrice: number }> {
  const priceLookup = new Map<string, { costPrice: number; sellingPrice: number }>();

  let liquorPricingRow = -1;
  let beerPricingRow = -1;

  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const colB = extractStringValue(row.getCell(2).value).trim().toUpperCase();
    if (colB === 'LIQUOR NAME' && extractStringValue(row.getCell(9).value).trim().toUpperCase().includes('90 PR')) {
      liquorPricingRow = r;
    }
    if (colB === 'STRONG BEER' && extractStringValue(row.getCell(3).value).trim().toUpperCase().includes('330 ML')) {
      beerPricingRow = r;
    }
  }

  // Parse Liquor pricing
  if (liquorPricingRow !== -1) {
    const endRow = beerPricingRow !== -1 ? beerPricingRow - 1 : worksheet.rowCount;
    for (let r = liquorPricingRow + 1; r < endRow; r++) {
      const row = worksheet.getRow(r);
      const colB = extractStringValue(row.getCell(2).value).trim();
      const colA = extractStringValue(row.getCell(1).value).trim();
      if (!colB || colB.toUpperCase().includes('TOTAL') || colB.toUpperCase().includes('STOCK VALUE') || colA.toUpperCase().includes('SR')) {
        continue;
      }

      const normalizedName = normalizeProductName(colB);
      // Rates columns are: 90 PR/SR, 180 PR/SR, 375 PR/SR, 750 PR/SR, Loose PR/SR (5 sizes, 1000/2000 pricing is missing)
      const sizes = [90, 180, 375, 750, 0];
      const packagings = ['BOTTLE', 'BOTTLE', 'BOTTLE', 'BOTTLE', 'LOOSE'];

      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const packaging = packagings[i];
        const pr = getNum(row, 9 + i * 2);
        const sr = getNum(row, 10 + i * 2);
        if (pr > 0 || sr > 0) {
          const key = `${normalizedName}_${size}_${packaging}`;
          priceLookup.set(key, { costPrice: pr, sellingPrice: sr });
        }
      }
    }
  }

  // Parse Beer & Wine pricing
  if (beerPricingRow !== -1) {
    for (let r = beerPricingRow + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const colB = extractStringValue(row.getCell(2).value).trim();
      const colA = extractStringValue(row.getCell(1).value).trim();
      if (!colB || colB.toUpperCase().includes('TOTAL') || colB.toUpperCase().includes('STOCK VALUE') || colA.toUpperCase().includes('SR') || colA.toUpperCase().includes('NO')) {
        continue;
      }

      const normalizedName = normalizeProductName(colB);
      const isWine = normalizedName.includes('WINE');
      const sizes = isWine ? [180, 330, 650, 750] : [330, 330, 500, 650];
      const packagings = isWine ? ['BOTTLE', 'BOTTLE', 'BOTTLE', 'BOTTLE'] : ['BOTTLE', 'TIN', 'TIN', 'BOTTLE'];

      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const packaging = packagings[i];
        const pr = getNum(row, 7 + i * 2);
        const sr = getNum(row, 8 + i * 2);
        if (pr > 0 || sr > 0) {
          const key = `${normalizedName}_${size}_${packaging}`;
          priceLookup.set(key, { costPrice: pr, sellingPrice: sr });
        }
      }
    }
  }

  return priceLookup;
}

/**
 * Extracts all snapshot date block ranges within a sheet.
 */
function extractBlocks(worksheet: any): { date: Date; startRow: number; endRow: number }[] {
  const blocks: { date: Date; startRow: number; endRow: number }[] = [];
  let currentBlock: { date: Date; startRow: number; endRow: number } | null = null;

  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const date = findDateInRow(row);
    if (date) {
      if (currentBlock) {
        currentBlock.endRow = r - 1;
      }
      currentBlock = { date, startRow: r, endRow: worksheet.rowCount };
      blocks.push(currentBlock);
    }
  }
  return blocks;
}

/**
 * Parses items within a specific date block boundaries.
 */
function parseBlockRows(
  worksheet: any,
  startRow: number,
  endRow: number,
  blockDate: Date,
  sheetName: string,
  priceLookup: Map<string, { costPrice: number; sellingPrice: number }>
): { items: GodownStockItem[]; errors: ParsingError[] } {
  const items: GodownStockItem[] = [];
  const errors: ParsingError[] = [];
  let currentCategory = 'Liquor';

  for (let r = startRow; r <= endRow; r++) {
    const row = worksheet.getRow(r);
    const values = row.values as ExcelJS.CellValue[];
    if (!values) continue;

    const colA = extractStringValue(row.getCell(1).value).trim();
    const colB = extractStringValue(row.getCell(2).value).trim();

    if (!colB) continue;

    const colB_upper = colB.toUpperCase();
    if (colB_upper === 'STRONG BEER') {
      currentCategory = 'Strong Beer';
      continue;
    }
    if (colB_upper === 'MILD BEER') {
      currentCategory = 'Mild Beer';
      continue;
    }
    if (colB_upper === 'WINE') {
      currentCategory = 'Wine';
      continue;
    }

    if (
      colB_upper.includes('TOTAL') ||
      colB_upper.includes('STOCK VALUE') ||
      colB_upper === 'LIQUOR NAME' ||
      colA.toUpperCase().includes('SR') ||
      colA.toUpperCase().includes('NO')
    ) {
      continue;
    }

    let sizes: number[] = [];
    let packagings: string[] = [];

    if (currentCategory === 'Liquor') {
      sizes = [90, 180, 375, 750, 1000, 2000, 0];
      packagings = ['bottle', 'bottle', 'bottle', 'bottle', 'bottle', 'bottle', 'loose'];
    } else if (currentCategory === 'Strong Beer' || currentCategory === 'Mild Beer') {
      sizes = [330, 330, 500, 650];
      packagings = ['bottle', 'tin', 'tin', 'bottle'];
    } else if (currentCategory === 'Wine') {
      sizes = [180, 330, 650, 750];
      packagings = ['bottle', 'bottle', 'bottle', 'bottle'];
    }

    try {
      const normalizedName = normalizeProductName(colB);

      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const packaging = packagings[i];

        const colOpening = 3 + i;
        const colIn = size === 0 ? -1 : 11 + i; // Loose (size 0) has no In column
        const colClosing = 18 + i;
        const colSales = 26 + i;

        const openingStock = getNum(row, colOpening);
        const stockIn = colIn === -1 ? 0 : getNum(row, colIn);
        const closingStock = getNum(row, colClosing);
        const sales = getNum(row, colSales);

        if (openingStock === 0 && stockIn === 0 && closingStock === 0 && sales === 0) {
          continue;
        }

        const lookupKey = `${normalizedName}_${size}_${packaging.toUpperCase()}`;
        const prices = priceLookup.get(lookupKey);

        const costPrice = prices ? prices.costPrice : null;
        const sellingPrice = prices ? prices.sellingPrice : null;

        const totalCostValue = costPrice !== null ? closingStock * costPrice : null;
        const totalSellValue = sellingPrice !== null ? closingStock * sellingPrice : null;

        items.push({
          snapshotDate: blockDate,
          sheetName,
          itemName: colB,
          itemCode: null,
          category: currentCategory,
          bottleSizeMl: size,
          openingStock,
          stockIn,
          stockOut: sales, // Map Counter Sales → stock_out column database field
          closingStock,
          quantity: closingStock,
          unitPrice: sellingPrice ?? 0,
          totalValue: closingStock * (sellingPrice ?? 0),
          costPrice,
          sellingPrice,
          totalCostValue,
          totalSellValue,
          location: 'counter',
          metadata: size === 0 ? { packaging, unit: 'ml', isLoose: true } : { packaging }
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push({
        row: r,
        error: `Failed parsing item "${colB}" in category "${currentCategory}": ${errMsg}`
      });
    }
  }

  return { items, errors };
}

/**
 * Main parser entry point for Counter Stock Workbooks.
 */
export async function parseCounterStockWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<ExcelParsingResult> {
  logger.info({ fileName }, 'Counter Stock parsing initiated');

  const currentSheet = workbook.getWorksheet('Current');
  const historySheet = workbook.getWorksheet('History_') || workbook.getWorksheet('History');

  if (!currentSheet) {
    throw new Error('Malformed Counter Stock Workbook: Missing "Current" worksheet.');
  }

  // 1. Build pricing lookup from Current sheet first
  logger.info('Building pricing map from Current sheet...');
  const priceLookup = parsePriceLookup(currentSheet);
  logger.info({ priceCount: priceLookup.size }, 'Pricing map successfully established');

  const sheets: SheetParsingResult[] = [];

  // 2. Parse Current sheet snapshots
  logger.info('Parsing Current sheet snapshots...');
  const currentBlocks = extractBlocks(currentSheet);
  
  // Find where the pricing starts (usually row 121/122 in Current sheet)
  let currentEndRow = currentSheet.rowCount;
  for (let r = 1; r <= currentSheet.rowCount; r++) {
    const colB = extractStringValue(currentSheet.getRow(r).getCell(2).value).trim().toUpperCase();
    if (colB === 'ALL QUANTITY' || (colB === 'LIQUOR NAME' && r > 90)) {
      currentEndRow = r - 1;
      break;
    }
  }

  const currentStockItems: GodownStockItem[] = [];
  const currentErrors: ParsingError[] = [];

  for (const block of currentBlocks) {
    const actualEnd = Math.min(block.endRow, currentEndRow);
    const { items, errors } = parseBlockRows(currentSheet, block.startRow, actualEnd, block.date, 'Current', priceLookup);
    currentStockItems.push(...items);
    currentErrors.push(...errors);
  }

  sheets.push({
    sheetName: 'Current',
    transactions: [], // Not a financial ledger
    errors: currentErrors,
    godownStockItems: currentStockItems
  });

  // 3. Parse History sheet based on history retention settings table
  const historyDays = await getHistoryRetentionDays('godown_stock', 0); // Share godown retention setting
  logger.info({ historyDaysSetting: historyDays }, 'Stock history setting fetched for counter');

  if (historySheet && historyDays > 0) {
    logger.info('Scanning History sheet snapshot blocks...');
    const historyBlocks = extractBlocks(historySheet);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - historyDays);
    cutoffDate.setHours(0, 0, 0, 0);

    // Filter blocks within our retention window
    const eligibleBlocks = historyBlocks.filter(b => b.date >= cutoffDate);
    logger.info({ totalBlocks: historyBlocks.length, eligibleBlocksCount: eligibleBlocks.length, cutoffDate: cutoffDate.toISOString().split('T')[0] }, 'Historical blocks filtered');

    const historyStockItems: GodownStockItem[] = [];
    const historyErrors: ParsingError[] = [];

    for (const block of eligibleBlocks) {
      const { items, errors } = parseBlockRows(historySheet, block.startRow, block.endRow, block.date, 'History', priceLookup);
      historyStockItems.push(...items);
      historyErrors.push(...errors);
    }

    sheets.push({
      sheetName: 'History',
      transactions: [],
      errors: historyErrors,
      godownStockItems: historyStockItems
    });
  } else {
    logger.info('Skipping History sheet parsing (retention is set to latest only or History sheet not found)');
  }

  logger.info({
    fileName,
    sheetsParsed: sheets.map(s => `${s.sheetName} (${s.godownStockItems?.length || 0} rows, ${s.errors.length} errors)`)
  }, 'Counter Stock parsing completed');

  return {
    fileName,
    sheets,
    isGodownStockList: true, // Classify as inventory list type
    isCounterStockList: true
  };
}

export async function parseCounterStockWorkbookStreaming(buffer: Buffer, fileName: string): Promise<ExcelParsingResult> {
  logger.info({ fileName }, 'Counter Stock streaming parser initiated');

  const historyDays = await getHistoryRetentionDays('godown_stock', 0);
  logger.info({ historyDaysSetting: historyDays }, 'Stock history setting fetched for streaming counter');

  const priceLookup = new Map<string, { costPrice: number; sellingPrice: number }>();
  const todaysStockItems: GodownStockItem[] = [];
  const todaysErrors: ParsingError[] = [];
  const historyStockItems: GodownStockItem[] = [];
  const historyErrors: ParsingError[] = [];

  const stream = Readable.from(buffer);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(stream as any, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
  });

  // Calculate cutoff date for history retention
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historyDays);
  cutoffDate.setHours(0, 0, 0, 0);

  for await (const worksheet of workbookReader) {
    const rawSheetName = (worksheet as any).name;
    const isCurrent = rawSheetName === 'Current';
    const isHistory = rawSheetName === 'History' || rawSheetName === 'History_';

    if (isCurrent) {
      logger.info('Streaming: Loading Current sheet rows into memory...');
      const rowsMap = new Map<number, ExcelJS.Row>();
      let maxRowNumber = 0;
      for await (const row of worksheet) {
        rowsMap.set(row.number, row);
        if (row.number > maxRowNumber) {
          maxRowNumber = row.number;
        }
      }

      const rowContainer = {
        rowCount: maxRowNumber,
        getRow: (r: number) => rowsMap.get(r) || { getCell: () => ({ value: null }) } as any
      };

      logger.info('Streaming: Building pricing map from Current row container...');
      const priceLookupLocal = parsePriceLookup(rowContainer);
      for (const [k, v] of priceLookupLocal) {
        priceLookup.set(k, v);
      }
      logger.info({ priceCount: priceLookup.size }, 'Streaming: Pricing map established');

      // Find blocks in Current sheet
      const currentBlocks = extractBlocks(rowContainer);
      let currentEndRow = rowContainer.rowCount;
      for (let r = 1; r <= rowContainer.rowCount; r++) {
        const colB = extractStringValue(rowContainer.getRow(r).getCell(2).value).trim().toUpperCase();
        if (colB === 'ALL QUANTITY' || (colB === 'LIQUOR NAME' && r > 90)) {
          currentEndRow = r - 1;
          break;
        }
      }

      for (const block of currentBlocks) {
        const actualEnd = Math.min(block.endRow, currentEndRow);
        const { items, errors } = parseBlockRows(rowContainer, block.startRow, actualEnd, block.date, 'Current', priceLookup);
        todaysStockItems.push(...items);
        todaysErrors.push(...errors);
      }
    } else if (isHistory && historyDays > 0) {
      logger.info({ cutoffDate: cutoffDate.toISOString().split('T')[0] }, 'Streaming: Parsing History sheet row-by-row...');
      
      let currentBlockDate: Date | null = null;
      let isCurrentBlockEligible = false;
      let currentCategory = 'Liquor';
      let rowCount = 0;

      for await (const row of worksheet) {
        rowCount++;
        const date = findDateInRow(row);
        if (date) {
          currentBlockDate = date;
          isCurrentBlockEligible = date >= cutoffDate;
          currentCategory = 'Liquor'; // reset category for new block
          continue;
        }

        if (!isCurrentBlockEligible || !currentBlockDate) {
          // Skip rows outside retention window
          continue;
        }

        const colA = extractStringValue(row.getCell(1).value).trim();
        const colB = extractStringValue(row.getCell(2).value).trim();
        if (!colB) continue;

        const colB_upper = colB.toUpperCase();
        if (colB_upper === 'STRONG BEER') {
          currentCategory = 'Strong Beer';
          continue;
        }
        if (colB_upper === 'MILD BEER') {
          currentCategory = 'Mild Beer';
          continue;
        }
        if (colB_upper === 'WINE') {
          currentCategory = 'Wine';
          continue;
        }

        if (
          colB_upper.includes('TOTAL') ||
          colB_upper.includes('STOCK VALUE') ||
          colB_upper === 'LIQUOR NAME' ||
          colA.toUpperCase().includes('SR') ||
          colA.toUpperCase().includes('NO')
        ) {
          continue;
        }

        let sizes: number[] = [];
        let packagings: string[] = [];

        if (currentCategory === 'Liquor') {
          sizes = [90, 180, 375, 750, 1000, 2000, 0];
          packagings = ['bottle', 'bottle', 'bottle', 'bottle', 'bottle', 'bottle', 'loose'];
        } else if (currentCategory === 'Strong Beer' || currentCategory === 'Mild Beer') {
          sizes = [330, 330, 500, 650];
          packagings = ['bottle', 'tin', 'tin', 'bottle'];
        } else if (currentCategory === 'Wine') {
          sizes = [180, 330, 650, 750];
          packagings = ['bottle', 'bottle', 'bottle', 'bottle'];
        }

        try {
          const normalizedName = normalizeProductName(colB);

          for (let i = 0; i < sizes.length; i++) {
            const size = sizes[i];
            const packaging = packagings[i];

            const colOpening = 3 + i;
            const colIn = size === 0 ? -1 : 11 + i;
            const colClosing = 18 + i;
            const colSales = 26 + i;

            const openingStock = getNum(row, colOpening);
            const stockIn = colIn === -1 ? 0 : getNum(row, colIn);
            const closingStock = getNum(row, colClosing);
            const sales = getNum(row, colSales);

            if (openingStock === 0 && stockIn === 0 && closingStock === 0 && sales === 0) {
              continue;
            }

            const lookupKey = `${normalizedName}_${size}_${packaging.toUpperCase()}`;
            const prices = priceLookup.get(lookupKey);

            const costPrice = prices ? prices.costPrice : null;
            const sellingPrice = prices ? prices.sellingPrice : null;

            const totalCostValue = costPrice !== null ? closingStock * costPrice : null;
            const totalSellValue = sellingPrice !== null ? closingStock * sellingPrice : null;

            historyStockItems.push({
              snapshotDate: currentBlockDate,
              sheetName: 'History',
              itemName: colB,
              itemCode: null,
              category: currentCategory,
              bottleSizeMl: size,
              openingStock,
              stockIn,
              stockOut: sales,
              closingStock,
              quantity: closingStock,
              unitPrice: sellingPrice ?? 0,
              totalValue: closingStock * (sellingPrice ?? 0),
              costPrice,
              sellingPrice,
              totalCostValue,
              totalSellValue,
              location: 'counter',
              metadata: size === 0 ? { packaging, unit: 'ml', isLoose: true } : { packaging }
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          historyErrors.push({
            row: rowCount,
            error: `Failed parsing item "${colB}" in category "${currentCategory}": ${errMsg}`
          });
        }
      }
    }
  }

  const sheets: SheetParsingResult[] = [
    {
      sheetName: 'Current',
      transactions: [],
      errors: todaysErrors,
      godownStockItems: todaysStockItems
    }
  ];

  if (historyDays > 0) {
    sheets.push({
      sheetName: 'History',
      transactions: [],
      errors: historyErrors,
      godownStockItems: historyStockItems
    });
  }

  logger.info({
    fileName,
    sheetsParsed: sheets.map(s => `${s.sheetName} (${s.godownStockItems?.length || 0} rows, ${s.errors.length} errors)`)
  }, 'Counter Stock streaming parsing completed');

  return {
    fileName,
    sheets,
    isGodownStockList: true,
    isCounterStockList: true
  };
}
