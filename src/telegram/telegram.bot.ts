import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { orchestratorService } from '../services/orchestrator.service.js';
import { AiProviderFactory } from '../ai/ai.factory.js';
import { getReport } from '../db/db.client.js';
import { formatCronExpression } from '../utils/cron.js';

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

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
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
        await this.handleCallbackData(data, chatId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, data }, 'Error processing Telegram callback action');
        try {
          await telegramClient.sendMessage(
            this.formatBotError(error),
            'Markdown',
            this.getMainMenuKeyboard()
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

  private async handleCallbackData(data: string, chatId: string): Promise<void> {
    logger.info({ data, chatId }, '[Telegram Bot] Routing callback query');

    if (data === 'sales_today') {
      await this.sendTodaySales(chatId);
    } else if (data === 'sales_month_menu') {
      await this.sendMonthSelectionMenu(chatId);
    } else if (data === 'sales_master') {
      await this.sendSalesSummary(chatId);
    } else if (data === 'sales_back') {
      await this.sendSalesSummaryOptions(chatId);
    } else if (data.startsWith('month_')) {
      const targetMonth = data.replace('month_', '');
      await this.sendSpecificMonthSales(chatId, targetMonth);
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
    const healthText = `🩺 *Accounting Service Status*\n\n` +
      `🟢 *Status*: Active & Online\n` +
      `🤖 *Active AI Engine*: \`${config.AI_PROVIDER.toUpperCase()}\`\n` +
      `🧠 *LLM Model*: \`${config.AI_MODEL}\`\n` +
      `📅 *Sync Schedule*: \`${formatCronExpression(config.CRON_SCHEDULE)}\`\n` +
      `👥 *Authorized Users*: ${this.authorizedChatIds.length}\n` +
      `🕒 *Server Time*: \`${formatTimestampToDual(new Date().toISOString())}\``;
    await telegramClient.sendMessage(healthText, 'Markdown', this.getMainMenuKeyboard(), chatId);
  }

  private async triggerSync(chatId: string): Promise<void> {
    await telegramClient.sendMessage(
      `🔄 *Triggering Google Drive Sync Pipeline...*\n\nIngesting latest spreadsheets, executing validation rules, and compiling AI financial insights. Please hold on...`,
      'Markdown'
    );

    try {
      await orchestratorService.runPipeline();
      await telegramClient.sendMessage(
        `✅ *Accounting Ingestion Completed Successfully!*\n\nProcessed latest ledgers. The financial command center dashboard has been synchronized and reports have been generated. Use the buttons below to view updated numbers.`,
        'Markdown',
        this.getMainMenuKeyboard()
      );
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Pipeline Ingestion Encountered an Error:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard()
      );
    }
  }

  private async sendSalesSummaryOptions(chatId: string): Promise<void> {
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
        ]
      ]
    };

    await telegramClient.sendMessage(
      `📊 *${config.BUSINESS_NAME} - Sales Performance Portal*\n\nPlease select the timeframe you wish to view below:`,
      'Markdown',
      inlineKeyboard,
      chatId
    );
  }

  private async loadReport(reportType: 'sales' | 'debitors' | 'daily-sales', folderName: string, fileName: string): Promise<any | null> {
    try {
      const dbData = await getReport(reportType);
      if (dbData) return dbData;
    } catch (err: any) {
      logger.error({ err: err.message, reportType }, 'Failed to fetch report from Neon DB in Telegram Bot');
    }

    const filePath = path.resolve(process.cwd(), 'data', 'output', folderName, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to read local report file in Telegram Bot');
      return null;
    }
  }

  private async sendTodaySales(chatId: string): Promise<void> {
    const dailyData = await this.loadReport('daily-sales', `${config.BUSINESS_NAME} Daily Sales Register`, 'daily-sales.json');
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

  private async sendMonthSelectionMenu(chatId: string): Promise<void> {
    const data = await this.loadReport('sales', `${config.BUSINESS_NAME} Daily Sales Register`, 'summary.json');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
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
          chatId
        );
        return;
      }

      // Present the months in reverse chronological order (newest first)
      const sortedMonths = [...months].reverse();
      const buttons: InlineKeyboardButton[][] = [];

      for (let i = 0; i < sortedMonths.length; i += 3) {
        const row: InlineKeyboardButton[] = [];
        const m1 = sortedMonths[i];
        row.push({ text: m1.sheetName, callback_data: `month_${m1.sheetName.replace(/\s/g, '_')}` });
        
        if (i + 1 < sortedMonths.length) {
          const m2 = sortedMonths[i + 1];
          row.push({ text: m2.sheetName, callback_data: `month_${m2.sheetName.replace(/\s/g, '_')}` });
        }
        
        if (i + 2 < sortedMonths.length) {
          const m3 = sortedMonths[i + 2];
          row.push({ text: m3.sheetName, callback_data: `month_${m3.sheetName.replace(/\s/g, '_')}` });
        }
        buttons.push(row);
      }

      buttons.push([{ text: '◀️ Back to Options', callback_data: 'sales_back' }]);

      await telegramClient.sendMessage(
        `📅 *${config.BUSINESS_NAME} - Select Month*\n\nPlease tap a month below to view its performance summary:`,
        'Markdown',
        { inline_keyboard: buttons },
        chatId
      );
    } catch (err: any) {
      logger.error({ err }, 'Failed to generate month selection menu');
      await telegramClient.sendMessage(
        `❌ *Error generating month menu:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
    }
  }

  private async sendSpecificMonthSales(chatId: string, targetMonth: string): Promise<void> {
    const data = await this.loadReport('sales', `${config.BUSINESS_NAME} Daily Sales Register`, 'summary.json');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Ledger Available*`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
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
          chatId
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

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '📅 Select Another Month', callback_data: 'sales_month_menu' },
            { text: '📊 Back to Options', callback_data: 'sales_back' }
          ]
        ]
      };

      await telegramClient.sendMessage(summaryText, 'Markdown', inlineKeyboard, chatId);
    } catch (err: any) {
      logger.error({ err }, 'Failed to read specific month sales');
      await telegramClient.sendMessage(
        `❌ *Error loading month sales:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
    }
  }

  private async sendSalesSummary(chatId: string): Promise<void> {
    const data = await this.loadReport('sales', `${config.BUSINESS_NAME} Daily Sales Register`, 'summary.json');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Sales Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
        'Markdown',
        this.getMainMenuKeyboard()
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

      await telegramClient.sendMessage(summaryText, 'Markdown', this.getMainMenuKeyboard(), chatId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read Sales Summary:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
    }
  }

  private async sendDebitorsSummary(chatId: string): Promise<void> {
    const data = await this.loadReport('debitors', 'DEBITORS LIST', 'summary.json');
    if (!data) {
      await telegramClient.sendMessage(
        `⚠️ *No Debitors Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
      return;
    }

    try {
      const agg = data.aggregates || {};
      const top = data.topDebitors || [];

      let debitorsText = `👥 *${config.BUSINESS_NAME} - Debitors & Credit Summary*\n` +
        `🕒 *Last Ingested*: \`${formatTimestampToDual(data.timestamp || data.runTimestamp)}\`\n\n` +
        `*Credit Book Aggregates:*\n` +
        `• 📖 *Active Credit Accounts*: ${agg.activeDebitorsCount || 0} customers\n` +
        `• 📉 *Total Credit Extended*: ₹${Math.round(agg.totalDebitSum || 0).toLocaleString()}\n` +
        `• 📈 *Total Credit Recovered*: ₹${Math.round(agg.totalCreditSum || 0).toLocaleString()}\n` +
        `• 💰 *Net Balance Outstanding*: ₹${Math.round(agg.totalPendingSum || 0).toLocaleString()}\n` +
        `• ✅ *Collection Success Rate*: ${agg.collectionSuccessRate || 0}%\n\n` +
        `🔥 *Top Outstanding Debits:*\n`;

      if (top.length > 0) {
         top.slice(0, 5).forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
           const pendingVal = d.pending ?? d.pendingBalance ?? 0;
           const riskLevel = pendingVal > 20000 ? 'High Risk 🚨' : pendingVal > 5000 ? 'Medium Alert ⚠️' : 'Healthy ✅';
           debitorsText += `${i + 1}. *${d.name}*: ₹${Math.round(pendingVal).toLocaleString()} (Risk: _${riskLevel}_)\n`;
         });
      } else {
        debitorsText += `_No pending debtor accounts found!_\n`;
      }

      debitorsText += `\n💬 _Tip: Ask me 'Suggest a recovery plan for ${top[0]?.name || 'debtors'}' for AI strategic advice!_`;

      await telegramClient.sendMessage(debitorsText, 'Markdown', this.getMainMenuKeyboard(), chatId);
    } catch (err: any) {
      await telegramClient.sendMessage(
        `❌ *Failed to Read Debitors Summary:*\n\n\`${err.message}\``,
        'Markdown',
        this.getMainMenuKeyboard(),
        chatId
      );
    }
  }

  private async handleAiQuery(query: string, chatId: string): Promise<void> {
    // Send standard analysis acknowledgement only to the querying user
    await telegramClient.sendMessage(
      `🤖 *Analyzing ledger data. Just a moment...*`,
      'Markdown',
      this.getMainMenuKeyboard(),
      chatId
    );

    let combinedContext = '';

    const salesData = await this.loadReport('sales', `${config.BUSINESS_NAME} Daily Sales Register`, 'summary.json');
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

    const debitorsData = await this.loadReport('debitors', 'DEBITORS LIST', 'summary.json');
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
        chatId
      );
      return;
    }

    const provider = AiProviderFactory.createProvider();
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
    
    // Reply only to the user who asked the question
    await telegramClient.sendMessage(cleanResponse, 'Markdown', this.getMainMenuKeyboard(), chatId);
  }

  private formatBotError(err: Error | unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    const msgLower = msg.toLowerCase();

    if (msgLower.includes('rate limit') || msgLower.includes('rate_limit') || msgLower.includes('429')) {
      // Find the wait duration if present, e.g. "try again in 33m47.808s"
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
