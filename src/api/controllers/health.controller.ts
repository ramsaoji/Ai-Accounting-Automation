import { config } from '../../config/config.js';

/**
 * GET /health, GET /
 * Returns system health state, active AI provider, active model, and cron configurations.
 */
export async function getHealth(request: any, reply: any): Promise<void> {
  reply.code(200).send({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'AI Accounting Automation Service',
    provider: config.AI_PROVIDER,
    model: config.AI_MODEL,
    cron: config.CRON_SCHEDULE,
  });
}
