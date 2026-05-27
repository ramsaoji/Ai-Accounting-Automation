import http from 'http';
import fs from 'fs';
import path from 'path';
import { getReport } from '../../db/db.client.js';
import { AiProviderFactory } from '../../ai/ai.factory.js';
import { logger } from '../../logger/logger.js';
import { corsHeaders } from '../cors.js';
import { config } from '../../config/config.js';

/**
 * POST /chat, POST /api/chat
 * Runs the interactive AI financial advisor session using contextual database statistics.
 */
export function handleAdvisorChat(req: http.IncomingMessage, res: http.ServerResponse): void {
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
      const reportType = isDebitors ? 'debitors' : 'sales';
      
      let summaryJson: any = null;
      const isDbActive = !!config.DATABASE_URL;

      if (isDbActive) {
        try {
          summaryJson = await getReport(reportType);
        } catch (dbErr: any) {
          logger.error({ err: dbErr.message }, 'Failed to fetch chat context from Neon DB');
        }

        if (!summaryJson) {
          res.writeHead(404, corsHeaders);
          res.end(JSON.stringify({ error: 'Summary data not found in database. Please upload spreadsheets.' }));
          return;
        }
      } else {
        const folderName = isDebitors ? 'DEBITORS LIST' : 'Hotel Gaurav Daily Sales Register';
        const filePath = path.resolve(process.cwd(), 'data', 'output', folderName, 'summary.json');
        
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, corsHeaders);
          res.end(JSON.stringify({ error: 'Summary data not found on disk. Please trigger pipeline.' }));
          return;
        }

        const rawSummaryData = fs.readFileSync(filePath, 'utf8');
        summaryJson = JSON.parse(rawSummaryData);
      }

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
}
