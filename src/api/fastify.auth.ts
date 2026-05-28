import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, getSecurityCredentials } from './controllers/security.controller.js';
import { logger } from '../logger/logger.js';

/**
 * Fastify preHandler hook to verify Bearer token authentication on protected routes.
 */
export async function checkFastifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const creds = await getSecurityCredentials();

  // If no app passcode is configured, auth is bypassed (dev / open mode)
  if (!creds.appPassword) {
    return;
  }

  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Unauthorized API access blocked: missing token for route ${request.url}`);
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload || !payload.appLockAuthorized) {
    logger.warn(`Unauthorized API access blocked: invalid token for route ${request.url}`);
    reply.code(401).send({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }
}
