import fs from 'fs';
import path from 'path';
import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';
import { getReport } from '../../db/db.client.js';
import { config } from '../../config/config.js';

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

/**
 * 7. Cross-Workbook Reconciliation Rule
 * Reconciles credit extended/recovered between the Daily Sales Register and the Debitors Ledger.
 */
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
