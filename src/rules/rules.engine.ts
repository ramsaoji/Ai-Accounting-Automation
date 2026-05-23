import { Transaction } from '../types/accounting.types.js';
import { Rule, RuleAlert, AlertSeverity } from './rules.types.js';
import { logger } from '../logger/logger.js';

/**
 * 1. Duplicate Invoice Rule
 * Checks for identical invoice numbers across different transactions.
 */
export class DuplicateInvoiceRule implements Rule {
  id = 'RULE_001';
  name = 'Duplicate Invoice Check';
  description = 'Detects multiple transactions sharing the same invoice number';

  evaluate(transactions: Transaction[]): RuleAlert[] {
    const alerts: RuleAlert[] = [];
    const invoiceGroups = new Map<string, Transaction[]>();

    // Group transactions by invoice number
    for (const tx of transactions) {
      const inv = tx.invoiceNumber.trim();
      if (!inv || inv === 'N/A' || inv === '-') continue;
      
      const group = invoiceGroups.get(inv) || [];
      group.push(tx);
      invoiceGroups.set(inv, group);
    }

    // Flag duplicates
    for (const [invoiceNum, txs] of invoiceGroups.entries()) {
      if (txs.length > 1) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'high',
          message: `Duplicate invoice number detected: "${invoiceNum}" found across ${txs.length} transactions.`,
          metadata: {
            invoiceNumber: invoiceNum,
            count: txs.length,
            vendors: txs.map(t => t.vendor),
            amounts: txs.map(t => t.amount),
          },
        });
      }
    }

    return alerts;
  }
}

/**
 * 2. High Expense Rule (Threshold Breaches)
 * Flags any single debit transaction exceeding a specific threshold.
 */
export class HighExpenseRule implements Rule {
  id = 'RULE_002';
  name = 'High Expense Detection';
  description = 'Flags individual debit transactions that breach the defined threshold';

  constructor(private threshold: number = 50000) {}

  evaluate(transactions: Transaction[]): RuleAlert[] {
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

/**
 * 3. Suspicious Spike Rule (Category Anomaly Detection)
 * Flags any transaction that exceeds 3x the average of its specific category.
 */
export class SuspiciousSpikeRule implements Rule {
  id = 'RULE_003';
  name = 'Suspicious Category Spike';
  description = 'Flags transactions exceeding 3x the average amount for their category';

  evaluate(transactions: Transaction[]): RuleAlert[] {
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
      
      // If a transaction is > 3x average and represents a significant expense
      if (tx.amount > avg * 3 && tx.amount > 5000) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'medium',
          message: `Suspicious spike detected in category "${tx.category}": ₹${tx.amount.toLocaleString()} is over 3x the category average (₹${Math.round(avg).toLocaleString()}).`,
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

/**
 * 4. Off-Hours / Unusual Timing Rule
 * Flags business transactions posted on weekends or late-night (potential posting errors or fraud).
 */
export class OffHoursTransactionRule implements Rule {
  id = 'RULE_004';
  name = 'Off-Hours Transaction';
  description = 'Flags transactions executed during weekends or late nights (11 PM - 5 AM)';

  evaluate(transactions: Transaction[]): RuleAlert[] {
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      const date = new Date(tx.date);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours();

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
          message: `Transaction with vendor "${tx.vendor}" was logged ${reason} (${date.toLocaleString()}). Check for potential posting delays.`,
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

/**
 * 5. Negative Or Zero Amount Transaction Rule
 * Flags transactions with 0 or negative values (if any slipped past first-stage schemas).
 */
export class NegativeOrZeroTransactionRule implements Rule {
  id = 'RULE_005';
  name = 'Negative or Zero Transaction Value';
  description = 'Flags transactions carrying zero or negative amounts';

  evaluate(transactions: Transaction[]): RuleAlert[] {
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

/**
 * Central Rules Engine Orchestrator
 */
export class RulesEngine {
  private rules: Rule[] = [];

  constructor() {
    // Register default rules
    this.registerRule(new DuplicateInvoiceRule());
    this.registerRule(new HighExpenseRule(50000)); // Default threshold of ₹50,000
    this.registerRule(new SuspiciousSpikeRule());
    this.registerRule(new OffHoursTransactionRule());
    this.registerRule(new NegativeOrZeroTransactionRule());
  }

  /**
   * Registers a new custom rule to the engine.
   */
  registerRule(rule: Rule): void {
    this.rules.push(rule);
    logger.debug({ ruleId: rule.id, name: rule.name }, 'Registered rule in engine');
  }

  /**
   * Evaluates all registered rules against a set of transactions.
   */
  evaluate(transactions: Transaction[]): RuleAlert[] {
    logger.info({ ruleCount: this.rules.length, transactionCount: transactions.length }, 'Evaluating accounting rules');
    
    const allAlerts: RuleAlert[] = [];

    for (const rule of this.rules) {
      try {
        const ruleAlerts = rule.evaluate(transactions);
        if (ruleAlerts.length > 0) {
          logger.info({ ruleId: rule.id, alertCount: ruleAlerts.length }, 'Rule generated alerts');
          allAlerts.push(...ruleAlerts);
        }
      } catch (error) {
        logger.error({ ruleId: rule.id, error }, 'Failed evaluating rule');
      }
    }

    logger.info({ totalAlerts: allAlerts.length }, 'Finished evaluating all accounting rules');
    return allAlerts;
  }
}

export const rulesEngine = new RulesEngine();
