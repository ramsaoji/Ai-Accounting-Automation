import pg from 'pg';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

if (config.DATABASE_URL) {
  logger.info('Initializing PostgreSQL connection pool with Neon DB...');
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for secure connections to Neon DB
    },
  });
} else {
  logger.warn('DATABASE_URL is not set. Neon DB storage will be bypassed (falling back to local files).');
}

let isInitialized = false;

/**
 * Initializes the database by creating the required reports table if it doesn't exist.
 */
export async function initDb(): Promise<void> {
  if (!pool) return;
  if (isInitialized) return;
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS financial_reports (
        report_type VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    isInitialized = true;
    logger.info('Neon DB initialized successfully: financial_reports table is ready.');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize database table in Neon');
  }
}

/**
 * Upserts a financial report JSON payload into the database.
 */
export async function saveReport(reportType: 'sales' | 'debitors' | 'daily-sales' | 'sync-metadata', data: any): Promise<void> {
  if (!pool) return;
  try {
    await initDb(); // Ensure table exists
    const query = `
      INSERT INTO financial_reports (report_type, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (report_type)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;
    await pool.query(query, [reportType, JSON.stringify(data)]);
    logger.info({ reportType }, 'Saved report summary to Neon DB');
  } catch (err) {
    logger.error({ err, reportType }, 'Failed to save report to Neon DB');
  }
}

/**
 * Retrieves a financial report JSON payload from the database.
 */
export async function getReport(reportType: 'sales' | 'debitors' | 'daily-sales' | 'sync-metadata'): Promise<any | null> {
  if (!pool) return null;
  try {
    await initDb(); // Ensure table exists
    const result = await pool.query('SELECT data FROM financial_reports WHERE report_type = $1', [reportType]);
    if (result.rows.length === 0) return null;
    return result.rows[0].data;
  } catch (err) {
    logger.error({ err, reportType }, 'Failed to read report from Neon DB');
    return null;
  }
}
