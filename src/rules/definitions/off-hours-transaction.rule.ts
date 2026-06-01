import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';

/**
 * 4. Off-Hours / Unusual Timing Rule
 * Flags business transactions posted on weekends or late-night (potential posting errors or fraud).
 */
export class OffHoursTransactionRule implements Rule {
  id = 'RULE_004';
  name = 'Off-Hours Transaction';
  description = 'Flags transactions executed during weekends or late nights (11 PM - 5 AM)';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      // Skip off-hours check for synthetic daily summary entries
      if (/^(LQ|FD|EX|UJ|UG)-\d{4}-\d{2}-\d{2}$/.test(tx.invoiceNumber)) {
        continue;
      }

      const date = new Date(tx.date);
      // Skip if the record does not contain specific time info (i.e., defaults to UTC midnight 00:00:00)
      const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
      if (!hasTime) {
        continue;
      }

      // Convert UTC to IST (UTC+5:30) for auditing Indian business hours
      const utcTime = date.getTime();
      const istTime = utcTime + (5.5 * 60 * 60 * 1000);
      const istDate = new Date(istTime);

      const day = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const hour = istDate.getUTCHours();

      const isWeekend = day === 0 || day === 6;
      const isLateNight = hour >= 23 || hour < 5;

      if (isWeekend || isLateNight) {
        let reason = '';
        if (isWeekend && isLateNight) reason = 'on a weekend late-night';
        else if (isWeekend) reason = 'during the weekend';
        else reason = 'late at night';

        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'low',
          message: `Transaction with vendor "${tx.vendor}" was logged ${reason} (${istDate.toISOString().replace('T', ' ').substring(0, 19)} IST). Check for potential posting delays.`,
          transaction: tx,
          metadata: {
            dayOfWeek: day,
            hourOfDay: hour,
            isWeekend,
            isLateNight,
          },
        });
      }
    }

    return alerts;
  }
}
