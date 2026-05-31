import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().optional(),

  // AI Config (Default fallback values for first-time seeding)
  DEFAULT_AI_PROVIDER: z.enum(['openai', 'gemini', 'claude', 'openrouter', 'deepseek', 'groq', 'none']).default('none'),
  DEFAULT_AI_MODEL: z.string().optional(),

  // API Keys (Conditional checks can be added at runtime depending on chosen provider)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Google Config (optional — falls back to local file mode if absent/placeholder)
  GOOGLE_CLIENT_EMAIL: z.string().default('accounting-worker@your-project-id.iam.gserviceaccount.com'),
  GOOGLE_PRIVATE_KEY: z.string().default('MIIEvgIBADANBgkqhkiG9w0').transform((val) => {
    // Replace escaped newlines with actual newline characters
    return val.replace(/\\n/g, '\n');
  }),
  GOOGLE_DRIVE_FOLDER_ID: z.string().default('your_google_drive_folder_id_here'),

  // Telegram Config (optional — skips bot/notifications if absent/placeholder)
  TELEGRAM_BOT_TOKEN: z.string().default('1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ'),
  // Comma-separated list of authorized chat IDs (e.g. "123456789,987654321")
  TELEGRAM_CHAT_ID: z.string().default('-1001234567890').transform((val) =>
    val.split(',').map((id) => id.trim()).filter(Boolean)
  ),
  // Timezones to format dates in Telegram messages (e.g. "Asia/Kolkata,Asia/Hong_Kong")
  TELEGRAM_TIMEZONES: z.string().default('Asia/Kolkata,Asia/Hong_Kong').transform((val) =>
    val.split(',').map((tz) => tz.trim()).filter(Boolean)
  ),

  // Scheduler Config
  CRON_SCHEDULE: z.string().default('0 0 * * *'), // Default to every day at 00:00

  // Authorization Config (Default fallback values for first-time seeding)
  DEFAULT_UPLOAD_PASSWORD: z.string({
    required_error: 'DEFAULT_UPLOAD_PASSWORD must be configured in your .env file to authorize spreadsheet ingestion uploads.',
  }).min(1, 'DEFAULT_UPLOAD_PASSWORD must not be empty inside .env.'),
  DEFAULT_APP_PASSWORD: z.string({
    required_error: 'DEFAULT_APP_PASSWORD must be configured in your .env file to secure the App Lock screen.',
  }).min(1, 'DEFAULT_APP_PASSWORD must not be empty inside .env.'),
  JWT_SECRET: z.string().default('development_jwt_secret_fallback_key_12345'),
  ENABLE_FILE_LOGGING: z.string().default('false').transform((val) => val === 'true'),
  DEFAULT_WEB_CHAT_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  DEFAULT_TELEGRAM_CHAT_ENABLED: z.string().default('true').transform((val) => val === 'true'),

  // CORS — comma-separated list of allowed production origins (e.g. "https://yourdomain.com")
  ALLOWED_ORIGINS: z.string().optional().default('').transform((val) =>
    val ? val.split(',').map((o) => o.trim()).filter(Boolean) : []
  ),

  // Business display name (used in AI prompts, Telegram messages, and reports)
  BUSINESS_NAME: z.string().optional().default('Hotel Gaurav'),
}).transform((data) => {
  const defaults: Record<string, string> = {
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-3-5-sonnet-20240620',
    deepseek: 'deepseek-chat',
    groq: 'llama-3.3-70b-versatile',
    openrouter: 'google/gemini-2.0-flash-exp:free',
    none: 'none'
  };
  const resolvedModel = data.DEFAULT_AI_MODEL || defaults[data.DEFAULT_AI_PROVIDER] || 'none';
  return {
    ...data,
    AI_PROVIDER: data.DEFAULT_AI_PROVIDER,
    AI_MODEL: resolvedModel,
    UPLOAD_PASSWORD: data.DEFAULT_UPLOAD_PASSWORD,
    APP_PASSWORD: data.DEFAULT_APP_PASSWORD
  };
}).refine(
  (data) => data.NODE_ENV !== 'production' || data.JWT_SECRET !== 'development_jwt_secret_fallback_key_12345',
  {
    message: 'JWT_SECRET must be explicitly defined and not fallback to default in production environment',
    path: ['JWT_SECRET'],
  }
);

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Configuration validation failed:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
