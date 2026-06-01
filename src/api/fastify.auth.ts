import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSecurityCredentials, TokenPayload } from './controllers/security.controller.js';
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

  // 1. Check HttpOnly cookie first
  let token = request.cookies.app_session_token;

  // 2. Fallback to Authorization Bearer header (for Telegram bot backward compatibility)
  if (!token) {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    logger.warn(`Unauthorized API access blocked: missing token/cookie for route ${request.url}`);
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  try {
    const payload = request.server.jwt.verify<TokenPayload>(token);
    if (!payload || !payload.appLockAuthorized) {
      logger.warn(`Unauthorized API access blocked: invalid token/cookie for route ${request.url}`);
      reply.code(401).send({ error: 'Unauthorized: Invalid or expired session' });
      return;
    }
  } catch (err) {
    logger.warn({ err }, `Unauthorized API access blocked: invalid token/cookie for route ${request.url}`);
    reply.code(401).send({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }
}
