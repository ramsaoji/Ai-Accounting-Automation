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

/**
 * Converts a standard 5-field cron expression (assumed to be in UTC)
 * into a user-friendly human-readable string in the browser's local timezone.
 */
export function formatCronExpression(cron: string): string {
  if (!cron) return 'Not Scheduled';

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return cron; // Return raw if not a standard 5-field cron
  }

  const [minute, hour, dom, month, dow] = parts;

  // Timezone-independent intervals (every X minutes/hours)
  if (minute === '*/5' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every 5 minutes';
  }
  if (minute === '*/10' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every 10 minutes';
  }
  if (minute === '*/15' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every 15 minutes';
  }
  if (minute === '*/30' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every 30 minutes';
  }
  if (minute === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every hour';
  }

  // 1. Daily at specific hour/minute: e.g. "30 3 * * *" or "0 0 * * *"
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    if (!isNaN(minNum) && !isNaN(hrNum)) {
      const now = new Date();
      // Construct UTC date for today at hrNum:minNum UTC
      const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hrNum, minNum));
      const localHr = utcDate.getHours();
      const localMin = utcDate.getMinutes();
      const ampm = localHr >= 12 ? 'PM' : 'AM';
      const displayHr = localHr % 12 === 0 ? 12 : localHr % 12;
      const displayMin = localMin.toString().padStart(2, '0');
      return `Daily at ${displayHr}:${displayMin} ${ampm}`;
    }
  }

  // 2. Weekly on specific day: e.g. "0 0 * * 0"
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow !== '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    const dowNum = parseInt(dow, 10);
    if (!isNaN(minNum) && !isNaN(hrNum) && !isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
      // Find a baseline Sunday in UTC: e.g., May 31, 2026 is Sunday
      const baselineSunday = new Date(Date.UTC(2026, 4, 31, hrNum, minNum));
      // Adjust to target day of week
      baselineSunday.setUTCDate(baselineSunday.getUTCDate() + dowNum);

      // Extract local browser day and time
      const localDay = daysOfWeek[baselineSunday.getDay()];
      const localHr = baselineSunday.getHours();
      const localMin = baselineSunday.getMinutes();
      const ampm = localHr >= 12 ? 'PM' : 'AM';
      const displayHr = localHr % 12 === 0 ? 12 : localHr % 12;
      const displayMin = localMin.toString().padStart(2, '0');
      return `Weekly on ${localDay} at ${displayHr}:${displayMin} ${ampm}`;
    }
  }

  // 3. Monthly on specific day: e.g. "0 0 1 * *"
  if (minute !== '*' && hour !== '*' && dom !== '*' && month === '*' && dow === '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    const domNum = parseInt(dom, 10);
    if (!isNaN(minNum) && !isNaN(hrNum) && !isNaN(domNum)) {
      // Baseline day of month
      const baseline = new Date(Date.UTC(2026, 4, domNum, hrNum, minNum));
      const localDom = baseline.getDate();
      const localHr = baseline.getHours();
      const localMin = baseline.getMinutes();
      const suffix = (localDom === 1 || localDom === 21 || localDom === 31) ? 'st' :
                     (localDom === 2 || localDom === 22) ? 'nd' :
                     (localDom === 3 || localDom === 23) ? 'rd' : 'th';
      const ampm = localHr >= 12 ? 'PM' : 'AM';
      const displayHr = localHr % 12 === 0 ? 12 : localHr % 12;
      const displayMin = localMin.toString().padStart(2, '0');
      return `Monthly on the ${localDom}${suffix} at ${displayHr}:${displayMin} ${ampm}`;
    }
  }

  // Fallback: return raw schedule label
  return `Scheduled: ${cron} (UTC)`;
}
