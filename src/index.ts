import http from 'http';
import fs from 'fs';
import path from 'path';
import { schedulerJob } from './scheduler/scheduler.job.js';
import { orchestratorService } from './services/orchestrator.service.js';
import { config } from './config/config.js';
import { logger } from './logger/logger.js';
import { AiProviderFactory } from './ai/ai.factory.js';

// 1. Initialize background cron scheduler
try {
  schedulerJob.start();
} catch (err) {
  logger.fatal({ err }, 'Failed to start background scheduler. Exiting process.');
  process.exit(1);
}

// 2. Spin up a lightweight native HTTP server for Railway / Render health-checks
const server = http.createServer((req, res) => {
  // CORS Headers for API requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const parsedUrl = req.url || '';

  // Health check endpoint
  if (parsedUrl === '/health' || parsedUrl === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'AI Accounting Automation Service',
        provider: config.AI_PROVIDER,
        model: config.AI_MODEL,
        cron: config.CRON_SCHEDULE,
      })
    );
    return;
  }

  // GET: Serve Real-time Parsed Sales Register summary
  if (parsedUrl === '/api/data/sales' && req.method === 'GET') {
    const filePath = path.resolve(process.cwd(), 'data', 'output', 'Hotel Gaurav Daily Sales Register', 'summary.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        logger.error({ err, filePath }, 'Failed to read sales summary JSON file');
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Sales summary dataset not found' }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(data);
    });
    return;
  }

  // GET: Serve Real-time Parsed Debitors summary
  if (parsedUrl === '/api/data/debitors' && req.method === 'GET') {
    const filePath = path.resolve(process.cwd(), 'data', 'output', 'DEBITORS LIST', 'summary.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        logger.error({ err, filePath }, 'Failed to read debitors summary JSON file');
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Debitors summary dataset not found' }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(data);
    });
    return;
  }

  // Trigger manual execution via a secure path (helpful for testing)
  if ((parsedUrl === '/trigger-pipeline' || parsedUrl === '/api/trigger-pipeline') && req.method === 'POST') {
    logger.info('Manual pipeline execution triggered via HTTP POST request');
    
    // Fire-and-forget in background to return early
    orchestratorService.runPipeline().then(() => {
      logger.info('Background manual pipeline execution completed successfully');
    }).catch((err) => {
      logger.error({ err }, 'Manual HTTP pipeline run failed');
    });

    res.writeHead(202, corsHeaders);
    res.end(JSON.stringify({ message: 'Accounting pipeline triggered successfully in background' }));
    return;
  }

  // POST: Real-time Interactive AI Financial Advisor Chat
  if ((parsedUrl === '/chat' || parsedUrl === '/api/chat') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { message, workspace, history } = JSON.parse(body);
        if (!message) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'Message field is required' }));
          return;
        }

        // Determine correct summary file based on requested workspace
        const isDebitors = workspace === 'debitors';
        const folderName = isDebitors ? 'DEBITORS LIST' : 'Hotel Gaurav Daily Sales Register';
        const filePath = path.resolve(process.cwd(), 'data', 'output', folderName, 'summary.json');
        
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, corsHeaders);
          res.end(JSON.stringify({ error: 'Summary data not found. Please trigger pipeline.' }));
          return;
        }

        const rawSummaryData = fs.readFileSync(filePath, 'utf8');
        const summaryJson = JSON.parse(rawSummaryData);

        // Prune the summary JSON to be token-efficient (eliminating up to 114,000 lines of duplicate alert details)
        const prunedSummary: any = {
          fileName: summaryJson.fileName,
          timestamp: summaryJson.timestamp,
          isDebitorsList: !!summaryJson.isDebitorsList,
          aggregates: summaryJson.aggregates,
          topDebitors: summaryJson.topDebitors || [],
          allDebitors: summaryJson.allDebitors || [],
          totalMonths: summaryJson.totalMonths,
          totalTransactions: summaryJson.totalTransactions,
          masterTotals: summaryJson.masterTotals,
          benchmarks: summaryJson.benchmarks,
          months: summaryJson.months,
          alertsCount: summaryJson.alerts ? summaryJson.alerts.length : 0,
          alertsSample: summaryJson.alerts ? summaryJson.alerts.slice(0, 5) : [],
          intelligence: summaryJson.intelligence || [],
          errors: summaryJson.errors || []
        };
        const prunedSummaryString = JSON.stringify(prunedSummary, null, 2);

        // Load AI Provider from factory
        const provider = AiProviderFactory.createProvider();

        let domainContext = '';
        if (isDebitors) {
          domainContext = `
You are helping the owner understand their customer credits, outstanding dues (Udhari), credit recoveries, and collection risk profiles.
Key metrics available:
- Total outstanding credit accounts: ${summaryJson.aggregates?.activeDebitorsCount} customers on books
- Total credit extended (debit sum): ₹${Math.round(summaryJson.aggregates?.totalDebitSum).toLocaleString()}
- Total credit recovered (credit sum): ₹${Math.round(summaryJson.aggregates?.totalCreditSum).toLocaleString()}
- Net outstanding balance dues: ₹${Math.round(summaryJson.aggregates?.totalPendingSum).toLocaleString()}
- Collections success rate: ${summaryJson.aggregates?.collectionSuccessRate}%
- Top outstanding debtor: ${summaryJson.aggregates?.topDebtorName} (₹${Math.round(summaryJson.aggregates?.topDebtorValue).toLocaleString()} pending)
`;
        } else {
          domainContext = `
You are helping the owner understand their restaurant's revenues, expenses, liquor/food splits, trends, and seasonal cashflows.
Key metrics available:
- Total operational months parsed: ${summaryJson.totalMonths} months
- Total audited transactions: ${summaryJson.totalTransactions} items
- Liquor Sales: ₹${Math.round(summaryJson.masterTotals?.liquorSales).toLocaleString()} (${summaryJson.benchmarks?.liquorPercentage}% of sales)
- Food Sales: ₹${Math.round(summaryJson.masterTotals?.foodSales).toLocaleString()} (${summaryJson.benchmarks?.foodPercentage}% of sales)
- Net cashflow position: ₹${Math.round(summaryJson.masterTotals?.netCashflow).toLocaleString()} (${summaryJson.masterTotals?.surplusStatus})
- Credit outstanding gap: ₹${Math.round(summaryJson.benchmarks?.creditOutstandingGap).toLocaleString()} (Recovery rate: ${summaryJson.benchmarks?.creditRecoveryRate}%)
- Best revenue month: ${summaryJson.benchmarks?.bestRevenueMonth} (₹${Math.round(summaryJson.benchmarks?.bestRevenueValue).toLocaleString()})
`;
        }

        let conversationHistoryPrompt = '';
        if (history && Array.isArray(history) && history.length > 0) {
          conversationHistoryPrompt = `
=== CONVERSATION HISTORY ===
${history.map(h => `${h.sender === 'user' ? 'Owner' : 'Advisor'}: ${h.text}`).join('\n')}
`;
        }

        const prompt = `
You are a friendly, encouraging, and experienced local bar-and-restaurant financial consultant.
You are helping the owner of "Hotel Gaurav" understand their accounting ledger spreadsheet data.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HIGH-LEVEL CONTEXT ===
${domainContext}

=== FULL LEDGER DATA ===
${prunedSummaryString}
${conversationHistoryPrompt}

=== OWNER'S NEW QUESTION ===
"${message}"

=== INSTRUCTIONS FOR 100% AUDIT ACCURACY ===
1. Tone & Style: Answer in a warm, encouraging, direct, and supportive tone as their local consultant. Address them directly as "Hotel Gaurav" or "your restaurant".
2. Simple Language: Do NOT use dry corporate jargon (no: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline). Use clear local business terms.
3. Strict Mathematical Double-Check:
   - If the owner asks for a numeric filter, range (e.g. "between 5k and 10k"), mathematical aggregate (e.g. "total sum", "average"), or list count, you MUST physically review every single item in the data arrays (like topDebitors, allDebitors, masterTotals, or months).
   - Perform a strict inequality check (Min <= Value <= Max). Do NOT guess, approximate, or rely on semantic proximity!
   - Example: ₹15,650 is mathematically GREATER than 10k, so it must NEVER appear in a "5k to 10k" query.
   - Verify every item on your list before writing the final response.
4. Schema-Agnostic Auditing (Supports All Spreadsheets):
   - This spreadsheet could be a sales register, debitors ledger, or general expenses workbook. Adapt your reasoning dynamically to the arrays, keys, and values present in the provided ledger JSON.
   - If the data contains customer credits ("allDebitors" or "topDebitors"), perform calculations on those. If it contains monthly sales metrics ("months"), perform calculations on monthly trends.
   - If the requested filter or range contains zero matches, state clearly and supportively that no records fell within that specific criteria in the audited timeframe.
5. Formatting & Dynamic Visual Representation (Crucial):
   - Do NOT output long text equations or highly nested bullets for structured data series.
   - For comparisons, yearly breakdowns, multi-value aggregates, or ranges (e.g. comparing 2024 vs 2025 sales, listing balances, or customer summaries), you MUST format the data as a clean, highly readable Markdown Table.
     - Example Columns: \`Year | Total Liquor Sales | Total Food Sales | Combined Revenue\`
     - Example Columns: \`Customer | Pending Balance | Action Step\`
   - Use Markdown Checklists (\`- [ ] task\`) if the owner asks for checklist items, operational steps, or meeting action points.
   - Keep paragraphs brief and easy to read.
`;

        const aiResponse = await provider.generateText(prompt, {
          temperature: 0.15,
          maxTokens: 1000,
        });

        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ text: aiResponse.trim() }));
      } catch (err: any) {
        logger.error({ err }, 'Error in chat API handler');
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'AI advisor failed to generate response', details: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = config.PORT || 8080;
server.listen(PORT, () => {
  logger.info(
    { 
      port: PORT, 
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      aiModel: config.AI_MODEL 
    }, 
    '[SERVER] HTTP health-check server listening for requests'
  );
  
  // Perform an immediate test run on development startup ONLY if the summaries don't exist yet (first boot check)
  if (config.NODE_ENV === 'development') {
    const salesPath = path.resolve(process.cwd(), 'data', 'output', 'Hotel Gaurav Daily Sales Register', 'summary.json');
    const debitorsPath = path.resolve(process.cwd(), 'data', 'output', 'DEBITORS LIST', 'summary.json');
    const hasData = fs.existsSync(salesPath) && fs.existsSync(debitorsPath);

    if (!hasData) {
      logger.info('Required static financial summaries are missing. Running initial pipeline ingestion on startup...');
      orchestratorService.runPipeline().catch((err) => {
        logger.error({ err }, 'Development startup pipeline run failed');
      });
    } else {
      logger.info('Existing financial summaries found. Skipping startup pipeline execution to conserve API tokens and prevent watch loops. Click "Sync" in the dashboard to force manual updates.');
    }
  }
});

// 3. Graceful Shutdown handlers
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop scheduler
  schedulerJob.stop();

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP healthcheck server closed.');
    logger.info('Service shutdown complete. Goodbye!');
    process.exit(0);
  });

  // Force exit after 10s if sockets remain open
  setTimeout(() => {
    logger.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
export default server;
