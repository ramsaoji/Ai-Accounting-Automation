import fs from 'fs';
import path from 'path';
import { driveService } from '../drive/drive.service.js';
import { excelParser } from '../excel/excel.parser.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { aiService } from '../ai/ai.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { saveReport, getReport } from '../db/db.client.js';

export interface SyncMetadata {
  files: {
    [fileName: string]: string; // fileName -> modifiedTime ISO string
  };
}

export async function getSyncMetadata(inputDir: string): Promise<SyncMetadata> {
  if (config.DATABASE_URL) {
    try {
      const data = await getReport('sync-metadata');
      return data || { files: {} };
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to read sync-metadata from Neon DB');
      return { files: {} };
    }
  } else {
    const metaPath = path.resolve(inputDir, '..', 'output', 'sync-metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        return { files: {} };
      }
    }
    return { files: {} };
  }
}

export async function saveSyncMetadata(inputDir: string, metadata: SyncMetadata): Promise<void> {
  if (config.DATABASE_URL) {
    try {
      await saveReport('sync-metadata', metadata);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to save sync-metadata to Neon DB');
    }
  } else {
    const outputDir = path.resolve(inputDir, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const metaPath = path.resolve(outputDir, 'sync-metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  }
}

function resolveTargetFile(inputFilePath: string, inputDir: string): string {
  // 1. Try raw input path
  let target = path.resolve(process.cwd(), inputFilePath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  // 2. Try with .xlsx extension appended
  target = path.resolve(process.cwd(), inputFilePath + '.xlsx');
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  // 3. Try inside inputDir folder
  target = path.join(inputDir, inputFilePath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  // 4. Try inside inputDir with .xlsx extension appended
  target = path.join(inputDir, inputFilePath + '.xlsx');
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  // 5. Try basename check in inputDir
  const baseName = path.basename(inputFilePath);
  target = path.join(inputDir, baseName);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  // 6. Try basename in inputDir with .xlsx appended
  target = path.join(inputDir, baseName + '.xlsx');
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  throw new Error(`Could not resolve input file "${inputFilePath}" inside the input directory "${inputDir}". Please verify the file exists.`);
}

export class OrchestratorService {
  /**
   * Checks if there are any new or modified Excel spreadsheets on Google Drive or local input directory.
   */
  async checkNewFiles(): Promise<{ hasNew: boolean; newFilesCount: number }> {
    const inputDir = path.resolve(process.cwd(), 'data', 'input');
    const isMockDrive = 
      config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') || 
      config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');

    // 1. Load sync metadata
    const metadata = await getSyncMetadata(inputDir);
    let newFilesCount = 0;

    // Check if a specific file was passed via command line parameter `--file`
    const fileArgIndex = process.argv.indexOf('--file');
    const specificFilePath = fileArgIndex !== -1 && process.argv[fileArgIndex + 1] ? process.argv[fileArgIndex + 1] : undefined;

    if (specificFilePath) {
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
   */
  async runPipeline(): Promise<void> {
    const startTime = Date.now();
    logger.info('Initiating AI Accounting Automation Pipeline...');

    // Detect if Google credentials are at their mock defaults
    const isMockDrive = 
      config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') || 
      config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');

    // Detect if Telegram credentials are at their mock defaults
    const isMockTelegram = 
      config.TELEGRAM_BOT_TOKEN === '1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ' ||
      config.TELEGRAM_CHAT_ID === '-1001234567890';

    try {
      const inputDir = path.resolve(process.cwd(), 'data', 'input');
      const outputDir = path.resolve(process.cwd(), 'data', 'output');

      // Ensure local directories exist
      if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
      }
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }


      interface FileToProcess {
        name: string;
        buffer: Buffer;
        path?: string;
        modifiedTime?: string;
      }

      const filesToProcess: FileToProcess[] = [];

      // Check if a specific file was passed via command line parameter `--file`
      const fileArgIndex = process.argv.indexOf('--file');
      const specificFilePath = fileArgIndex !== -1 && process.argv[fileArgIndex + 1] ? process.argv[fileArgIndex + 1] : undefined;

      if (specificFilePath) {
        const resolvedPath = resolveTargetFile(specificFilePath, inputDir);
        logger.info({ resolvedPath }, 'SPECIFIC FILE TARGET DETECTED. Operating in targeted file run mode.');
        filesToProcess.push({
          name: path.basename(resolvedPath),
          path: resolvedPath,
          buffer: fs.readFileSync(resolvedPath),
        });
      } else if (isMockDrive) {
        logger.info('Google Drive credentials are at mock defaults. Operating in BATCH LOCAL FILE MODE.');
        
        // Scan for .xlsx files in data/input
        let files = fs.readdirSync(inputDir)
          .filter(f => f.endsWith('.xlsx'))
          .map(f => {
            const filePath = path.join(inputDir, f);
            const stat = fs.statSync(filePath);
            return { name: f, path: filePath, mtime: stat.mtimeMs };
          })
          .sort((a, b) => a.mtime - b.mtime); // Sort ascending (oldest first) so newest wins in DB upsert

        if (files.length === 0) {
          logger.warn(`No Excel spreadsheets found in '${inputDir}'. Skipping local batch execution.`);
          return;
        }

        for (const fileInfo of files) {
          filesToProcess.push({
            name: fileInfo.name,
            path: fileInfo.path,
            buffer: fs.readFileSync(fileInfo.path),
            modifiedTime: new Date(fileInfo.mtime).toISOString(),
          });
        }
        logger.info(`Loaded ${filesToProcess.length} local file(s) for batch processing.`);
      } else {
        // 1. Google Drive: Fetch all Excel workbooks
        const driveFiles = await driveService.getAllExcelFiles();
        if (driveFiles.length === 0) {
          logger.warn('[WARN] Pipeline aborted: No accounting spreadsheets found in target Google Drive folder.');
          return;
        }

        logger.info(`Loaded ${driveFiles.length} file(s) from Google Drive for batch processing.`);

        // 2. Google Drive: Download all file contents sequentially
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

      // Load sync metadata
      const metadata = await getSyncMetadata(inputDir);

      // Filter out files that are already synced and unchanged
      const filesToIngest = filesToProcess.filter(fileItem => {
        if (!fileItem.modifiedTime) return true; // targeted file / CLI mode has no modifiedTime set, always process
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
          // 3. Excel: Parse sheet rows into typed JSON and capture ingestion errors
          const parseResult = await excelParser.parseBuffer(buffer, fileName);
          
          // Consolidate all sheets to avoid manual multi-file tracking
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

          // 4. Rules Engine: Run modular business validations globally
          const alerts = rulesEngine.evaluate(allTransactions);

          // Parse limit if passed via CLI argument `--limit`
          const limitArgIndex = process.argv.indexOf('--limit');
          const customLimit = limitArgIndex !== -1 && process.argv[limitArgIndex + 1] ? process.argv[limitArgIndex + 1] : undefined;
          const debitorsLimit = customLimit && !isNaN(parseInt(customLimit, 10)) ? parseInt(customLimit, 10) : 10;

          // 5. AI Service: Request swappable LLM provider to compile all three report layouts
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
            debitorsLimit
          });

          const cleanFileName = fileName.replace(/\.[^/.]+$/, ""); // Strip extension

          // If it is daily sales, compile daily-sales array
          let dailySalesArray: any[] | undefined = undefined;
          if (!parseResult.isDebitorsList) {
            const dailyMap = new Map<string, {
              date: string;
              liquor: number;
              food: number;
              creditRecovery: number;
              expenses: number;
              creditExtended: number;
            }>();

            for (const t of allTransactions) {
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
            dailySalesArray = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
          }

          if (config.DATABASE_URL) {
            // DB mode: persist to Neon DB only — no local disk output
            try {
              const isDebtors = parseResult.isDebitorsList || cleanFileName.toUpperCase().includes('DEBITORS');
              const reportType = isDebtors ? 'debitors' : 'sales';
              const summaryObj = JSON.parse(reports.jsonSummary);
              await saveReport(reportType, summaryObj);
              if (reportType === 'sales' && dailySalesArray) {
                await saveReport('daily-sales', dailySalesArray);
              }
              logger.info({ reportType }, 'Persisted ingestion report to Neon DB.');
            } catch (dbErr: any) {
              logger.error({ err: dbErr.message }, 'Failed to persist parsed output to Neon DB');
            }
          } else {
            // Local mode: write to disk only
            const fileOutputDir = path.resolve(outputDir, cleanFileName);
            if (!fs.existsSync(fileOutputDir)) {
              fs.mkdirSync(fileOutputDir, { recursive: true });
            }
            const mdPath = path.resolve(fileOutputDir, 'summary.md');
            const htmlPath = path.resolve(fileOutputDir, 'summary.html');
            const jsonPath = path.resolve(fileOutputDir, 'summary.json');
            fs.writeFileSync(mdPath, reports.markdownReport);
            fs.writeFileSync(htmlPath, reports.htmlReport);
            fs.writeFileSync(jsonPath, reports.jsonSummary);
            logger.info({ mdPath, htmlPath, jsonPath }, 'Unified reports package written to local disk.');

            if (dailySalesArray) {
              const dailySalesPath = path.resolve(fileOutputDir, 'daily-sales.json');
              fs.writeFileSync(dailySalesPath, JSON.stringify(dailySalesArray, null, 2));
              logger.info({ dailySalesPath }, 'Compiled daily-sales list written locally.');
            }
          }

          if (!isMockTelegram) {
            // Build a crisp, well-formatted, and visually gorgeous Executive Summary for Telegram Sync Complete!
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
                  top.slice(0, 5).forEach((d: any, i: number) => {
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

          // Update and save sync metadata
          if (fileItem.modifiedTime) {
            metadata.files[fileName] = fileItem.modifiedTime;
            await saveSyncMetadata(inputDir, metadata);
          }
        } catch (fileError) {
          const fileErrMessage = fileError instanceof Error ? fileError.message : String(fileError);
          logger.error({ fileName, error: fileErrMessage }, `[ERROR] Error processing spreadsheet in batch list`);
          
          if (isMockTelegram) {
            const crashPath = path.resolve(outputDir, `${fileName}_crash_alert.md`);
            const crashAlert = `🚨 *FILE PROCESSING CRASH*\n\nSpreadsheet *${fileName}* failed during processing:\n\n\`\`\`\n${fileErrMessage}\n\`\`\``;
            fs.writeFileSync(crashPath, crashAlert);
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

      // 7. Dynamic Hub Compile: Regenerate master portal index
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
          durationSec: Number((durationMs / 1000).toFixed(2)) 
        }, 
        '[SUCCESS] AI Accounting Automation Pipeline completed batch execution!'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error }, '[ERROR] Critical failure in orchestrator runPipeline');
      throw error;
    }
  }

  /**
   * Process an uploaded file buffer dynamically through the parsing, rules auditing, AI summary compilation,
   * Neon DB updating, and local file storage pipeline.
   */
  async processFileBuffer(buffer: Buffer, fileName: string): Promise<any> {
    const startTime = Date.now();
    logger.info(`Orchestrator ingesting file buffer for "${fileName}"`);
    
    // 1. Ingest/Parse the Excel sheet rows
    const parseResult = await excelParser.parseBuffer(buffer, fileName);
    
    // Consolidate sheets
    const allTransactions = parseResult.sheets.flatMap(s => s.transactions);
    const allErrors = parseResult.sheets.flatMap(s => s.errors);

    if (allTransactions.length === 0) {
      throw new Error(`Workbook "${fileName}" contains zero valid transactions.`);
    }

    logger.info(
      { sheets: parseResult.sheets.length, transactions: allTransactions.length }, 
      'Auditing and generating upload summary report'
    );

    // 2. Rules Engine: Run modular business validations
    const alerts = rulesEngine.evaluate(allTransactions);

    // 3. AI Service: Request LLM provider to compile summary
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
      debitorsLimit: 10
    });

    const summaryObj = JSON.parse(reports.jsonSummary);

    // 4. Save JSON report payload to Neon DB
    try {
      const isDebtors = parseResult.isDebitorsList || fileName.toUpperCase().includes('DEBITORS');
      const reportType = isDebtors ? 'debitors' : 'sales';
      await saveReport(reportType, summaryObj);

      if (reportType === 'sales') {
        // Compile and save daily-sales list
        const dailyMap = new Map<string, any>();
        for (const t of allTransactions) {
          if (!t.date || isNaN(t.date.getTime())) continue;
          const dateStr = t.date.toISOString().split('T')[0];
          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, {
              date: dateStr,
              liquor: 0,
              food: 0,
              creditRecovery: 0,
              expenses: 0,
              creditExtended: 0
            });
          }
          const dayData = dailyMap.get(dateStr)!;
          const amt = t.amount || 0;
          if (t.category === 'Liquor Revenue') {
            dayData.liquor += amt;
          } else if (t.category === 'Food Revenue') {
            dayData.food += amt;
          } else if (t.category === 'Credit Recovery') {
            dayData.creditRecovery += amt;
          } else if (t.category === 'Operational Expense') {
            dayData.expenses += amt;
          } else if (t.category === 'Credit Extended') {
            dayData.creditExtended += amt;
          }
        }
        const dailySalesArray = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        await saveReport('daily-sales', dailySalesArray);
      }
    } catch (dbErr: any) {
      logger.error({ err: dbErr.message }, 'Failed to persist uploaded report to Neon DB');
    }

    // 5. Write outputs to local disk only if DATABASE_URL is not configured
    if (!config.DATABASE_URL) {
      try {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
        const outputDir = path.resolve(process.cwd(), 'data', 'output', cleanFileName);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(path.resolve(outputDir, 'summary.json'), reports.jsonSummary);
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
