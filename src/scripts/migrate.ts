import { initDb, initSecurityConfig, initSystemSettings, closeDb } from '../db/db.client.js';
import { logger } from '../logger/logger.js';

async function runMigration() {
  logger.info('🚀 Starting database migrations and configuration seeding...');
  try {
    await initDb();
    await initSecurityConfig();
    await initSystemSettings();
    logger.info('✅ Database migrations and seeding completed successfully!');
  } catch (err) {
    logger.error({ err }, '❌ Database migration script failed');
    process.exit(1);
  } finally {
    await closeDb();
  }
}

runMigration();
