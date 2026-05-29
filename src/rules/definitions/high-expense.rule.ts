import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';

/**
 * 2. High Expense Rule (Threshold Breaches)
 * Flags any single debit transaction exceeding a specific threshold.
 */
export class HighExpenseRule implements Rule {
  id = 'RULE_002';
  name = 'High Expense Detection';
  description = 'Flags individual debit transactions that breach the defined threshold';

  constructor(private threshold: number = 50000) {}

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      if (tx.type === 'debit' && tx.amount >= this.threshold) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: tx.amount >= this.threshold * 2 ? 'critical' : 'high',
          message: `Large debit transaction of ₹${tx.amount.toLocaleString()} for category "${tx.category}" to vendor "${tx.vendor}" exceeded threshold (₹${this.threshold.toLocaleString()}).`,
          transaction: tx,
          metadata: {
            threshold: this.threshold,
            excess: tx.amount - this.threshold,
          },
        });
      }
    }

    return alerts;
  }
}
