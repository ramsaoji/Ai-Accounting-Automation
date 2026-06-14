import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * 4. Off-Hours / Unusual Timing Rule
 * Flags business transactions posted on weekends or late-night (potential posting errors or fraud).
 */
export class OffHoursTransactionRule implements Rule {
  id = 'RULE_004';
  name = 'Off-Hours Transaction';
  description = 'Flags transactions executed during weekends or late nights (11 PM - 5 AM)';

  async evaluate(transactions: Transaction[], context?: RuleContext): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    // Resolve base timezone and rules config for the current branch/file
    let timezone = 'Asia/Kolkata'; // fallback
    let rulesConfig: any = null;

    try {
      const branchId = context?.branchId;
      if (branchId) {
        const branch = await db.select().from(schema.branches).where(eq(schema.branches.id, branchId)).limit(1).then(r => r[0]);
        if (branch) {
          rulesConfig = (branch.metadata as any)?.rulesConfig;
          const biz = await db.select().from(schema.businessEntities).where(eq(schema.businessEntities.id, branch.entityId)).limit(1).then(r => r[0]);
          if (biz?.baseTimezone) {
            timezone = biz.baseTimezone;
          }
        }
      } else if (context?.fileName) {
        const fileRecord = await db.select().from(schema.files).where(eq(schema.files.fileName, context.fileName)).limit(1).then(r => r[0]);
        if (fileRecord?.branchId) {
          const branch = await db.select().from(schema.branches).where(eq(schema.branches.id, fileRecord.branchId)).limit(1).then(r => r[0]);
          if (branch) {
            rulesConfig = (branch.metadata as any)?.rulesConfig;
            const biz = await db.select().from(schema.businessEntities).where(eq(schema.businessEntities.id, branch.entityId)).limit(1).then(r => r[0]);
            if (biz?.baseTimezone) {
              timezone = biz.baseTimezone;
            }
          }
        }
      }
    } catch (err) {
      // ignore
    }

    const opHours = rulesConfig?.operatingHours;
    const startHour = opHours !== undefined && opHours.startHour !== undefined ? opHours.startHour : 9;
    const endHour = opHours !== undefined && opHours.endHour !== undefined ? opHours.endHour : 23;
    const weekendDays = rulesConfig?.weekends || [0, 6]; // Default to Sunday & Saturday

    for (const tx of transactions) {
      // Skip off-hours check for synthetic daily summary entries (any uppercase prefix followed by date)
      if (/^[A-Z]{2,4}-\d{4}-\d{2}-\d{2}/.test(tx.invoiceNumber || '')) {
        continue;
      }

      const date = new Date(tx.date);
      // Skip if the record does not contain specific time info (i.e., defaults to UTC or local midnight)
      const isUtcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
      const isLocalMidnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
      if (isUtcMidnight || isLocalMidnight) {
        continue;
      }

      // Convert UTC to local business timezone
      const dateInTz = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const day = dateInTz.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = dateInTz.getHours();

      const isWeekend = weekendDays.includes(day);
      let isLateNight = false;
      if (startHour < endHour) {
        isLateNight = hour < startHour || hour >= endHour;
      } else {
        isLateNight = hour < startHour && hour >= endHour;
      }

      if (isWeekend || isLateNight) {
        let reason = '';
        if (isWeekend && isLateNight) reason = 'on a weekend off-hours';
        else if (isWeekend) reason = 'during the weekend';
        else reason = 'outside standard operating hours';

        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'low',
          message: `Transaction with vendor "${tx.vendor}" was logged ${reason} (${dateInTz.toISOString().replace('T', ' ').substring(0, 19)} in timezone ${timezone}). Check for potential posting delays.`,
          transaction: tx,
          metadata: {
            dayOfWeek: day,
            hourOfDay: hour,
            isWeekend,
            isLateNight,
            timezone,
            startHour,
            endHour
          },
        });
      }
    }

    return alerts;
  }
}
