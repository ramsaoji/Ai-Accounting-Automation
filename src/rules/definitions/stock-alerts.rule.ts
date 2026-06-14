import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { GodownStockItem } from '../../types/accounting.types.js';
import { db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Modular rule for auditing stock inventory items.
 * Evaluates negative stock levels, out-of-stock items, low stock warnings, and selling price losses.
 */
export class StockAlertsRule implements Rule {
  id = 'RULE_009';
  name = 'Stock Inventory Audit & Alerts';
  description = 'Audits stock closing numbers, depletion levels, and cost-to-sell ratios.';

  async evaluate(transactions: any[], context?: RuleContext): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    if (!context || (context.fileType !== 'godown_stock' && context.fileType !== 'counter_stock') || !context.godownStockItems) {
      return alerts;
    }

    const items: GodownStockItem[] = context.godownStockItems;

    let lowStockThreshold = 5; // default fallback
    try {
      const branchId = context?.branchId;
      if (branchId) {
        const branch = await db.select().from(schema.branches).where(eq(schema.branches.id, branchId)).limit(1).then(r => r[0]);
        const rulesConfig = (branch?.metadata as any)?.rulesConfig;
        if (rulesConfig && rulesConfig.lowStockThreshold !== undefined) {
          lowStockThreshold = Number(rulesConfig.lowStockThreshold);
        }
      }
    } catch (err) {
      // ignore
    }

    for (const item of items) {
      const closing = Number(item.closingStock || 0);
      const opening = Number(item.openingStock || 0);
      const stockIn = Number(item.stockIn || 0);
      const stockOut = Number(item.stockOut || 0);

      const sizeText = item.specification || (item.bottleSizeMl ? `${item.bottleSizeMl}ml` : item.unitOfMeasure || 'Standard');
      const unitText = item.unitOfMeasure || 'units';

      // 1. Check for erroneous negative stock values
      if (closing < 0 || opening < 0 || stockIn < 0 || stockOut < 0) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'critical',
          message: `Erronious negative stock detected for "${item.itemName}" (${sizeText}). Values: Opening: ${opening}, In: ${stockIn}, Out: ${stockOut}, Closing: ${closing}.`
        });
        continue;
      }

      // 2. Check for items sold at a cost-to-sell loss
      if (item.costPrice && item.sellingPrice) {
        const cost = Number(item.costPrice);
        const sell = Number(item.sellingPrice);
        if (cost >= sell && sell > 0) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'high',
            message: `Negative margin warning: "${item.itemName}" (${sizeText}) cost price (₹${cost}) is greater than or equal to its selling price (₹${sell}).`
          });
        }
      }

      // 3. Only evaluate depletion stock alerts on the active "Todays" or "Current" snapshot
      if (item.sheetName === 'Todays' || item.sheetName === 'Current') {
        // Out of Stock
        if (closing === 0 && (opening > 0 || stockOut > 0)) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'high',
            message: `Out of Stock warning: "${item.itemName}" (${sizeText}) is completely depleted (Closing Stock: 0).`
          });
        }
        // Low Stock
        else if (closing > 0 && closing < lowStockThreshold) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'medium',
            message: `Low Stock warning: "${item.itemName}" (${sizeText}) is running thin (Closing Stock: ${closing} ${unitText}).`
          });
        }
      }
    }

    return alerts;
  }
}
