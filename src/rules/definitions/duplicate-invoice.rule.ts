import { Transaction } from '../../types/accounting.types.js';
import { Rule, RuleAlert } from '../rules.types.js';

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
