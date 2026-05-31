import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { formatCronExpression } from '../utils/cron.js';
import { getSystemSetting } from '../db/db.client.js';
import { formatTimestampToDual, formatBotError } from './bot.utils.js';
import { getMainMenuKeyboard } from './bot.keyboards.js';
import { handleCommand } from './bot.commands.js';
import { handleCallbackData } from './bot.callbacks.js';
import { handleAiQuery } from './bot.ai.js';

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
    telegramClient.sendMessage(startupMsg, 'Markdown', getMainMenuKeyboard()).catch((err) => {
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
        await handleCallbackData(data, chatId, callbackQuery.message.message_id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, data }, 'Error processing Telegram callback action');
        try {
          await telegramClient.sendMessage(
            formatBotError(error),
            'Markdown',
            getMainMenuKeyboard(),
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
        await handleCommand(text, chatId);
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
            getMainMenuKeyboard(),
            chatId
          );
          return;
        }
        await handleAiQuery(text, chatId);
      }
    } catch (error: any) {
      logger.error({ error: error.message, text }, 'Error processing Telegram message action');
      try {
        await telegramClient.sendMessage(
          formatBotError(error),
          'Markdown',
          getMainMenuKeyboard(),
          chatId
        );
      } catch (err) {
        logger.error({ err }, 'Failed to send crash message back to chat');
      }
    }
  }
}

export const telegramBot = new TelegramBot();
