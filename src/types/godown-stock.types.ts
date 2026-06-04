import { z } from 'zod';

export const GodownStockItemSchema = z.object({
  snapshotDate: z.union([z.date(), z.string()]).transform((val) => {
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${val}`);
    }
    return parsed;
  }),
  sheetName: z.string().min(1).trim(),
  itemName: z.string().min(1).trim(),
  itemCode: z.string().nullable().optional(),
  category: z.string().min(1).trim(),
  bottleSizeMl: z.number().int().nonnegative(),
  openingStock: z.coerce.number().default(0),
  stockIn: z.coerce.number().default(0),
  stockOut: z.coerce.number().default(0),
  closingStock: z.coerce.number().default(0),
  costPrice: z.coerce.number().nullable().optional(),
  sellingPrice: z.coerce.number().nullable().optional(),
  totalCostValue: z.coerce.number().nullable().optional(),
  totalSellValue: z.coerce.number().nullable().optional(),
  quantity: z.coerce.number().default(0),
  unitPrice: z.coerce.number().default(0),
  totalValue: z.coerce.number().default(0),
  location: z.string().trim().default('godown'),
  metadata: z.record(z.any()).optional(),
});

export type GodownStockItem = z.infer<typeof GodownStockItemSchema>;
