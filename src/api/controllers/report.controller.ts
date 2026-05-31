import fs from 'fs';
import path from 'path';
import { db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { orchestratorService } from '../../services/orchestrator.service.js';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import { verifyToken } from './security.controller.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../errors.js';

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

    // 2. Query transactions, alerts, and errors concurrently
    const [dbTxs, dbAlerts, dbErrors] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
      db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
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
        severity: a.severity as 'info' | 'low' | 'medium' | 'high' | 'critical',
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

    // 2. Query debtor snapshots, alerts, transactions and errors
    const [dbParty, dbAlerts, dbErrors, dbTxs] = await Promise.all([
      db.select().from(schema.partyBalances).where(eq(schema.partyBalances.fileId, activeFile.id)),
      db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
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
        severity: a.severity as 'info' | 'low' | 'medium' | 'high' | 'critical',
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
      const payload = sessionToken ? verifyToken(sessionToken) : null;
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

    const [dbTxs, dbAlerts, dbErrors] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.fileId, activeFile.id)),
      db.select().from(schema.auditAlerts).where(eq(schema.auditAlerts.fileId, activeFile.id)),
      db.select().from(schema.parsingErrors).where(eq(schema.parsingErrors.fileId, activeFile.id)),
    ]);

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
        alerts: dbAlerts.map(a => ({
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity as 'info' | 'low' | 'medium' | 'high' | 'critical',
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
        alerts: dbAlerts.map(a => ({
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity as 'info' | 'low' | 'medium' | 'high' | 'critical',
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
