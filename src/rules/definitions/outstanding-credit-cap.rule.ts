import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { getAuditPolicySetting } from '../../db/db.client.js';

/**
 * 8. Outstanding Credit Cap Rule
 * Flags any customer whose net outstanding credit (pending dues) exceeds the defined limit.
 */
export class OutstandingCreditCapRule implements Rule {
  id = 'RULE_008';
  name = 'Outstanding Credit Cap Breached';
  description = 'Flags customers whose cumulative outstanding credit balance exceeds the defined limit';

  async evaluate(transactions: Transaction[], context?: RuleContext): Promise<RuleAlert[]> {
    const fileType = context?.fileType || 'debitors';
    const fileName = context?.fileName;
    const capStr = await getAuditPolicySetting(fileType, fileName, 'ruleOutstandingCreditCap', '100000');
    const cap = Number(capStr) || 100000;
    const alerts: RuleAlert[] = [];

    // Group debit (extended) and credit (recovered) by customer (vendor)
    const balances = new Map<string, { debit: number; credit: number }>();

    for (const tx of transactions) {
      if (tx.category === 'Credit Extended' || tx.category === 'Credit Recovery') {
        const val = balances.get(tx.vendor) || { debit: 0, credit: 0 };
        if (tx.category === 'Credit Extended') {
          val.debit += tx.amount;
        } else {
          val.credit += tx.amount;
        }
        balances.set(tx.vendor, val);
      }
    }

    for (const [vendor, bal] of balances.entries()) {
      const pending = bal.debit - bal.credit;
      if (pending > cap) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: pending > cap * 2 ? 'critical' : 'high',
          message: `Customer "${vendor}" outstanding credit of ₹${Math.round(pending).toLocaleString()} has breached the defined cap limit of ₹${cap.toLocaleString()}.`,
          metadata: {
            debit: bal.debit,
            credit: bal.credit,
            pending,
            cap,
            excess: pending - cap
          }
        });
      }
    }

    return alerts;
  }
}
