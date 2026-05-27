import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in your .env file!');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'financial_reports'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    if (!tableExists) {
      console.log('❌ Table "financial_reports" does not exist in the database yet.');
      return;
    }

    console.log('✅ Table "financial_reports" exists!');
    
    const dataCheck = await pool.query('SELECT report_type, updated_at FROM financial_reports');
    if (dataCheck.rows.length === 0) {
      console.log('⚠️ The table is empty. No data has been inserted yet.');
    } else {
      console.log('✅ Data found in database:');
      console.table(dataCheck.rows);
    }
  } catch (err: any) {
    console.error('❌ Error querying database:', err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
