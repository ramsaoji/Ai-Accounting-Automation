import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/config.js';

/**
 * GET /health, GET /
 * Returns system health state, active AI provider, active model, and cron configurations.
 */
export async function getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isMockDrive =
    config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
    config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0') ||
    config.GOOGLE_DRIVE_FOLDER_ID.includes('your_google_drive_folder_id_here');

  reply.code(200).send({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'AI Accounting Automation Service',
    provider: config.AI_PROVIDER,
    model: config.AI_MODEL,
    cron: config.CRON_SCHEDULE,
    connectionMode: isMockDrive ? 'static' : 'live',
  });
}
