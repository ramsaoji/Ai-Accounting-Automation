import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { getAuditPolicySetting } from '../../db/db.client.js';

/**
 * 3. Suspicious Spike Rule (Category Anomaly Detection)
 * Flags any transaction that exceeds 3x the average of its specific category.
 */
export class SuspiciousSpikeRule implements Rule {
  id = 'RULE_003';
  name = 'Suspicious Category Spike';
  description = 'Flags transactions exceeding 3x the average amount for their category';

  async evaluate(transactions: Transaction[], context?: RuleContext): Promise<RuleAlert[]> {
    const fileType = context?.fileType || 'sales';
    const fileName = context?.fileName;
    const multiplierStr = await getAuditPolicySetting(fileType, fileName, 'ruleSuspiciousSpikeMultiplier', '3');
    const multiplier = Number(multiplierStr) || 3;
    const alerts: RuleAlert[] = [];
    const categoryValues = new Map<string, number[]>();

    // Group debit values by category
    for (const tx of transactions) {
      if (tx.type === 'debit') {
        const vals = categoryValues.get(tx.category) || [];
        vals.push(tx.amount);
        categoryValues.set(tx.category, vals);
      }
    }

    // Calculate averages and evaluate
    for (const tx of transactions) {
      if (tx.type !== 'debit') continue;

      const vals = categoryValues.get(tx.category);
      if (!vals || vals.length < 3) continue; // Skip if we don't have enough data points (min 3)

      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      
      // If a transaction is > multiplier * average and represents a significant expense
      if (tx.amount > avg * multiplier && tx.amount > 5000) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'medium',
          message: `Suspicious spike detected in category "${tx.category}": ₹${tx.amount.toLocaleString()} is over ${multiplier}x the category average (₹${Math.round(avg).toLocaleString()}).`,
          transaction: tx,
          metadata: {
            categoryAverage: avg,
            multiplier: Number((tx.amount / avg).toFixed(2)),
          },
        });
      }
    }

    return alerts;
  }
}
