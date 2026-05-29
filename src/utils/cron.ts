import { config } from '../config/config.js';

/**
 * Converts a standard 5-field cron expression (assumed to be in UTC)
 * into a user-friendly human-readable string in the configured Telegram timezones.
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

  const timezones = config.TELEGRAM_TIMEZONES && config.TELEGRAM_TIMEZONES.length > 0
    ? config.TELEGRAM_TIMEZONES
    : ['Asia/Kolkata'];

  // Helper to extract timezone abbreviation (e.g. Asia/Kolkata -> IST)
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

  // 1. Daily at specific hour/minute: e.g. "30 3 * * *"
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    if (!isNaN(minNum) && !isNaN(hrNum)) {
      const now = new Date();
      // Construct UTC date for today at hrNum:minNum UTC
      const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hrNum, minNum));
      
      const formattedTimes = timezones.map(tz => {
        const timeStr = utcDate.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const abbrev = getTzAbbrev(tz, utcDate);
        return `${timeStr} (${abbrev})`;
      });

      return `Daily at ${formattedTimes.join(' / ')}`;
    }
  }

  // 2. Weekly on specific day: e.g. "0 0 * * 0"
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow !== '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    const dowNum = parseInt(dow, 10);
    if (!isNaN(minNum) && !isNaN(hrNum) && !isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
      // Find a baseline Sunday in UTC: e.g., May 31, 2026 is Sunday
      const baselineSunday = new Date(Date.UTC(2026, 4, 31, hrNum, minNum));
      // Adjust to target day of week
      baselineSunday.setUTCDate(baselineSunday.getUTCDate() + dowNum);

      const formattedWeeks = timezones.map(tz => {
        const dayName = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'long'
        }).format(baselineSunday);

        const timeStr = baselineSunday.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const abbrev = getTzAbbrev(tz, baselineSunday);
        return `Weekly on ${dayName} at ${timeStr} (${abbrev})`;
      });

      return formattedWeeks.join(' / ');
    }
  }

  // 3. Monthly on specific day: e.g. "0 0 1 * *"
  if (minute !== '*' && hour !== '*' && dom !== '*' && month === '*' && dow === '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    const domNum = parseInt(dom, 10);
    if (!isNaN(minNum) && !isNaN(hrNum) && !isNaN(domNum)) {
      // Baseline day of month in UTC
      const baseline = new Date(Date.UTC(2026, 4, domNum, hrNum, minNum));

      const formattedMonths = timezones.map(tz => {
        const localDom = parseInt(new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          day: 'numeric'
        }).format(baseline), 10);
        
        const timeStr = baseline.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const suffix = (localDom === 1 || localDom === 21 || localDom === 31) ? 'st' :
                       (localDom === 2 || localDom === 22) ? 'nd' :
                       (localDom === 3 || localDom === 23) ? 'rd' : 'th';
        
        const abbrev = getTzAbbrev(tz, baseline);
        return `Monthly on the ${localDom}${suffix} at ${timeStr} (${abbrev})`;
      });

      return formattedMonths.join(' / ');
    }
  }
  
  // Fallback: return raw schedule label
  return `Schedule: ${cron} (UTC)`;
}
