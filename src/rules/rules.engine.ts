import { Transaction } from '../types/accounting.types.js';
import { Rule, RuleAlert } from './rules.types.js';
import { logger } from '../logger/logger.js';

// Import modular rules
import { DuplicateInvoiceRule } from './definitions/duplicate-invoice.rule.js';
import { HighExpenseRule } from './definitions/high-expense.rule.js';
import { SuspiciousSpikeRule } from './definitions/suspicious-spike.rule.js';
import { OffHoursTransactionRule } from './definitions/off-hours-transaction.rule.js';
import { NegativeOrZeroTransactionRule } from './definitions/negative-or-zero.rule.js';
import { DuplicateDateRule } from './definitions/duplicate-date.rule.js';
import { CrossWorkbookReconciliationRule } from './definitions/cross-workbook.rule.js';

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
    this.registerRule(new DuplicateDateRule());
    this.registerRule(new CrossWorkbookReconciliationRule());
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
  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    logger.info({ ruleCount: this.rules.length, transactionCount: transactions.length }, 'Evaluating accounting rules');
    
    const allAlerts: RuleAlert[] = [];

    for (const rule of this.rules) {
      try {
        const ruleAlerts = await rule.evaluate(transactions);
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
