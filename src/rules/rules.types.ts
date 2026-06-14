import { Transaction, GodownStockItem } from '../types/accounting.types.js';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RuleAlert {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  transaction?: Transaction;
}

export interface RuleContext {
  fileType?: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
  fileName?: string;
  godownStockItems?: GodownStockItem[];
  branchId?: string | null;
  entityId?: string | null;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  evaluate(transactions: Transaction[], context?: RuleContext): Promise<RuleAlert[]>;
}
