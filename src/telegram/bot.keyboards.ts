import { db } from '../db/db.client.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger/logger.js';

// Global cache of imported file types. Initialize empty.
// In case query fails or at boot before first poll, default to empty.
let activeFileTypes: Set<string> = new Set();

export async function refreshActiveFileTypesCache(): Promise<void> {
  try {
    const records = await db
      .select({ fileType: schema.files.fileType })
      .from(schema.files)
      .where(
        and(
          eq(schema.files.isLatest, true),
          eq(schema.files.status, 'success')
        )
      );

    const newTypes = new Set<string>();
    for (const record of records) {
      if (record.fileType) {
        newTypes.add(record.fileType.toLowerCase());
      }
    }

    activeFileTypes = newTypes;
    logger.debug({ activeFileTypes: Array.from(activeFileTypes) }, 'Telegram bot main menu active file types cache refreshed');
  } catch (err) {
    logger.error({ err }, 'Failed to refresh Telegram bot active file types cache');
  }
}

export function getMainMenuKeyboard(): Record<string, any> {
  const keyboard: any[][] = [];
  const buttons: { text: string }[] = [];

  if (activeFileTypes.has('sales')) {
    buttons.push({ text: '📊 Sales Summary' });
  }
  if (activeFileTypes.has('debitors')) {
    buttons.push({ text: '👥 Debitors List' });
  }
  if (activeFileTypes.has('godown_stock')) {
    buttons.push({ text: '🏭 Godown Stock' });
  }
  if (activeFileTypes.has('counter_stock')) {
    buttons.push({ text: '🏪 Counter Stock' });
  }

  // Chunk buttons into rows of 2
  for (let i = 0; i < buttons.length; i += 2) {
    keyboard.push(buttons.slice(i, i + 2));
  }

  // Always append the Sync and Health options
  keyboard.push([{ text: '🔄 Sync Ledger' }, { text: '🩺 Service Health' }]);

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}
