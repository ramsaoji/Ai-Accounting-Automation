import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['credit', 'debit']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionSchema = z.object({
  date: z.union([z.date(), z.string()]).transform((val) => {
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${val}`);
    }
    return parsed;
  }),
  invoiceNumber: z.string().min(1, 'Invoice number is required').trim(),
  category: z.string().min(1, 'Category is required').trim(),
  description: z.string().default('').transform(v => v.trim()),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: TransactionTypeSchema,
  vendor: z.string().min(1, 'Vendor is required').trim(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
