import fs from 'fs';
import path from 'path';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import { driveService } from '../drive/drive.service.js';
import { excelParser } from '../excel/excel.parser.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { aiService } from '../ai/ai.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { db } from '../db/db.client.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Transaction } from '../types/accounting.types.js';
import { resolveTargetFile } from '../utils/file.js';
import { buildDailySalesArray } from '../utils/accounting.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncMetadata {
  files: {
    [fileName: string]: string; // fileName -> modifiedTime ISO string
  };
}

interface FileToProcess {
  name: string;
  buffer: Buffer;
  path?: string;
  modifiedTime?: string;
}

export interface PipelineOptions {
  /** Run only this specific file instead of the full Drive/local batch. */
  specificFile?: string;
  /** Limit for debitors report (number of top debitors to include). */
  debitorsLimit?: number;
  /** Force local file mode even if Google Drive is active. */
  forceLocal?: boolean;
}

// ─── Sync Metadata Helpers ───────────────────────────────────────────────────

export async function getSyncMetadata(): Promise<SyncMetadata> {
  try {
    const rows = await db.select().from(schema.syncMetadata);
    const filesObj: Record<string, string> = {};
    for (const r of rows) {
      filesObj[r.fileName] = r.modifiedTime;
    }
    return { files: filesObj };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed to read sync-metadata from Drizzle DB');
    return { files: {} };
  }
}

export async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    for (const [fName, mTime] of Object.entries(metadata.files)) {
      await db
        .insert(schema.syncMetadata)
        .values({
          fileName: fName,
          modifiedTime: mTime,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.syncMetadata.fileName,
          set: {
            modifiedTime: mTime,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed to save sync-metadata to Drizzle DB');
  }
}

// ─── Orchestrator Service ────────────────────────────────────────────────────

export class OrchestratorService {
  /**
   * Whether the pipeline is currently executing. Prevents concurrent runs.
   */
  private isRunning = false;
  private syncStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';
  private syncError: string | null = null;
  private syncProgress = {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    statusText: 'Idle',
    files: [] as { name: string; status: 'pending' | 'processing' | 'success' | 'error'; error?: string }[]
  };

  /**
   * Returns the current sync progress.
   */
  get progress() {
    return this.syncProgress;
  }

  /**
   * Checks if there are any new or modified Excel spreadsheets on Google Drive or local input directory.
   * Accepts an optional `specificFile` override (used by CLI scripts — not via HTTP).
   */
  async checkNewFiles(options?: PipelineOptions): Promise<{ hasNew: boolean; newFilesCount: number }> {
    const isMockDrive =
      config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
      config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');

    if (options?.specificFile) {
      // In targeted file mode, we always consider it "new" to ensure it runs
      return { hasNew: true, newFilesCount: 1 };
    }

    if (isMockDrive) {
      throw new Error('Google Drive integration is not configured. Please supply valid credentials in your configuration to enable cloud syncing.');
    }

    // 1. Load sync metadata
    const metadata = await getSyncMetadata();
    let newFilesCount = 0;

    try {
      const driveFiles = await driveService.getAllExcelFiles();
      for (const f of driveFiles) {
        const mtimeStr = f.modifiedTime || f.createdTime || '';
        const lastMtime = metadata.files[f.name];
        if (!lastMtime || lastMtime !== mtimeStr) {
          newFilesCount++;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to check new files in Google Drive.');
      throw new Error('Google Drive API connection failed. Verify your credentials in configuration.');
    }

    return {
      hasNew: newFilesCount > 0,
      newFilesCount,
    };
  }

  /**
   * Runs the complete end-to-end accounting ingestion, audit rules, AI reporting, and Telegram notification pipeline.
   * Protected by a concurrency guard — duplicate invocations while the pipeline is running are safely ignored.
   * Spawns a background Node.js Worker Thread to keep the main Fastify event loop responsive.
   */
  async runPipeline(options?: PipelineOptions): Promise<number> {
    if (this.isRunning) {
      logger.warn('Pipeline is already running. Ignoring duplicate execution request.');
      return 0;
    }
    this.isRunning = true;
    this.syncStatus = 'running';
    this.syncError = null;
    this.syncProgress = {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: '',
      statusText: 'Idle',
      files: []
    };

    logger.info('Initiating background worker thread for AI Accounting Ingestion...');

    return new Promise<number>((resolve, reject) => {
      const isTs = import.meta.url.endsWith('.ts') || import.meta.url.includes('.ts?');
      let worker: Worker;
      try {
        if (isTs) {
          worker = new Worker(
            `
            import { register } from 'tsx/esm/api';
            register();
            await import('${import.meta.url}');
            `,
            { eval: true }
          );
        } else {
          worker = new Worker(new URL(import.meta.url));
        }
      } catch (err: any) {
        logger.error({ err }, 'Failed to initialize worker thread');
        this.isRunning = false;
        this.syncStatus = 'error';
        this.syncError = err.message || String(err);
        reject(err);
        return;
      }

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          this.syncProgress = msg.progress;
        } else if (msg.status === 'success') {
          logger.info('Background worker completed pipeline run successfully');
          this.isRunning = false;
          this.syncStatus = 'success';
          this.syncError = null;
          resolve(msg.filesProcessed ?? 0);
        } else if (msg.status === 'error') {
          const errStr = msg.error || 'Unknown worker error';
          this.isRunning = false;
          this.syncStatus = 'error';
          this.syncError = errStr;
          reject(new Error(errStr));
        }
      });

      worker.on('error', (err) => {
        logger.error({ err }, 'Worker thread encountered a critical error');
        const errStr = err.message || String(err);
        this.isRunning = false;
        this.syncStatus = 'error';
        this.syncError = errStr;
        reject(err);
      });

      worker.on('exit', (code) => {
        this.isRunning = false;
        if (code !== 0) {
          if (this.syncStatus === 'running') {
            const errStr = `Worker thread stopped unexpectedly with exit code ${code}`;
            this.syncStatus = 'error';
            this.syncError = errStr;
            reject(new Error(errStr));
          } else {
            resolve(0);
          }
        } else {
          if (this.syncStatus === 'running') {
            this.syncStatus = 'success';
          }
          resolve(0);
        }
      });

      // Start the pipeline inside the worker thread
      worker.postMessage({ type: 'start', options });
    });
  }

  /**
   * The actual pipeline run logic executed inside the Worker Thread isolate.
   */
  async runPipelineInternal(options?: PipelineOptions): Promise<number> {
    if (this.isRunning) {
      logger.warn('Pipeline is already running in worker thread. Ignoring duplicate execution request.');
      return 0;
    }
    this.isRunning = true;

    const startTime = Date.now();
    logger.info('Initiating AI Accounting Automation Pipeline...');

    // Detect if Google credentials are at their mock defaults
    const isMockDrive =
      config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
      config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');

    // Detect if Telegram credentials are at their mock defaults
    const isMockTelegram =
      config.TELEGRAM_BOT_TOKEN === '1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ' ||
      config.TELEGRAM_CHAT_ID.includes('-1001234567890');

    try {
      const fallbackDir = process.cwd();
      const filesToProcess: FileToProcess[] = [];

      if (options?.specificFile) {
        const resolvedPath = await resolveTargetFile(options.specificFile, fallbackDir);
        logger.info({ resolvedPath }, 'SPECIFIC FILE TARGET DETECTED. Operating in targeted file run mode.');
        filesToProcess.push({
          name: path.basename(resolvedPath),
          path: resolvedPath,
          buffer: await fs.promises.readFile(resolvedPath),
        });
      } else {
        if (isMockDrive) {
          throw new Error('Google Drive integration is not configured. Please supply valid credentials in your configuration to enable cloud syncing.');
        }

        // Google Drive: Fetch and download all Excel workbooks
        const driveFiles = await driveService.getAllExcelFiles();
        if (driveFiles.length === 0) {
          logger.warn('[WARN] Pipeline aborted: No accounting spreadsheets found in target Google Drive folder.');
          return 0;
        }

        logger.info(`Loaded ${driveFiles.length} file(s) from Google Drive for batch processing.`);

        for (const fileInfo of driveFiles) {
          logger.info({ fileId: fileInfo.id, fileName: fileInfo.name }, 'Downloading target Excel sheet from Google Drive');
          const buffer = await driveService.downloadFile(fileInfo.id, fileInfo.name);
          filesToProcess.push({
            name: fileInfo.name,
            buffer,
            modifiedTime: fileInfo.modifiedTime || fileInfo.createdTime || new Date().toISOString(),
          });
        }
      }

      // Load sync metadata and filter to only new/changed files
      const metadata = await getSyncMetadata();
      const filesToIngest = filesToProcess.filter(fileItem => {
        if (!fileItem.modifiedTime) return true; // targeted/CLI mode — always process
        const lastMtime = metadata.files[fileItem.name];
        return !lastMtime || lastMtime !== fileItem.modifiedTime;
      });

      if (filesToIngest.length === 0) {
        logger.info('All spreadsheets are already synced and up-to-date. Skipping pipeline execution.');
        return 0;
      }

      logger.info(`Processing ${filesToIngest.length} of ${filesToProcess.length} file(s) that are new or modified.`);

      // Initialize progress in worker thread
      const progress = {
        totalFiles: filesToIngest.length,
        processedFiles: 0,
        currentFile: '',
        statusText: 'Analyzing files...',
        files: filesToIngest.map(f => ({
          name: f.name,
          status: 'pending' as 'pending' | 'processing' | 'success' | 'error',
          error: undefined as string | undefined
        }))
      };
      if (!isMainThread) {
        parentPort?.postMessage({ type: 'progress', progress });
      }

      let filesProcessedCount = 0;

      // Process loaded files sequentially
      for (const fileItem of filesToIngest) {
        const { name: fileName, buffer } = fileItem;
        logger.info(`Ingesting file: "${fileName}"`);

        // Update progress status to processing
        const fileProgress = progress.files.find(f => f.name === fileName);
        if (fileProgress) {
          fileProgress.status = 'processing';
        }
        progress.currentFile = fileName;
        progress.statusText = `Ingesting and auditing ${fileName}...`;
        if (!isMainThread) {
          parentPort?.postMessage({ type: 'progress', progress });
        }

        try {
          // 1. Excel: Parse sheet rows into typed JSON
          const parseResult = await excelParser.parseBuffer(buffer, fileName);
          const allTransactions = parseResult.sheets.flatMap(s => s.transactions);
          const allErrors = parseResult.sheets.flatMap(s => s.errors);

          if (allTransactions.length === 0) {
            logger.info(`Workbook "${fileName}" contains zero valid transactions. Skipping.`);
            continue;
          }

          logger.info(
            { sheets: parseResult.sheets.length, transactions: allTransactions.length },
            'Auditing and generating unified Master Summary report'
          );

          // 2. Rules Engine: Run modular business validations
          const alerts = await rulesEngine.evaluate(allTransactions);

          const debitorsLimit = options?.debitorsLimit ?? 10;

          // 3. AI Service: Request swappable LLM provider to compile reports
          const timestamp = new Date().toISOString();
          const reports = await aiService.generateFinancialSummary({
            fileName,
            runTimestamp: timestamp,
            transactions: allTransactions,
            alerts,
            parsingErrors: allErrors,
            sheets: parseResult.sheets,
            isDebitorsList: parseResult.isDebitorsList,
            debitors: parseResult.sheets.find(s => s.debitors !== undefined)?.debitors,
            debitorsLimit,
          });

          const cleanFileName = fileName.replace(/\.[^/.]+$/, ''); // Strip extension

          // 4. Build daily-sales array if this is a sales register (shared helper)
          const dailySalesArray = !parseResult.isDebitorsList
            ? buildDailySalesArray(allTransactions)
            : undefined;

          // 4. DB mode: persist relationally to PostgreSQL DB
          try {
            await this.saveToRelationalDb(
              fileName,
              parseResult,
              allTransactions,
              allErrors,
              alerts,
              reports,
              timestamp
            );
            logger.info({ fileName }, 'Persisted ingestion report to relational PostgreSQL DB.');
          } catch (dbErr: unknown) {
            const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
            logger.error({ err: message }, 'Failed to persist parsed output to PostgreSQL DB relationally');
          }

          // 5. Telegram Notification
          if (!isMockTelegram) {
            try {
              const summaryObj = JSON.parse(reports.jsonSummary);

              if (parseResult.isDebitorsList) {
                const agg = summaryObj.aggregates || {};
                const top = summaryObj.topDebitors || [];
                const alertsCount = summaryObj.alerts?.length || 0;

                let summaryText = `🔄 *Google Drive Ingestion Sync Complete* ✅\n` +
                  `📁 *File Ingested*: \`${summaryObj.fileName}\`\n` +
                  `📅 *Sync Time*: \`${summaryObj.timestamp}\`\n\n` +
                  `👥 *Udhari & Debitors Register Summary:*\n` +
                  `• 📖 *Active Credit Accounts*: ${agg.activeDebitorsCount || 0} customers\n` +
                  `• 📉 *Total Credit Extended*: ₹${Math.round(agg.totalDebitSum || 0).toLocaleString()}\n` +
                  `• 📈 *Total Credit Recovered*: ₹${Math.round(agg.totalCreditSum || 0).toLocaleString()}\n` +
                  `• 💰 *Net Balance Outstanding*: *₹${Math.round(agg.totalPendingSum || 0).toLocaleString()}* \n` +
                  `• ✅ *Recovery Success Rate*: ${agg.collectionSuccessRate || 0}%\n\n` +
                  `🔥 *Top Outstanding Debits:*\n`;

                if (top.length > 0) {
                  top.slice(0, 5).forEach((d: { name: string; pending?: number }, i: number) => {
                    const pendingVal = d.pending ?? 0;
                    const riskLevel = pendingVal > 20000 ? 'High Risk 🚨' : pendingVal > 5000 ? 'Medium Alert ⚠️' : 'Healthy ✅';
                    summaryText += `${i + 1}. *${d.name}*: ₹${Math.round(pendingVal).toLocaleString()} (Risk: _${riskLevel}_)\n`;
                  });
                } else {
                  summaryText += `_No pending debtor accounts found!_\n`;
                }

                if (alertsCount > 0) {
                  summaryText += `\n⚠️ *Audit Exceptions (${alertsCount} alerts detected)*\n`;
                }
                summaryText += `\n💡 _Tip: Tap '👥 Debitors List' below or ask me any question to get strategic recovery advice!_`;
                await telegramService.sendReport(summaryText);
              } else {
                const mt = summaryObj.masterTotals || {};
                const bm = summaryObj.benchmarks || {};
                const alertsCount = summaryObj.alerts?.length || 0;

                let summaryText = `🔄 *Google Drive Ingestion Sync Complete* ✅\n` +
                  `📁 *File Ingested*: \`${summaryObj.fileName}\`\n` +
                  `📅 *Sync Time*: \`${summaryObj.runTimestamp || summaryObj.timestamp || 'N/A'}\`\n\n` +
                  `📊 *Daily Sales & Cashflow Summary:*\n` +
                  `• 🍷 *Liquor Sales*: ₹${Math.round(mt.liquorSales || 0).toLocaleString()} (${bm.liquorPercentage || 0}% of sales)\n` +
                  `• 🍲 *Food Sales*: ₹${Math.round(mt.foodSales || 0).toLocaleString()} (${bm.foodPercentage || 0}% of sales)\n` +
                  `• 💵 *Net Cashflow*: *₹${Math.round(mt.netCashflow || 0).toLocaleString()}* (${mt.surplusStatus || 'N/A'})\n` +
                  `• 🔄 *Credit Recovery Rate*: ${bm.creditRecoveryRate || 0}%\n` +
                  `• 🌟 *Best Month*: ${bm.bestRevenueMonth} (₹${Math.round(bm.bestRevenueValue || 0).toLocaleString()})\n`;

                if (alertsCount > 0) {
                  summaryText += `\n⚠️ *Audit Exceptions (${alertsCount} alerts detected)*\n`;
                }
                summaryText += `\n💡 _Tip: Tap '📊 Sales Summary' below or ask me to compare months!_`;
                await telegramService.sendReport(summaryText);
              }
            } catch (err) {
              logger.error({ err }, 'Failed to format dynamic Telegram summary, falling back to full markdown report');
              await telegramService.sendReport(reports.markdownReport);
            }
          }

          // 6. Update sync metadata
          if (fileItem.modifiedTime) {
            metadata.files[fileName] = fileItem.modifiedTime;
            await saveSyncMetadata(metadata);
          }

          // Update progress status to success
          if (fileProgress) {
            fileProgress.status = 'success';
          }
          progress.processedFiles++;
          filesProcessedCount++;
          if (!isMainThread) {
            parentPort?.postMessage({ type: 'progress', progress });
          }
        } catch (fileError) {
          const fileErrMessage = fileError instanceof Error ? fileError.message : String(fileError);
          logger.error({ fileName, error: fileErrMessage }, '[ERROR] Error processing spreadsheet in batch list');

          // Update progress status to error
          if (fileProgress) {
            fileProgress.status = 'error';
            fileProgress.error = fileErrMessage;
          }
          progress.processedFiles++;
          if (!isMainThread) {
            parentPort?.postMessage({ type: 'progress', progress });
          }

          if (isMockTelegram) {
            logger.error({ fileName, fileErrMessage }, 'FILE PROCESSING CRASH (Mock Telegram Mode)');
          } else {
            try {
              const crashAlert = `🚨 *FILE PROCESSING CRASH*\n\nSpreadsheet *${fileName}* failed during processing:\n\n\`\`\`\n${fileErrMessage}\n\`\`\``;
              await telegramService.sendReport(crashAlert);
            } catch (tgError) {
              logger.error({ tgError }, 'Failed to dispatch file crash notification to Telegram');
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          processedCount: filesToProcess.length,
          durationSec: Number((durationMs / 1000).toFixed(2)),
        },
        '[SUCCESS] AI Accounting Automation Pipeline completed batch execution!'
      );
      return filesProcessedCount;
    } catch (error) {
      logger.error({ error }, '[ERROR] Critical failure in orchestrator runPipeline');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Returns whether the pipeline is currently executing.
   * Used by the HTTP trigger controller to report concurrency conflicts.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Returns the current sync process state.
   */
  get status(): 'idle' | 'running' | 'success' | 'error' {
    return this.syncStatus;
  }

  /**
   * Returns the error message from the last failed sync run, if any.
   */
  get error(): string | null {
    return this.syncError;
  }

  /**
   * Process an uploaded file buffer dynamically through the parsing, rules auditing, AI summary compilation,
   * Neon DB updating, and local file storage pipeline.
   */
  async processFileBuffer(buffer: Buffer, fileName: string): Promise<unknown> {
    const startTime = Date.now();
    logger.info(`Orchestrator ingesting file buffer for "${fileName}"`);

    // 1. Parse the Excel sheet rows
    const parseResult = await excelParser.parseBuffer(buffer, fileName);
    const allTransactions = parseResult.sheets.flatMap(s => s.transactions);
    const allErrors = parseResult.sheets.flatMap(s => s.errors);

    if (allTransactions.length === 0) {
      throw new Error(`Workbook "${fileName}" contains zero valid transactions.`);
    }

    logger.info(
      { sheets: parseResult.sheets.length, transactions: allTransactions.length },
      'Auditing and generating upload summary report'
    );

    // 2. Rules Engine
    const alerts = await rulesEngine.evaluate(allTransactions);

    // 3. AI Service
    const timestamp = new Date().toISOString();
    const reports = await aiService.generateFinancialSummary({
      fileName,
      runTimestamp: timestamp,
      transactions: allTransactions,
      alerts,
      parsingErrors: allErrors,
      sheets: parseResult.sheets,
      isDebitorsList: parseResult.isDebitorsList,
      debitors: parseResult.sheets.find(s => s.debitors !== undefined)?.debitors,
      debitorsLimit: 10,
    });

    const summaryObj = JSON.parse(reports.jsonSummary);

    // 4. Persist to Neon DB relationally
    // 4. Persist to PostgreSQL DB relationally
    try {
      await this.saveToRelationalDb(
        fileName,
        parseResult,
        allTransactions,
        allErrors,
        alerts,
        reports,
        timestamp
      );
      logger.info({ fileName }, 'Persisted uploaded report relationally to PostgreSQL DB.');
    } catch (dbErr: unknown) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error({ err: message }, 'Failed to persist uploaded report relationally to PostgreSQL DB');
    }

    const durationMs = Date.now() - startTime;
    logger.info({ durationSec: (durationMs / 1000).toFixed(2) }, 'Successfully processed uploaded file buffer!');

    return summaryObj;
  }

  /**
   * Decoupled relational database persistence helper.
   * Maps dynamic spreadsheet transactions/snapshots directly to strictly-typed normalized SQL tables,
   * bulk inserting in optimal chunks inside an isolated SQL transaction run.
   */
  async saveToRelationalDb(
    fileName: string,
    parseResult: any,
    allTransactions: any[],
    allErrors: any[],
    alerts: any[],
    reports: any,
    timestamp: string
  ): Promise<void> {
    if (!db) return;
    const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
    const isDebtors = parseResult.isDebitorsList || cleanFileName.toUpperCase().includes('DEBITORS');
    const isStock = cleanFileName.toUpperCase().includes('STOCK');
    const fileType = isDebtors ? 'debitors' : isStock ? 'stock' : 'sales';
    const summaryObj = JSON.parse(reports.jsonSummary);

    await db.transaction(async (tx) => {
      // 1. Mark previous active version of this file as not latest
      await tx
        .update(schema.files)
        .set({ isLatest: false })
        .where(
          and(
            eq(schema.files.fileName, fileName),
            eq(schema.files.isLatest, true)
          )
        );

      // 2. Insert new file run
      const [newFile] = await tx
        .insert(schema.files)
        .values({
          fileName,
          fileType,
          runTimestamp: new Date(timestamp),
          totalRows: allTransactions.length,
          aiSummary: reports.markdownReport,
          aiIntelligence: summaryObj.intelligence || [],
          aiGenerated: !!summaryObj.aiGenerated,
          isLatest: true,
          status: 'success',
        })
        .returning();

      // 3. Insert transactions (finance ledgers)
      if (fileType !== 'stock' && allTransactions.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < allTransactions.length; i += batchSize) {
          const chunk = allTransactions.slice(i, i + batchSize).map(t => ({
            fileId: newFile.id,
            sheetName: t.sheetName || 'Counter',
            date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
            invoiceNumber: t.invoiceNumber || null,
            category: t.category || 'General',
            amount: String(t.amount || 0),
            type: t.type || 'credit',
            vendor: t.vendor || 'Counter',
            particulars: t.description || null,
            metadata: {}
          }));
          await tx.insert(schema.transactions).values(chunk);
        }
      }

      // 4. Insert stock items (inventory)
      if (fileType === 'stock' && allTransactions.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < allTransactions.length; i += batchSize) {
          const chunk = allTransactions.slice(i, i + batchSize).map(t => ({
            fileId: newFile.id,
            sheetName: t.sheetName || 'Stock',
            itemName: t.vendor || t.particulars || 'Item',
            itemCode: t.invoiceNumber || null,
            category: t.category || 'General',
            quantity: '1',
            unitPrice: String(t.amount || 0),
            totalValue: String(t.amount || 0),
            location: cleanFileName.toUpperCase().includes('GODWON') ? 'godown' : 'counter',
            metadata: {}
          }));
          await tx.insert(schema.stockItems).values(chunk);
        }
      }

      // 5. Insert party balances (debtors list)
      const debtorsList = parseResult.sheets.find((s: any) => s.debitors !== undefined)?.debitors || [];
      if (debtorsList.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < debtorsList.length; i += batchSize) {
          const chunk = debtorsList.slice(i, i + batchSize).map((d: any) => ({
            fileId: newFile.id,
            partyName: d.name,
            partyType: 'debtor',
            debit: String(d.debit || 0),
            credit: String(d.credit || 0),
            pending: String(d.pending || 0),
            metadata: {}
          }));
          await tx.insert(schema.partyBalances).values(chunk);
        }
      }

      // 6. Insert audit alerts
      if (alerts.length > 0) {
        await tx.insert(schema.auditAlerts).values(
          alerts.map(a => ({
            fileId: newFile.id,
            ruleId: a.ruleId,
            ruleName: a.ruleName,
            severity: a.severity,
            message: a.message,
          }))
        );
      }

      // 7. Insert parsing errors
      if (allErrors.length > 0) {
        await tx.insert(schema.parsingErrors).values(
          allErrors.map(e => ({
            fileId: newFile.id,
            rowNumber: e.row,
            invoiceNumber: e.invoiceNumber || null,
            errorMessage: e.error,
          }))
        );
      }
    });
  }
}

export const orchestratorService = new OrchestratorService();

// ─── Ingestion Worker Thread Listener ──────────────────────────────────────────
if (!isMainThread) {
  parentPort?.on('message', async (message) => {
    if (message?.type === 'start') {
      try {
        const filesProcessed = await orchestratorService.runPipelineInternal(message.options);
        parentPort?.postMessage({ status: 'success', filesProcessed });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        parentPort?.postMessage({ status: 'error', error: errorMsg });
      }
    }
  });
}
