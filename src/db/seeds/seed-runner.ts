import { db, closeDb } from '../db.client.js';
import * as schema from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../logger/logger.js';
import { hotelGauravConfig } from './hotel-gaurav.js';
import { zenithSalonConfig } from './zenith-salon.js';

export async function seedTenant(config: any) {
  logger.info(`[ONBOARD] Starting onboarding pipeline for tenant: ${config.businessName}...`);
  
  // 1. Create Organization
  let org = await db.select().from(schema.organizations).where(eq(schema.organizations.name, config.organizationName)).limit(1).then((r: any[]) => r[0]);
  if (!org) {
    logger.info(`Creating organization: ${config.organizationName}`);
    org = await db.insert(schema.organizations).values({
      name: config.organizationName,
      planTier: 'growth',
      billingStatus: 'active'
    }).returning().then((r: any[]) => r[0]);
  }
  const orgId = org.id;

  // 2. Create Business Entity
  let business = await db.select().from(schema.businessEntities).where(and(eq(schema.businessEntities.name, config.businessName), eq(schema.businessEntities.orgId, orgId))).limit(1).then((r: any[]) => r[0]);
  if (!business) {
    logger.info(`Creating business: ${config.businessName}`);
    business = await db.insert(schema.businessEntities).values({
      orgId,
      name: config.businessName,
      industryProfile: config.industryProfile,
      baseCurrency: config.baseCurrency,
      baseTimezone: config.baseTimezone
    }).returning().then((r: any[]) => r[0]);
  }
  const businessId = business.id;

  // 3. Create Branches
  const branchMap = new Map<string, string>();
  for (const b of config.branches) {
    let branchRow = await db.select().from(schema.branches).where(and(eq(schema.branches.name, b.name), eq(schema.branches.entityId, businessId))).limit(1).then((r: any[]) => r[0]);
    if (!branchRow) {
      logger.info(`Creating branch: ${b.name}`);
      branchRow = await db.insert(schema.branches).values({
        entityId: businessId,
        name: b.name,
        slug: b.slug,
        metadata: { description: b.description, rulesConfig: b.rulesConfig }
      }).returning().then((r: any[]) => r[0]);
    }
    branchMap.set(b.name, branchRow.id);
  }

  // 4. Create Chart of Accounts
  const coaIdMap = new Map<string, string>();
  for (const coa of config.chartOfAccounts) {
    let coaRow = await db.select().from(schema.chartOfAccounts).where(and(eq(schema.chartOfAccounts.accountCode, coa.code), eq(schema.chartOfAccounts.entityId, businessId))).limit(1).then((r: any[]) => r[0]);
    if (!coaRow) {
      logger.info(`Creating Chart of Account item: ${coa.name} (${coa.code})`);
      coaRow = await db.insert(schema.chartOfAccounts).values({
        entityId: businessId,
        accountCode: coa.code,
        accountName: coa.name,
        accountType: coa.type,
        colorHex: coa.color
      }).returning().then((r: any[]) => r[0]);
    }
    coaIdMap.set(coa.code, coaRow.id);
  }

  // 5. Create Parser Mapping Templates
  const templateIdMap = new Map<string, string>();
  for (const temp of config.parserTemplates) {
    let template = await db.select().from(schema.parserTemplates).where(and(eq(schema.parserTemplates.templateName, temp.templateName), eq(schema.parserTemplates.entityId, businessId))).limit(1).then((r: any[]) => r[0]);
    if (!template) {
      logger.info(`Registering excel parser template: ${temp.templateName}`);
      const resolvedSchema = {
        ...temp.mappingSchema,
        expansions: temp.mappingSchema.expansions
          ? temp.mappingSchema.expansions.map((e: any) => ({
              ...e,
              coa_id: coaIdMap.get(e.coa_code)
            }))
          : undefined
      };
      template = await db.insert(schema.parserTemplates).values({
        entityId: businessId,
        templateName: temp.templateName,
        fileCategory: temp.fileCategory,
        mappingSchema: resolvedSchema
      }).returning().then((r: any[]) => r[0]);
    }
    templateIdMap.set(temp.templateName, template.id);
  }

  logger.info(`[OK] Tenant ${config.businessName} successfully onboarded and configured!`);
  return { orgId, businessId, branchMap, coaIdMap, templateIdMap };
}

async function runAll() {
  const targetTenant = process.argv[2]?.toLowerCase();
  logger.info({ targetTenant }, '[SEED] Starting demo tenant seeding runner...');
  try {
    const shouldSeedGaurav = !targetTenant || targetTenant === 'gaurav' || targetTenant === 'hotel-gaurav';
    const shouldSeedSalon = !targetTenant || targetTenant === 'salon' || targetTenant === 'zenith-salon';

    if (shouldSeedGaurav) {
      // 1. Seed Hotel Gaurav
      const gaurav = await seedTenant(hotelGauravConfig);
      const mainBranchId = gaurav.branchMap.get('Hotel Gaurav Main')!;
      const godownBranchId = gaurav.branchMap.get('Hotel Gaurav Godown')!;
      const salesTemplateId = gaurav.templateIdMap.get('Hotel Gaurav Daily Sales Template')!;

      // 2. Backfill existing Files (for local dev test compatibility)
      logger.info('Backfilling branch and template scopes on existing Files...');
      const allFiles = await db.select().from(schema.files);
      let backfillFileCount = 0;
      for (const f of allFiles) {
        const isInventory = f.fileType === 'godown_stock' || f.fileType === 'counter_stock';
        const targetBranchId = isInventory ? godownBranchId : mainBranchId;
        const targetTemplateId = f.fileType === 'sales' ? salesTemplateId : null;

        await db.update(schema.files)
          .set({
            branchId: targetBranchId,
            templateId: targetTemplateId
          })
          .where(eq(schema.files.id, f.id));
        backfillFileCount++;
      }
      logger.info(`Successfully updated ${backfillFileCount} file references.`);

      // 3. Backfill existing Transactions
      logger.info('Backfilling branch and Chart of Account references on Transactions...');
      const allTxs = await db.select().from(schema.transactions);
      let backfillTxCount = 0;
      for (const t of allTxs) {
        const parentFile = allFiles.find(f => f.id === t.fileId);
        const targetBranchId = parentFile ? (parentFile.fileType === 'godown_stock' || parentFile.fileType === 'counter_stock' ? godownBranchId : mainBranchId) : mainBranchId;
        
        let targetCoaCode = '';
        const cat = t.category.toLowerCase();
        if (cat.includes('liquor') || cat.includes('wine')) {
          targetCoaCode = '4001';
        } else if (cat.includes('food')) {
          targetCoaCode = '4002';
        } else if (cat.includes('recovery') || cat.includes('jama')) {
          targetCoaCode = '4003';
        } else if (t.type === 'debit' && cat.includes('expense')) {
          targetCoaCode = '5001';
        } else if (t.type === 'debit' && cat.includes('extended')) {
          targetCoaCode = '5002';
        }
        const targetCoaId = targetCoaCode ? gaurav.coaIdMap.get(targetCoaCode) : null;

        await db.update(schema.transactions)
          .set({
            branchId: targetBranchId,
            coaId: targetCoaId
          })
          .where(eq(schema.transactions.id, t.id));
        backfillTxCount++;
      }
      logger.info(`Successfully updated ${backfillTxCount} transaction references.`);

      // 4. Backfill Stock ledger & party balances branchIds
      logger.info('Backfilling branch references on Stock items and debtor ledgers...');
      await db.update(schema.stockItems).set({ branchId: godownBranchId });
      await db.update(schema.partyBalances).set({ branchId: mainBranchId });
      await db.update(schema.auditAlerts).set({ branchId: mainBranchId });
      await db.update(schema.parsingErrors).set({ branchId: mainBranchId });
      logger.info('Reconciliation indices backfilled successfully.');
    }

    if (shouldSeedSalon) {
      // 5. Seed Zenith Salon & Spa
      await seedTenant(zenithSalonConfig);
    }

    logger.info('[OK] Seeding and backfill migration completed successfully!');
  } catch (err) {
    logger.error({ err }, '[ERROR] Seeding script encountered an error');
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Executed directly
runAll();
