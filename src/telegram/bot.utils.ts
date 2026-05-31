import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { getReconstructedReport } from '../api/controllers/report.controller.js';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

/**
 * Formats an ISO timestamp or date string to show all configured user timezones.
 */
export function formatTimestampToDual(ts?: string): string {
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

/**
 * Extracts a Date object from a month-year label (e.g. "May 2026")
 * for accurate chronological sorting.
 */
export function getMonthYearDate(label: string): Date {
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

/**
 * Loads reports from controller dynamically or statically.
 */
export async function loadReport(reportType: 'sales' | 'debitors' | 'daily-sales'): Promise<any | null> {
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

/**
 * Formats errors for user-friendly display in Telegram.
 */
export function formatBotError(err: Error | unknown): string {
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
