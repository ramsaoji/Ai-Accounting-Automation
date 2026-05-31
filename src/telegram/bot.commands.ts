import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { orchestratorService } from '../services/orchestrator.service.js';
import { getSystemSetting } from '../db/db.client.js';
import { formatCronExpression } from '../utils/cron.js';
import { formatTimestampToDual } from './bot.utils.js';
import { getMainMenuKeyboard } from './bot.keyboards.js';
import { sendSalesSummaryOptions, sendDebitorsSummary } from './bot.callbacks.js';

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
  const welcomeText = `🌟 *${config.BUSINESS_NAME} - AI Financial Command Center* 🌟\n\n` +
    `Welcome, Owner! I am your real-time interactive AI Financial Advisor. I monitor your daily sales registers, debt ledgers, and cashflows.\n\n` +
    `*Available Command Panel:*\n` +
    `📊 *Sales Summary* - View interactive timeframe summaries for Daily Sales.\n` +
    `👥 *Debitors List* - Inspect Top Outstanding Customer Debts & Collection Risk.\n` +
    `🔄 *Sync Ledger* - Manually trigger Google Drive sync & ingestion pipeline.\n` +
    `🩺 *Service Health* - Check accounting service health & active AI engine.\n\n` +
    `💬 *Or just text me any question!* (e.g., 'Compare food vs liquor sales' or 'Who is our top debtor and what is their pending balance?')`;
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
    await telegramClient.sendMessage(
      `❌ *Pipeline Ingestion Encountered an Error:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      statusMessageId
    );
  }
}
