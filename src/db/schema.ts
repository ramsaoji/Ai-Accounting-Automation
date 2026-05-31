import { pgTable, uuid, varchar, integer, timestamp, boolean, text, jsonb, serial, date, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Files / Ingestion Runs
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'sales' | 'debitors' | 'stock' | 'payroll' | 'party_ledger'
  runTimestamp: timestamp('run_timestamp').notNull(),
  totalRows: integer('total_rows').notNull(),
  aiSummary: text('ai_summary'),
  aiIntelligence: jsonb('ai_intelligence'), // Array of LLM analysis strings
  aiGenerated: boolean('ai_generated').default(false).notNull(),
  isLatest: boolean('is_latest').default(true).notNull(),
  status: varchar('status', { length: 30 }).default('processing').notNull(), // 'processing' | 'success' | 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Transactions (Sales counter logs, payroll lines, supplier payments)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  sheetName: varchar('sheet_name', { length: 100 }).notNull(),
  date: date('date').notNull(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  category: varchar('category', { length: 100 }).notNull(), // e.g. 'Liquor Sales', 'Food Sales', 'Daily Expense', 'Salary'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 'credit' (inflow) | 'debit' (outflow)
  vendor: varchar('vendor', { length: 255 }).notNull(), // Customer, Employee, or Supplier
  particulars: text('particulars'),
  metadata: jsonb('metadata'), // Dynamic metadata catches columns/drift
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Stock Items (For godown and counter inventory registers)
export const stockItems = pgTable('stock_items', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  sheetName: varchar('sheet_name', { length: 100 }).notNull(), // e.g. "Liquor Counter Stock"
  itemCode: varchar('item_code', { length: 100 }),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric('total_value', { precision: 12, scale: 2 }).notNull(),
  location: varchar('location', { length: 100 }).notNull(), // 'godown' | 'counter'
  metadata: jsonb('metadata'), // Captures custom inventory columns
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Party Balances (Outstanding credit balances for debtors and creditors/suppliers)
export const partyBalances = pgTable('party_balances', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  partyName: varchar('party_name', { length: 255 }).notNull(),
  partyType: varchar('party_type', { length: 30 }).notNull(), // 'debtor' (Udhari) | 'creditor' (Supplier)
  debit: numeric('debit', { precision: 12, scale: 2 }).notNull(),
  credit: numeric('credit', { precision: 12, scale: 2 }).notNull(),
  pending: numeric('pending', { precision: 12, scale: 2 }).notNull(),
  metadata: jsonb('metadata'), // Credit rating, contact number, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Audit Exception Alerts
export const auditAlerts = pgTable('audit_alerts', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  ruleId: varchar('rule_id', { length: 50 }).notNull(),
  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'info' | 'low' | 'medium' | 'high' | 'critical'
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Ingestion Parsing Errors & Warnings
export const parsingErrors = pgTable('parsing_errors', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  rowNumber: integer('row_number').notNull(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  errorMessage: text('error_message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Security Credentials (Argon2 hashes)
export const securityConfig = pgTable('security_config', {
  key: varchar('key', { length: 50 }).primaryKey(), // 'credentials'
  appPasswordHash: varchar('app_password_hash', { length: 255 }).notNull(),
  uploadPasswordHash: varchar('upload_password_hash', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. File Sync Metadata (Modification times / hashes)
export const syncMetadata = pgTable('sync_metadata', {
  fileName: varchar('file_name', { length: 255 }).primaryKey(),
  modifiedTime: varchar('modified_time', { length: 100 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Schema Relations ────────────────────────────────────────────────────────
export const filesRelations = relations(files, ({ many }) => ({
  transactions: many(transactions),
  stockItems: many(stockItems),
  partyBalances: many(partyBalances),
  auditAlerts: many(auditAlerts),
  parsingErrors: many(parsingErrors),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  file: one(files, {
    fields: [transactions.fileId],
    references: [files.id],
  }),
}));

export const stockItemsRelations = relations(stockItems, ({ one }) => ({
  file: one(files, {
    fields: [stockItems.fileId],
    references: [files.id],
  }),
}));

export const partyBalancesRelations = relations(partyBalances, ({ one }) => ({
  file: one(files, {
    fields: [partyBalances.fileId],
    references: [files.id],
  }),
}));

export const auditAlertsRelations = relations(auditAlerts, ({ one }) => ({
  file: one(files, {
    fields: [auditAlerts.fileId],
    references: [files.id],
  }),
}));

export const parsingErrorsRelations = relations(parsingErrors, ({ one }) => ({
  file: one(files, {
    fields: [parsingErrors.fileId],
    references: [files.id],
  }),
}));
