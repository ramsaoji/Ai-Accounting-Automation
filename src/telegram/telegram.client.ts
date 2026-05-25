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
  async sendMessage(
    text: string, 
    parseMode: 'Markdown' | 'HTML' | 'Plain' = 'Markdown',
    replyMarkup?: Record<string, any>
  ): Promise<boolean> {
    const chatId = config.TELEGRAM_CHAT_ID;
    const url = `${this.baseUrl}/sendMessage`;

    let processedText = text;
    if (parseMode === 'Markdown') {
      processedText = this.formatForTelegram(text);
    }

    logger.info({ chatId, parseMode, messageLen: processedText.length }, 'Sending message via Telegram Client');

    try {
      const payload: Record<string, any> = {
        chat_id: chatId,
        text: processedText,
      };

      if (parseMode !== 'Plain') {
        payload.parse_mode = parseMode;
      }

      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
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
        const descLower = description.toLowerCase();
        if (parseMode === 'Markdown' && (descLower.includes('bad request') || descLower.includes("can't find end of") || descLower.includes("can't parse entities"))) {
          logger.warn('Failed to parse Markdown formatting. Attempting delivery in PLAIN TEXT fallback mode...');
          return this.sendMessage(text, 'Plain');
        }
        
        throw new Error(`Telegram Bot API delivery failed: ${description || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Automatically normalizes raw Markdown to be highly readable, beautiful,
   * and 100% compliant with Telegram's styling engine.
   */
  private formatForTelegram(text: string): string {
    let formatted = text;

    // 1. Convert Markdown tables to gorgeous visual lists
    formatted = this.formatTablesToLists(formatted);

    // 2. Clean GitHub alert banners and format blockquotes
    formatted = this.formatBlockquotes(formatted);

    // 3. Balance stray markdown elements to prevent parser exceptions
    formatted = this.balanceMarkdownTags(formatted);

    return formatted;
  }

  private formatTablesToLists(text: string): string {
    const lines = text.split('\n');
    const newLines: string[] = [];
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      
      newLines.push('\n━━━━━━━━━━━━━━━━━━━━━━');
      for (const row of tableRows) {
        const primaryKey = row[0] || '';
        newLines.push(`\n🔸 *${primaryKey}*`);
        for (let i = 1; i < row.length; i++) {
          const header = tableHeaders[i] || `Column ${i + 1}`;
          const val = row[i] || '';
          if (val && val !== '—' && val !== '-' && val !== '–') {
            newLines.push(`  • *${header}*: ${val}`);
          }
        }
      }
      newLines.push('━━━━━━━━━━━━━━━━━━━━━━\n');
      
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cells = trimmed
          .split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

        const isSeparator = cells.every(c => c.replace(/[\s:-]/g, '').length === 0);
        if (isSeparator) {
          continue;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      } else {
        if (inTable) {
          flushTable();
        }
        newLines.push(line);
      }
    }
    
    if (inTable) {
      flushTable();
    }

    return newLines.join('\n');
  }

  private formatBlockquotes(text: string): string {
    return text
      .replace(/>\s*\[!NOTE\]/gi, 'ℹ️ *NOTE:*')
      .replace(/>\s*!NOTE/gi, 'ℹ️ *NOTE:*')
      .replace(/>\s*\[!TIP\]/gi, '💡 *TIP:*')
      .replace(/>\s*!TIP/gi, '💡 *TIP:*')
      .replace(/>\s*\[!WARNING\]/gi, '⚠️ *WARNING:*')
      .replace(/>\s*!WARNING/gi, '⚠️ *WARNING:*')
      .replace(/>\s*\[!CAUTION\]/gi, '🚨 *CRITICAL:*')
      .replace(/>\s*!CAUTION/gi, '🚨 *CRITICAL:*')
      .replace(/^>\s*/gm, ' ');
  }

  private balanceMarkdownTags(text: string): string {
    const stars = (text.match(/\*/g) || []).length;
    const underscores = (text.match(/_/g) || []).length;

    let balanced = text;
    if (stars % 2 !== 0) {
      balanced = balanced + '*';
    }
    if (underscores % 2 !== 0) {
      balanced = balanced + '_';
    }
    return balanced;
  }
}

export const telegramClient = new TelegramClient();
