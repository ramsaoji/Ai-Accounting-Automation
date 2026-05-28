/**
 * Converts a standard 5-field cron expression into a user-friendly human-readable string.
 */
export function formatCronExpression(cron: string): string {
  if (!cron) return 'Not Scheduled';
  
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return cron; // Return raw if not a standard 5-field cron
  }
  
  const [minute, hour, dom, month, dow] = parts;
  
  // 1. Common exact intervals
  if (minute === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') {
    return 'Daily at midnight';
  }
  if (minute === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every hour';
  }
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
  
  // 2. Daily at specific hour/minute: e.g. "0 9 * * *"
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    const minNum = parseInt(minute, 10);
    const hrNum = parseInt(hour, 10);
    if (!isNaN(minNum) && !isNaN(hrNum)) {
      const ampm = hrNum >= 12 ? 'PM' : 'AM';
      const displayHr = hrNum % 12 === 0 ? 12 : hrNum % 12;
      const displayMin = minNum.toString().padStart(2, '0');
      return `Daily at ${displayHr}:${displayMin} ${ampm}`;
    }
  }

  // 3. Weekly on specific day: e.g. "0 0 * * 0"
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (minute === '0' && hour === '0' && dom === '*' && month === '*' && dow !== '*') {
    const dowNum = parseInt(dow, 10);
    if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
      return `Weekly on ${daysOfWeek[dowNum]} at midnight`;
    }
  }

  // 4. Monthly on specific day: e.g. "0 0 1 * *"
  if (minute === '0' && hour === '0' && dom !== '*' && month === '*' && dow === '*') {
    const domNum = parseInt(dom, 10);
    if (!isNaN(domNum)) {
      const suffix = (domNum === 1 || domNum === 21 || domNum === 31) ? 'st' :
                     (domNum === 2 || domNum === 22) ? 'nd' :
                     (domNum === 3 || domNum === 23) ? 'rd' : 'th';
      return `Monthly on the ${domNum}${suffix} at midnight`;
    }
  }
  
  // Fallback: return raw schedule label
  return `Schedule: ${cron}`;
}
