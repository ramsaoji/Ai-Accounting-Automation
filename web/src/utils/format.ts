/**
 * Format helper utilities for currency, timestamps, and month sheet parsing.
 */

/**
 * Format a number as Indian Rupee (INR) currency style (e.g. ₹50,000)
 */
export function formatINR(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

/**
 * Format a number as abbreviated INR currency style (e.g. ₹5 Cr, ₹2.5 L)
 */
export function formatINRValue(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  let formatted = '';
  if (absVal >= 10000000) {
    formatted = `₹${parseFloat((absVal / 10000000).toFixed(2))} Cr`;
  } else if (absVal >= 100000) {
    formatted = `₹${parseFloat((absVal / 100000).toFixed(2))} L`;
  } else {
    formatted = `₹${absVal.toLocaleString('en-IN')}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse standard or ISO timestamps to locale string.
 */
export function formatTimestamp(ts?: string): string {
  if (!ts) return 'Never';
  if (ts.includes(',') || ts.toLowerCase().includes('am') || ts.toLowerCase().includes('pm')) {
    return ts;
  }
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) {
    return ts;
  }
  return parsed.toLocaleString();
}

/**
 * Parses a sheet name (like "Jan 2026") into a JavaScript Date object.
 */
export function getSheetDate(sheetName: string): Date | null {
  const clean = sheetName.trim().toLowerCase();
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const monthsMap: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sept: 8, sep: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11
    };
    const monthMatch = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)/);
    const monthIdx = monthMatch ? monthsMap[monthMatch[0]] : 0;
    return new Date(year, monthIdx, 1);
  }
  return null;
}

/**
 * Parses a sheet name (like "Jan 2026") into a numerical month value for sorting.
 */
export function parseSheetNameToValue(sheetName: string): number {
  const clean = sheetName.trim().toLowerCase();
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const monthsMap: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sept: 8, sep: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11
    };
    const monthMatch = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)/);
    const monthIdx = monthMatch ? monthsMap[monthMatch[0]] : 0;
    return year * 12 + monthIdx;
  }
  return 0;
}
