import { telegramClient } from './telegram.client.js';
import { logger } from '../logger/logger.js';

export class TelegramService {
  private MAX_MESSAGE_LENGTH = 4000; // Safe threshold under Telegram's 4096 limit

  /**
   * Dispatches a message to the target Telegram chat, automatically chunking the text
   * if it exceeds Telegram's size limitations.
   */
  async sendReport(messageText: string): Promise<void> {
    try {
      if (messageText.length <= this.MAX_MESSAGE_LENGTH) {
        await telegramClient.sendMessage(messageText, 'Markdown');
        return;
      }

      logger.info(
        { originalLength: messageText.length }, 
        'Message exceeds Telegram character limit. Splitting into multiple chunks.'
      );

      const chunks = this.splitMessage(messageText);
      logger.info({ totalChunks: chunks.length }, 'Dispatched split message blocks');

      for (let i = 0; i < chunks.length; i++) {
        logger.info({ currentChunk: i + 1, totalChunks: chunks.length }, 'Delivering chunk to Telegram');
        // Prepend chunk indicator for executive readability
        const header = chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}]\n` : '';
        await telegramClient.sendMessage(header + chunks[i], 'Markdown');
        
        // Wait slightly between chunk dispatches to prevent rate-limiting (30 msgs/sec limit)
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed in Telegram dispatch pipeline');
      throw new Error(`Telegram Service failed: ${(error as Error).message}`);
    }
  }

  /**
   * Intelligently splits a message string at line boundaries without cutting words.
   */
  private splitMessage(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > this.MAX_MESSAGE_LENGTH) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export const telegramService = new TelegramService();
