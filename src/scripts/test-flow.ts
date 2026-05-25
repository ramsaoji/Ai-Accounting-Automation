import fs from 'fs';
import path from 'path';
import { excelParser } from '../excel/excel.parser.js';
import { rulesEngine } from '../rules/rules.engine.js';
import { aiService } from '../ai/ai.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { generateSampleExcel } from './generate-sample.js';
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

async function runLocalTest() {
  logger.info('--- 🧪 STARTING LOCAL PIPELINE INTEGRATION TEST (BATCH MODE) ---');
  
  const inputDir = path.resolve(process.cwd(), 'data', 'input');
  const outputDir = path.resolve(process.cwd(), 'data', 'output');

  // Ensure local directories exist
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }


  // Check if a specific file was passed via command line parameter `--file`
  const fileArgIndex = process.argv.indexOf('--file');
  const specificFilePath = fileArgIndex !== -1 && process.argv[fileArgIndex + 1] ? process.argv[fileArgIndex + 1] : undefined;

  let files: { name: string; path: string; mtime: number }[] = [];

  if (specificFilePath) {
    const resolvedPath = resolveTargetFile(specificFilePath, inputDir);
    logger.info({ resolvedPath }, '🎯 SPECIFIC FILE TARGET DETECTED. Operating in targeted file run mode.');
    files = [{
      name: path.basename(resolvedPath),
      path: resolvedPath,
      mtime: Date.now()
    }];
  } else {
    // Scan for .xlsx files in data/input
    files = fs.readdirSync(inputDir)
      .filter(f => f.endsWith('.xlsx'))
      .map(f => {
        const filePath = path.join(inputDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, path: filePath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      logger.info(`No Excel spreadsheets found in '${inputDir}'. Automatically seeding a 'sample_ledger.xlsx' template...`);
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
  }

  logger.info(`Found ${files.length} Excel spreadsheet(s) to process. Initiating execution...`);

  // Loop and process each file in batch
  for (const fileInfo of files) {
    const fileName = fileInfo.name;
    const samplePath = fileInfo.path;

    logger.info(`\n==================================================`);
    logger.info(`📥 BATCH PROCESSING FILE: "${fileName}"`);
    logger.info(`==================================================`);

    logger.info({ samplePath }, 'Reading spreadsheet into memory buffer...');
    const fileBuffer = fs.readFileSync(samplePath);

    // 4. Excel Module: Parse workbook
    const parseResult = await excelParser.parseBuffer(fileBuffer, fileName);
    
    // Consolidate all sheets to avoid manual multi-file tracking
    const allTransactions = parseResult.sheets.flatMap(s => s.transactions);
    const allErrors = parseResult.sheets.flatMap(s => s.errors);

    if (allTransactions.length === 0) {
      logger.info(`Workbook "${fileName}" contains zero valid transactions. Skipping.`);
      continue;
    }

    logger.info(`Consolidating ${parseResult.sheets.length} worksheet(s) into a single master summary...`);

    // 6. Rules Engine: Evaluate business validation rules globally
    const alerts = rulesEngine.evaluate(allTransactions);
    logger.info(`Rules Engine complete. Generated ${alerts.length} business alerts.`);

    // 7. Check AI keys and run AI generation
    const activeProvider = config.AI_PROVIDER;
    const hasApiKey = 
      (activeProvider === 'gemini' && config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'your_gemini_api_key_here') ||
      (activeProvider === 'openai' && config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'your_openai_api_key_here') ||
      (activeProvider === 'claude' && config.CLAUDE_API_KEY && config.CLAUDE_API_KEY !== 'your_claude_api_key_here') ||
      (activeProvider === 'openrouter' && config.OPENROUTER_API_KEY && config.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') ||
      (activeProvider === 'deepseek' && config.DEEPSEEK_API_KEY && config.DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here') ||
      (activeProvider === 'groq' && config.GROQ_API_KEY && config.GROQ_API_KEY !== 'your_groq_api_key_here') ||
      (activeProvider === 'ollama');

    // Parse limit if passed via CLI argument `--limit`
    const limitArgIndex = process.argv.indexOf('--limit');
    const customLimit = limitArgIndex !== -1 && process.argv[limitArgIndex + 1] ? parseInt(process.argv[limitArgIndex + 1], 10) : undefined;
    const debitorsLimit = customLimit && !isNaN(customLimit) ? customLimit : 10;

    let reports: any = null;

    if (hasApiKey) {
      logger.info({ provider: activeProvider }, 'Configured API keys detected. Invoking LIVE AI generation...');
      try {
        reports = await aiService.generateFinancialSummary({
          fileName,
          runTimestamp: new Date().toLocaleString(),
          transactions: allTransactions,
          alerts,
          parsingErrors: allErrors,
          sheets: parseResult.sheets,
          isDebitorsList: parseResult.isDebitorsList,
          debitors: parseResult.sheets.find(s => s.debitors !== undefined)?.debitors,
          debitorsLimit
        });
      } catch (err) {
        logger.error({ err }, 'Live AI generation failed. Falling back to default report template.');
      }
    }

    if (!reports) {
      logger.warn('AI Generation failed or Dry Run mode active.');
      continue;
    }

    // 8. Write final reports locally
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
    
    logger.info({ mdPath, htmlPath, jsonPath }, 'Saved Unified Master Reports Package inside targeted subfolder.');

    // 9. Check Telegram credentials and send message
    const hasTelegramKeys = 
      config.TELEGRAM_BOT_TOKEN && 
      config.TELEGRAM_BOT_TOKEN !== '1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ' &&
      config.TELEGRAM_CHAT_ID && 
      config.TELEGRAM_CHAT_ID !== '-1001234567890';

    if (hasTelegramKeys) {
      logger.info('Active Telegram bot credentials detected. Delivering report to chat...');
      try {
        await telegramService.sendReport(reports.markdownReport);
        logger.info('Telegram test delivery succeeded!');
      } catch (err) {
        logger.error({ err }, 'Telegram test delivery failed.');
      }
    } else {
      logger.warn('Telegram credentials are at default settings. Skipping Telegram dispatch.');
    }
  }

  logger.info('\n--- 🧪 BATCH INTEGRATION TEST RUN COMPLETE ---');
}

// Execute the test run
runLocalTest().catch((error) => {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack : '';
  logger.error({ error: errMsg, stack: errStack }, 'Local pipeline integration test crash');
});
