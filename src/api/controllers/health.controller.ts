import http from 'http';
import { config } from '../../config/config.js';

/**
 * GET /health, GET /
 * Returns system health state, active AI provider, active model, and cron configurations.
 */
export function getHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
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
}
