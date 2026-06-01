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

async function evaluateDbTransactions(dbTxs: any[], fileType: 'sales' | 'debitors' | 'stock', fileName: string): Promise<any[]> {
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

    // 2. Query transactions and errors concurrently
    const [dbTxs, dbErrors] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    ]);

    const evaluatedAlerts = await evaluateDbTransactions(dbTxs, 'sales', activeFile.fileName);

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

    // 7. Structure complete MasterSummary response object
    const summaryPayload = {
      fileName: activeFile.fileName,
      runTimestamp: activeFile.runTimestamp.toISOString(),
      totalTransactions: activeFile.totalRows,
      totalMonths: months.length,
      masterTotals,
      benchmarks,
      months,
      transactions: [],
      alerts: evaluatedAlerts.map(a => ({
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
      aiGenerated: activeFile.aiGenerated
    };

    reply.code(200).send(summaryPayload);
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

    // 2. Query debtor snapshots, transactions and errors concurrently
    const [dbParty, dbErrors, dbTxs] = await Promise.all([
      db.select().from(schema.partyBalances).where(eq(schema.partyBalances.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
    ]);

    const evaluatedAlerts = await evaluateDbTransactions(dbTxs, 'debitors', activeFile.fileName);

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

    // 6. Structure complete MasterSummary response object
    const summaryPayload = {
      fileName: activeFile.fileName,
      runTimestamp: activeFile.runTimestamp.toISOString(),
      isDebitorsList: true,
      totalTransactions: activeFile.totalRows,
      aggregates,
      topDebitors,
      transactions: [],
      alerts: evaluatedAlerts.map(a => ({
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
      aiGenerated: activeFile.aiGenerated
    };

    reply.code(200).send(summaryPayload);
  } catch (dbErr: unknown) {
    const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
    logger.error({ err: message }, 'Failed to fetch debtors report from relational PostgreSQL DB');
    reply.code(503).send(Errors.databaseError('Debitors report'));
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
export async function getReconstructedReport(reportType: 'sales' | 'debitors'): Promise<any | null> {
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

    const [dbTxs, dbErrors] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    ]);

    const evaluatedAlerts = await evaluateDbTransactions(dbTxs, reportType, activeFile.fileName);

    const txs = dbTxs.map(t => ({
      date: t.date,
      invoice: t.invoiceNumber || '',
      category: t.category,
      particulars: t.particulars || '',
      amount: Number(t.amount),
      type: t.type as 'credit' | 'debit',
      vendor: t.vendor
    }));

    if (reportType === 'debitors') {
      const dbParty = await db.select().from(schema.partyBalances).where(eq(schema.partyBalances.fileId, activeFile.id));
      const topDebitors = dbParty
        .map(d => ({
          name: d.partyName,
          debit: Number(d.debit),
          credit: Number(d.credit),
          pending: Number(d.pending)
        }))
        .sort((a, b) => b.pending - a.pending);

      const totalDebitSum = topDebitors.reduce((sum, d) => sum + d.debit, 0);
      const totalCreditSum = topDebitors.reduce((sum, d) => sum + d.credit, 0);
      const totalPendingSum = topDebitors.reduce((sum, d) => sum + d.pending, 0);
      const collectionSuccessRate = totalDebitSum > 0 ? ((totalCreditSum / totalDebitSum) * 100).toFixed(1) : '100.0';
      const activeDebitorsCount = topDebitors.length;
      const averageOutstandingDues = activeDebitorsCount > 0 ? (totalPendingSum / activeDebitorsCount) : 0;

      return {
        fileName: activeFile.fileName,
        timestamp: activeFile.runTimestamp.toISOString(),
        runTimestamp: activeFile.runTimestamp.toISOString(),
        isDebitorsList: true,
        totalTransactions: activeFile.totalRows,
        aggregates: {
          totalDebitSum,
          totalCreditSum,
          totalPendingSum,
          collectionSuccessRate,
          averageOutstandingDues,
          activeDebitorsCount,
          topDebtorName: topDebitors[0]?.name || 'N/A',
          topDebtorValue: topDebitors[0]?.pending || 0
        },
        topDebitors,
        transactions: txs,
        alerts: evaluatedAlerts.map(a => ({
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
        aiGenerated: true
      };
    } else {
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

      return {
        fileName: activeFile.fileName,
        runTimestamp: activeFile.runTimestamp.toISOString(),
        totalTransactions: activeFile.totalRows,
        totalMonths: months.length,
        masterTotals: {
          liquorSales,
          foodSales,
          creditRecovery,
          expenses,
          creditExtended,
          totalInflows,
          totalOutflows,
          netCashflow,
          surplusStatus: netCashflow >= 0 ? 'Surplus' : 'Deficit'
        },
        benchmarks: {
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
        },
        months,
        transactions: txs,
        alerts: evaluatedAlerts.map(a => ({
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
        aiGenerated: activeFile.aiGenerated
      };
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

