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

  let combinedContext = '';

  const salesData = await loadReport('sales');
  if (salesData) {
    const prunedSales = {
      fileName: salesData.fileName,
      timestamp: salesData.runTimestamp || salesData.timestamp || 'N/A',
      totalMonths: salesData.totalMonths ?? salesData.months?.length ?? 0,
      totalTransactions: salesData.totalTransactions,
      masterTotals: salesData.masterTotals,
      benchmarks: salesData.benchmarks,
      months: salesData.months?.map((m: any) => {
        const totalSales = (m.liquor || 0) + (m.food || 0);
        return {
          month: m.sheetName,
          totalSales,
          netCashflow: m.net || 0,
          liquorPercentage: totalSales > 0 ? Number(((m.liquor / totalSales) * 100).toFixed(1)) : 0,
          foodPercentage: totalSales > 0 ? Number(((m.food / totalSales) * 100).toFixed(1)) : 0
        };
      }) || []
    };

    combinedContext += `\n=== ${config.BUSINESS_NAME.toUpperCase()} DAILY SALES SUMMARY ===\n` +
      JSON.stringify(prunedSales, null, 2) + '\n';
  }

  const debitorsData = await loadReport('debitors');
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
    const prompt = `
You are a friendly, encouraging, and experienced local bar-and-restaurant financial consultant.
You are helping the owner of "${config.BUSINESS_NAME}" understand their accounting ledger spreadsheet data.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HIGH-LEVEL FINANCIAL CONTEXT ===
${combinedContext}

=== OWNER'S NEW QUESTION ===
"${query}"

=== INSTRUCTIONS FOR 100% AUDIT ACCURACY ===
1. Persona & Tone: Adopt the persona of an extremely warm, encouraging, local bar-and-restaurant financial expert who is a numbers genius. Address them directly as "${config.BUSINESS_NAME}" or "your restaurant". Use a friendly tone with supportive, expert guidance.
2. Simple Language: Do NOT use dry corporate jargon (no: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline). Use clear local business terms.
3. Strict Mathematical Double-Check:
   - If the owner asks for a numeric filter, range (e.g. "between 5k and 10k"), mathematical aggregate (e.g. "total sum", "average"), or list count, you MUST physically review every single item in the data arrays.
   - Perform a strict inequality check (Min <= Value <= Max). Do NOT guess, approximate, or rely on semantic proximity!
   - Verify every item on your list before writing the final response.
4. Schema-Agnostic Auditing: Adapt your reasoning dynamically to the arrays, keys, and values present in the provided ledger JSON.
5. Currency Formatting (INR Standard):
   - Always format currency values using the Indian Rupee symbol (₹) and Indian standard comma numbering style (e.g. ₹2,60,408 or ₹4,05,44,890). NEVER output raw bare numbers like 2604080 or unformatted USD styles. Make numbers pop by writing them in bold, like *₹26,04,080*.
6. Formatting & Monospaced Telegram Tables (Crucial):
   - Do NOT output long text equations or raw lines for tabular data.
   - For comparisons, monthly revenue/expense data, customer debts, or ranges, you MUST format the data as a clean Markdown Table AND you MUST wrap the entire table inside a pre-formatted, monospaced code block (triple backticks: \` \` \` ). This is critical because normal Markdown tables look completely broken and scrambled on Telegram mobile. A monospaced block forces Telegram to display it in a perfectly aligned, highly readable grid!
     - Example:
       \`\`\`
       | Month    | Revenue     | Status    |
       | -------- | ----------- | --------- |
       | MAY 2025 | ₹26,04,080  | Peak 📈   |
       \`\`\`
7. Emojis and Checklists:
   - Add financial and operational emojis (🍷, 🍲, 💰, 📈, 🚨, ⚠️, ✅) at the start of bullet points, lists, and headers to create a premium visual interface.
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
