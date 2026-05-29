import fs from 'fs';
import path from 'path';
import { Transaction } from '../types/accounting.types.js';
import { Rule, RuleAlert, AlertSeverity } from './rules.types.js';
import { logger } from '../logger/logger.js';
import { getReport } from '../db/db.client.js';
import { config } from '../config/config.js';

/**
 * 1. Duplicate Invoice Rule
 * Checks for identical invoice numbers across different transactions.
 */
export class DuplicateInvoiceRule implements Rule {
  id = 'RULE_001';
  name = 'Duplicate Invoice Check';
  description = 'Detects multiple transactions sharing the same invoice number';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];
    const invoiceGroups = new Map<string, Transaction[]>();

    // Group transactions by invoice number
    for (const tx of transactions) {
      const inv = tx.invoiceNumber.trim();
      if (!inv || inv === 'N/A' || inv === '-') continue;
      
      // Skip synthetic invoices
      if (/^(LQ|FD|EX|UJ|UG)-\d{4}-\d{2}-\d{2}$/.test(inv)) continue;
      
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

/**
 * 3. Suspicious Spike Rule (Category Anomaly Detection)
 * Flags any transaction that exceeds 3x the average of its specific category.
 */
export class SuspiciousSpikeRule implements Rule {
  id = 'RULE_003';
  name = 'Suspicious Category Spike';
  description = 'Flags transactions exceeding 3x the average amount for their category';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
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

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    for (const tx of transactions) {
      // Skip off-hours check for synthetic daily summary entries
      if (/^(LQ|FD|EX|UJ|UG)-\d{4}-\d{2}-\d{2}$/.test(tx.invoiceNumber)) {
        continue;
      }

      const date = new Date(tx.date);
      // Skip if the record does not contain specific time info (i.e., defaults to local midnight 00:00:00)
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
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

/**
 * 7. Cross-Workbook Reconciliation Rule
 * Reconciles credit extended/recovered between the Daily Sales Register and the Debitors Ledger.
 */
interface ReconciliationSummary {
  aggregates?: {
    totalDebitSum?: number;
    totalCreditSum?: number;
    totalPendingSum?: number;
    collectionSuccessRate?: string | number;
  };
  masterTotals?: {
    totalInflows?: number;
    netCashflow?: number;
    creditExtended?: number;
    creditRecovery?: number;
  };
}

export class CrossWorkbookReconciliationRule implements Rule {
  id = 'RULE_007';
  name = 'Cross-Workbook Ledger Reconciliation Check';
  description = 'Reconciles Credit Extended / Credit Recovery sums between Daily Sales and Debitors outstanding ledger';

  async evaluate(transactions: Transaction[]): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];
    const outputDir = path.resolve(process.cwd(), 'data', 'output');

    const hasSalesCategory = transactions.some(t => t.category === 'Liquor Revenue' || t.category === 'Food Revenue');
    const isDebitorsList = transactions.some(t => t.invoiceNumber.startsWith('UD-DB') || t.invoiceNumber.startsWith('UD-CR'));

    if (hasSalesCategory) {
      let summary: ReconciliationSummary | null = null;
      if (config.DATABASE_URL) {
        summary = await getReport('debitors') as ReconciliationSummary | null;
      } else {
        const debitorsSummaryPath = path.join(outputDir, 'DEBITORS LIST', 'summary.json');
        if (fs.existsSync(debitorsSummaryPath)) {
          try {
            const raw = fs.readFileSync(debitorsSummaryPath, 'utf8');
            summary = JSON.parse(raw) as ReconciliationSummary;
          } catch (e) {
            // ignore
          }
        }
      }

      if (summary) {
        try {
          const debTotalDebit = summary.aggregates?.totalDebitSum || 0;
          const debTotalCredit = summary.aggregates?.totalCreditSum || 0;

          const salesTotalDebit = transactions.filter(t => t.category === 'Credit Extended').reduce((sum, t) => sum + t.amount, 0);
          const salesTotalCredit = transactions.filter(t => t.category === 'Credit Recovery').reduce((sum, t) => sum + t.amount, 0);

          const debitDiff = Math.abs(salesTotalDebit - debTotalDebit);
          const creditDiff = Math.abs(salesTotalCredit - debTotalCredit);

          if (debitDiff > 1.0 || creditDiff > 1.0) {
            alerts.push({
              ruleId: this.id,
              ruleName: this.name,
              severity: 'high',
              message: `Reconciliation variance detected. Sales Register Credit Extended: ₹${Math.round(salesTotalDebit).toLocaleString()} vs Debitors Debits: ₹${Math.round(debTotalDebit).toLocaleString()} (Diff: ₹${Math.round(debitDiff).toLocaleString()}). Sales Register Credit Recovered: ₹${Math.round(salesTotalCredit).toLocaleString()} vs Debitors Credits: ₹${Math.round(debTotalCredit).toLocaleString()} (Diff: ₹${Math.round(creditDiff).toLocaleString()}).`,
              metadata: {
                salesTotalDebit,
                debTotalDebit,
                salesTotalCredit,
                debTotalCredit,
                debitDifference: debitDiff,
                creditDifference: creditDiff
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    } else if (isDebitorsList) {
      let summary: ReconciliationSummary | null = null;
      if (config.DATABASE_URL) {
        summary = await getReport('sales') as ReconciliationSummary | null;
      } else {
        const salesSummaryPath = path.join(outputDir, `${config.BUSINESS_NAME} Daily Sales Register`, 'summary.json');
        if (fs.existsSync(salesSummaryPath)) {
          try {
            const raw = fs.readFileSync(salesSummaryPath, 'utf8');
            summary = JSON.parse(raw) as ReconciliationSummary;
          } catch (e) {
            // ignore
          }
        }
      }

      if (summary) {
        try {
          const salesTotalDebit = summary.masterTotals?.creditExtended || 0;
          const salesTotalCredit = summary.masterTotals?.creditRecovery || 0;

          const debTotalDebit = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
          const debTotalCredit = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);

          const debitDiff = Math.abs(salesTotalDebit - debTotalDebit);
          const creditDiff = Math.abs(salesTotalCredit - debTotalCredit);

          if (debitDiff > 1.0 || creditDiff > 1.0) {
            alerts.push({
              ruleId: this.id,
              ruleName: this.name,
              severity: 'high',
              message: `Reconciliation variance detected. Debitors Debits: ₹${Math.round(debTotalDebit).toLocaleString()} vs Sales Register Credit Extended: ₹${Math.round(salesTotalDebit).toLocaleString()} (Diff: ₹${Math.round(debitDiff).toLocaleString()}). Debitors Credits: ₹${Math.round(debTotalCredit).toLocaleString()} vs Sales Register Credit Recovered: ₹${Math.round(salesTotalCredit).toLocaleString()} (Diff: ₹${Math.round(creditDiff).toLocaleString()}).`,
              metadata: {
                salesTotalDebit,
                debTotalDebit,
                salesTotalCredit,
                debTotalCredit,
                debitDifference: debitDiff,
                creditDifference: creditDiff
              }
            });
          }
        } catch (e) {
          // ignore
        }
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
