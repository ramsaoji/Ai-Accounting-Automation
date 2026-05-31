import pg from 'pg';
import dotenv from 'dotenv';
import { initDb, initSecurityConfig } from '../db/db.client.js';

dotenv.config();

const { Pool } = pg;

async function resetDrizzle() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in your .env file!');
    process.exit(1);
  }

  console.log('🔄 Connecting to PostgreSQL database to perform a Drizzle reset...');
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🗑️ Dropping all relational and Drizzle metadata tables...');
    
    // Perform a cascade drop of all our custom schemas and Drizzle migrations tracking table
    await pool.query(`
      DROP TABLE IF EXISTS "sync_metadata" CASCADE;
      DROP TABLE IF EXISTS "parsing_errors" CASCADE;
      DROP TABLE IF EXISTS "audit_alerts" CASCADE;
      DROP TABLE IF EXISTS "party_balances" CASCADE;
      DROP TABLE IF EXISTS "stock_items" CASCADE;
      DROP TABLE IF EXISTS "transactions" CASCADE;
      DROP TABLE IF EXISTS "security_config" CASCADE;
      DROP TABLE IF EXISTS "files" CASCADE;
      DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;
      DROP SCHEMA IF EXISTS "drizzle" CASCADE;
    `);

    console.log('✅ All tables successfully dropped.');
  } catch (err: any) {
    console.error('❌ Error dropping tables:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  // Run the Drizzle initial migrations and seed security config
  try {
    console.log('🏗️ Booting database initializers to apply migrations and seed credentials...');
    await initDb();
    await initSecurityConfig();
    console.log('🎉 Drizzle reset completed successfully! The database is clean and primed.');
  } catch (err: any) {
    console.error('❌ Error executing migrations:', err.message);
    process.exit(1);
  }
}

resetDrizzle();
