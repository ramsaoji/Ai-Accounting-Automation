import { Rule, RuleAlert, RuleContext } from '../rules.types.js';
import { GodownStockItem } from '../../types/accounting.types.js';

/**
 * Modular rule for auditing Godown Stock items.
 * Evaluates negative stock levels, out-of-stock items, low stock warnings, and selling price losses.
 */
export class GodownStockAlertsRule implements Rule {
  id = 'RULE_009';
  name = 'Godown Stock Audit & Alerts';
  description = 'Audits godown stock closing numbers, depletion levels, and cost-to-sell ratios.';

  async evaluate(transactions: any[], context?: RuleContext): Promise<RuleAlert[]> {
    const alerts: RuleAlert[] = [];

    if (!context || context.fileType !== 'godown_stock' || !context.godownStockItems) {
      return alerts;
    }

    const items: GodownStockItem[] = context.godownStockItems;

    for (const item of items) {
      const closing = Number(item.closingStock || 0);
      const opening = Number(item.openingStock || 0);
      const stockIn = Number(item.stockIn || 0);
      const stockOut = Number(item.stockOut || 0);

      // 1. Check for erroneous negative stock values
      if (closing < 0 || opening < 0 || stockIn < 0 || stockOut < 0) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'critical',
          message: `Erronious negative stock detected for "${item.itemName}" (${item.bottleSizeMl}ml). Values: Opening: ${opening}, In: ${stockIn}, Out: ${stockOut}, Closing: ${closing}.`
        });
        continue; // skip other warnings if it's already negative/erroneous
      }

      // 2. Check for items sold at a cost-to-sell loss (for Beer/Wine pricing data)
      if (item.costPrice && item.sellingPrice) {
        const cost = Number(item.costPrice);
        const sell = Number(item.sellingPrice);
        if (cost >= sell && sell > 0) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'high',
            message: `Negative margin warning: "${item.itemName}" (${item.bottleSizeMl}ml) cost price (₹${cost}) is greater than or equal to its selling price (₹${sell}).`
          });
        }
      }

      // 3. Only evaluate stock alerts on the active "Todays" snapshot, not historical history snapshots
      if (item.sheetName === 'Todays') {
        // Out of Stock
        if (closing === 0 && (opening > 0 || stockOut > 0)) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'high',
            message: `Out of Stock warning: "${item.itemName}" (${item.bottleSizeMl}ml) is completely depleted (Closing Stock: 0).`
          });
        }
        // Low Stock
        else if (closing > 0 && closing < 5) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            severity: 'medium',
            message: `Low Stock warning: "${item.itemName}" (${item.bottleSizeMl}ml) is running thin (Closing Stock: ${closing} units).`
          });
        }
      }
    }

    return alerts;
  }
}
