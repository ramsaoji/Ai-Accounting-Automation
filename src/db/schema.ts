import { pgTable, uuid, varchar, integer, timestamp, boolean, text, jsonb, serial, date, numeric, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 0. Organizations (Multi-tenant SaaS boundary)
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  planTier: varchar('plan_tier', { length: 50 }).default('free').notNull(),
  billingStatus: varchar('billing_status', { length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 0b. Business Entities (RETAIL | HOSPITALITY | SERVICES etc)
export const businessEntities = pgTable('business_entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  industryProfile: varchar('industry_profile', { length: 50 }).default('general').notNull(),
  baseCurrency: varchar('base_currency', { length: 10 }).default('INR').notNull(),
  baseTimezone: varchar('base_timezone', { length: 100 }).default('Asia/Kolkata').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 0c. Branches / Outlets (Physical/virtual locations under an entity)
export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => businessEntities.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('branches_entity_id_slug_unique').on(table.entityId, table.slug)
]);

// 0d. Chart of Accounts (Flexible dynamic categorization)
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => businessEntities.id, { onDelete: 'cascade' }).notNull(),
  accountCode: varchar('account_code', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: varchar('account_type', { length: 50 }).notNull(), // REVENUE | COGS | OPEX | ASSET | LIABILITY
  parentId: uuid('parent_id'),
  colorHex: varchar('color_hex', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('coa_entity_id_code_unique').on(table.entityId, table.accountCode)
]);

// 0e. Parser Mapping Templates (Configuration schemas for Excel coordinates)
export const parserTemplates = pgTable('parser_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => businessEntities.id, { onDelete: 'cascade' }).notNull(),
  templateName: varchar('template_name', { length: 255 }).notNull(),
  fileCategory: varchar('file_category', { length: 50 }).notNull(), // sales | inventory | receivables | payroll
  mappingSchema: jsonb('mapping_schema').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 1. Files / Ingestion Runs
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'sales' | 'debitors' | 'godown_stock' | 'payroll' | 'party_ledger'
  runTimestamp: timestamp('run_timestamp').notNull(),
  totalRows: integer('total_rows').notNull(),
  aiSummary: text('ai_summary'),
  aiIntelligence: jsonb('ai_intelligence'), // Array of LLM analysis strings
  aiGenerated: boolean('ai_generated').default(false).notNull(),
  isLatest: boolean('is_latest').default(true).notNull(),
  status: varchar('status', { length: 30 }).default('processing').notNull(), // 'processing' | 'success' | 'failed'
  errorMessage: text('error_message'),
  contentHash: varchar('content_hash', { length: 64 }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => parserTemplates.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('files_type_latest_idx').on(table.fileType, table.isLatest),
  index('files_run_timestamp_idx').on(table.runTimestamp)
]);

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
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  coaId: uuid('coa_id').references(() => chartOfAccounts.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('transactions_file_id_idx').on(table.fileId),
  index('transactions_date_idx').on(table.date),
  index('transactions_category_idx').on(table.category),
  index('transactions_file_id_category_idx').on(table.fileId, table.category),
  index('transactions_file_id_date_idx').on(table.fileId, table.date)
]);

// 3. Stock Items (Consolidated inventory registers)
export const stockItems = pgTable('stock_items', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  snapshotDate: date('snapshot_date').notNull(),
  sheetName: varchar('sheet_name', { length: 100 }).notNull(),
  itemCode: varchar('item_code', { length: 100 }),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  bottleSizeMl: integer('bottle_size_ml').default(0).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }).default('units').notNull(),
  specification: varchar('specification', { length: 100 }),
  openingStock: numeric('opening_stock', { precision: 12, scale: 3 }).default('0').notNull(),
  stockIn: numeric('stock_in', { precision: 12, scale: 3 }).default('0').notNull(),
  stockOut: numeric('stock_out', { precision: 12, scale: 3 }).default('0').notNull(),
  closingStock: numeric('closing_stock', { precision: 12, scale: 3 }).default('0').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(), // kept for backwards compatibility
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(), // kept for backwards compatibility
  totalValue: numeric('total_value', { precision: 12, scale: 2 }).notNull(), // kept for backwards compatibility
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }),
  totalCostValue: numeric('total_cost_value', { precision: 14, scale: 2 }),
  totalSellValue: numeric('total_sell_value', { precision: 14, scale: 2 }),
  location: varchar('location', { length: 100 }).notNull(), // e.g. 'godown', 'counter', 'floor', 'downtown'
  metadata: jsonb('metadata'),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('stock_items_file_id_idx').on(table.fileId),
  index('stock_items_snapshot_date_idx').on(table.snapshotDate),
  index('stock_items_item_name_idx').on(table.itemName),
  index('stock_items_category_idx').on(table.category),
  index('stock_items_file_id_snapshot_date_idx').on(table.fileId, table.snapshotDate),
  index('stock_items_file_id_item_name_idx').on(table.fileId, table.itemName)
]);


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
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('party_balances_file_id_idx').on(table.fileId),
  index('party_balances_file_id_party_name_idx').on(table.fileId, table.partyName)
]);

// 5. Audit Exception Alerts
export const auditAlerts = pgTable('audit_alerts', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  ruleId: varchar('rule_id', { length: 50 }).notNull(),
  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'info' | 'low' | 'medium' | 'high' | 'critical'
  message: text('message').notNull(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_alerts_file_id_idx').on(table.fileId)
]);

// 6. Ingestion Parsing Errors & Warnings
export const parsingErrors = pgTable('parsing_errors', {
  id: serial('id').primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  rowNumber: integer('row_number').notNull(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  errorMessage: text('error_message').notNull(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('parsing_errors_file_id_idx').on(table.fileId)
]);

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

// 9. System Settings (Enable/Disable features)
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Audit Policies (Workspace/File-specific rules thresholds)
export const auditPolicies = pgTable('audit_policies', {
  id: serial('id').primaryKey(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'sales' | 'debitors' | 'godown_stock'
  fileName: varchar('file_name', { length: 255 }), // Nullable override
  ruleId: varchar('rule_id', { length: 50 }).notNull(), // 'RULE_002', 'RULE_008'
  parameterKey: varchar('parameter_key', { length: 100 }).notNull(), // 'ruleHighExpenseCeiling', etc.
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('audit_policies_file_type_idx').on(table.fileType),
  index('audit_policies_file_name_idx').on(table.fileName),
]);

// 11. History Retention Settings (Workspace-specific retention days)
export const historyRetentionSettings = pgTable('history_retention_settings', {
  fileType: varchar('file_type', { length: 50 }).primaryKey(), // 'sales' | 'godown_stock' | etc.
  retentionDays: integer('retention_days').default(90).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Schema Relations ────────────────────────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  businessEntities: many(businessEntities),
}));

export const businessEntitiesRelations = relations(businessEntities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [businessEntities.orgId],
    references: [organizations.id],
  }),
  branches: many(branches),
  chartOfAccounts: many(chartOfAccounts),
  parserTemplates: many(parserTemplates),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  businessEntity: one(businessEntities, {
    fields: [branches.entityId],
    references: [businessEntities.id],
  }),
  transactions: many(transactions),
  stockItems: many(stockItems),
  partyBalances: many(partyBalances),
  auditAlerts: many(auditAlerts),
  parsingErrors: many(parsingErrors),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  businessEntity: one(businessEntities, {
    fields: [chartOfAccounts.entityId],
    references: [businessEntities.id],
  }),
  parent: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentId],
    references: [chartOfAccounts.id],
    relationName: 'coa_hierarchy',
  }),
  children: many(chartOfAccounts, {
    relationName: 'coa_hierarchy',
  }),
  transactions: many(transactions),
}));

export const parserTemplatesRelations = relations(parserTemplates, ({ one, many }) => ({
  businessEntity: one(businessEntities, {
    fields: [parserTemplates.entityId],
    references: [businessEntities.id],
  }),
  files: many(files),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  transactions: many(transactions),
  stockItems: many(stockItems),
  partyBalances: many(partyBalances),
  auditAlerts: many(auditAlerts),
  parsingErrors: many(parsingErrors),
  branch: one(branches, {
    fields: [files.branchId],
    references: [branches.id],
  }),
  template: one(parserTemplates, {
    fields: [files.templateId],
    references: [parserTemplates.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  file: one(files, {
    fields: [transactions.fileId],
    references: [files.id],
  }),
  branch: one(branches, {
    fields: [transactions.branchId],
    references: [branches.id],
  }),
  coa: one(chartOfAccounts, {
    fields: [transactions.coaId],
    references: [chartOfAccounts.id],
  }),
}));

export const stockItemsRelations = relations(stockItems, ({ one }) => ({
  file: one(files, {
    fields: [stockItems.fileId],
    references: [files.id],
  }),
  branch: one(branches, {
    fields: [stockItems.branchId],
    references: [branches.id],
  }),
}));

export const partyBalancesRelations = relations(partyBalances, ({ one }) => ({
  file: one(files, {
    fields: [partyBalances.fileId],
    references: [files.id],
  }),
  branch: one(branches, {
    fields: [partyBalances.branchId],
    references: [branches.id],
  }),
}));

export const auditAlertsRelations = relations(auditAlerts, ({ one }) => ({
  file: one(files, {
    fields: [auditAlerts.fileId],
    references: [files.id],
  }),
  branch: one(branches, {
    fields: [auditAlerts.branchId],
    references: [branches.id],
  }),
}));

export const parsingErrorsRelations = relations(parsingErrors, ({ one }) => ({
  file: one(files, {
    fields: [parsingErrors.fileId],
    references: [files.id],
  }),
  branch: one(branches, {
    fields: [parsingErrors.branchId],
    references: [branches.id],
  }),
}));
