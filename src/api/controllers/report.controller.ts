import fs from 'fs';
import path from 'path';
import { db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq, and, or, ilike, asc, desc, sql, inArray } from 'drizzle-orm';
import { orchestratorService } from '../../services/orchestrator.service.js';
import { rulesEngine } from '../../rules/rules.engine.js';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import { TokenPayload } from './security.controller.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../errors.js';

async function evaluateDbTransactions(dbTxs: any[], fileType: 'sales' | 'debitors' | 'godown_stock', fileName: string): Promise<any[]> {
  const transactionsForAudit = dbTxs.map(t => ({
    date: new Date(t.date),
    invoiceNumber: t.invoiceNumber || '',
    category: t.category,
    description: t.particulars || '',
    amount: Number(t.amount),
    type: t.type as 'credit' | 'debit',
    vendor: t.vendor,
    sheetName: t.sheetName
  }));
  return await rulesEngine.evaluate(transactionsForAudit, { fileType, fileName });
}

function getMonthYearLabel(dateVal: any, sheetName: string): string {
  const cleanSheet = sheetName.trim();
  const lowerSheet = cleanSheet.toLowerCase();
  if (lowerSheet !== 'counter' && lowerSheet !== 'sheet1' && lowerSheet !== 'sales' && lowerSheet !== 'daily sales') {
    return cleanSheet;
  }
  
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch (err) {
    // fallback
  }
  return cleanSheet;
}

/**
 * Parses a sheet name like "Jan 2025" or "December 2024" into a Date for sorting.
 */
function getSheetDate(sheetName: string): Date | null {
  const clean = sheetName.trim().toLowerCase();
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const monthsMap: Record<string, number> = {
      january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
      april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
      august: 7, aug: 7, september: 8, sept: 8, sep: 8,
      october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
    };
    const monthMatch = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)/);
    const monthIdx = monthMatch ? (monthsMap[monthMatch[0]] ?? 0) : 0;
    return new Date(year, monthIdx, 1);
  }
  return null;
}

export const reportCache = new Map<string, any>();
const HIGH_SEVERITY = new Set(['high', 'critical']);
const serverStartTime = Date.now();

export async function buildSalesReport(activeFile: any): Promise<any> {
  if (config.NODE_ENV !== 'development') {
    const cached = reportCache.get(activeFile.id);
    if (cached) {
      return cached;
    }
  }

  // 2. Query transactions, errors and pre-saved alerts concurrently
  const [dbTxs, dbErrors, dbAlerts] = await Promise.all([
    db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
    db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
  ]);

  // 3. Map transactions for standard frontend interface
  const txs = dbTxs.map(t => ({
    date: t.date,
    invoice: t.invoiceNumber || '',
    category: t.category,
    particulars: t.particulars || '',
    amount: Number(t.amount),
    type: t.type as 'credit' | 'debit',
    vendor: t.vendor
  }));

  // 4. Map monthly summaries dynamically from row-level entries
  const monthlyMap = new Map<string, any>();
  for (const t of dbTxs) {
    const sheet = getMonthYearLabel(t.date, t.sheetName);
    if (!monthlyMap.has(sheet)) {
      monthlyMap.set(sheet, {
        sheetName: sheet,
        liquor: 0,
        food: 0,
        creditRecovery: 0,
        expenses: 0,
        creditExtended: 0,
        inflows: 0,
        outflows: 0,
        net: 0,
        status: 'Surplus',
      });
    }
    const m = monthlyMap.get(sheet)!;
    const amt = Number(t.amount);
    if (t.category.toLowerCase().includes('liquor') || t.category.toLowerCase().includes('wine')) {
      m.liquor += amt;
    } else if (t.category.toLowerCase().includes('food')) {
      m.food += amt;
    } else if (t.category.toLowerCase().includes('recovery') || t.category.toLowerCase().includes('jama')) {
      m.creditRecovery += amt;
    } else if (t.type === 'debit' && t.category.toLowerCase().includes('expense')) {
      m.expenses += amt;
    } else if (t.type === 'debit' && t.category.toLowerCase().includes('extended')) {
      m.creditExtended += amt;
    }
  }

  const months = Array.from(monthlyMap.values()).map(m => {
    m.inflows = m.liquor + m.food + m.creditRecovery;
    m.outflows = m.expenses + m.creditExtended;
    m.net = m.inflows - m.outflows;
    m.status = m.net >= 0 ? 'Surplus' : 'Deficit';
    return m;
  });

  // 5. Compile Master Totals
  let liquorSales = 0, foodSales = 0, creditRecovery = 0, expenses = 0, creditExtended = 0;
  for (const m of months) {
    liquorSales += m.liquor;
    foodSales += m.food;
    creditRecovery += m.creditRecovery;
    expenses += m.expenses;
    creditExtended += m.creditExtended;
  }
  const totalInflows = liquorSales + foodSales + creditRecovery;
  const totalOutflows = expenses + creditExtended;
  const netCashflow = totalInflows - totalOutflows;

  const masterTotals = {
    liquorSales,
    foodSales,
    creditRecovery,
    expenses,
    creditExtended,
    totalInflows,
    totalOutflows,
    netCashflow,
    surplusStatus: netCashflow >= 0 ? 'Surplus' as const : 'Deficit' as const
  };

  // 6. Compile Benchmarks
  const liquorPercentage = liquorSales + foodSales > 0 ? ((liquorSales / (liquorSales + foodSales)) * 100).toFixed(1) : '0.0';
  const foodPercentage = liquorSales + foodSales > 0 ? ((foodSales / (liquorSales + foodSales)) * 100).toFixed(1) : '0.0';
  const creditRecoveryRate = creditExtended > 0 ? ((creditRecovery / creditExtended) * 100).toFixed(1) : '100.0';
  const creditOutstandingGap = creditExtended - creditRecovery;

  let bestRevenueMonth = 'N/A', bestRevenueValue = 0;
  let bestProfitMonth = 'N/A', bestProfitValue = 0;
  let peakExpenseMonth = 'N/A', peakExpenseValue = 0;
  for (const m of months) {
    const revenue = m.liquor + m.food;
    if (revenue > bestRevenueValue) {
      bestRevenueValue = revenue;
      bestRevenueMonth = m.sheetName;
    }
    if (m.net > bestProfitValue) {
      bestProfitValue = m.net;
      bestProfitMonth = m.sheetName;
    }
    if (m.expenses > peakExpenseValue) {
      peakExpenseValue = m.expenses;
      peakExpenseMonth = m.sheetName;
    }
  }

  const benchmarks = {
    bestRevenueMonth,
    bestRevenueValue,
    bestProfitMonth,
    bestProfitValue,
    peakExpenseMonth,
    peakExpenseValue,
    liquorPercentage,
    foodPercentage,
    creditRecoveryRate,
    creditOutstandingGap
  };

  const sortedMonths = [...months].sort((a: any, b: any) => {
    const da = getSheetDate(a.sheetName);
    const db = getSheetDate(b.sheetName);
    if (!da || !db) return 0;
    return da.getTime() - db.getTime();
  });
  const dateRange = sortedMonths.length >= 2
    ? { from: sortedMonths[0].sheetName, to: sortedMonths[sortedMonths.length - 1].sheetName }
    : sortedMonths.length === 1
      ? { from: sortedMonths[0].sheetName, to: sortedMonths[0].sheetName }
      : null;

  const highAlertCount = dbAlerts.filter(a => HIGH_SEVERITY.has(a.severity)).length;

  // 7. Structure complete MasterSummary response object
  const summaryPayload = {
    fileName: activeFile.fileName,
    runTimestamp: activeFile.runTimestamp.toISOString(),
    totalTransactions: activeFile.totalRows,
    totalMonths: months.length,
    masterTotals,
    benchmarks,
    months,
    transactions: txs,
    alerts: dbAlerts.map(a => ({
      ruleId: a.ruleId,
      ruleName: a.ruleName,
      severity: a.severity,
      message: a.message,
    })),
    errors: dbErrors.map(e => ({
      row: e.rowNumber,
      invoiceNumber: e.invoiceNumber || undefined,
      error: e.errorMessage,
    })),
    intelligence: (activeFile.aiIntelligence as string[]) || [],
    aiGenerated: activeFile.aiGenerated,
    highAlertCount,
    dateRange
  };

  reportCache.set(activeFile.id, summaryPayload);
  return summaryPayload;
}

export async function buildDebitorsReport(activeFile: any): Promise<any> {
  if (config.NODE_ENV !== 'development') {
    const cached = reportCache.get(activeFile.id);
    if (cached) {
      return cached;
    }
  }

  // 2. Query debtor snapshots, transactions, errors and pre-saved alerts concurrently
  const [dbParty, dbErrors, dbTxs, dbAlerts] = await Promise.all([
    db.select().from(schema.partyBalances).where(eq(schema.partyBalances.fileId, activeFile.id)),
    db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
    db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
  ]);

  // 3. Map debtor list
  const topDebitors = dbParty
    .map(d => ({
      name: d.partyName,
      debit: Number(d.debit),
      credit: Number(d.credit),
      pending: Number(d.pending)
    }))
    .sort((a, b) => b.pending - a.pending);

  // 4. Map transactions
  const txs = dbTxs.map(t => ({
    date: t.date,
    invoice: t.invoiceNumber || '',
    category: t.category,
    particulars: t.particulars || '',
    amount: Number(t.amount),
    type: t.type as 'credit' | 'debit',
    vendor: t.vendor
  }));

  // 5. Compute consolidated totals
  let totalDebitSum = 0, totalCreditSum = 0, totalPendingSum = 0;
  for (const d of dbParty) {
    totalDebitSum += Number(d.debit);
    totalCreditSum += Number(d.credit);
    totalPendingSum += Number(d.pending);
  }
  const activeDebitorsCount = dbParty.filter(d => Number(d.pending) > 0).length;
  const collectionSuccessRate = totalDebitSum > 0 ? ((totalCreditSum / totalDebitSum) * 100).toFixed(1) : '100.0';

  const aggregates = {
    totalDebitSum,
    totalCreditSum,
    totalPendingSum,
    activeDebitorsCount,
    collectionSuccessRate
  };

  const highAlertCount = dbAlerts.filter(a => HIGH_SEVERITY.has(a.severity)).length;

  // 6. Structure complete MasterSummary response object
  const summaryPayload = {
    fileName: activeFile.fileName,
    runTimestamp: activeFile.runTimestamp.toISOString(),
    isDebitorsList: true,
    totalTransactions: activeFile.totalRows,
    aggregates,
    topDebitors,
    transactions: txs,
    alerts: dbAlerts.map(a => ({
      ruleId: a.ruleId,
      ruleName: a.ruleName,
      severity: a.severity,
      message: a.message,
    })),
    errors: dbErrors.map(e => ({
      row: e.rowNumber,
      invoiceNumber: e.invoiceNumber || undefined,
      error: e.errorMessage,
    })),
    intelligence: (activeFile.aiIntelligence as string[]) || [],
    aiGenerated: activeFile.aiGenerated,
    highAlertCount,
    dateRange: null
  };

  reportCache.set(activeFile.id, summaryPayload);
  return summaryPayload;
}

export async function buildGodownStockReport(activeFile: any): Promise<any> {
  if (config.NODE_ENV !== 'development') {
    const cached = reportCache.get(activeFile.id);
    if (cached) {
      return cached;
    }
  }

  const [dbStockItems, dbErrors, dbAlerts] = await Promise.all([
    db.select().from(schema.godownStockItems).where(eq(schema.godownStockItems.fileId, activeFile.id)),
    db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
  ]);

  const todaysItems = dbStockItems.filter(item => item.sheetName === 'Todays');

  let latestItems = todaysItems;
  if (latestItems.length === 0 && dbStockItems.length > 0) {
    const dates = dbStockItems.map(item => new Date(item.snapshotDate).getTime());
    const maxDate = Math.max(...dates);
    latestItems = dbStockItems.filter(item => new Date(item.snapshotDate).getTime() === maxDate);
  }

  let totalClosingValue = 0;
  let totalSellingValue = 0;
  let totalVolumeLiters = 0;
  let totalStockInCount = 0;
  let totalStockOutCount = 0;
  let activeItemsCount = 0;

  const categoryMap = new Map<string, {
    category: string;
    closingValue: number;
    sellingValue: number;
    itemsCount: number;
    totalVolumeLiters: number;
    stockInCount: number;
    stockOutCount: number;
  }>();

  const categories = ['Liquor', 'Strong Beer', 'Mild Beer', 'Wine'];
  for (const cat of categories) {
    categoryMap.set(cat, {
      category: cat,
      closingValue: 0,
      sellingValue: 0,
      itemsCount: 0,
      totalVolumeLiters: 0,
      stockInCount: 0,
      stockOutCount: 0
    });
  }

  for (const item of latestItems) {
    const stockIn = Number(item.stockIn);
    const stockOut = Number(item.stockOut);
    const closingStock = Number(item.closingStock);
    const costPrice = item.costPrice ? Number(item.costPrice) : 0;
    const sellingPrice = item.sellingPrice ? Number(item.sellingPrice) : 0;

    const totalCostVal = item.totalCostValue ? Number(item.totalCostValue) : (closingStock * costPrice);
    const totalSellVal = item.totalSellValue ? Number(item.totalSellValue) : (closingStock * sellingPrice);
    const volumeLiters = (closingStock * item.bottleSizeMl) / 1000;

    totalClosingValue += totalCostVal;
    totalSellingValue += totalSellVal;
    totalVolumeLiters += volumeLiters;
    totalStockInCount += stockIn;
    totalStockOutCount += stockOut;
    
    if (closingStock > 0) {
      activeItemsCount++;
    }

    const cat = item.category || 'General';
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, {
        category: cat,
        closingValue: 0,
        sellingValue: 0,
        itemsCount: 0,
        totalVolumeLiters: 0,
        stockInCount: 0,
        stockOutCount: 0
      });
    }

    const catAgg = categoryMap.get(cat)!;
    catAgg.closingValue += totalCostVal;
    catAgg.sellingValue += totalSellVal;
    catAgg.totalVolumeLiters += volumeLiters;
    catAgg.stockInCount += stockIn;
    catAgg.stockOutCount += stockOut;
    if (closingStock > 0) {
      catAgg.itemsCount++;
    }
  }

  const categoryAggregates = Array.from(categoryMap.values());

  const aggregates = {
    totalClosingValue,
    totalSellingValue,
    totalItemsCount: activeItemsCount,
    totalVolumeLiters,
    stockInCount: totalStockInCount,
    stockOutCount: totalStockOutCount
  };

  const trendsMap = new Map<string, {
    date: string;
    totalCostValue: number;
    totalSellValue: number;
    totalClosingStock: number;
    totalStockIn: number;
    totalStockOut: number;
  }>();

  for (const item of dbStockItems) {
    const dateStr = String(item.snapshotDate);

    const closingStock = Number(item.closingStock);
    const stockIn = Number(item.stockIn);
    const stockOut = Number(item.stockOut);
    const costPrice = item.costPrice ? Number(item.costPrice) : 0;
    const sellingPrice = item.sellingPrice ? Number(item.sellingPrice) : 0;

    const totalCostVal = item.totalCostValue ? Number(item.totalCostValue) : (closingStock * costPrice);
    const totalSellVal = item.totalSellValue ? Number(item.totalSellValue) : (closingStock * sellingPrice);

    if (!trendsMap.has(dateStr)) {
      trendsMap.set(dateStr, {
        date: dateStr,
        totalCostValue: 0,
        totalSellValue: 0,
        totalClosingStock: 0,
        totalStockIn: 0,
        totalStockOut: 0
      });
    }

    const trend = trendsMap.get(dateStr)!;
    trend.totalCostValue += totalCostVal;
    trend.totalSellValue += totalSellVal;
    trend.totalClosingStock += closingStock;
    trend.totalStockIn += stockIn;
    trend.totalStockOut += stockOut;
  }

  const historicalTrends = Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const mappedItems = latestItems.map(item => ({
    itemName: item.itemName,
    category: item.category,
    bottleSizeMl: item.bottleSizeMl,
    openingStock: Number(item.openingStock),
    stockIn: Number(item.stockIn),
    stockOut: Number(item.stockOut),
    closingStock: Number(item.closingStock),
    costPrice: item.costPrice ? Number(item.costPrice) : null,
    sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
    totalCostValue: item.totalCostValue ? Number(item.totalCostValue) : null,
    totalSellValue: item.totalSellValue ? Number(item.totalSellValue) : null,
    packaging: (item.metadata as any)?.packaging || 'bottle'
  }));

  const sortedTrends = [...historicalTrends].sort((a, b) => a.date.localeCompare(b.date));
  const dateRange = sortedTrends.length >= 2
    ? { from: sortedTrends[0].date, to: sortedTrends[sortedTrends.length - 1].date }
    : sortedTrends.length === 1
      ? { from: sortedTrends[0].date, to: sortedTrends[0].date }
      : null;

  const highAlertCount = dbAlerts.filter(a => HIGH_SEVERITY.has(a.severity)).length;

  const summaryPayload = {
    fileName: activeFile.fileName,
    runTimestamp: activeFile.runTimestamp.toISOString(),
    isGodownStockList: true,
    totalItems: latestItems.length,
    aggregates,
    categoryAggregates,
    items: mappedItems,
    historicalTrends,
    alerts: dbAlerts.map(a => ({
      ruleId: a.ruleId,
      ruleName: a.ruleName,
      severity: a.severity,
      message: a.message,
    })),
    errors: dbErrors.map(e => ({
      row: e.rowNumber,
      invoiceNumber: e.invoiceNumber || undefined,
      error: e.errorMessage,
    })),
    intelligence: (activeFile.aiIntelligence as string[]) || [],
    aiGenerated: activeFile.aiGenerated,
    highAlertCount,
    dateRange
  };

  reportCache.set(activeFile.id, summaryPayload);
  return summaryPayload;
}

export async function reEvaluateAlertsForFile(
  fileId: string,
  fileType: 'sales' | 'debitors' | 'godown_stock',
  fileName: string
): Promise<void> {
  let evaluatedAlerts: any[] = [];
  if (fileType === 'godown_stock') {
    const dbStockItems = await db.select().from(schema.godownStockItems).where(eq(schema.godownStockItems.fileId, fileId));
    const mappedStockItems = dbStockItems.map(item => ({
      ...item,
      openingStock: Number(item.openingStock),
      stockIn: Number(item.stockIn),
      stockOut: Number(item.stockOut),
      closingStock: Number(item.closingStock),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalValue: Number(item.totalValue),
      costPrice: item.costPrice ? Number(item.costPrice) : null,
      sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
      totalCostValue: item.totalCostValue ? Number(item.totalCostValue) : null,
      totalSellValue: item.totalSellValue ? Number(item.totalSellValue) : null,
    }));
    evaluatedAlerts = await rulesEngine.evaluate([], { fileType, fileName, godownStockItems: mappedStockItems as any });
  } else {
    const dbTxs = await db.select().from(schema.transactions).where(eq(schema.transactions.fileId, fileId));
    evaluatedAlerts = await evaluateDbTransactions(dbTxs, fileType, fileName);
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, fileId));
    if (evaluatedAlerts.length > 0) {
      await tx.insert(schema.auditAlerts).values(
        evaluatedAlerts.map(a => ({
          fileId: fileId,
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity,
          message: a.message,
        }))
      );
    }
  });

  reportCache.delete(fileId);
}

/**
 * GET /api/v1/portal-summary
 * Serves a highly optimized, lightweight summary of the latest Sales and Debitors files.
 * Perfect for immediate display on the user dashboard after login.
 */
export async function getPortalSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const [latestSalesFile, latestDebitorsFile, latestGodownStockFile] = await Promise.all([
      db.select().from(schema.files).where(and(eq(schema.files.fileType, 'sales'), eq(schema.files.isLatest, true))).limit(1).then(r => r[0]),
      db.select().from(schema.files).where(and(eq(schema.files.fileType, 'debitors'), eq(schema.files.isLatest, true))).limit(1).then(r => r[0]),
      db.select().from(schema.files).where(and(eq(schema.files.fileType, 'godown_stock'), eq(schema.files.isLatest, true))).limit(1).then(r => r[0])
    ]);

    const salesKey = latestSalesFile ? `${latestSalesFile.id}-${latestSalesFile.runTimestamp.getTime()}` : 'no-sales';
    const debitorsKey = latestDebitorsFile ? `${latestDebitorsFile.id}-${latestDebitorsFile.runTimestamp.getTime()}` : 'no-debitors';
    const godownStockKey = latestGodownStockFile ? `${latestGodownStockFile.id}-${latestGodownStockFile.runTimestamp.getTime()}` : 'no-godown-stock';
    const etag = `W/"portal-${salesKey}-${debitorsKey}-${godownStockKey}-${serverStartTime}"`;

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache, must-revalidate');

    if (request.headers['if-none-match'] === etag) {
      reply.code(304).send();
      return;
    }

    const [salesReport, debitorsReport, godownStockReport] = await Promise.all([
      latestSalesFile ? buildSalesReport(latestSalesFile) : Promise.resolve(null),
      latestDebitorsFile ? buildDebitorsReport(latestDebitorsFile) : Promise.resolve(null),
      latestGodownStockFile ? buildGodownStockReport(latestGodownStockFile) : Promise.resolve(null)
    ]);

    const response: any = {};

    if (salesReport) {
      response.sales = {
        fileName: salesReport.fileName,
        runTimestamp: salesReport.runTimestamp,
        totalTransactions: salesReport.totalTransactions,
        totalMonths: salesReport.totalMonths,
        alertCount: salesReport.alerts.length,
        highAlertCount: salesReport.highAlertCount,
        dateRange: salesReport.dateRange,
        totalInflows: salesReport.masterTotals.totalInflows,
        netCashflow: salesReport.masterTotals.netCashflow,
        sparkline: salesReport.months.map((m: any) => m.net)
      };
    }

    if (debitorsReport) {
      response.debitors = {
        fileName: debitorsReport.fileName,
        runTimestamp: debitorsReport.runTimestamp,
        totalTransactions: debitorsReport.totalTransactions,
        alertCount: debitorsReport.alerts.length,
        highAlertCount: debitorsReport.highAlertCount,
        dateRange: null,
        totalPendingSum: debitorsReport.aggregates.totalPendingSum,
        collectionSuccessRate: debitorsReport.aggregates.collectionSuccessRate,
        activeDebitorsCount: debitorsReport.aggregates.activeDebitorsCount,
        sparkline: debitorsReport.topDebitors.slice(0, 15).map((d: any) => d.pending)
      };
    }

    if (godownStockReport) {
      response.godownStock = {
        fileName: godownStockReport.fileName,
        runTimestamp: godownStockReport.runTimestamp,
        totalItems: godownStockReport.totalItems,
        alertCount: godownStockReport.alerts.length,
        highAlertCount: godownStockReport.highAlertCount,
        dateRange: godownStockReport.dateRange,
        totalClosingValue: godownStockReport.aggregates.totalClosingValue,
        totalSellingValue: godownStockReport.aggregates.totalSellingValue,
        activeItemsCount: godownStockReport.aggregates.totalItemsCount,
        sparkline: godownStockReport.historicalTrends.slice(-15).map((t: any) => t.totalCostValue)
      };
    }

    reply.code(200).send(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed to fetch portal summary');
    reply.code(500).send(Errors.internalError('Failed to fetch portal summary'));
  }
}

/**
 * GET /api/v1/data/sales
 * Serves real-time sales summary data (reconciled cashflow metrics and benchmarks).
 * Dynamically compiles totals and time-series from row-level transactional tables.
 */
export async function getSalesReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // 1. Fetch the active Sales register run record
    const [activeFile] = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileType, 'sales'),
          eq(schema.files.isLatest, true)
        )
      )
      .limit(1);

    if (!activeFile) {
      reply.code(404).send(Errors.notFound('Sales summary dataset (relational DB is empty)'));
      return;
    }

    const etag = `W/"sales-${activeFile.id}-${activeFile.runTimestamp.getTime()}"`;
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache, must-revalidate');

    if (request.headers['if-none-match'] === etag) {
      reply.code(304).send();
      return;
    }

    const report = await buildSalesReport(activeFile);
    reply.code(200).send({ ...report, transactions: [] });
  } catch (dbErr: unknown) {
    const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
    logger.error({ err: message }, 'Failed to fetch sales report from relational DB');
    reply.code(503).send(Errors.databaseError('Sales report'));
  }
}

/**
 * GET /api/v1/data/debitors
 * Serves outstanding debtor lists, active udhari accounts, and aging statistics.
 * Fetches from normalized relation tables.
 */
export async function getDebitorsReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // 1. Fetch the active Debitors run record
    const [activeFile] = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileType, 'debitors'),
          eq(schema.files.isLatest, true)
        )
      )
      .limit(1);

    if (!activeFile) {
      reply.code(404).send(Errors.notFound('Debitors summary dataset (relational DB is empty)'));
      return;
    }

    const etag = `W/"debitors-${activeFile.id}-${activeFile.runTimestamp.getTime()}"`;
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache, must-revalidate');

    if (request.headers['if-none-match'] === etag) {
      reply.code(304).send();
      return;
    }

    const report = await buildDebitorsReport(activeFile);
    reply.code(200).send({ ...report, transactions: [] });
  } catch (dbErr: unknown) {
    const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
    logger.error({ err: message }, 'Failed to fetch debtors report from relational PostgreSQL DB');
    reply.code(503).send(Errors.databaseError('Debitors report'));
  }
}

/**
 * GET /api/v1/data/godown-stock
 * Serves real-time stock valuation summary, category aggregates and historical movement trends.
 */
export async function getGodownStockReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const [activeFile] = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileType, 'godown_stock'),
          eq(schema.files.isLatest, true)
        )
      )
      .limit(1);

    if (!activeFile) {
      reply.code(404).send(Errors.notFound('Godown Stock summary dataset (relational DB is empty)'));
      return;
    }

    const etag = `W/"godown-stock-${activeFile.id}-${activeFile.runTimestamp.getTime()}"`;
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache, must-revalidate');

    if (request.headers['if-none-match'] === etag) {
      reply.code(304).send();
      return;
    }

    const report = await buildGodownStockReport(activeFile);
    reply.code(200).send(report);
  } catch (dbErr: unknown) {
    const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
    logger.error({ err: message }, 'Failed to fetch godown stock report from database');
    reply.code(503).send(Errors.databaseError('Godown Stock report'));
  }
}

/**
 * POST /api/trigger-pipeline
 * Securely triggers an immediate, asynchronous Excel sheets ingestion run.
 */
export async function triggerPipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.info('Manual pipeline execution triggered via HTTP POST request');

  if (orchestratorService.running) {
    logger.warn('Pipeline trigger rejected: pipeline is already running.');
    reply.code(409).send(Errors.conflict('Pipeline is already running. Please wait for it to complete.'));
    return;
  }

  try {
    const body = request.body as { forceLocal?: boolean } | undefined;
    const forceLocal = body?.forceLocal === true;

    const { hasNew, newFilesCount } = await orchestratorService.checkNewFiles({ forceLocal });

    if (!hasNew) {
      logger.info('All spreadsheets are already up-to-date. Skipping background execution.');
      reply.code(200).send({ status: 'up-to-date', message: 'All spreadsheets are already up-to-date' });
      return;
    }

    logger.info({ newFilesCount, forceLocal }, 'New/changed files detected. Triggering background pipeline execution');

    orchestratorService.runPipeline({ forceLocal }).then(() => {
      logger.info('Background manual pipeline execution completed successfully');
    }).catch((err) => {
      logger.error({ err }, 'Background manual HTTP pipeline run failed');
    });

    reply.code(202).send({ status: 'processing', message: `Sync started. Ingesting ${newFilesCount} spreadsheet(s)...` });
  } catch (err) {
    logger.error({ err }, 'Failed during pre-sync check');
    const errMsg = err instanceof Error ? err.message : String(err);
    reply.code(400).send({ error: errMsg });
  }
}

/**
 * POST /api/ledger/upload
 * Ingests an Excel file dynamically through the full pipeline.
 */
export async function handleFileUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.info('File upload request received');

  try {
    const creds = await (await import('./security.controller.js')).getSecurityCredentials();
    const targetUploadPassword = creds.uploadPassword;

    let fileName: string | undefined;
    let buffer: Buffer | undefined;
    let sessionToken: string | undefined;

    if (request.isMultipart()) {
      const parts = await request.file();
      if (!parts) {
        reply.code(400).send(Errors.badRequest('No file uploaded'));
        return;
      }
      fileName = parts.filename;
      buffer = await parts.toBuffer();
      sessionToken = parts.fields && parts.fields.sessionToken
        ? (parts.fields.sessionToken as { value: string }).value
        : undefined;
    } else {
      const body = request.body as { fileName?: string; fileData?: string; sessionToken?: string } | undefined;
      sessionToken = body?.sessionToken;
      fileName = body?.fileName;
      if (body?.fileData) {
        buffer = Buffer.from(body.fileData, 'base64');
      }
    }

    if (fileName && !fileName.toLowerCase().endsWith('.xlsx')) {
      logger.warn({ fileName }, 'Rejected upload: file is not a valid .xlsx spreadsheet');
      reply.code(400).send(Errors.badRequest('Invalid file type: only Excel (.xlsx) spreadsheets are accepted'));
      return;
    }

    if (targetUploadPassword) {
      let payload: TokenPayload | null = null;
      if (sessionToken) {
        try {
          payload = request.server.jwt.verify<TokenPayload>(sessionToken);
        } catch {
          payload = null;
        }
      }
      if (!payload || !payload.uploadAuthorized) {
        logger.warn({ fileName: fileName || 'unknown' }, 'Unauthorized upload attempt: invalid or expired session token');
        reply.code(401).send(Errors.unauthorized('Invalid or expired upload session'));
        return;
      }
    }

    if (!fileName || !buffer) {
      reply.code(400).send(Errors.badRequest('fileName and file data are required'));
      return;
    }

    const summary = await orchestratorService.processFileBuffer(buffer, fileName);
    reply.code(200).send(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Error handling file upload');
    reply.code(500).send(Errors.internalError('Failed to process spreadsheet file'));
  }
}

/**
 * GET /api/v1/sync-status
 * Retrieves the current execution state of the background sync pipeline.
 */
export async function getSyncStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.send({
    status: orchestratorService.status,
    error: orchestratorService.error,
    isRunning: orchestratorService.running,
    progress: orchestratorService.progress
  });
}

/**
 * Programmatically reconstructs the complete structured MasterSummary object from relational database tables.
 * This is used to share context with the AI advisor chat and Telegram Bot without duplicating query aggregation logic.
 */
export async function getReconstructedReport(reportType: 'sales' | 'debitors' | 'godown_stock'): Promise<any | null> {
  if (!db) return null;
  try {
    const [activeFile] = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileType, reportType),
          eq(schema.files.isLatest, true)
        )
      )
      .limit(1);

    if (!activeFile) return null;

    if (reportType === 'sales') {
      return await buildSalesReport(activeFile);
    } else if (reportType === 'debitors') {
      return await buildDebitorsReport(activeFile);
    } else {
      return await buildGodownStockReport(activeFile);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to dynamically reconstruct report summary');
    return null;
  }
}

/**
 * GET /api/v1/transactions
 * Serves paginated, sorted, searched, and filtered transaction entries.
 */
export async function getTransactionsList(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const query = request.query as {
      fileType?: string;
      page?: string;
      limit?: string;
      search?: string;
      category?: string;
      vendor?: string;
      month?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      type?: 'credit' | 'debit';
    };

    const fileType = query.fileType;
    if (!fileType || (fileType !== 'sales' && fileType !== 'debitors')) {
      reply.code(400).send(Errors.badRequest('fileType must be "sales" or "debitors"'));
      return;
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '10', 10));
    const search = query.search || '';
    const category = query.category || '';
    const vendor = query.vendor || '';
    const month = query.month || '';
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'desc';
    const txType = query.type || '';

    // 1. Fetch the active run record for the fileType
    const [activeFile] = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileType, fileType),
          eq(schema.files.isLatest, true)
        )
      )
      .limit(1);

    if (!activeFile) {
      reply.code(200).send({
        transactions: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      });
      return;
    }

    // 2. Build Drizzle conditions array
    const conditions: any[] = [eq(schema.transactions.fileId, activeFile.id)];

    // Apply search filter
    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.transactions.vendor, searchPattern),
          ilike(schema.transactions.category, searchPattern),
          ilike(schema.transactions.particulars, searchPattern),
          ilike(schema.transactions.invoiceNumber, searchPattern)
        )
      );
    }

    // Apply category filter
    if (category.trim()) {
      conditions.push(eq(schema.transactions.category, category.trim()));
    }

    // Apply vendor filter
    if (vendor.trim()) {
      conditions.push(eq(schema.transactions.vendor, vendor.trim()));
    }

    // Apply txType filter ('credit' | 'debit')
    if (txType.trim()) {
      conditions.push(eq(schema.transactions.type, txType.trim()));
    }

    // Apply month filter (e.g. "January 2026, February 2026")
    if (month.trim()) {
      const monthsMap: Record<string, number> = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sept: 9, sep: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12
      };
      
      const monthStrings = month.split(',').map(m => m.trim()).filter(Boolean);
      const monthConditions: any[] = [];

      for (const mStr of monthStrings) {
        const parts = mStr.toLowerCase().split(/\s+/);
        if (parts.length === 2 && monthsMap[parts[0]]) {
          const monthNum = monthsMap[parts[0]];
          const yearNum = parseInt(parts[1], 10);
          if (!isNaN(yearNum)) {
            monthConditions.push(
              or(
                eq(schema.transactions.sheetName, mStr),
                and(
                  inArray(sql<string>`lower(${schema.transactions.sheetName})`, ['counter', 'sheet1', 'sales', 'daily sales']),
                  sql`EXTRACT(MONTH FROM ${schema.transactions.date}) = ${monthNum}`,
                  sql`EXTRACT(YEAR FROM ${schema.transactions.date}) = ${yearNum}`
                )
              )
            );
          } else {
            monthConditions.push(eq(schema.transactions.sheetName, mStr));
          }
        } else {
          monthConditions.push(eq(schema.transactions.sheetName, mStr));
        }
      }

      if (monthConditions.length > 0) {
        conditions.push(or(...monthConditions));
      }
    }

    // 3. Resolve sorting
    let orderClause: any;
    const isAsc = sortOrder === 'asc';

    switch (sortBy) {
      case 'amount':
        orderClause = isAsc ? asc(schema.transactions.amount) : desc(schema.transactions.amount);
        break;
      case 'category':
        orderClause = isAsc ? asc(schema.transactions.category) : desc(schema.transactions.category);
        break;
      case 'vendor':
        orderClause = isAsc ? asc(schema.transactions.vendor) : desc(schema.transactions.vendor);
        break;
      case 'invoice':
      case 'invoiceNumber':
        orderClause = isAsc ? asc(schema.transactions.invoiceNumber) : desc(schema.transactions.invoiceNumber);
        break;
      case 'date':
      default:
        orderClause = isAsc ? asc(schema.transactions.date) : desc(schema.transactions.date);
        break;
    }

    // 4. Run total count and page retrieval concurrently in Promise.all
    const offset = (page - 1) * limit;
    const [countResult, dbTxs] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.transactions)
        .where(and(...conditions)),
      db
        .select()
        .from(schema.transactions)
        .where(and(...conditions))
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset)
    ]);
    const total = countResult[0]?.count ?? 0;

    // 6. Map and return response
    const transactions = dbTxs.map(t => ({
      date: t.date,
      invoice: t.invoiceNumber || '',
      category: t.category,
      particulars: t.particulars || '',
      amount: Number(t.amount),
      type: t.type as 'credit' | 'debit',
      vendor: t.vendor
    }));

    reply.code(200).send({
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed to fetch transactions list');
    reply.code(500).send(Errors.internalError('Failed to fetch transactions list'));
  }
}

