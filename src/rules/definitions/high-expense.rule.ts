import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { getAuditPolicySetting } from '../../db/db.client.js';

/**
 * 2. High Expense Rule (Threshold Breaches)
 * Flags any single debit transaction exceeding a specific threshold.
 */
export class HighExpenseRule implements Rule {
  id = 'RULE_002';
  name = 'High Expense Detection';
  description = 'Flags individual debit transactions that breach the defined threshold';

  async evaluate(transactions: Transaction[], context?: RuleContext): Promise<RuleAlert[]> {
    const fileType = context?.fileType || 'sales';
    const fileName = context?.fileName;
    const thresholdStr = await getAuditPolicySetting(fileType, fileName, 'ruleHighExpenseCeiling', '50000');
    const threshold = Number(thresholdStr) || 50000;
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      if (tx.type === 'debit' && tx.amount >= threshold) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: tx.amount >= threshold * 2 ? 'critical' : 'high',
          message: `Large debit transaction of ₹${tx.amount.toLocaleString()} for category "${tx.category}" to vendor "${tx.vendor}" exceeded threshold (₹${threshold.toLocaleString()}).`,
          transaction: tx,
          metadata: {
            threshold,
            excess: tx.amount - threshold,
          },
        });
      }
    }

    return alerts;
  }
}
