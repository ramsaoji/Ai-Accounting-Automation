import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { AiProviderFactory } from '../ai/ai.factory.js';
import { getSystemSetting } from '../db/db.client.js';
import { loadReport } from './bot.utils.js';
import { getMainMenuKeyboard } from './bot.keyboards.js';

export async function handleAiQuery(query: string, chatId: string): Promise<void> {
  // Guard query length for AI queries
  if (query.length > 1000) {
    await telegramClient.sendMessage(
      `⚠️ *Query Too Long*\n\nYour question is too long (*${query.length}* characters). Please keep your analysis queries under *1,000 characters* so the AI engine can focus and process it efficiently.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId
    );
    return;
  }

  // Send standard analysis acknowledgement only to the querying user and store its ID
  const statusRes = await telegramClient.sendMessage(
    `🤖 *Analyzing ledger data. Just a moment...*`,
    'Markdown',
    getMainMenuKeyboard(),
    chatId
  );
  const statusMessageId = statusRes.messageId;

  const salesData = await loadReport('sales');
  const debitorsData = await loadReport('debitors');
  const stockData = await loadReport('godown_stock');

  let combinedContext = '';
  let businessMetadata = salesData?.businessMetadata || debitorsData?.businessMetadata || stockData?.businessMetadata;
  const industryProfile = businessMetadata?.industryProfile || 'HOSPITALITY';
  const businessName = businessMetadata?.businessName || config.BUSINESS_NAME;
  const currency = businessMetadata?.currency || 'INR';

  if (salesData) {
    const prunedSales = {
      fileName: salesData.fileName,
      timestamp: salesData.runTimestamp || salesData.timestamp || 'N/A',
      totalMonths: salesData.totalMonths ?? salesData.months?.length ?? 0,
      totalTransactions: salesData.totalTransactions,
      masterTotals: salesData.masterTotals,
      benchmarks: salesData.benchmarks,
      months: salesData.months?.map((m: any) => {
        const mObj: any = {
          month: m.sheetName,
          netCashflow: m.net || 0,
          inflows: m.inflows || 0,
          outflows: m.outflows || 0,
        };
        if (m.departments) {
          Object.entries(m.departments).forEach(([key, val]) => {
            mObj[`category_${key}`] = val;
          });
        } else {
          mObj.liquor = m.liquor || 0;
          mObj.food = m.food || 0;
        }
        return mObj;
      }) || []
    };

    combinedContext += `\n=== ${businessName.toUpperCase()} DAILY SALES SUMMARY ===\n` +
      JSON.stringify(prunedSales, null, 2) + '\n';
  }

  if (debitorsData) {
    const prunedDebitors = {
      fileName: debitorsData.fileName,
      timestamp: debitorsData.timestamp || debitorsData.runTimestamp || 'N/A',
      aggregates: debitorsData.aggregates,
      topDebitors: debitorsData.topDebitors?.slice(0, 5).map((d: any) => ({
        name: d.name,
        pending: d.pending ?? d.pendingBalance ?? 0,
        debit: d.debit,
        credit: d.credit,
        riskLevel: (d.pending ?? d.pendingBalance ?? 0) > 20000 ? 'High Risk' : (d.pending ?? d.pendingBalance ?? 0) > 5000 ? 'Medium Alert' : 'Healthy'
      })) || [],
      allDebitors: debitorsData.topDebitors?.slice(0, 30).map((d: any) => ({
        name: d.name,
        pending: d.pending ?? d.pendingBalance ?? 0,
        riskLevel: (d.pending ?? d.pendingBalance ?? 0) > 20000 ? 'High Risk' : (d.pending ?? d.pendingBalance ?? 0) > 5000 ? 'Medium Alert' : 'Healthy'
      })) || []
    };

    combinedContext += `\n=== DEBITORS & CREDIT SUMMARY ===\n` +
      JSON.stringify(prunedDebitors, null, 2) + '\n';
  }

  if (stockData) {
    if (!businessMetadata && stockData.businessMetadata) {
      businessMetadata = stockData.businessMetadata;
    }
    const prunedStock = {
      fileName: stockData.fileName,
      timestamp: stockData.runTimestamp || stockData.timestamp || 'N/A',
      totalItems: stockData.totalItems,
      aggregates: stockData.aggregates,
      categoryAggregates: stockData.categoryAggregates || [],
      itemsSample: stockData.items?.slice(0, 15).map((item: any) => ({
        itemName: item.itemName,
        category: item.category,
        closingStock: item.closingStock,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        totalCostValue: item.totalCostValue
      })) || [],
      alertsCount: stockData.alerts?.length || 0,
      alertsSample: stockData.alerts?.slice(0, 5) || []
    };

    combinedContext += `\n=== ${businessName.toUpperCase()} STOCK SUMMARY ===\n` +
      JSON.stringify(prunedStock, null, 2) + '\n';
  }

  if (!combinedContext) {
    await telegramClient.sendMessage(
      `⚠️ *No Financial Records Found*\n\nUnable to access ledger summaries. Please run /sync first to ingest spreadsheets.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      statusMessageId
    );
    return;
  }

  try {
    const activeProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
    const activeModel = await getSystemSetting('ai_model', config.AI_MODEL);
    const provider = AiProviderFactory.createProvider(activeProvider, activeModel);

    const persona = industryProfile === 'SERVICES'
      ? 'local service business financial consultant'
      : industryProfile === 'RETAIL'
        ? 'local retail financial consultant'
        : 'local hospitality/restaurant consultant';
    const entityTerm = industryProfile === 'SERVICES' ? 'business' : industryProfile === 'RETAIL' ? 'store' : 'restaurant';
    const formattedCurrency = currency === 'INR' ? '₹' : (currency + ' ');

    const prompt = `
You are a friendly, encouraging, and experienced ${persona}.
You are helping the owner of "${businessName}" understand their accounting ledger spreadsheet data.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HIGH-LEVEL FINANCIAL CONTEXT ===
${combinedContext}

=== OWNER'S NEW QUESTION ===
"${query}"

=== INSTRUCTIONS FOR 100% AUDIT ACCURACY ===
1. Persona & Tone: Adopt the persona of an extremely warm, encouraging, local ${persona} who is a numbers genius. Address them directly as "${businessName}" or "your ${entityTerm}". Use a friendly tone with supportive, expert guidance.
2. Simple Language: Do NOT use dry corporate jargon (no: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline). Use clear local business terms.
3. Strict Mathematical Double-Check:
   - If the owner asks for a numeric filter, range (e.g. "between 5k and 10k"), mathematical aggregate (e.g. "total sum", "average"), or list count, you MUST physically review every single item in the data arrays.
   - Perform a strict inequality check (Min <= Value <= Max). Do NOT guess, approximate, or rely on semantic proximity!
   - Verify every item on your list before writing the final response.
4. Schema-Agnostic Auditing: Adjust your reasoning dynamically to the arrays, keys, and values present in the provided ledger JSON.
5. Currency Formatting:
   - Always format currency values using the local currency symbol (${formattedCurrency}) and local numbering style. Make numbers pop by writing them in bold, like *${formattedCurrency}26,04,080*.
6. Formatting & Monospaced Telegram Tables (Crucial):
   - Do NOT output long text equations or raw lines for tabular data.
   - For comparisons, monthly revenue/expense data, customer debts, or ranges, you MUST format the data as a clean Markdown Table AND you MUST wrap the entire table inside a pre-formatted, monospaced code block (triple backticks: \` \` \` ). This is critical because normal Markdown tables look completely broken and scrambled on Telegram mobile. A monospaced block forces Telegram to display it in a perfectly aligned, highly readable grid!
     - Example:
       \`\`\`
       | Month    | Revenue     | Status    |
       | -------- | ----------- | --------- |
       | MAY 2025 | ${formattedCurrency}26,04,080  | Peak 📈   |
       \`\`\`
7. Emojis and Checklists:
   - Add financial and operational emojis (💰, 📈, 🚨, ⚠️, ✅) at the start of bullet points, lists, and headers to create a premium visual interface.
   - Use Markdown Checklists (\`- [ ] task\`) if the owner asks for checklists, strategic action steps, or meeting action points.
   - Keep paragraphs short, punchy, and highly readable.
`;

    const response = await provider.generateText(prompt, {
      temperature: 0.15,
      maxTokens: 1000,
    });

    const cleanResponse = response.trim();
    
    // Edit the loading status message in-place with the final response
    await telegramClient.sendMessage(cleanResponse, 'Markdown', getMainMenuKeyboard(), chatId, statusMessageId);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to generate AI insights for query');
    await telegramClient.sendMessage(
      // We import it dynamically if we want or formatBotError from utils
      (await import('./bot.utils.js')).formatBotError(err),
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      statusMessageId
    );
  }
}
