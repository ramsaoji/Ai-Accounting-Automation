import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';

/**
 * 5. Negative Or Zero Amount Transaction Rule
 * Flags transactions with 0 or negative values (if any slipped past first-stage schemas).
 */
export class NegativeOrZeroTransactionRule implements Rule {
  id = 'RULE_005';
  name = 'Negative or Zero Transaction Value';
  description = 'Flags transactions carrying zero or negative amounts';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      if (tx.amount <= 0) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'critical',
          message: `Invalid transaction amount detected: ₹${tx.amount} from invoice "${tx.invoiceNumber}" is negative or zero.`,
          transaction: tx,
        });
      }
    }

    return alerts;
  }
}
