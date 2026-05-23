import fs from 'fs';
import path from 'path';
import { driveService } from '../drive/drive.service.js';
import { excelParser } from '../excel/excel.parser.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { aiService } from '../ai/ai.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

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
      let fileName: string;
      let buffer: Buffer;

      if (isMockDrive) {
        logger.info('⚠️ Google Drive credentials are at mock defaults. Operating in LOCAL FILE MODE.');
        
        const inputDir = path.resolve(process.cwd(), 'data', 'input');
        const outputDir = path.resolve(process.cwd(), 'data', 'output');

        // Ensure local directories exist
        if (!fs.existsSync(inputDir)) {
          fs.mkdirSync(inputDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

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
          
          // Dynamically import the generator to create the file
          const { generateSampleExcel } = await import('../scripts/generate-sample.js');
          await generateSampleExcel();

          const sampleSource = path.resolve(process.cwd(), 'sample_ledger.xlsx');
          const sampleDest = path.join(inputDir, 'sample_ledger.xlsx');
          
          fs.copyFileSync(sampleSource, sampleDest);
          
          files = [{
            name: 'sample_ledger.xlsx',
            path: sampleDest,
            mtime: Date.now()
          }];
        }

        const latestLocalFile = files[0];
        fileName = latestLocalFile.name;
        buffer = fs.readFileSync(latestLocalFile.path);
        logger.info({ fileName, path: latestLocalFile.path }, 'Ingested latest local Excel spreadsheet');
      } else {
        // 1. Google Drive: Fetch latest Excel workbook
        const fileInfo = await driveService.getLatestExcelFile();
        if (!fileInfo) {
          logger.warn('⚠️ Pipeline aborted: No accounting spreadsheets found in target Google Drive folder.');
          return;
        }

        logger.info({ fileId: fileInfo.id, fileName: fileInfo.name }, 'Processing target Excel sheet from Google Drive');

        // 2. Google Drive: Download file contents as a buffer
        fileName = fileInfo.name;
        buffer = await driveService.downloadFile(fileInfo.id, fileInfo.name);
      }

      // 3. Excel: Parse sheet rows into typed JSON and capture ingestion errors
      const parseResult = await excelParser.parseBuffer(buffer, fileName);
      const { transactions, errors: parsingErrors } = parseResult;
      
      if (transactions.length === 0) {
        logger.error({ fileName }, '❌ Ingested spreadsheet contains zero valid transactions. Aborting pipeline.');
        
        const errorAlert = `⚠️ *Accounting System Alert*\n\nThe spreadsheet *${fileName}* was ingested but contains *zero valid transactions*.\n\nErrors encountered:\n${parsingErrors.map(e => `Row ${e.row}: ${e.error}`).slice(0, 10).join('\n')}\n\nPlease inspect the source file immediately.`;
        
        if (isMockTelegram) {
          const alertPath = path.resolve(process.cwd(), 'data', 'output', `${fileName}_error_alert.md`);
          fs.writeFileSync(alertPath, errorAlert);
          logger.warn({ alertPath }, 'Mock Telegram: Written spreadsheet error alert to local output directory');
        } else {
          await telegramService.sendReport(errorAlert);
        }
        return;
      }

      // 4. Rules Engine: Run modular business validations and risk evaluations
      const alerts = rulesEngine.evaluate(transactions);

      // 5. AI Service: Request swappable LLM provider to draft executive financial analysis and summaries
      const timestamp = new Date().toLocaleString();
      const aiSummary = await aiService.generateFinancialSummary({
        fileName,
        runTimestamp: timestamp,
        transactions,
        alerts,
        parsingErrors,
      });

      // 6. Telegram/Local Output: Dispatch or Save final executive summary
      if (isMockTelegram) {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, ""); // Strip extension
        const summaryPath = path.resolve(process.cwd(), 'data', 'output', `${cleanFileName}_summary.md`);
        
        fs.writeFileSync(summaryPath, aiSummary);
        logger.info({ summaryPath }, '✅ In Mock Telegram Mode. AI summary successfully generated and written locally.');
      } else {
        await telegramService.sendReport(aiSummary);
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        { 
          fileName, 
          transactions: transactions.length, 
          alerts: alerts.length, 
          errors: parsingErrors.length,
          durationSec: Number((durationMs / 1000).toFixed(2)) 
        }, 
        '🎉 AI Accounting Automation Pipeline executed successfully!'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error }, '❌ Critical failure in accounting worker pipeline');

      if (isMockTelegram) {
        const crashPath = path.resolve(process.cwd(), 'data', 'output', 'pipeline_crash_alert.md');
        const crashAlert = `🚨 *SYSTEM PIPELINE CRASH*\n\nAn unexpected critical error aborted the AI Accounting Automation pipeline:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check system logs for additional stack trace context.`;
        fs.writeFileSync(crashPath, crashAlert);
        logger.error({ crashPath }, 'Mock Telegram: Written crash notification to local output directory');
      } else {
        try {
          const crashAlert = `🚨 *SYSTEM PIPELINE CRASH*\n\nAn unexpected critical error aborted the AI Accounting Automation pipeline:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check system logs for additional stack trace context.`;
          await telegramService.sendReport(crashAlert);
        } catch (tgError) {
          logger.error({ tgError }, 'Failed to dispatch crash notification to Telegram');
        }
      }

      throw error;
    }
  }
}

export const orchestratorService = new OrchestratorService();

