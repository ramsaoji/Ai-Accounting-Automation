import http from 'http';
import { schedulerJob } from './scheduler/scheduler.job.js';
import { config } from './config/config.js';
import { logger } from './logger/logger.js';
import { telegramBot } from './telegram/telegram.bot.js';
import { initDb, initSecurityConfig } from './db/db.client.js';
import { handleRequest } from './api/router.js';

// 0. Initialize Neon DB if configured
initDb().then(async () => {
  await initSecurityConfig();
}).catch((dbErr) => {
  logger.error({ err: dbErr }, 'Failed to initialize Neon DB connection');
});

// 1. Initialize background cron scheduler
try {
  schedulerJob.start();
} catch (err) {
  logger.fatal({ err }, 'Failed to start background scheduler. Exiting process.');
  process.exit(1);
}

// 1.5 Initialize background Telegram Bot interactive listener
try {
  telegramBot.start();
} catch (err) {
  logger.error({ err }, 'Failed to start interactive Telegram Bot listener. Proceeding with core services.');
}

// 2. Spin up a lightweight native HTTP server delegating to the modular router
const server = http.createServer(handleRequest);

const PORT = config.PORT || 8080;
server.listen(PORT, () => {
  logger.info(
    { 
      port: PORT, 
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      aiModel: config.AI_MODEL 
    }, 
    '[SERVER] HTTP server listening for requests'
  );
});

// 3. Graceful Shutdown handlers
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop scheduler
  schedulerJob.stop();

  // Stop Telegram Bot
  try {
    telegramBot.stop();
  } catch (err) {
    logger.error({ err }, 'Error stopping Telegram Bot during shutdown');
  }

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP healthcheck server closed.');
    logger.info('Service shutdown complete. Goodbye!');
    process.exit(0);
  });

  // Force exit after 10s if sockets remain open
  setTimeout(() => {
    logger.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
export default server;
