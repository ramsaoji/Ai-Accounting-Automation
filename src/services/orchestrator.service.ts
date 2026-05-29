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
import { saveReport, getReport } from '../db/db.client.js';
import type { Transaction } from '../types/accounting.types.js';

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
}

// ─── Sync Metadata Helpers ───────────────────────────────────────────────────

export async function getSyncMetadata(inputDir: string): Promise<SyncMetadata> {
  if (config.DATABASE_URL) {
    try {
      const data = await getReport('sync-metadata');
      return (data as SyncMetadata) || { files: {} };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, 'Failed to read sync-metadata from Neon DB');
      return { files: {} };
    }
  } else {
    const metaPath = path.resolve(inputDir, '..', 'output', 'sync-metadata.json');
    try {
      const raw = await fs.promises.readFile(metaPath, 'utf8');
      return JSON.parse(raw) as SyncMetadata;
    } catch {
      return { files: {} };
    }
  }
}

export async function saveSyncMetadata(inputDir: string, metadata: SyncMetadata): Promise<void> {
  if (config.DATABASE_URL) {
    try {
      await saveReport('sync-metadata', metadata);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, 'Failed to save sync-metadata to Neon DB');
    }
  } else {
    const outputDir = path.resolve(inputDir, '..', 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });
    const metaPath = path.resolve(outputDir, 'sync-metadata.json');
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }
}

// ─── Internal Utilities ──────────────────────────────────────────────────────

async function resolveTargetFile(inputFilePath: string, inputDir: string): Promise<string> {
  const isFile = async (p: string) => {
    try { return (await fs.promises.stat(p)).isFile(); } catch { return false; }
  };

  // 1. Try raw input path
  let target = path.resolve(process.cwd(), inputFilePath);
  if (await isFile(target)) return target;

  // 2. Try with .xlsx extension appended
  target = path.resolve(process.cwd(), inputFilePath + '.xlsx');
  if (await isFile(target)) return target;

  // 3. Try inside inputDir folder
  target = path.join(inputDir, inputFilePath);
  if (await isFile(target)) return target;

  // 4. Try inside inputDir with .xlsx extension appended
  target = path.join(inputDir, inputFilePath + '.xlsx');
  if (await isFile(target)) return target;

  // 5. Try basename check in inputDir
  const baseName = path.basename(inputFilePath);
  target = path.join(inputDir, baseName);
  if (await isFile(target)) return target;

  // 6. Try basename in inputDir with .xlsx appended
  target = path.join(inputDir, baseName + '.xlsx');
  if (await isFile(target)) return target;

  throw new Error(`Could not resolve input file "${inputFilePath}" inside the input directory "${inputDir}". Please verify the file exists.`);
}

/**
 * Compiles a per-day aggregated sales array from a flat transaction list.
 * Shared between runPipeline() and processFileBuffer() to eliminate duplication.
 */
function buildDailySalesArray(transactions: Transaction[]): Array<{
  date: string;
  liquor: number;
  food: number;
  creditRecovery: number;
  expenses: number;
  creditExtended: number;
}> {
  const dailyMap = new Map<string, {
    date: string;
    liquor: number;
    food: number;
    creditRecovery: number;
    expenses: number;
    creditExtended: number;
  }>();

  for (const t of transactions) {
    if (!t.date || isNaN(t.date.getTime())) continue;
    const dateStr = t.date.toISOString().split('T')[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, liquor: 0, food: 0, creditRecovery: 0, expenses: 0, creditExtended: 0 });
    }
    const dayData = dailyMap.get(dateStr)!;
    const amt = t.amount || 0;
    if (t.category === 'Liquor Revenue') dayData.liquor += amt;
    else if (t.category === 'Food Revenue') dayData.food += amt;
    else if (t.category === 'Credit Recovery') dayData.creditRecovery += amt;
    else if (t.category === 'Operational Expense') dayData.expenses += amt;
    else if (t.category === 'Credit Extended') dayData.creditExtended += amt;
  }

  return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Orchestrator Service ────────────────────────────────────────────────────

export class OrchestratorService {
  /**
   * Whether the pipeline is currently executing. Prevents concurrent runs.
   */
  private isRunning = false;

  /**
   * Checks if there are any new or modified Excel spreadsheets on Google Drive or local input directory.
   * Accepts an optional `specificFile` override (used by CLI scripts — not via HTTP).
   */
  async checkNewFiles(options?: PipelineOptions): Promise<{ hasNew: boolean; newFilesCount: number }> {
    const inputDir = path.resolve(process.cwd(), 'data', 'input');
    const isMockDrive =
      config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
      config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');

    // 1. Load sync metadata
    const metadata = await getSyncMetadata(inputDir);
    let newFilesCount = 0;

    if (options?.specificFile) {
      // In targeted file mode, we always consider it "new" to ensure it runs
      return { hasNew: true, newFilesCount: 1 };
    }

    if (isMockDrive) {
      if (!fs.existsSync(inputDir)) {
        return { hasNew: false, newFilesCount: 0 };
      }
      const localFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.xlsx'));
      for (const f of localFiles) {
        const filePath = path.join(inputDir, f);
        const stat = fs.statSync(filePath);
        const mtimeStr = new Date(stat.mtimeMs).toISOString();
        const lastMtime = metadata.files[f];
        if (!lastMtime || lastMtime !== mtimeStr) {
          newFilesCount++;
        }
      }
    } else {
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
        logger.error({ err }, 'Failed to check new files in Google Drive. Assuming new files exist to be safe.');
        return { hasNew: true, newFilesCount: 1 };
      }
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
  async runPipeline(options?: PipelineOptions): Promise<void> {
    if (this.isRunning) {
      logger.warn('Pipeline is already running. Ignoring duplicate execution request.');
      return;
    }
    this.isRunning = true;

    logger.info('Initiating background worker thread for AI Accounting Ingestion...');

    return new Promise<void>((resolve, reject) => {
      // Spawn worker thread targeting this same file (tsx in dev / js in dist in prod)
      const worker = new Worker(new URL(import.meta.url));

      worker.on('message', (msg) => {
        if (msg.status === 'success') {
          logger.info('Background worker completed pipeline run successfully');
          this.isRunning = false;
          resolve();
        } else if (msg.status === 'error') {
          this.isRunning = false;
          reject(new Error(msg.error));
        }
      });

      worker.on('error', (err) => {
        logger.error({ err }, 'Worker thread encountered a critical error');
        this.isRunning = false;
        reject(err);
      });

      worker.on('exit', (code) => {
        this.isRunning = false;
        if (code !== 0) {
          reject(new Error(`Worker thread stopped unexpectedly with exit code ${code}`));
        } else {
          resolve();
        }
      });

      // Start the pipeline inside the worker thread
      worker.postMessage({ type: 'start', options });
    });
  }

  /**
   * The actual pipeline run logic executed inside the Worker Thread isolate.
   */
  async runPipelineInternal(options?: PipelineOptions): Promise<void> {
    // ── Concurrency Guard ──────────────────────────────────────────────────
    if (this.isRunning) {
      logger.warn('Pipeline is already running in worker thread. Ignoring duplicate execution request.');
      return;
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
      const inputDir = path.resolve(process.cwd(), 'data', 'input');
      const outputDir = path.resolve(process.cwd(), 'data', 'output');

      // Ensure local directories exist
      await fs.promises.mkdir(inputDir, { recursive: true });
      await fs.promises.mkdir(outputDir, { recursive: true });

      const filesToProcess: FileToProcess[] = [];

      if (options?.specificFile) {
        const resolvedPath = await resolveTargetFile(options.specificFile, inputDir);
        logger.info({ resolvedPath }, 'SPECIFIC FILE TARGET DETECTED. Operating in targeted file run mode.');
        filesToProcess.push({
          name: path.basename(resolvedPath),
          path: resolvedPath,
          buffer: await fs.promises.readFile(resolvedPath),
        });
      } else if (isMockDrive) {
        logger.info('Google Drive credentials are at mock defaults. Operating in BATCH LOCAL FILE MODE.');

        const dirEntries = await fs.promises.readdir(inputDir);
        const fileStats = await Promise.all(
          dirEntries
            .filter(f => f.endsWith('.xlsx'))
            .map(async (f) => {
              const filePath = path.join(inputDir, f);
              const stat = await fs.promises.stat(filePath);
              return { name: f, path: filePath, mtime: stat.mtimeMs };
            })
        );
        const files = fileStats.sort((a, b) => a.mtime - b.mtime); // Sort ascending (oldest first)

        if (files.length === 0) {
          logger.warn(`No Excel spreadsheets found in '${inputDir}'. Skipping local batch execution.`);
          return;
        }

        for (const fileInfo of files) {
          filesToProcess.push({
            name: fileInfo.name,
            path: fileInfo.path,
            buffer: await fs.promises.readFile(fileInfo.path),
            modifiedTime: new Date(fileInfo.mtime).toISOString(),
          });
        }
        logger.info(`Loaded ${filesToProcess.length} local file(s) for batch processing.`);
      } else {
        // Google Drive: Fetch and download all Excel workbooks
        const driveFiles = await driveService.getAllExcelFiles();
        if (driveFiles.length === 0) {
          logger.warn('[WARN] Pipeline aborted: No accounting spreadsheets found in target Google Drive folder.');
          return;
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
      const metadata = await getSyncMetadata(inputDir);
      const filesToIngest = filesToProcess.filter(fileItem => {
        if (!fileItem.modifiedTime) return true; // targeted/CLI mode — always process
        const lastMtime = metadata.files[fileItem.name];
        return !lastMtime || lastMtime !== fileItem.modifiedTime;
      });

      if (filesToIngest.length === 0) {
        logger.info('All spreadsheets are already synced and up-to-date. Skipping pipeline execution.');
        return;
      }

      logger.info(`Processing ${filesToIngest.length} of ${filesToProcess.length} file(s) that are new or modified.`);

      // Process loaded files sequentially
      for (const fileItem of filesToIngest) {
        const { name: fileName, buffer } = fileItem;
        logger.info(`Ingesting file: "${fileName}"`);

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
          const timestamp = new Date().toLocaleString();
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

          if (config.DATABASE_URL) {
            // DB mode: persist to Neon DB
            try {
              const isDebtors = parseResult.isDebitorsList || cleanFileName.toUpperCase().includes('DEBITORS');
              const reportType = isDebtors ? 'debitors' : 'sales';
              const summaryObj = JSON.parse(reports.jsonSummary);
              await saveReport(reportType, summaryObj);
              if (reportType === 'sales' && dailySalesArray) {
                await saveReport('daily-sales', dailySalesArray);
              }
              logger.info({ reportType }, 'Persisted ingestion report to Neon DB.');
            } catch (dbErr: unknown) {
              const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
              logger.error({ err: message }, 'Failed to persist parsed output to Neon DB');
            }
          } else {
            // Local mode: write to disk
            const fileOutputDir = path.resolve(outputDir, cleanFileName);
            await fs.promises.mkdir(fileOutputDir, { recursive: true });

            await Promise.all([
              fs.promises.writeFile(path.resolve(fileOutputDir, 'summary.md'), reports.markdownReport),
              fs.promises.writeFile(path.resolve(fileOutputDir, 'summary.html'), reports.htmlReport),
              fs.promises.writeFile(path.resolve(fileOutputDir, 'summary.json'), reports.jsonSummary),
            ]);
            logger.info({ fileOutputDir }, 'Unified reports package written to local disk.');

            if (dailySalesArray) {
              const dailySalesPath = path.resolve(fileOutputDir, 'daily-sales.json');
              await fs.promises.writeFile(dailySalesPath, JSON.stringify(dailySalesArray, null, 2));
              logger.info({ dailySalesPath }, 'Compiled daily-sales list written locally.');
            }
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
                  `• 💰 *Net Balance Outstanding*: *₹${Math.round(agg.totalPendingSum || 0).toLocaleString()}*\n` +
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
            await saveSyncMetadata(inputDir, metadata);
          }
        } catch (fileError) {
          const fileErrMessage = fileError instanceof Error ? fileError.message : String(fileError);
          logger.error({ fileName, error: fileErrMessage }, '[ERROR] Error processing spreadsheet in batch list');

          if (isMockTelegram) {
            const crashPath = path.resolve(outputDir, `${fileName}_crash_alert.md`);
            const crashAlert = `🚨 *FILE PROCESSING CRASH*\n\nSpreadsheet *${fileName}* failed during processing:\n\n\`\`\`\n${fileErrMessage}\n\`\`\``;
            await fs.promises.writeFile(crashPath, crashAlert);
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

      // 7. Rebuild master portal index (local mode only)
      try {
        const { rebuildMasterPortal } = await import('../excel/portal.builder.js');
        rebuildMasterPortal(outputDir);
      } catch (portalError) {
        logger.error({ error: portalError }, 'Failed to rebuild Master Control Center portal');
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          processedCount: filesToProcess.length,
          durationSec: Number((durationMs / 1000).toFixed(2)),
        },
        '[SUCCESS] AI Accounting Automation Pipeline completed batch execution!'
      );
    } catch (error) {
      logger.error({ error }, '[ERROR] Critical failure in orchestrator runPipeline');
      throw error;
    } finally {
      // Always release the concurrency guard
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
    const timestamp = new Date().toLocaleString();
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

    // 4. Persist to Neon DB
    try {
      const isDebtors = parseResult.isDebitorsList || fileName.toUpperCase().includes('DEBITORS');
      const reportType = isDebtors ? 'debitors' : 'sales';
      await saveReport(reportType, summaryObj);

      if (reportType === 'sales') {
        // Use shared helper — no more duplicated daily-sales compilation code
        const dailySalesArray = buildDailySalesArray(allTransactions);
        await saveReport('daily-sales', dailySalesArray);
      }
    } catch (dbErr: unknown) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error({ err: message }, 'Failed to persist uploaded report to Neon DB');
    }

    // 5. Write to local disk if DATABASE_URL is not configured
    if (!config.DATABASE_URL) {
      try {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
        const outputDir = path.resolve(process.cwd(), 'data', 'output', cleanFileName);
        await fs.promises.mkdir(outputDir, { recursive: true });
        await fs.promises.writeFile(path.resolve(outputDir, 'summary.json'), reports.jsonSummary);
        logger.info({ outputDir }, 'Summary JSON written to local disk (no-DB mode).');
      } catch (err) {
        logger.warn({ err }, 'Failed to write local output during upload');
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info({ durationSec: (durationMs / 1000).toFixed(2) }, 'Successfully processed uploaded file buffer!');

    return summaryObj;
  }
}

export const orchestratorService = new OrchestratorService();

// ─── Ingestion Worker Thread Listener ──────────────────────────────────────────
if (!isMainThread) {
  parentPort?.on('message', async (message) => {
    if (message?.type === 'start') {
      try {
        await orchestratorService.runPipelineInternal(message.options);
        parentPort?.postMessage({ status: 'success' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        parentPort?.postMessage({ status: 'error', error: errorMsg });
      }
    }
  });
}
