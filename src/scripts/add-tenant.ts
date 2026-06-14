import { db, closeDb } from '../db/db.client.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger/logger.js';

// Configuration for the new business to onboard
const NEW_TENANT_CONFIG = {
  organizationName: 'Zenith Wellness Group',
  businessName: 'Zenith Salon & Spa',
  industryProfile: 'SERVICES', // SERVICES, RETAIL, HOSPITALITY, etc.
  baseCurrency: 'INR',
  baseTimezone: 'Asia/Kolkata',
  branches: [
    { name: 'Zenith Salon Downtown', slug: 'zenith-salon-downtown', description: 'Downtown premium spa location' }
  ],
  // Custom Chart of Accounts (CoA) mapping for the Salon industry
  chartOfAccounts: [
    { code: '4001', name: 'Hair Services Revenue', type: 'REVENUE', color: 'var(--primary)' },
    { code: '4002', name: 'Spa & Facial Revenue', type: 'REVENUE', color: 'var(--chart-2)' },
    { code: '4003', name: 'Retail Product Sales', type: 'REVENUE', color: 'var(--chart-3)' },
    { code: '4004', name: 'Membership Recovered', type: 'REVENUE', color: 'var(--success)' },
    { code: '5001', name: 'Salon Rent & Utilities', type: 'OPEX', color: 'var(--destructive)' },
    { code: '5002', name: 'Staff Commission & Wages', type: 'OPEX', color: 'var(--warning)' }
  ],
  // Dynamic spreadsheet parsing templates matching the salon's Excel layout
  parserTemplates: [
    {
      templateName: 'Zenith Salon Excel Sales Template',
      fileCategory: 'sales',
      mappingSchema: {
        file_category: 'sales',
        header_row_index: 2, // Header row index in the excel worksheet
        data_start_row: 3,  // Data starting row index
        columns: {
          date: { col_idx: 1, type: 'date' },       // Date column index
          invoice: { col_idx: 2, type: 'string' }   // Invoice column index
        },
        // Maps specific column indices to their respective Chart of Accounts codes
        expansions: [
          { col_index: 3, type: 'credit', coa_code: '4001', default_vendor: 'Hair Styling Desk', default_particulars: 'Hair Services Revenue' },
          { col_index: 4, type: 'credit', coa_code: '4002', default_vendor: 'Spa Rooms', default_particulars: 'Spa & Facial Treatments' },
          { col_index: 5, type: 'credit', coa_code: '4003', default_vendor: 'Product Shelves', default_particulars: 'Retail Product Sales' },
          { col_index: 6, type: 'credit', coa_code: '4004', default_vendor: 'Memberships', default_particulars: 'Membership Subscription Recoveries' },
          { col_index: 7, type: 'debit', coa_code: '5001', default_vendor: 'Landlords', default_particulars: 'Rent and utility opex' },
          { col_index: 8, type: 'debit', coa_code: '5002', default_vendor: 'Staff Members', default_particulars: 'Stylist wages paid' }
        ]
      }
    },
    {
      templateName: 'Zenith Salon Excel Stock Template',
      fileCategory: 'inventory',
      mappingSchema: {
        file_category: 'inventory',
        data_start_row: 3,
        columns: {
          itemName: { col_idx: 1 },
          itemCode: { col_idx: 2 },
          category: { col_idx: 3 },
          unitOfMeasure: { col_idx: 4 },
          openingStock: { col_idx: 5 },
          stockIn: { col_idx: 6 },
          stockOut: { col_idx: 7 },
          closingStock: { col_idx: 8 },
          costPrice: { col_idx: 9 },
          sellingPrice: { col_idx: 10 }
        }
      }
    },
    {
      templateName: 'Zenith Salon Excel Debitors Template',
      fileCategory: 'receivables',
      mappingSchema: {
        file_category: 'receivables',
        breakup: {
          sheet_name: 'Breakup',
          data_start_row: 2,
          columns: {
            partyName: { col_idx: 1 },
            debit: { col_idx: 2 },
            credit: { col_idx: 3 },
            pending: { col_idx: 4 }
          }
        },
        entrylist: {
          sheet_name: 'EntryList',
          data_start_row: 5,
          columns: {
            partyName: { col_idx: 2 },
            date: { col_idx: 3 },
            debit: { col_idx: 4 },
            credit: { col_idx: 5 }
          }
        }
      }
    }
  ]
};

async function onboardTenant() {
  logger.info('[ONBOARD] Starting onboarding pipeline for new tenant...');
  try {
    // 1. Create Organization
    let org = await db.select().from(schema.organizations).where(eq(schema.organizations.name, NEW_TENANT_CONFIG.organizationName)).limit(1).then(r => r[0]);
    if (!org) {
      logger.info(`Creating organization: ${NEW_TENANT_CONFIG.organizationName}`);
      org = await db.insert(schema.organizations).values({
        name: NEW_TENANT_CONFIG.organizationName,
        planTier: 'growth',
        billingStatus: 'active'
      }).returning().then(r => r[0]);
    }
    const orgId = org.id;

    // 2. Create Business Entity
    let business = await db.select().from(schema.businessEntities).where(and(eq(schema.businessEntities.name, NEW_TENANT_CONFIG.businessName), eq(schema.businessEntities.orgId, orgId))).limit(1).then(r => r[0]);
    if (!business) {
      logger.info(`Creating business: ${NEW_TENANT_CONFIG.businessName}`);
      business = await db.insert(schema.businessEntities).values({
        orgId,
        name: NEW_TENANT_CONFIG.businessName,
        industryProfile: NEW_TENANT_CONFIG.industryProfile,
        baseCurrency: NEW_TENANT_CONFIG.baseCurrency,
        baseTimezone: NEW_TENANT_CONFIG.baseTimezone
      }).returning().then(r => r[0]);
    }
    const businessId = business.id;

    // 3. Create Branches
    const branchMap = new Map<string, string>();
    for (const b of NEW_TENANT_CONFIG.branches) {
      let branchRow = await db.select().from(schema.branches).where(and(eq(schema.branches.name, b.name), eq(schema.branches.entityId, businessId))).limit(1).then(r => r[0]);
      if (!branchRow) {
        logger.info(`Creating branch: ${b.name}`);
        branchRow = await db.insert(schema.branches).values({
          entityId: businessId,
          name: b.name,
          slug: b.slug,
          metadata: { description: b.description }
        }).returning().then(r => r[0]);
      }
      branchMap.set(b.name, branchRow.id);
    }

    // 4. Create Chart of Accounts
    const coaIdMap = new Map<string, string>();
    for (const coa of NEW_TENANT_CONFIG.chartOfAccounts) {
      let coaRow = await db.select().from(schema.chartOfAccounts).where(and(eq(schema.chartOfAccounts.accountCode, coa.code), eq(schema.chartOfAccounts.entityId, businessId))).limit(1).then(r => r[0]);
      if (!coaRow) {
        logger.info(`Creating Chart of Account item: ${coa.name} (${coa.code})`);
        coaRow = await db.insert(schema.chartOfAccounts).values({
          entityId: businessId,
          accountCode: coa.code,
          accountName: coa.name,
          accountType: coa.type,
          colorHex: coa.color
        }).returning().then(r => r[0]);
      }
      coaIdMap.set(coa.code, coaRow.id);
    }

    // 5. Create Parser Mapping Templates
    for (const temp of NEW_TENANT_CONFIG.parserTemplates) {
      let template = await db.select().from(schema.parserTemplates).where(and(eq(schema.parserTemplates.templateName, temp.templateName), eq(schema.parserTemplates.entityId, businessId))).limit(1).then(r => r[0]);
      if (!template) {
        logger.info(`Registering excel parser template: ${temp.templateName}`);
        const resolvedSchema = {
          ...temp.mappingSchema,
          expansions: temp.mappingSchema.expansions
            ? temp.mappingSchema.expansions.map(e => ({
                ...e,
                coa_id: coaIdMap.get(e.coa_code)
              }))
            : undefined
        };
        await db.insert(schema.parserTemplates).values({
          entityId: businessId,
          templateName: temp.templateName,
          fileCategory: temp.fileCategory,
          mappingSchema: resolvedSchema
        });
      }
    }

    logger.info('[OK] New tenant successfully onboarded and configured!');
  } catch (err) {
    logger.error({ err }, '[ERROR] Onboarding pipeline failed');
  } finally {
    await closeDb();
  }
}

onboardTenant();
