import pg from 'pg';
import dotenv from 'dotenv';


dotenv.config();

const { Pool } = pg;

async function resetDrizzle() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in your .env file!');
    process.exit(1);
  }

  console.log('[RESET] Connecting to PostgreSQL database to perform a Drizzle reset...');
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('[DELETE] Dropping all relational and Drizzle metadata tables...');
    
    // Perform a cascade drop of all our custom schemas and Drizzle migrations tracking table
    await pool.query(`
      DROP TABLE IF EXISTS "sync_metadata" CASCADE;
      DROP TABLE IF EXISTS "parsing_errors" CASCADE;
      DROP TABLE IF EXISTS "audit_alerts" CASCADE;
      DROP TABLE IF EXISTS "party_balances" CASCADE;
      DROP TABLE IF EXISTS "stock_items" CASCADE;
      DROP TABLE IF EXISTS "godown_stock_items" CASCADE;
      DROP TABLE IF EXISTS "counter_stock_items" CASCADE;
      DROP TABLE IF EXISTS "transactions" CASCADE;
      DROP TABLE IF EXISTS "security_config" CASCADE;
      DROP TABLE IF EXISTS "system_settings" CASCADE;
      DROP TABLE IF EXISTS "history_retention_settings" CASCADE;
      DROP TABLE IF EXISTS "audit_policies" CASCADE;
      DROP TABLE IF EXISTS "files" CASCADE;
      DROP TABLE IF EXISTS "parser_templates" CASCADE;
      DROP TABLE IF EXISTS "chart_of_accounts" CASCADE;
      DROP TABLE IF EXISTS "branches" CASCADE;
      DROP TABLE IF EXISTS "business_entities" CASCADE;
      DROP TABLE IF EXISTS "organizations" CASCADE;
      DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;
      DROP SCHEMA IF EXISTS "drizzle" CASCADE;
    `);

    console.log('[OK] All tables successfully dropped.');
  } catch (err: any) {
    console.error('[ERROR] Error dropping tables:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }


}

resetDrizzle();
