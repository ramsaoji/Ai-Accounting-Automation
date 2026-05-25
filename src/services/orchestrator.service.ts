import fs from 'fs';
import path from 'path';
import { driveService } from '../drive/drive.service.js';
import { excelParser } from '../excel/excel.parser.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { aiService } from '../ai/ai.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

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
   * Runs the complete end-to-end accounting ingestion, audit rules, AI reporting, and Telegram notification pipeline.
   */
  async runPipeline(): Promise<void> {
    const startTime = Date.now();
    logger.info('🚀 Initiating AI Accounting Automation Pipeline...');

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
      }

      const filesToProcess: FileToProcess[] = [];

      // Check if a specific file was passed via command line parameter `--file`
      const fileArgIndex = process.argv.indexOf('--file');
      const specificFilePath = fileArgIndex !== -1 && process.argv[fileArgIndex + 1] ? process.argv[fileArgIndex + 1] : undefined;

      if (specificFilePath) {
        const resolvedPath = resolveTargetFile(specificFilePath, inputDir);
        logger.info({ resolvedPath }, '🎯 SPECIFIC FILE TARGET DETECTED. Operating in targeted file run mode.');
        filesToProcess.push({
          name: path.basename(resolvedPath),
          path: resolvedPath,
          buffer: fs.readFileSync(resolvedPath),
        });
      } else if (isMockDrive) {
        logger.info('⚠️ Google Drive credentials are at mock defaults. Operating in BATCH LOCAL FILE MODE.');
        
        // Scan for .xlsx files in data/input
        let files = fs.readdirSync(inputDir)
          .filter(f => f.endsWith('.xlsx'))
          .map(f => {
            const filePath = path.join(inputDir, f);
            const stat = fs.statSync(filePath);
            return { name: f, path: filePath, mtime: stat.mtimeMs };
          })
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length === 0) {
          logger.info(`No Excel spreadsheets found in '${inputDir}'. Automatically seeding a 'sample_ledger.xlsx' template...`);
          
          const { generateSampleExcel } = await import('../scripts/generate-sample.js');
          await generateSampleExcel();

          const sampleSource = path.resolve(process.cwd(), 'sample_ledger.xlsx');
          const sampleDest = path.join(inputDir, 'sample_ledger.xlsx');
          
          fs.copyFileSync(sampleSource, sampleDest);
          fs.unlinkSync(sampleSource);
          
          files = [{
            name: 'sample_ledger.xlsx',
            path: sampleDest,
            mtime: Date.now()
          }];
        }

        for (const fileInfo of files) {
          filesToProcess.push({
            name: fileInfo.name,
            path: fileInfo.path,
            buffer: fs.readFileSync(fileInfo.path),
          });
        }
        logger.info(`Loaded ${filesToProcess.length} local file(s) for batch processing.`);
      } else {
        // 1. Google Drive: Fetch latest Excel workbook
        const fileInfo = await driveService.getLatestExcelFile();
        if (!fileInfo) {
          logger.warn('⚠️ Pipeline aborted: No accounting spreadsheets found in target Google Drive folder.');
          return;
        }

        logger.info({ fileId: fileInfo.id, fileName: fileInfo.name }, 'Processing target Excel sheet from Google Drive');

        // 2. Google Drive: Download file contents as a buffer
        const buffer = await driveService.downloadFile(fileInfo.id, fileInfo.name);
        filesToProcess.push({
          name: fileInfo.name,
          buffer,
        });
      }

      // Process loaded files sequentially
      for (const fileItem of filesToProcess) {
        const { name: fileName, buffer } = fileItem;
        logger.info(`\n🚀 Ingesting file: "${fileName}"`);

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
          const customLimit = limitArgIndex !== -1 && process.argv[limitArgIndex + 1] ? parseInt(process.argv[limitArgIndex + 1], 10) : undefined;
          const debitorsLimit = customLimit && !isNaN(customLimit) ? customLimit : 10;

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

          // 6. Telegram/Local Output: Save MD, HTML, and JSON locally
          if (isMockTelegram) {
            const cleanFileName = fileName.replace(/\.[^/.]+$/, ""); // Strip extension
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
            
            logger.info({ mdPath, htmlPath, jsonPath }, `✅ Unified reports package successfully compiled and written locally.`);
          } else {
            await telegramService.sendReport(reports.markdownReport);
          }
        } catch (fileError) {
          const fileErrMessage = fileError instanceof Error ? fileError.message : String(fileError);
          logger.error({ fileName, error: fileErrMessage }, `❌ Error processing spreadsheet in batch list`);
          
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

      const durationMs = Date.now() - startTime;
      logger.info(
        { 
          processedCount: filesToProcess.length,
          durationSec: Number((durationMs / 1000).toFixed(2)) 
        }, 
        '🎉 AI Accounting Automation Pipeline completed batch execution!'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error }, '❌ Critical failure in orchestrator runPipeline');
      throw error;
    }
  }
}

export const orchestratorService = new OrchestratorService();
