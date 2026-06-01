import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, and, isNull } from 'drizzle-orm';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import * as argon2 from 'argon2';
import * as schema from './schema.js';
import path from 'path';

const { Pool } = pg;

if (!config.DATABASE_URL) {
  logger.error('CRITICAL: DATABASE_URL is not set. A PostgreSQL database connection is strictly required.');
  throw new Error('DATABASE_URL environment variable is missing. The application requires PostgreSQL to run.');
}

export const isLocalDb = config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');

logger.info({ isLocalDb }, 'Initializing PostgreSQL connection pool for Drizzle ORM...');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: isLocalDb ? false : {
    rejectUnauthorized: false, // Required for Neon DB secure TLS connections
  },
});

export const db = drizzle(pool, { schema });

let isInitialized = false;

/**
 * Initializes the database by applying all outstanding migrations from the /drizzle folder.
 * This runs automatically on boot to ensure the relational schema matches the TypeScript models.
 */
export async function initDb(): Promise<void> {
  if (isInitialized) return;

  const maxRetries = 5;
  let delay = 2000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempt ${attempt} of ${maxRetries}: Executing relational database schema migrations...`);
      const migrationsPath = path.resolve(process.cwd(), 'drizzle');
      await migrate(db, { migrationsFolder: migrationsPath });
      isInitialized = true;
      logger.info('Relational schema migrations applied successfully. Database is fully up-to-date.');
      return;
    } catch (err) {
      logger.error({ err, attempt }, `Relational database migrations attempt ${attempt} failed.`);
      if (attempt === maxRetries) {
        throw err;
      }
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

/**
 * Initializes default security configuration inside Neon DB if not already present.
 * Seeds Argon2-hashed credentials sourced from server environment configurations.
 */
export async function initSecurityConfig(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(schema.securityConfig)
      .where(eq(schema.securityConfig.key, 'credentials'))
      .limit(1);

    if (existing.length === 0) {
      logger.info('No security config credentials found in relational DB. Seeding from environment variables...');
      const uploadHash = await argon2.hash(config.UPLOAD_PASSWORD);
      const appHash = await argon2.hash(config.APP_PASSWORD);
      
      await db.insert(schema.securityConfig).values({
         key: 'credentials',
         uploadPasswordHash: uploadHash,
         appPasswordHash: appHash,
      });
      logger.info('Database security credentials seeded successfully.');
    } else {
      const creds = existing[0];
      const appPasswordNeedsSync = !(await argon2.verify(creds.appPasswordHash, config.APP_PASSWORD).catch(() => false));
      const uploadPasswordNeedsSync = !(await argon2.verify(creds.uploadPasswordHash, config.UPLOAD_PASSWORD).catch(() => false));

      if (appPasswordNeedsSync || uploadPasswordNeedsSync) {
        logger.info('Detected updated fallback passwords in environment. Syncing hashes to DB...');
        const appHash = appPasswordNeedsSync ? await argon2.hash(config.APP_PASSWORD) : creds.appPasswordHash;
        const uploadHash = uploadPasswordNeedsSync ? await argon2.hash(config.UPLOAD_PASSWORD) : creds.uploadPasswordHash;

        await db
          .update(schema.securityConfig)
          .set({
            appPasswordHash: appHash,
            uploadPasswordHash: uploadHash,
            updatedAt: new Date(),
          })
          .where(eq(schema.securityConfig.key, 'credentials'));
        logger.info('Database security credentials config updated successfully.');
      } else {
        logger.info('Security configuration credentials verified successfully in relational DB.');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to initialize or seed relational security configuration');
  }
}

/**
 * Gracefully ends the PostgreSQL database connection pool.
 */
export async function closeDb(): Promise<void> {
  logger.info('Closing PostgreSQL database connection pool...');
  try {
    await pool.end();
    logger.info('PostgreSQL connection pool closed successfully.');
  } catch (err) {
    logger.error({ err }, 'Error closing PostgreSQL connection pool');
  }
}

/**
 * Fetches a system configuration setting value from the relational database by its unique key.
 * Returns default value if not present.
 */
export async function getSystemSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const existing = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key))
      .limit(1);

    if (existing.length === 0) {
      return defaultValue;
    }
    return existing[0].value;
  } catch (err) {
    logger.error({ err, key }, 'Failed to fetch system setting from database');
    return defaultValue;
  }
}

/**
 * Persists or updates a system configuration setting value inside the relational database using an upsert.
 */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  try {
    await db
      .insert(schema.systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value, updatedAt: new Date() },
      });
    logger.info({ key, value }, 'System configuration setting saved successfully');
  } catch (err) {
    logger.error({ err, key, value }, 'Failed to save system setting to database');
    throw err;
  }
}

/**
 * Fetches an audit policy setting value.
 * First checks for a specific file override, then a fileType default, and finally returns defaultValue.
 */
export async function getAuditPolicySetting(
  fileType: string,
  fileName: string | undefined | null,
  parameterKey: string,
  defaultValue: string
): Promise<string> {
  try {
    // 1. If fileName is provided, check for specific override first
    if (fileName) {
      const override = await db
        .select()
        .from(schema.auditPolicies)
        .where(
          and(
            eq(schema.auditPolicies.fileType, fileType),
            eq(schema.auditPolicies.fileName, fileName),
            eq(schema.auditPolicies.parameterKey, parameterKey)
          )
        )
        .limit(1);
      if (override.length > 0) {
        return override[0].value;
      }
    }

    // 2. Check for fileType default setting (where fileName is null or empty)
    const typeDefault = await db
      .select()
      .from(schema.auditPolicies)
      .where(
        and(
          eq(schema.auditPolicies.fileType, fileType),
          eq(schema.auditPolicies.parameterKey, parameterKey),
          isNull(schema.auditPolicies.fileName)
        )
      )
      .limit(1);
    if (typeDefault.length > 0) {
      return typeDefault[0].value;
    }

    return defaultValue;
  } catch (err) {
    logger.error({ err, fileType, fileName, parameterKey }, 'Failed to fetch audit policy setting');
    return defaultValue;
  }
}

/**
 * Saves or updates an audit policy setting value.
 */
export async function setAuditPolicySetting(
  fileType: string,
  fileName: string | undefined | null,
  ruleId: string,
  parameterKey: string,
  value: string
): Promise<void> {
  try {
    const cleanFileName = fileName || null;

    const existing = await db
      .select()
      .from(schema.auditPolicies)
      .where(
        and(
          eq(schema.auditPolicies.fileType, fileType),
          cleanFileName 
            ? eq(schema.auditPolicies.fileName, cleanFileName) 
            : isNull(schema.auditPolicies.fileName),
          eq(schema.auditPolicies.parameterKey, parameterKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.auditPolicies)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.auditPolicies.id, existing[0].id));
    } else {
      await db
        .insert(schema.auditPolicies)
        .values({
          fileType,
          fileName: cleanFileName,
          ruleId,
          parameterKey,
          value,
          updatedAt: new Date()
        });
    }
    logger.info({ fileType, fileName: cleanFileName, parameterKey, value }, 'Audit policy setting saved successfully');
  } catch (err) {
    logger.error({ err, fileType, fileName, parameterKey, value }, 'Failed to save audit policy setting');
    throw err;
  }
}

/**
 * Seeds initial system configurations on boot if not already present.
 */
export async function initSystemSettings(): Promise<void> {
  try {
    // 1. Check if the old 'ai_chat_enabled' exists in the database to migrate preference
    const oldSetting = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, 'ai_chat_enabled'))
      .limit(1);

    let initialValue = 'true';
    if (oldSetting.length > 0) {
      initialValue = oldSetting[0].value;
      logger.info({ initialValue }, 'Found historical "ai_chat_enabled" setting. Migrating to new separate keys...');
    }

    const isAiConfigured = config.AI_PROVIDER !== 'none' && config.AI_MODEL && config.AI_MODEL !== 'none' && config.AI_MODEL.trim() !== '';
    const initialWebChat = isAiConfigured && config.DEFAULT_WEB_CHAT_ENABLED;
    const initialTelegramChat = isAiConfigured && config.DEFAULT_TELEGRAM_CHAT_ENABLED;

    const keysToSeed = [
      { 
        key: 'web_chat_enabled', 
        value: oldSetting.length > 0 ? initialValue : (initialWebChat ? 'true' : 'false') 
      },
      { 
        key: 'telegram_chat_enabled', 
        value: oldSetting.length > 0 ? initialValue : (initialTelegramChat ? 'true' : 'false') 
      },
      {
        key: 'ai_provider',
        value: config.AI_PROVIDER
      },
      {
        key: 'ai_model',
        value: config.AI_MODEL
      }
    ];

    for (const item of keysToSeed) {
      const existing = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, item.key))
        .limit(1);

      if (existing.length === 0) {
        logger.info({ key: item.key, value: item.value }, 'Seeding default system setting...');
        await db.insert(schema.systemSettings).values({
          key: item.key,
          value: item.value,
        });
      }
    }

    // 2. Delete the old 'ai_chat_enabled' key so it doesn't clutter the database
    if (oldSetting.length > 0) {
      logger.info('Deleting old "ai_chat_enabled" configuration key from database...');
      await db
        .delete(schema.systemSettings)
        .where(eq(schema.systemSettings.key, 'ai_chat_enabled'));
    }

    // 3. Migrate historical audit policy settings from system_settings to audit_policies
    const policyMigrations = [
      {
        oldKey: 'rule_high_expense_ceiling',
        fileType: 'sales',
        ruleId: 'RULE_002',
        parameterKey: 'ruleHighExpenseCeiling',
        defaultValue: '50000'
      },
      {
        oldKey: 'rule_suspicious_spike_multiplier',
        fileType: 'sales',
        ruleId: 'RULE_003',
        parameterKey: 'ruleSuspiciousSpikeMultiplier',
        defaultValue: '3'
      },
      {
        oldKey: 'rule_outstanding_credit_cap',
        fileType: 'debitors',
        ruleId: 'RULE_008',
        parameterKey: 'ruleOutstandingCreditCap',
        defaultValue: '100000'
      }
    ];

    for (const pm of policyMigrations) {
      const oldKeySetting = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, pm.oldKey))
        .limit(1);

      let policyValue = pm.defaultValue;
      if (oldKeySetting.length > 0) {
        policyValue = oldKeySetting[0].value;
        logger.info({ oldKey: pm.oldKey, value: policyValue }, 'Found historical audit setting in system_settings. Migrating to audit_policies...');
      }

      const existingPolicy = await db
        .select()
        .from(schema.auditPolicies)
        .where(
          and(
            eq(schema.auditPolicies.fileType, pm.fileType),
            isNull(schema.auditPolicies.fileName),
            eq(schema.auditPolicies.parameterKey, pm.parameterKey)
          )
        )
        .limit(1);

      if (existingPolicy.length === 0) {
        logger.info({ fileType: pm.fileType, parameterKey: pm.parameterKey, value: policyValue }, 'Seeding default audit policy setting...');
        await db.insert(schema.auditPolicies).values({
          fileType: pm.fileType,
          fileName: null,
          ruleId: pm.ruleId,
          parameterKey: pm.parameterKey,
          value: policyValue,
          updatedAt: new Date()
        });
      }

      if (oldKeySetting.length > 0) {
        logger.info({ oldKey: pm.oldKey }, 'Deleting migrated audit key from system_settings...');
        await db
          .delete(schema.systemSettings)
          .where(eq(schema.systemSettings.key, pm.oldKey));
      }
    }

    logger.info('Database system settings initialization completed.');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize or seed system configuration settings');
  }
}
