import fs from 'fs';
import path from 'path';
import { getReconstructedReport } from './report.controller.js';
import { AiProviderFactory } from '../../ai/ai.factory.js';
import { getSystemSetting, db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../errors.js';

export const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message must not exceed 4000 characters'),
  workspace: z.enum(['sales', 'debitors', 'godown_stock', 'counter_stock']),
  history: z.array(
    z.object({
      sender: z.enum(['user', 'ai']),
      text: z.string().max(2000),
    })
  ).optional(),
});

type ChatBody = z.infer<typeof chatSchema>;

/**
 * POST /api/chat
 * Runs the interactive AI financial advisor session using contextual database statistics.
 */
export async function handleAdvisorChat(
  request: FastifyRequest<{ Body: ChatBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { message, workspace, history } = request.body;

    const webChatEnabled = (await getSystemSetting('web_chat_enabled', 'true')) === 'true';
    const providerName = await getSystemSetting('ai_provider', config.AI_PROVIDER);
    const modelName = await getSystemSetting('ai_model', config.AI_MODEL);

    if (!webChatEnabled || providerName === 'none' || !modelName || modelName === 'none' || !modelName.trim()) {
      reply.code(503).send({ error: 'AI advisor chat is disabled because no active AI model is configured. Please configure an AI Provider and Model in settings first.' });
      return;
    }

    // Determine correct summary file based on requested workspace
    const reportType = workspace;
    const isDebitors = workspace === 'debitors';
    const isGodownStock = workspace === 'godown_stock' || workspace === 'counter_stock';

    let summaryJson: unknown = null;

    try {
      summaryJson = await getReconstructedReport(reportType);
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error({ err: msg }, 'Failed to fetch chat context from Neon DB');
    }

    if (!summaryJson) {
      reply.code(404).send(Errors.notFound('Summary data in database. Please upload spreadsheets.'));
      return;
    }

    // Cast for downstream usage — summaryJson comes from controlled DB/file output
    const summary = summaryJson as Record<string, unknown>;

    const aggregates = summary.aggregates as Record<string, unknown> | undefined;
    const masterTotals = summary.masterTotals as Record<string, unknown> | undefined;
    const benchmarks = summary.benchmarks as Record<string, unknown> | undefined;

    const rawItems = Array.isArray(summary.items) ? (summary.items as any[]) : [];
    const sortedItems = [...rawItems].sort((a, b) => Number(b.stockOut || 0) - Number(a.stockOut || 0));
    const minimalItems = sortedItems.slice(0, 60).map(item => ({
      name: item.itemName,
      category: item.category,
      stockIn: Number(item.stockIn || 0),
      stockOut: Number(item.stockOut || 0),
      closingStock: Number(item.closingStock || 0),
      costPrice: item.costPrice ? Number(item.costPrice) : null,
      sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
    }));

    // Prune the summary JSON to be token-efficient (eliminating duplicate alert details)
    const prunedSummary = {
      fileName: summary.fileName,
      timestamp: summary.runTimestamp || summary.timestamp,
      isDebitorsList: !!summary.isDebitorsList,
      isGodownStockList: !!summary.isGodownStockList,
      aggregates,
      categoryAggregates: summary.categoryAggregates,
      historicalTrends: summary.historicalTrends,
      itemsSample: minimalItems.slice(0, 15),
      allItems: minimalItems,
      topDebitors: Array.isArray(summary.topDebitors) ? (summary.topDebitors as any[]).slice(0, 10) : [],
      allDebitors: Array.isArray(summary.topDebitors) ? (summary.topDebitors as any[]).slice(0, 50) : [],
      totalMonths: summary.totalMonths,
      totalTransactions: summary.totalTransactions,
      masterTotals,
      benchmarks,
      months: summary.months,
      alertsCount: Array.isArray(summary.alerts) ? summary.alerts.length : 0,
      alertsSample: Array.isArray(summary.alerts) ? summary.alerts.slice(0, 5) : [],
      intelligence: summary.intelligence || [],
      errors: summary.errors || [],
    };
    const prunedSummaryString = JSON.stringify(prunedSummary, null, 2);

    // Load AI Provider from factory dynamically
    const provider = AiProviderFactory.createProvider(providerName, modelName);

    // Find business profile for the branch associated with the file
    let businessName = config.BUSINESS_NAME;
    let industryProfile = 'HOSPITALITY';
    let currency = 'INR';

    try {
      const fileName = summary.fileName as string;
      if (fileName) {
        const fileRecord = await db.select().from(schema.files).where(eq(schema.files.fileName, fileName)).limit(1).then(r => r[0]);
        if (fileRecord?.branchId) {
          const branch = await db.select().from(schema.branches).where(eq(schema.branches.id, fileRecord.branchId)).limit(1).then(r => r[0]);
          if (branch) {
            const biz = await db.select().from(schema.businessEntities).where(eq(schema.businessEntities.id, branch.entityId)).limit(1).then(r => r[0]);
            if (biz) {
              businessName = biz.name;
              industryProfile = biz.industryProfile;
              currency = biz.baseCurrency;
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to resolve dynamic business profile in chat controller');
    }

    let domainContext = '';
    const formattedCurrency = currency === 'INR' ? '₹' : (currency + ' ');

    if (isGodownStock) {
      const inventoryName = workspace === 'counter_stock' ? 'counter' : 'godown';
      const isHospitality = industryProfile === 'HOSPITALITY';
      const volumeLine = isHospitality ? `- Total volume: ${Math.round(Number(aggregates?.totalVolumeLiters ?? 0)).toLocaleString()} Liters\n` : '';
      domainContext = `
You are helping the owner understand their ${inventoryName} inventory, stock levels, valuations, item specifications, and potential audit discrepancies.
Key metrics available:
- Total items tracked: ${summary.totalItems} products
- Valuation at Cost: ${formattedCurrency}${Math.round(Number(aggregates?.totalClosingValue ?? 0)).toLocaleString()}
- Valuation at Retail (Selling): ${formattedCurrency}${Math.round(Number(aggregates?.totalSellingValue ?? 0)).toLocaleString()}
- Total active items (closing stock > 0): ${aggregates?.totalItemsCount} items
${volumeLine}- Stock In / Stock Out transactions count: In: ${aggregates?.stockInCount}, Out: ${aggregates?.stockOutCount}
`;
    } else if (isDebitors) {
      domainContext = `
You are helping the owner understand their customer credits, outstanding dues (Udhari), credit recoveries, and collection risk profiles.
Key metrics available:
- Total outstanding credit accounts: ${aggregates?.activeDebitorsCount} customers on books
- Total credit extended (debit sum): ${formattedCurrency}${Math.round(Number(aggregates?.totalDebitSum ?? 0)).toLocaleString()}
- Total credit recovered (credit sum): ${formattedCurrency}${Math.round(Number(aggregates?.totalCreditSum ?? 0)).toLocaleString()}
- Net outstanding balance dues: ${formattedCurrency}${Math.round(Number(aggregates?.totalPendingSum ?? 0)).toLocaleString()}
- Collections success rate: ${aggregates?.collectionSuccessRate}%
- Top outstanding debtor: ${aggregates?.topDebtorName} (${formattedCurrency}${Math.round(Number(aggregates?.topDebtorValue ?? 0)).toLocaleString()} pending)
`;
    } else {
      // Calculate dynamic category totals across all months
      const categoryTotals: Record<string, number> = {};
      let totalRevenue = 0;
      const monthsList = Array.isArray(summary.months) ? (summary.months as any[]) : [];
      for (const m of monthsList) {
        if (m.departments) {
          for (const [name, val] of Object.entries(m.departments)) {
            if (!name.toLowerCase().includes('recovery') && !name.toLowerCase().includes('jama') && !name.toLowerCase().includes('expense') && !name.toLowerCase().includes('extended')) {
              categoryTotals[name] = (categoryTotals[name] || 0) + Number(val);
              totalRevenue += Number(val);
            }
          }
        }
      }

      let categoryLines = '';
      for (const [name, val] of Object.entries(categoryTotals)) {
        const pct = totalRevenue > 0 ? ((val / totalRevenue) * 100).toFixed(1) : '0.0';
        categoryLines += `- ${name}: ${formattedCurrency}${Math.round(val).toLocaleString()} (${pct}% of sales)\n`;
      }
      if (!categoryLines) {
        const lPct = String(benchmarks?.liquorPercentage || '0.0');
        const fPct = String(benchmarks?.foodPercentage || '0.0');
        categoryLines = `- Primary Revenue: ${formattedCurrency}${Math.round(Number(masterTotals?.liquorSales ?? 0)).toLocaleString()} (${lPct}% of sales)\n` +
                        `- Secondary Revenue: ${formattedCurrency}${Math.round(Number(masterTotals?.foodSales ?? 0)).toLocaleString()} (${fPct}% of sales)\n`;
      }


      domainContext = `
You are helping the owner understand their business revenues, expenses, splits, trends, and seasonal cashflows.
Key metrics available:
- Total operational months parsed: ${summary.totalMonths} months
- Total audited transactions: ${summary.totalTransactions} items
${categoryLines}- Net cashflow position: ${formattedCurrency}${Math.round(Number(masterTotals?.netCashflow ?? 0)).toLocaleString()} (${masterTotals?.surplusStatus})
- Credit outstanding gap: ${formattedCurrency}${Math.round(Number(benchmarks?.creditOutstandingGap ?? 0)).toLocaleString()} (Recovery rate: ${benchmarks?.creditRecoveryRate}%)
- Best revenue month: ${benchmarks?.bestRevenueMonth} (${formattedCurrency}${Math.round(Number(benchmarks?.bestRevenueValue ?? 0)).toLocaleString()})
`;
    }


    let conversationHistoryPrompt = '';
    if (history && Array.isArray(history) && history.length > 0) {
      conversationHistoryPrompt = `
=== CONVERSATION HISTORY ===
${history.map(h => `${h.sender === 'user' ? 'Owner' : 'Advisor'}: ${h.text}`).join('\n')}
`;
    }

    const persona = industryProfile === 'SERVICES'
      ? 'local service business financial consultant'
      : industryProfile === 'RETAIL'
        ? 'local retail financial consultant'
        : 'local hospitality/restaurant consultant';
    const entityTerm = industryProfile === 'SERVICES' ? 'business' : industryProfile === 'RETAIL' ? 'store' : 'restaurant';

    const prompt = `
You are a friendly, encouraging, and experienced ${persona}.
You are helping the owner of "${businessName}" understand their accounting ledger spreadsheet data.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HIGH-LEVEL CONTEXT ===
${domainContext}

=== FULL LEDGER DATA ===
${prunedSummaryString}
${conversationHistoryPrompt}

=== OWNER'S NEW QUESTION ===
"${message}"

=== INSTRUCTIONS FOR 100% AUDIT ACCURACY ===
1. Tone & Style: Answer in a warm, encouraging, direct, and supportive tone as their local consultant. Address them directly as "${businessName}" or "your ${entityTerm}".
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

    reply.code(200).send({ text: aiResponse.trim() });
  } catch (err: unknown) {
    logger.error({ err }, 'Error in chat API handler');
    reply.code(500).send(Errors.internalError('AI advisor failed to generate response'));
  }
}
