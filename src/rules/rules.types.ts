import { Transaction } from '../types/accounting.types.js';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RuleAlert {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  transaction?: Transaction;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  evaluate(transactions: Transaction[]): RuleAlert[];
}
