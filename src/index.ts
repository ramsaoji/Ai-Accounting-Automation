import { schedulerJob } from './scheduler/scheduler.job.js';
import { config } from './config/config.js';
import { logger } from './logger/logger.js';
import { telegramBot } from './telegram/telegram.bot.js';
import { initDb, initSecurityConfig, initSystemSettings } from './db/db.client.js';
import { createFastifyApp } from './api/fastify.app.js';
import { AiProviderFactory } from './ai/ai.factory.js';
import type { FastifyInstance } from 'fastify';

// Module-scoped app reference so the shutdown handler can reach it
let app: FastifyInstance;

/**
 * Sequential startup: DB must be fully ready before any other service starts.
 * This eliminates the race where the scheduler or HTTP server could handle
 * requests before security credentials are loaded into the database.
 */
async function start() {
  // 0. Initialize database and seed security config — must complete before anything else
  try {
    await initDb();
    await initSecurityConfig();
    await initSystemSettings();
  } catch (dbErr) {
    logger.fatal({ err: dbErr }, 'CRITICAL: Failed to initialize PostgreSQL database. The application requires PostgreSQL to be running. Exiting.');
    process.exit(1);
  }

  // 0.5 Validate AI provider credentials at startup (not at first use)
  AiProviderFactory.validateProviderConfig();

  // 0.6 Log Google Drive integration status
  const isMockDrive =
    config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
    config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0');
  if (isMockDrive) {
    logger.warn('[Google Drive] Integration is in MOCK mode. API syncing is disabled. Only manual HTTP file uploads will be processed.');
  } else {
    logger.info('[Google Drive] Google Drive integration is ACTIVE (Live Sync Mode enabled).');
  }

  // 1. Initialize background cron scheduler
  try {
    schedulerJob.start();
  } catch (err) {
    logger.fatal({ err }, 'Failed to start background scheduler. Exiting process.');
    process.exit(1);
  }

  // 2. Initialize background Telegram Bot interactive listener
  try {
    telegramBot.start();
  } catch (err) {
    logger.error({ err }, 'Failed to start interactive Telegram Bot listener. Proceeding with core services.');
  }

  // 3. Spin up Fastify HTTP server
  app = createFastifyApp();
  const PORT = config.PORT || 8080;

  await app.listen({ port: PORT, host: '0.0.0.0' });
  logger.info(
    {
      port: PORT,
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      aiModel: config.AI_MODEL,
    },
    '[SERVER] Fastify HTTP server listening for requests'
  );
}

// 4. Graceful Shutdown handlers
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Force exit after 10s if sockets remain open (registered before any async work)
  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceExit.unref(); // Allow clean exit if shutdown completes in time

  // Stop scheduler
  schedulerJob.stop();

  // Stop Telegram Bot
  try {
    telegramBot.stop();
  } catch (err) {
    logger.error({ err }, 'Error stopping Telegram Bot during shutdown');
  }

  // Close Fastify server
  try {
    if (app) await app.close();
    logger.info('HTTP server closed. Service shutdown complete. Goodbye!');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error closing Fastify server during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.fatal({ err }, 'Fatal error during service startup. Exiting.');
  process.exit(1);
});

export { app };
