import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testInit() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }

  console.log('Testing connection & initializing table...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const query = `
      CREATE TABLE IF NOT EXISTS financial_reports (
        report_type VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
    console.log('✅ Table created successfully or already exists!');
  } catch (err: any) {
    console.error('❌ Failed to initialize table:', err);
  } finally {
    await pool.end();
  }
}

testInit();
