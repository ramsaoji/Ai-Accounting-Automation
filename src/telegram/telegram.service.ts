import { telegramClient } from './telegram.client.js';
import { logger } from '../logger/logger.js';

export class TelegramService {
  /**
   * Dispatches a message to the target Telegram chats.
   * Centralized chunking, formatting, and throttling are handled inside the client.
   */
  async sendReport(messageText: string): Promise<void> {
    try {
      const res = await telegramClient.sendMessage(messageText, 'Markdown');
      if (!res.success) {
        throw new Error('Telegram Client failed to deliver message');
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed in Telegram dispatch pipeline');
      throw new Error(`Telegram Service failed: ${error.message}`);
    }
  }
}

export const telegramService = new TelegramService();
