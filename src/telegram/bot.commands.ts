import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { orchestratorService } from '../services/orchestrator.service.js';
import { getSystemSetting } from '../db/db.client.js';
import { formatCronExpression } from '../utils/cron.js';
import { formatTimestampToDual, loadReport } from './bot.utils.js';
import { getMainMenuKeyboard, refreshActiveFileTypesCache } from './bot.keyboards.js';
import {
  sendSalesSummaryOptions,
  sendDebitorsSummary,
  sendGodownStockSummary,
  sendCounterStockSummary,
  sendSalesChart,
  sendDebitorsChart,
  sendStockChart
} from './bot.callbacks.js';

export async function handleCommand(command: string, chatId: string): Promise<void> {
  const cmdClean = command.toLowerCase();

  if (cmdClean === '/start' || cmdClean === '/help' || cmdClean.includes('help') || cmdClean.includes('start')) {
    await sendHelp(chatId);
  } else if (cmdClean === '/status' || cmdClean === '/health' || cmdClean.includes('service health')) {
    await sendHealth(chatId);
  } else if (cmdClean === '/sync' || cmdClean.includes('sync ledger')) {
    await triggerSync(chatId);
  } else if (cmdClean === '/summary' || cmdClean.includes('sales summary')) {
    await sendSalesSummaryOptions(chatId);
  } else if (cmdClean === '/debitors' || cmdClean.includes('debitors list')) {
    await sendDebitorsSummary(chatId);
  } else if (cmdClean === '/stock' || cmdClean === '/godownstock' || cmdClean.includes('godown stock')) {
    await sendGodownStockSummary(chatId);
  } else if (cmdClean === '/counterstock' || cmdClean === '/counter_stock' || cmdClean.includes('counter stock')) {
    await sendCounterStockSummary(chatId);
  } else if (cmdClean === '/chart_sales' || cmdClean === '/chart_cashflow') {
    await sendSalesChart(chatId);
  } else if (cmdClean === '/chart_debitors' || cmdClean === '/chart_ageing') {
    await sendDebitorsChart(chatId);
  } else if (cmdClean === '/chart_godown') {
    await sendStockChart(chatId, 'godown_stock');
  } else if (cmdClean === '/chart_counter') {
    await sendStockChart(chatId, 'counter_stock');
  } else {
    await telegramClient.sendMessage(
      `❓ *Unknown Command*\n\nI didn't recognize that command. Tap the keyboard buttons or type /help to see the available command panel.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId
    );
  }
}

export async function sendHelp(chatId: string): Promise<void> {
  const salesReport = await loadReport('sales');
  const businessName = salesReport?.businessMetadata?.businessName || config.BUSINESS_NAME;

  const welcomeText = `🌟 *${businessName} - AI Financial Command Center* 🌟\n\n` +
    `Welcome, Owner! I am your real-time interactive AI Financial Advisor. I monitor your daily sales registers, debt ledgers, and cashflows.\n\n` +
    `*Available Command Panel:*\n` +
    `📊 *Sales Summary* - View interactive timeframe summaries for Daily Sales.\n` +
    `👥 *Debitors List* - Inspect Top Outstanding Customer Debts & Collection Risk.\n` +
    `🏭 *Godown Stock* - Inspect godown inventory, valuations, and low-stock alerts.\n` +
    `🏪 *Counter Stock* - Inspect counter inventory, valuations, and sales movement.\n` +
    `🔄 *Sync Ledger* - Manually trigger Google Drive sync & ingestion pipeline.\n` +
    `🩺 *Service Health* - Check accounting service health & active AI engine.\n\n` +
    `💬 *Or just text me any question!* (e.g., 'Compare category sales performance' or 'Show current stock valuation')`;
  await telegramClient.sendMessage(welcomeText, 'Markdown', getMainMenuKeyboard(), chatId);
}

export async function sendHealth(chatId: string): Promise<void> {
  const aiProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
  const aiModel = await getSystemSetting('ai_model', config.AI_MODEL);

  const isAiConfigured = aiProvider !== 'none' && aiModel && aiModel !== 'none' && aiModel.trim() !== '';

  const engineDisplay = isAiConfigured ? `\`${aiProvider.toUpperCase()}\`` : `\`DISABLED / OFFLINE\``;
  const modelDisplay = isAiConfigured ? `\`${aiModel}\`` : `\`UNCONFIGURED\``;

  const healthText = `🩺 *Accounting Service Status*\n\n` +
    `🟢 *Status*: Active & Online\n` +
    `🤖 *Active AI Engine*: ${engineDisplay}\n` +
    `🧠 *LLM Model*: ${modelDisplay}\n` +
    `📅 *Sync Schedule*: \`${formatCronExpression(config.CRON_SCHEDULE)}\`\n` +
    `👥 *Authorized Users*: ${config.TELEGRAM_CHAT_ID.length}\n` +
    `🕒 *Server Time*: \`${formatTimestampToDual(new Date().toISOString())}\``;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
      ]
    ]
  };
  await telegramClient.sendMessage(healthText, 'Markdown', inlineKeyboard, chatId);
}

export async function triggerSync(chatId: string): Promise<void> {
  const statusRes = await telegramClient.sendMessage(
    `🔄 *Triggering Google Drive Sync Pipeline...*\n\nIngesting latest spreadsheets, executing validation rules, and compiling AI financial insights. Please hold on...`,
    'Markdown',
    undefined,
    chatId
  );
  const statusMessageId = statusRes.messageId;

  try {
    const filesProcessed = await orchestratorService.runPipeline();
    await refreshActiveFileTypesCache();
    if (filesProcessed === 0) {
      await telegramClient.sendMessage(
        `All spreadsheets are already synced and up-to-date. Skipping pipeline execution.`,
        'Markdown',
        getMainMenuKeyboard(),
        chatId,
        statusMessageId
      );
    } else {
      await telegramClient.sendMessage(
        `✅ *Accounting Ingestion Completed Successfully!*\n\nProcessed latest ledgers. The financial command center dashboard has been synchronized and reports have been generated. Use the buttons below to view updated numbers.`,
        'Markdown',
        getMainMenuKeyboard(),
        chatId,
        statusMessageId
      );
    }
  } catch (err: any) {
    await refreshActiveFileTypesCache().catch(() => {});
    await telegramClient.sendMessage(
      `❌ *Pipeline Ingestion Encountered an Error:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      statusMessageId
    );
  }
}
