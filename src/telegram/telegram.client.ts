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
   * Sends a message to ALL configured Telegram chats with auto-fallback for markdown parsing errors.
   * Supports chunking and message editing.
   */
  async sendMessage(
    text: string, 
    parseMode: 'Markdown' | 'HTML' | 'Plain' = 'Markdown',
    replyMarkup?: Record<string, any>,
    targetChatId?: string,  // Optional: send to a specific chat only (e.g. bot replies)
    editMessageId?: number  // Optional: edit this message ID in-place for the first chunk
  ): Promise<{ success: boolean; messageId?: number }> {
    const chatIds = targetChatId ? [targetChatId] : config.TELEGRAM_CHAT_ID;

    let processedText = text;
    if (parseMode === 'Markdown') {
      processedText = this.formatForTelegram(text);
    }

    const chunks = this.splitMessage(processedText);
    logger.info({ chatIds, parseMode, originalLength: text.length, chunksCount: chunks.length }, 'Sending message via Telegram Client');

    let allSucceeded = true;
    let lastSentMessageId: number | undefined;

    for (const chatId of chatIds) {
      try {
        for (let i = 0; i < chunks.length; i++) {
          let chunkText = chunks[i];
          if (parseMode === 'Markdown') {
            chunkText = this.balanceMarkdownTags(chunkText);
          }
          
          const isLastChunk = i === chunks.length - 1;
          const chunkReplyMarkup = isLastChunk ? replyMarkup : undefined;

          if (editMessageId && i === 0) {
            const editRes = await this.editMessage(chatId, editMessageId, chunkText, parseMode, chunkReplyMarkup);
            if (editRes.success) {
              lastSentMessageId = editRes.messageId;
            } else {
              // Fallback to sending new message if edit fails
              const sendRes = await this.sendSingleChunk(chatId, chunkText, parseMode, chunkReplyMarkup);
              if (sendRes.success) {
                lastSentMessageId = sendRes.messageId;
              } else {
                allSucceeded = false;
              }
            }
          } else {
            const sendRes = await this.sendSingleChunk(chatId, chunkText, parseMode, chunkReplyMarkup);
            if (sendRes.success) {
              lastSentMessageId = sendRes.messageId;
            } else {
              allSucceeded = false;
            }
          }

          // Delay between chunks to prevent rate limiting
          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } catch (error: any) {
        logger.error({ chatId, error: error.message }, 'Failed in Telegram message loop');
        allSucceeded = false;
      }
    }

    return { success: allSucceeded, messageId: lastSentMessageId };
  }

  /**
   * Sends a single chunk message via Telegram API.
   */
  private async sendSingleChunk(
    chatId: string,
    text: string,
    parseMode: 'Markdown' | 'HTML' | 'Plain',
    replyMarkup?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number }> {
    const url = `${this.baseUrl}/sendMessage`;
    const payload: Record<string, any> = {
      chat_id: chatId,
      text: text,
    };

    if (parseMode !== 'Plain') {
      payload.parse_mode = parseMode;
    }

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      return {
        success: true,
        messageId: response.data?.result?.message_id
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        const description = errorData?.description || '';
        const descLower = description.toLowerCase();

        logger.error(
          { 
            chatId,
            status: error.response?.status, 
            data: errorData, 
            message: error.message 
          }, 
          'Telegram API delivery failed'
        );

        if (parseMode === 'Markdown' && (descLower.includes('bad request') || descLower.includes("can't find end of") || descLower.includes("can't parse entities"))) {
          logger.warn({ chatId }, 'Failed to parse Markdown formatting. Attempting delivery in PLAIN TEXT fallback mode...');
          return this.sendSingleChunk(chatId, text, 'Plain', replyMarkup);
        }
      }
      return { success: false };
    }
  }

  /**
   * Edits an existing Telegram message in place.
   */
  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
    parseMode: 'Markdown' | 'HTML' | 'Plain' = 'Markdown',
    replyMarkup?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number }> {
    const url = `${this.baseUrl}/editMessageText`;
    let processedText = text;
    if (parseMode === 'Markdown') {
      processedText = this.formatForTelegram(text);
    }

    try {
      const payload: Record<string, any> = {
        chat_id: chatId,
        message_id: messageId,
        text: processedText,
      };

      if (parseMode !== 'Plain') {
        payload.parse_mode = parseMode;
      }

      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      return {
        success: true,
        messageId: response.data?.result?.message_id || messageId
      };
    } catch (error) {
      logger.error({ chatId, messageId, error }, 'Failed to edit Telegram message');
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        const description = errorData?.description || '';
        const descLower = description.toLowerCase();

        if (parseMode === 'Markdown' && (descLower.includes('bad request') || descLower.includes("can't find end of") || descLower.includes("can't parse entities"))) {
          logger.warn({ chatId, messageId }, 'Failed to parse Markdown on edit. Retrying as plain text...');
          return this.editMessage(chatId, messageId, text, 'Plain', replyMarkup);
        }
      }
      return { success: false };
    }
  }

  /**
   * Intelligently splits a message string at line boundaries without cutting words.
   */
  private splitMessage(text: string, limit = 4000): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.length > limit) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        let remaining = line;
        while (remaining.length > limit) {
          chunks.push(remaining.substring(0, limit));
          remaining = remaining.substring(limit);
        }
        currentChunk = remaining;
      } else if (currentChunk.length + line.length + 1 > limit) {
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

  /**
   * Automatically normalizes raw Markdown to be highly readable, beautiful,
   * and 100% compliant with Telegram's styling engine.
   */
  private formatForTelegram(text: string): string {
    let formatted = text;

    // 0. Convert ** to * for Telegram Markdown V1 bold styling compatibility
    formatted = this.normalizeDoubleAsterisks(formatted);

    // 1. Escape stray underscores inside words/paths to prevent parser errors
    formatted = this.escapeStrayUnderscores(formatted);

    // 2. Convert Markdown tables to gorgeous visual lists (only if not inside a code block)
    formatted = this.formatTablesToLists(formatted);

    // 3. Clean GitHub alert banners and format blockquotes
    formatted = this.formatBlockquotes(formatted);

    // 4. Balance stray markdown elements to prevent parser exceptions
    formatted = this.balanceMarkdownTags(formatted);

    return formatted;
  }

  private normalizeDoubleAsterisks(text: string): string {
    // Split by code blocks (```...```) and code spans (`...`) to preserve double asterisks in code snippets
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    return parts.map((part) => {
      if (part.startsWith('`')) {
        return part;
      }
      // Replace ** with *
      return part.replace(/\*\*/g, '*');
    }).join('');
  }

  private escapeStrayUnderscores(text: string): string {
    // Split the text by code blocks (```...```) and code spans (`...`)
    // to protect code segments from being escaped.
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    return parts.map((part) => {
      if (part.startsWith('`')) {
        return part;
      }
      return part.replace(/([a-zA-Z0-9/])_([a-zA-Z0-9])/g, '$1\\_$2');
    }).join('');
  }

  private formatTablesToLists(text: string): string {
    const lines = text.split('\n');
    const newLines: string[] = [];
    let inTable = false;
    let inCodeBlock = false;
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
      
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      if (!inCodeBlock && trimmed.startsWith('|') && trimmed.endsWith('|')) {
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
    // Strip triple-backtick code blocks and single-backtick code spans before counting.
    // Asterisks/underscores inside code snippets/tables are literal and should not be balanced.
    const textWithoutCode = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '');

    const stars = (textWithoutCode.match(/\*/g) || []).length;
    const underscores = (textWithoutCode.match(/_/g) || []).length;

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
