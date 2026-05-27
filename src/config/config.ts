import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().optional(),
  
  // AI Config
  AI_PROVIDER: z.enum(['openai', 'gemini', 'claude', 'openrouter', 'deepseek', 'ollama', 'groq']).default('gemini'),
  AI_MODEL: z.string().min(1, 'AI_MODEL is required'),
  
  // API Keys (Conditional checks can be added at runtime depending on chosen provider)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  
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
  
  // Scheduler Config
  CRON_SCHEDULE: z.string().default('0 0 * * *'), // Default to every day at 00:00
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Configuration validation failed:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
