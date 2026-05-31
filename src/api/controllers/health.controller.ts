import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/config.js';
import { db, isLocalDb, getSystemSetting } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';

/**
 * GET /health, GET /
 * Public lightweight endpoint for simple container and status checks (load balancers).
 */
export async function getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.code(200).send({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/system/config
 * Authenticated endpoint serving diagnostic configs, database connection stats, and scheduling parameters.
 */
export async function getSystemConfig(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isMockDrive =
    config.GOOGLE_CLIENT_EMAIL.includes('your-project-id') ||
    config.GOOGLE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0') ||
    config.GOOGLE_DRIVE_FOLDER_ID.includes('your_google_drive_folder_id_here');

  let hasSyncedBefore = false;
  try {
    const syncMeta = await db.select().from(schema.syncMetadata).limit(1);
    hasSyncedBefore = syncMeta.length > 0;
  } catch (err) {
    // Fail silently, default to false (e.g. table not created yet)
  }

  const aiProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
  const aiModel = await getSystemSetting('ai_model', config.AI_MODEL);

  reply.code(200).send({
    service: 'AI Accounting Automation Service',
    provider: aiProvider,
    model: aiModel,
    cron: config.CRON_SCHEDULE,
    connectionMode: isMockDrive ? 'static' : 'live',
    isDbConnected: !!db,
    isLocalDb,
    isDevMode: config.NODE_ENV === 'development',
    hasSyncedBefore,
  });
}
