import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

export class TelegramClient {
  private baseUrl: string;

  constructor() {
    const token = config.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * Sends a message to the configured Telegram chat with auto-fallback for markdown parsing errors.
   */
  async sendMessage(text: string, parseMode: 'Markdown' | 'HTML' | 'Plain' = 'Markdown'): Promise<boolean> {
    const chatId = config.TELEGRAM_CHAT_ID;
    const url = `${this.baseUrl}/sendMessage`;

    logger.info({ chatId, parseMode, messageLen: text.length }, 'Sending message via Telegram Client');

    try {
      const payload: Record<string, any> = {
        chat_id: chatId,
        text,
      };

      if (parseMode !== 'Plain') {
        payload.parse_mode = parseMode;
      }

      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15s timeout
      });

      logger.info('Telegram message sent successfully');
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        const description = errorData?.description || '';

        logger.error(
          { 
            status: error.response?.status, 
            data: errorData, 
            message: error.message 
          }, 
          'Telegram API delivery failed'
        );

        // Fallback Strategy: If Telegram fails due to strict markdown parsing errors, retry as plain text!
        if (parseMode === 'Markdown' && (description.includes('bad request') || description.includes('can\'t find end of'))) {
          logger.warn('Failed to parse Markdown formatting. Attempting delivery in PLAIN TEXT fallback mode...');
          return this.sendMessage(text, 'Plain');
        }
        
        throw new Error(`Telegram Bot API delivery failed: ${description || error.message}`);
      }
      throw error;
    }
  }
}

export const telegramClient = new TelegramClient();
