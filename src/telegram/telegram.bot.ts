import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { orchestratorService } from '../services/orchestrator.service.js';
import { AiProviderFactory } from '../ai/ai.factory.js';
import { getReconstructedReport } from '../api/controllers/report.controller.js';
import { formatCronExpression } from '../utils/cron.js';
import { getSystemSetting } from '../db/db.client.js';

/**
 * Formats an ISO timestamp or date string to show all configured user timezones.
 */
function formatTimestampToDual(ts?: string): string {
  if (!ts) return 'Never';
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) {
    return ts; // Fallback to raw string
  }
  const timezones = config.TELEGRAM_TIMEZONES && config.TELEGRAM_TIMEZONES.length > 0
    ? config.TELEGRAM_TIMEZONES
    : ['Asia/Kolkata'];

  function getTzAbbrev(tz: string, date: Date): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      }).formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : tz;
    } catch {
      return tz;
    }
  }

  const formatted = timezones.map(tz => {
    const timeStr = parsed.toLocaleString('en-US', {
      timeZone: tz,
      hour12: true
    });
    const abbrev = getTzAbbrev(tz, parsed);
    return `${timeStr} ${abbrev}`;
  });

  return formatted.join(' / ');
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

/**
 * Extracts a Date object from a month-year label (e.g. "May 2026")
 * for accurate chronological sorting.
 */
function getMonthYearDate(label: string): Date {
  const cleanLabel = label.trim().toLowerCase();
  const parts = cleanLabel.split(/\s+/);
  if (parts.length === 2) {
    const monthIndex = MONTH_NAMES.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);
    if (monthIndex !== -1 && !isNaN(year)) {
      return new Date(year, monthIndex, 1);
    }
  }
  // Fallback pattern matching
  let foundMonth = 0;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (cleanLabel.includes(MONTH_NAMES[i])) {
      foundMonth = i;
      break;
    }
  }
  const yearMatch = cleanLabel.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return new Date(year, foundMonth, 1);
  }
  return new Date(0); // Return epoch fallback
}

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from?: {
      id: number;
      first_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

export class TelegramBot {
  private baseUrl: string;
  private offset: number = 0;
  private polling: boolean = false;
  private authorizedChatIds: string[];

  constructor() {
    const token = config.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    // config.TELEGRAM_CHAT_ID is already parsed as string[] by config.ts
    this.authorizedChatIds = config.TELEGRAM_CHAT_ID;
  }

  /**
   * Starts the long polling loop in the background.
   */
  start(): void {
    if (this.polling) {
      logger.warn('Telegram Bot listener is already running.');
      return;
    }
    
    // Detect if Telegram credentials are at their mock/placeholder defaults
    const isMockTelegram = 
      config.TELEGRAM_BOT_TOKEN === '1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ' ||
      this.authorizedChatIds.includes('-1001234567890');

    if (isMockTelegram) {
      logger.warn('[Telegram Bot] Bot is in MOCK mode. Listening loop will not start. Set valid credentials in .env to enable the interactive bot.');
      return;
    }

    this.polling = true;
    logger.info('[Telegram Bot] Starting interactive bot listener loop (Long Polling)...');
    
    // Non-blocking background loop trigger
    this.pollUpdates().catch((err) => {
      logger.error({ err }, 'Critical error in Telegram Bot loop initiation');
    });

    // Send startup online notification to all authorized users
    const startupMsg =
      `🟢 *${config.BUSINESS_NAME} AI — Accounting Service Online*\n\n` +
      `🤖 *AI Engine*: \`${config.AI_PROVIDER.toUpperCase()}\` (${config.AI_MODEL})\n` +
      `📅 *Auto-Sync Schedule*: \`${formatCronExpression(config.CRON_SCHEDULE)}\`\n` +
      `👥 *Authorized Users*: ${this.authorizedChatIds.length}\n\n` +
      `_Tap any button below to get started!_`;
    telegramClient.sendMessage(startupMsg, 'Markdown', this.getMainMenuKeyboard()).catch((err) => {
      logger.warn({ err }, 'Failed to send startup notification to Telegram');
    });
  }

  /**
   * Stops the long polling loop.
   */
  stop(): void {
    this.polling = false;
    logger.info('[Telegram Bot] Interactive bot listener loop stopped.');
  }

  private getMainMenuKeyboard(): Record<string, any> {
    return {
      keyboard: [
        [{ text: '📊 Sales Summary' }, { text: '👥 Debitors List' }],
        [{ text: '🔄 Sync Ledger' }, { text: '🩺 Service Health' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    };
  }

  private async pollUpdates(): Promise<void> {
    while (this.polling) {
      try {
        const url = `${this.baseUrl}/getUpdates?offset=${this.offset}&timeout=20`;
        const response = await axios.get(url, { 
          timeout: 25000, // 25s timeout to allow long poll to resolve
          validateStatus: (status) => status === 200
        });
        
        const data = response.data;

        if (data.ok && data.result && data.result.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            // Run update asynchronously without blocking the polling queue
            this.handleUpdate(update).catch((err) => {
              logger.error({ err, updateId: update.update_id }, 'Error handling background Telegram update');
            });
          }
        }
      } catch (error: any) {
        // If Axios request timed out, that's expected for long-polling (timeout=20), just loop again.
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          continue;
        }
        
        // Handle unauthorized token errors gracefully without crashing the main thread
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          logger.error('Telegram Bot Token is unauthorized or invalid (401). Disabling polling loop.');
          this.polling = false;
          break;
        }

        logger.error({ error: error.message }, 'Error in Telegram update polling sequence');
        // Wait 5 seconds before retrying on network/server errors to avoid hammering the API
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    // 1. Handle Callback Query (Inline Keyboard Buttons)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = String(callbackQuery.message.chat.id);
      const data = callbackQuery.data;
      const queryId = callbackQuery.id;

      // Acknowledge the callback query so the loading clock stops spinning in Telegram
      try {
        const answerUrl = `${this.baseUrl}/answerCallbackQuery`;
        await axios.post(answerUrl, {
          callback_query_id: queryId
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message }, 'Failed to answer callback query');
      }

      try {
        await this.handleCallbackData(data, chatId, callbackQuery.message.message_id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, data }, 'Error processing Telegram callback action');
        try {
          await telegramClient.sendMessage(
            this.formatBotError(error),
            'Markdown',
            this.getMainMenuKeyboard(),
            chatId
          );
        } catch (err) {
          logger.error({ err }, 'Failed to send callback crash message back to chat');
        }
      }
      return;
    }

    if (!update.message || !update.message.text) {
      return;
    }

    const message = update.message;
    const chatId = String(message.chat.id);
    const text = message.text!.trim();
    const username = message.from?.username || message.from?.first_name || 'Owner';

    logger.info({ chatId, text, username }, '[Telegram Bot] Received message');

    // Security Authorization Check — supports multiple authorized users
    if (!this.authorizedChatIds.includes(chatId)) {
      logger.warn({ chatId, authorizedChatIds: this.authorizedChatIds }, '[Telegram Bot] Unauthorized chat access blocked');
      try {
        const warningUrl = `${this.baseUrl}/sendMessage`;
        await axios.post(warningUrl, {
          chat_id: chatId,
          text: `🔒 *Access Restricted*\n\nYour Chat ID (\`${chatId}\`) is not authorized to access ${config.BUSINESS_NAME}'s financial ledger summaries.\n\nIf you are the owner, please add this Chat ID to \`TELEGRAM_CHAT_ID\` in your server's \`.env\` configuration.`,
          parse_mode: 'Markdown'
        });
      } catch (err: any) {
        logger.error({ err: err.message }, 'Failed to dispatch access warning');
      }
      return;
    }

    try {
      const cleanText = text.toLowerCase();
      const isKnownCommand = 
        text.startsWith('/') || 
        ['sales summary', 'debitors list', 'sync ledger', 'service health', 'help', 'start'].some(cmd => cleanText.includes(cmd));

      if (isKnownCommand) {
        await this.handleCommand(text, chatId);
      } else {
        const telegramChatEnabled = (await getSystemSetting('telegram_chat_enabled', 'true')) === 'true';
        const aiProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
        const aiModel = await getSystemSetting('ai_model', config.AI_MODEL);

        const isAiConfigured = aiProvider !== 'none' && aiModel && aiModel !== 'none' && aiModel.trim() !== '';

        if (!telegramChatEnabled || !isAiConfigured) {
          const customExplanation = !isAiConfigured
            ? `no AI model or provider is currently configured in the system settings.`
            : `custom typing and AI consultations are currently disabled by the administrator.`;
          await telegramClient.sendMessage(
            `💬 *AI Chat Advisory Offline*\n\nCustom typing and AI consultations are currently offline because ${customExplanation}\n\n` +
            `💡 *Menu Options Remain Fully Active!* You can still tap the keyboard buttons below (e.g. 📊 *Sales Summary* or 👥 *Debitors List*) to instantly pull real-time numbers from our database!`,
            'Markdown',
            this.getMainMenuKeyboard(),
            chatId
          );
          return;
        }
        await this.handleAiQuery(text, chatId);
      }
    } catch (error: any) {
      logger.error({ error: error.message, text }, 'Error processing Telegram message action');
      try {
        // Reply only to the person who sent the message, not broadcast to all users
        await telegramClient.sendMessage(
          this.formatBotError(error),
          'Markdown',
          this.getMainMenuKeyboard(),
          chatId
        );
      } catch (err) {
        logger.error({ err }, 'Failed to send crash message back to chat');
      }
    }
  }

  private async handleCallbackData(data: string, chatId: string, messageId?: number): Promise<void> {
    logger.info({ data, chatId, messageId }, '[Telegram Bot] Routing callback query');

    if (data === 'sales_today') {
      await this.sendTodaySales(chatId);
    } else if (data === 'sales_month_menu') {
      await this.sendMonthSelectionMenu(chatId, messageId);
    } else if (data === 'sales_master') {
      await this.sendSalesSummary(chatId, messageId);
    } else if (data === 'sales_back') {
      await this.sendSalesSummaryOptions(chatId, messageId);
    } else if (data.startsWith('month_')) {
      const targetMonth = data.replace('month_', '');
      await this.sendSpecificMonthSales(chatId, targetMonth, messageId);
    } else if (data.startsWith('year_')) {
      const targetYear = parseInt(data.replace('year_', ''), 10);
      await this.sendMonthsForYearMenu(chatId, targetYear, messageId);
    } else if (data === 'debitors_menu') {
      await this.sendDebitorsSummary(chatId, messageId);
    } else if (data === 'debitors_summary_metrics') {
      await this.sendDebitorsMetrics(chatId, messageId);
    } else if (data === 'debitors_top_5') {
      await this.sendDebitorsTop5(chatId, messageId);
    } else if (data === 'debitors_high_risk') {
      await this.sendDebitorsHighRisk(chatId, messageId);
    }
  }

  private async handleCommand(command: string, chatId: string): Promise<void> {
    const cmdClean = command.toLowerCase();

    if (cmdClean === '/start' || cmdClean === '/help' || cmdClean.includes('help') || cmdClean.includes('start')) {
      await this.sendHelp(chatId);
    } else if (cmdClean === '/status' || cmdClean === '/health' || cmdClean.includes('service health')) {
      await this.sendHealth(chatId);
    } else if (cmdClean === '/sync' || cmdClean.includes('sync ledger')) {
      await this.triggerSync(chatId);
    } else if (cmdClean === '/summary' || cmdClean.includes('sales summary')) {
      await this.sendSalesSummaryOptions(chatId);
    } else if (cmdClean === '/debitors' || cmdClean.includes('debitors list')) {
      await this.sendDebitorsSummary(chatId);
    } else {
      await telegramClient.sendMessage(
        `❓ *Unknown Command*\n\nI didn't recognize that command. Tap the keyboard buttons or type /help to see the available command panel.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId  // Reply only to sender
      );
    }
  }

  private async sendHelp(chatId: string): Promise<void> {
    const welcomeText = `🌟 *${config.BUSINESS_NAME} - AI Financial Command Center* 🌟\n\n` +
      `Welcome, Owner! I am your real-time interactive AI Financial Advisor. I monitor your daily sales registers, debt ledgers, and cashflows.\n\n` +
      `*Available Command Panel:*\n` +
      `📊 *Sales Summary* - View interactive timeframe summaries for Daily Sales.\n` +
      `👥 *Debitors List* - Inspect Top Outstanding Customer Debts & Collection Risk.\n` +
      `🔄 *Sync Ledger* - Manually trigger Google Drive sync & ingestion pipeline.\n` +
      `🩺 *Service Health* - Check accounting service health & active AI engine.\n\n` +
      `💬 *Or just text me any question!* (e.g., 'Compare food vs liquor sales' or 'Who is our top debtor and what is their pending balance?')`;
    await telegramClient.sendMessage(welcomeText, 'Markdown', this.getMainMenuKeyboard(), chatId);
  }

  private async sendHealth(chatId: string): Promise<void> {
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
      `👥 *Authorized Users*: ${this.authorizedChatIds.length}\n` +
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

  private async triggerSync(chatId: string): Promise<void> {
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
          this.getMainMenuKeyboard(),
          chatId,
          statusMessageId
        );
      } else {
        await telegramClient.sendMessage(
          `✅ *Accounting Ingestion Completed Successfully!*\n\nProcessed latest ledgers. The financial command center dashboard has been synchronized and reports have been generated. Use the buttons below to view updated numbers.`,
          'Markdown',
          this.getMainMenuKeyboard(),
          chatId,
          statusMessageId
        );
      }
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Pipeline Ingestion Encountered an Error:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        statusMessageId
      );
    }
  }

  private async sendSalesSummaryOptions(chatId: string, editMessageId?: number): Promise<void> {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📅 Today's Sales Summary", callback_data: "sales_today" }
        ],
        [
          { text: "📅 View Specific Month", callback_data: "sales_month_menu" }
        ],
        [
          { text: "📊 Master Cumulative Summary", callback_data: "sales_master" }
        ],
        [
          { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
        ]
      ]
    };

    await telegramClient.sendMessage(
      `📊 *${config.BUSINESS_NAME} - Sales Performance Portal*\n\nPlease select the timeframe you wish to view below:`,
      'Markdown',
      inlineKeyboard,
      chatId,
      editMessageId
    );
  }

  private async loadReport(reportType: 'sales' | 'debitors' | 'daily-sales'): Promise<any | null> {
    try {
      if (reportType === 'daily-sales') {
        const salesReport = await getReconstructedReport('sales');
        if (salesReport && salesReport.transactions) {
          const { buildDailySalesArray } = await import('../utils/accounting.js');
          const rawTxs = salesReport.transactions.map((t: any) => ({
            ...t,
            date: new Date(t.date)
          }));
          return buildDailySalesArray(rawTxs);
        }
        return null;
      }
      
      return await getReconstructedReport(reportType);
    } catch (err: any) {
      logger.error({ err: err.message, reportType }, 'Failed to fetch report relationally in Telegram Bot');
      return null;
    }
  }

  private async sendTodaySales(chatId: string): Promise<void> {
    const dailyData = await this.loadReport('daily-sales');
    if (!dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
      return;
    }

    try {
      // The daily data is sorted chronologically with the latest date first!
      const latestDay = dailyData[0];
      
      const rawDate = new Date(latestDay.date);
      const formattedDate = rawDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const inflow = (latestDay.liquor || 0) + (latestDay.food || 0) + (latestDay.creditRecovery || 0);
      const outflow = (latestDay.expenses || 0) + (latestDay.creditExtended || 0);
      const net = inflow - outflow;
      const statusLabel = net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

      const summaryText = `📅 *${config.BUSINESS_NAME} - Daily Sales Summary*\n` +
         `📆 *Date*: *${formattedDate}*\n\n` +
         `• 🍷 *Liquor Counter*: ₹${Math.round(latestDay.liquor || 0).toLocaleString()}\n` +
         `• 🍲 *Food Counter*: ₹${Math.round(latestDay.food || 0).toLocaleString()}\n` +
         `• 📥 *Credit Recovery (Udhari Jama)*: ₹${Math.round(latestDay.creditRecovery || 0).toLocaleString()}\n` +
         `• 🛠️ *Daily Expenses*: ₹${Math.round(latestDay.expenses || 0).toLocaleString()}\n` +
         `• 📤 *Credit Extended (Udhari)*: ₹${Math.round(latestDay.creditExtended || 0).toLocaleString()}\n` +
         `━━━━━━━━━━━━━━━━━━━━━━\n` +
         `• 📥 *Total Inflow*: ₹${Math.round(inflow).toLocaleString()}\n` +
         `• 📤 *Total Outflow*: ₹${Math.round(outflow).toLocaleString()}\n` +
         `• 💵 *Net Balance*: *₹${Math.round(net).toLocaleString()}* (${statusLabel})\n\n` +
         `💡 _Note: This represents the latest fully reconciled business day on record._`;

      await telegramClient.sendMessage(summaryText, 'Markdown', this.getMainMenuKeyboard(), chatId);
    } catch (err: any) {
      logger.error({ err }, 'Failed to read daily sales data');
      await telegramClient.sendMessage(
        `❌ *Failed to read daily sales:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
    }
  }

  private async sendMonthSelectionMenu(chatId: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('sales');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const months = data.months || [];

      if (months.length === 0) {
        await telegramClient.sendMessage(
          `⚠️ *No monthly sheets found in register.*`,
          'Markdown',
          this.getMainMenuKeyboard(),
          chatId,
          editMessageId
        );
        return;
      }

      // Group unique years from the monthly registers
      const yearsSet = new Set<number>();
      let hasOther = false;
      for (const m of months) {
        const dVal = getMonthYearDate(m.sheetName);
        if (dVal.getTime() > 0 && dVal.getFullYear() > 1970) {
          yearsSet.add(dVal.getFullYear());
        } else {
          hasOther = true;
        }
      }

      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

      const buttons: InlineKeyboardButton[][] = [];
      for (let i = 0; i < sortedYears.length; i += 2) {
        const row: InlineKeyboardButton[] = [];
        row.push({ text: `📅 Year ${sortedYears[i]}`, callback_data: `year_${sortedYears[i]}` });
        if (i + 1 < sortedYears.length) {
          row.push({ text: `📅 Year ${sortedYears[i + 1]}`, callback_data: `year_${sortedYears[i + 1]}` });
        }
        buttons.push(row);
      }

      if (hasOther) {
        buttons.push([{ text: '📁 Other Sheets', callback_data: 'year_0' }]);
      }

      buttons.push([{ text: '◀️ Back to Options', callback_data: 'sales_back' }]);

      await telegramClient.sendMessage(
        `📅 *${config.BUSINESS_NAME} - Select Year*\n\nPlease select a year to view its monthly performance summaries:`,
        'Markdown',
        { inline_keyboard: buttons },
        chatId,
        editMessageId
      );
    } catch (err: any) {
      logger.error({ err }, 'Failed to generate year selection menu');
      await telegramClient.sendMessage(
        `❌ *Error generating year menu:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendMonthsForYearMenu(chatId: string, year: number, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('sales');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const months = data.months || [];
      
      // Filter months by year
      const filtered = months.filter((m: any) => {
        const dVal = getMonthYearDate(m.sheetName);
        const y = dVal.getTime() > 0 ? dVal.getFullYear() : 0;
        if (year === 0) {
          return y <= 1970;
        }
        return y === year;
      });

      if (filtered.length === 0) {
        await telegramClient.sendMessage(
          `⚠️ *No monthly sheets found for Year ${year === 0 ? 'Other' : year}.*`,
          'Markdown',
          this.getMainMenuKeyboard(),
          chatId,
          editMessageId
        );
        return;
      }

      // Sort chronologically from newest (latest) to oldest
      const sortedYearMonths = filtered.sort((a: any, b: any) => getMonthYearDate(b.sheetName).getTime() - getMonthYearDate(a.sheetName).getTime());
      
      const buttons: InlineKeyboardButton[][] = [];
      for (let i = 0; i < sortedYearMonths.length; i += 3) {
        const row: InlineKeyboardButton[] = [];
        row.push({ text: sortedYearMonths[i].sheetName, callback_data: `month_${sortedYearMonths[i].sheetName.replace(/\s/g, '_')}` });
        
        if (i + 1 < sortedYearMonths.length) {
          row.push({ text: sortedYearMonths[i + 1].sheetName, callback_data: `month_${sortedYearMonths[i + 1].sheetName.replace(/\s/g, '_')}` });
        }
        
        if (i + 2 < sortedYearMonths.length) {
          row.push({ text: sortedYearMonths[i + 2].sheetName, callback_data: `month_${sortedYearMonths[i + 2].sheetName.replace(/\s/g, '_')}` });
        }
        buttons.push(row);
      }

      buttons.push([
        { text: '◀️ Back to Years', callback_data: 'sales_month_menu' },
        { text: '📊 Back to Options', callback_data: 'sales_back' }
      ]);

      await telegramClient.sendMessage(
        `📅 *${config.BUSINESS_NAME} - ${year === 0 ? 'Other Sheets' : `Year ${year}`}* \n\nPlease select a month to view its performance summary:`,
        'Markdown',
        { inline_keyboard: buttons },
        chatId,
        editMessageId
      );
    } catch (err: any) {
      logger.error({ err, year }, 'Failed to generate months selection menu for year');
      await telegramClient.sendMessage(
        `❌ *Error generating months menu for year:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendSpecificMonthSales(chatId: string, targetMonth: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('sales');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const months = data.months || [];

      const cleanTarget = targetMonth.toLowerCase().replace(/_/g, '').trim();
      const mData = months.find((m: { sheetName: string }) => m.sheetName.toLowerCase().replace(/\s/g, '') === cleanTarget.replace(/\s/g, ''));

      if (!mData) {
        await telegramClient.sendMessage(
          `⚠️ *Month not found in ledger database: "${targetMonth.replace(/_/g, ' ')}"*`,
          'Markdown',
          this.getMainMenuKeyboard(),
          chatId,
          editMessageId
        );
        return;
      }

      const inflows = (mData.liquor || 0) + (mData.food || 0) + (mData.creditRecovery || 0);
      const outflows = (mData.expenses || 0) + (mData.creditExtended || 0);
      const net = inflows - outflows;
      const statusLabel = net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

      const summaryText = `📅 *${config.BUSINESS_NAME} - ${mData.sheetName} Sales Summary*\n\n` +
        `• 🍷 *Liquor Sales*: ₹${Math.round(mData.liquor || 0).toLocaleString()}\n` +
        `• 🍲 *Food Sales*: ₹${Math.round(mData.food || 0).toLocaleString()}\n` +
        `• 📥 *Credit Recovery (Udhari Jama)*: ₹${Math.round(mData.creditRecovery || 0).toLocaleString()}\n` +
        `• 🛠️ *Operating Expenses*: ₹${Math.round(mData.expenses || 0).toLocaleString()}\n` +
        `• 📤 *Credit Extended (Udhari)*: ₹${Math.round(mData.creditExtended || 0).toLocaleString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• 📥 *Total Inflow*: ₹${Math.round(inflows || 0).toLocaleString()}\n` +
        `• 📤 *Total Outflow*: ₹${Math.round(outflows || 0).toLocaleString()}\n` +
        `• 💵 *Net Cashflow*: *₹${Math.round(net || 0).toLocaleString()}* (${statusLabel})\n\n` +
        `💬 _Tip: Tap 'Select Another Month' to compare different periods!_`;

      const match = mData.sheetName.match(/\b(20\d{2})\b/);
      const year = match ? parseInt(match[1], 10) : 0;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            ...(year ? [{ text: `◀️ Back to ${year}`, callback_data: `year_${year}` }] : []),
            { text: '📅 Select Month', callback_data: 'sales_month_menu' }
          ],
          [
            { text: '📊 Back to Options', callback_data: 'sales_back' }
          ]
        ]
      };

      await telegramClient.sendMessage(summaryText, 'Markdown', inlineKeyboard, chatId, editMessageId);
    } catch (err: any) {
      logger.error({ err }, 'Failed to read specific month sales');
      await telegramClient.sendMessage(
        `❌ *Error loading month sales:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendSalesSummary(chatId: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('sales');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const summaryText = `📊 *${config.BUSINESS_NAME} - Daily Sales Summary*\n` +
        `📅 *Audited Months*: ${data.totalMonths} months (${data.totalTransactions} transactions)\n` +
        `🕒 *Last Ingested*: \`${formatTimestampToDual(data.runTimestamp || data.timestamp)}\`\n\n` +
        `*Key Financial Metrics:*\n` +
        `• 🍷 *Liquor Sales*: ₹${Math.round(data.masterTotals?.liquorSales || 0).toLocaleString()} (${data.benchmarks?.liquorPercentage || 0}% of sales)\n` +
        `• 🍲 *Food Sales*: ₹${Math.round(data.masterTotals?.foodSales || 0).toLocaleString()} (${data.benchmarks?.foodPercentage || 0}% of sales)\n` +
        `• 💵 *Net Cashflow*: ₹${Math.round(data.masterTotals?.netCashflow || 0).toLocaleString()} (${data.masterTotals?.surplusStatus || 'N/A'})\n` +
        `• 🔄 *Credit Recovery Rate*: ${data.benchmarks?.creditRecoveryRate || 0}%\n` +
        `• 🌟 *Best Month*: ${data.benchmarks?.bestRevenueMonth} (₹${Math.round(data.benchmarks?.bestRevenueValue || 0).toLocaleString()})\n\n` +
        `💬 _Tip: Ask me 'Compare sales across months' or 'Explain cashflow surplus' for an AI breakdown!_`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '◀️ Back to Options', callback_data: 'sales_back' }
          ]
        ]
      };

      await telegramClient.sendMessage(summaryText, 'Markdown', inlineKeyboard, chatId, editMessageId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read Sales Summary:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendDebitorsSummary(chatId: string, editMessageId?: number): Promise<void> {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Credit & Collection Summary", callback_data: "debitors_summary_metrics" }
        ],
        [
          { text: "🔥 Top Outstanding Debits", callback_data: "debitors_top_5" }
        ],
        [
          { text: "🚨 High Risk Accounts (>₹20k)", callback_data: "debitors_high_risk" }
        ],
        [
          { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
        ]
      ]
    };

    await telegramClient.sendMessage(
      `👥 *${config.BUSINESS_NAME} - Debitors & Credit Directory*\n\nSelect an option below to view customer debts and credit tracking details:`,
      'Markdown',
      inlineKeyboard,
      chatId,
      editMessageId
    );
  }

  private async sendDebitorsMetrics(chatId: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('debitors');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Debitors Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const agg = data.aggregates || {};
      const metricsText = `📊 *${config.BUSINESS_NAME} - Credit & Collection Metrics*\n` +
        `🕒 *Last Ingested*: \`${formatTimestampToDual(data.timestamp || data.runTimestamp)}\`\n\n` +
        `• 📖 *Active Credit Accounts*: ${agg.activeDebitorsCount || 0} customers\n` +
        `• 📉 *Total Credit Extended*: ₹${Math.round(agg.totalDebitSum || 0).toLocaleString()}\n` +
        `• 📈 *Total Credit Recovered*: ₹${Math.round(agg.totalCreditSum || 0).toLocaleString()}\n` +
        `• 💰 *Net Balance Outstanding*: *₹${Math.round(agg.totalPendingSum || 0).toLocaleString()}*\n` +
        `• ✅ *Collection Success Rate*: *${agg.collectionSuccessRate || 0}%*\n\n` +
        `💡 _Collection rate measures the percentage of total credit extended that has been successfully recovered._`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
          ]
        ]
      };

      await telegramClient.sendMessage(metricsText, 'Markdown', inlineKeyboard, chatId, editMessageId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read Debitors Metrics:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendDebitorsTop5(chatId: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('debitors');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Debitors Summary Found*`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const top = data.topDebitors || [];
      let text = `🔥 *${config.BUSINESS_NAME} - Top 5 Outstanding Customer Debits*\n\n`;

      if (top.length > 0) {
         top.slice(0, 5).forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
           const pendingVal = d.pending ?? d.pendingBalance ?? 0;
           const riskLevel = pendingVal > 20000 ? 'High Risk 🚨' : pendingVal > 5000 ? 'Medium Alert ⚠️' : 'Healthy ✅';
           text += `${i + 1}. *${d.name}*: *₹${Math.round(pendingVal).toLocaleString()}* (Risk: _${riskLevel}_)\n`;
         });
      } else {
        text += `_No pending debtor accounts found!_\n`;
      }

      text += `\n💬 _Tip: Ask me 'Suggest a recovery plan for ${top[0]?.name || 'debtors'}' for AI strategic advice!_`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
          ]
        ]
      };

      await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read Top Debitors:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async sendDebitorsHighRisk(chatId: string, editMessageId?: number): Promise<void> {
    const data = await this.loadReport('debitors');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Debitors Summary Found*`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    try {
      const top = data.allDebitors || data.topDebitors || [];
      const highRisk = top.filter((d: any) => {
        const pendingVal = d.pending ?? d.pendingBalance ?? 0;
        return pendingVal > 20000;
      });

      let text = `🚨 *${config.BUSINESS_NAME} - High Risk Customer Debits (>₹20,000)*\n\n`;

      if (highRisk.length > 0) {
         highRisk.forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
           const pendingVal = d.pending ?? d.pendingBalance ?? 0;
           text += `${i + 1}. *${d.name}*: *₹${Math.round(pendingVal).toLocaleString()}*\n`;
         });
      } else {
        text += `_No high risk debtor accounts found with outstanding balances exceeding ₹20,000!_\n`;
      }

      text += `\n💬 _Tip: Direct collection effort immediately to these accounts to recover cashflow._`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
          ]
        ]
      };

      await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read High Risk Debitors:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
    }
  }

  private async handleAiQuery(query: string, chatId: string): Promise<void> {
    // Guard query length for AI queries
    if (query.length > 1000) {
      await telegramClient.sendMessage(
        `⚠️ *Query Too Long*\n\nYour question is too long (*${query.length}* characters). Please keep your analysis queries under *1,000 characters* so the AI engine can focus and process it efficiently.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
      return;
    }

    // Send standard analysis acknowledgement only to the querying user and store its ID
    const statusRes = await telegramClient.sendMessage(
      `🤖 *Analyzing ledger data. Just a moment...*`,
      'Markdown',
      this.getMainMenuKeyboard(),
      chatId
    );
    const statusMessageId = statusRes.messageId;

    let combinedContext = '';

    const salesData = await this.loadReport('sales');
    if (salesData) {
      // Prune list items to avoid token overflow while preserving master numbers
      const prunedSales = {
        fileName: salesData.fileName,
        timestamp: salesData.runTimestamp || salesData.timestamp || 'N/A',
        totalMonths: salesData.totalMonths,
        totalTransactions: salesData.totalTransactions,
        masterTotals: salesData.masterTotals,
        benchmarks: salesData.benchmarks,
        months: salesData.months?.map((m: {
          month: string;
          totalSales: number;
          netCashflow: number;
          liquorPercentage: number;
          foodPercentage: number;
        }) => ({
          month: m.month,
          totalSales: m.totalSales,
          netCashflow: m.netCashflow,
          liquorPercentage: m.liquorPercentage,
          foodPercentage: m.foodPercentage
        })) || []
      };

      combinedContext += `\n=== ${config.BUSINESS_NAME.toUpperCase()} DAILY SALES SUMMARY ===\n` +
        JSON.stringify(prunedSales, null, 2) + '\n';
    }

    const debitorsData = await this.loadReport('debitors');
    if (debitorsData) {
      const prunedDebitors = {
        fileName: debitorsData.fileName,
        timestamp: debitorsData.timestamp || debitorsData.runTimestamp || 'N/A',
        aggregates: debitorsData.aggregates,
        topDebitors: debitorsData.topDebitors?.map((d: {
          name: string;
          pending?: number;
          pendingBalance?: number;
          debit?: number;
          credit?: number;
        }) => ({
          name: d.name,
          pending: d.pending ?? d.pendingBalance ?? 0,
          debit: d.debit,
          credit: d.credit,
          riskLevel: (d.pending ?? d.pendingBalance ?? 0) > 20000 ? 'High Risk' : (d.pending ?? d.pendingBalance ?? 0) > 5000 ? 'Medium Alert' : 'Healthy'
        })) || [],
        allDebitors: debitorsData.allDebitors?.slice(0, 30).map((d: {
          name: string;
          pending?: number;
          pendingBalance?: number;
        }) => ({
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
        this.getMainMenuKeyboard(),
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
      await telegramClient.sendMessage(cleanResponse, 'Markdown', this.getMainMenuKeyboard(), chatId, statusMessageId);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to generate AI insights for query');
      await telegramClient.sendMessage(
        this.formatBotError(err),
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId,
        statusMessageId
      );
    }
  }

  private formatBotError(err: Error | unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    const msgLower = msg.toLowerCase();

    if (msgLower.includes('rate limit') || msgLower.includes('rate_limit') || msgLower.includes('429')) {
      const match = msg.match(/try again in ([^\s]+)/i);
      const waitTime = match ? match[1] || match[0] : 'a few minutes';
      
      return `🤖 *AI Engine Rate Limit Exceeded* ⏳\n\n` +
        `The Groq AI engine is resting due to high query volume. Please try again in *${waitTime}*.\n\n` +
        `💡 *Offline Dashboard is still Active!* You can tap buttons like 📊 *Sales Summary* or 👥 *Debitors List* below to instantly inspect your figures! They are stored locally and don't need AI resources.`;
    }

    if (msgLower.includes('quota') || msgLower.includes('insufficient quota') || msgLower.includes('billing')) {
      return `💳 *AI Service Credits Exhausted* 🚨\n\n` +
        `The AI provider's API billing quota has been fully exhausted.\n\n` +
        `💡 *Recommendation:* Please verify your billing profile or top-up API credits in your console dashboard. In the meantime, all local/offline calculations remain fully operational.`;
    }

    if (msgLower.includes('timeout') || msgLower.includes('enetunreach') || msgLower.includes('econnsent') || msgLower.includes('network')) {
      return `🔌 *Network Connectivity Offline* ⚠️\n\n` +
        `The server was unable to establish a secure connection to the remote AI API.\n\n` +
        `💡 *Recommendation:* Check your server's network link or wait a moment before trying again.`;
    }

    return `❌ *Operation Encountered an Error*\n\n` +
      `We ran into a minor technical issue while executing your request:\n` +
      `\`\`\`\n` +
      `${msg}\n` +
      `\`\`\``;
  }
}

export const telegramBot = new TelegramBot();
