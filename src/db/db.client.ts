import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
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

  try {
    logger.info('Executing relational database schema migrations...');
    const migrationsPath = path.resolve(process.cwd(), 'drizzle');
    await migrate(db, { migrationsFolder: migrationsPath });
    isInitialized = true;
    logger.info('Relational schema migrations applied successfully. Database is fully up-to-date.');
  } catch (err) {
    logger.error({ err }, 'Failed to apply Drizzle schema migrations during database initialization');
    throw err;
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
      logger.info('Security configuration credentials verified successfully in relational DB.');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to initialize or seed relational security configuration');
  }
}
