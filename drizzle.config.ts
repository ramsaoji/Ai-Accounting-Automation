import { defineConfig } from 'drizzle-kit';
import { config } from './src/config/config.js';

if (!config.DATABASE_URL) {
  console.warn('DATABASE_URL is not configured in environment variables. Drizzle Kit requires a valid database URL to run migrations.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL || '',
  },
});
