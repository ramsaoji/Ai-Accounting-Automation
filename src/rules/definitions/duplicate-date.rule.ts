import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';

/**
 * 6. Duplicate Date Entry Rule
 * Checks if daily registers contain duplicate transaction rows for the same date and category.
 */
export class DuplicateDateRule implements Rule {
  id = 'RULE_006';
  name = 'Duplicate Daily Register Date';
  description = 'Detects duplicate transaction entries for the same date and category in daily registers';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];
    const seenKeys = new Map<string, Transaction>();

    for (const tx of transactions) {
      if (!/^(LQ|FD|EX|UJ|UG)-\d{4}-\d{2}-\d{2}$/.test(tx.invoiceNumber)) {
        continue;
      }

      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const key = `${dateStr}_${tx.category}`;

      if (seenKeys.has(key)) {
        const originalTx = seenKeys.get(key)!;
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'high',
          message: `Duplicate daily register entry: multiple "${tx.category}" records found on date "${dateStr}".`,
          metadata: {
            date: dateStr,
            category: tx.category,
            amount1: originalTx.amount,
            amount2: tx.amount
          }
        });
      } else {
        seenKeys.set(key, tx);
      }
    }

    return alerts;
  }
}
