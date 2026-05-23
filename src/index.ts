import http from 'http';
import { schedulerJob } from './scheduler/scheduler.job.js';
import { orchestratorService } from './services/orchestrator.service.js';
import { config } from './config/config.js';
import { logger } from './logger/logger.js';

// 1. Initialize background cron scheduler
try {
  schedulerJob.start();
} catch (err) {
  logger.fatal({ err }, 'Failed to start background scheduler. Exiting process.');
  process.exit(1);
}

// 2. Spin up a lightweight native HTTP server for Railway / Render health-checks
// This prevents Render/Railway from failing deployments due to missing port bindings.
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'AI Accounting Automation Service',
        provider: config.AI_PROVIDER,
        model: config.AI_MODEL,
        cron: config.CRON_SCHEDULE,
      })
    );
    return;
  }

  // Trigger manual execution via a secure path (helpful for testing)
  if (req.url === '/trigger-pipeline' && req.method === 'POST') {
    logger.info('Manual pipeline execution triggered via HTTP POST request');
    
    // Fire-and-forget in background to return early
    orchestratorService.runPipeline().catch((err) => {
      logger.error({ err }, 'Manual HTTP pipeline run failed');
    });

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Accounting pipeline triggered successfully' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = config.PORT || 8080;
server.listen(PORT, () => {
  logger.info(
    { 
      port: PORT, 
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      aiModel: config.AI_MODEL 
    }, 
    '🚀 HTTP health-check server listening for requests'
  );
  
  // Perform an immediate test run on development startup
  if (config.NODE_ENV === 'development') {
    logger.info('Running dry-run pipeline test for development mode...');
    orchestratorService.runPipeline().catch((err) => {
      logger.error({ err }, 'Development startup pipeline test failed');
    });
  }
});

// 3. Graceful Shutdown handlers
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop scheduler
  schedulerJob.stop();

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
