import crypto from 'crypto';
import { db } from '../../db/db.client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import * as argon2 from 'argon2';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../errors.js';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const verifyUploadSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const verifyAppSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

export const changePasswordsSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newUploadPassword: z.string().optional(),
  newAppPassword: z.string().optional(),
});

// ─── Token Payload Type ──────────────────────────────────────────────────────

export interface TokenPayload {
  exp: number;
  appLockAuthorized?: boolean;
  uploadAuthorized?: boolean;
}

// JWT token utilities are now handled natively by Fastify's @fastify/jwt plugin.

// ─── Security Credentials ────────────────────────────────────────────────────

let cachedCredentials: { uploadPassword?: string; appPassword?: string } | null = null;

/**
 * Gets the current security credentials (from DB if active, otherwise env fallback in dev only).
 */
export async function getSecurityCredentials(): Promise<{ uploadPassword?: string; appPassword?: string }> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  try {
    if (db) {
      const dbData = await db
        .select()
        .from(schema.securityConfig)
        .where(eq(schema.securityConfig.key, 'credentials'))
        .limit(1);
      if (dbData.length > 0) {
        cachedCredentials = {
          uploadPassword: dbData[0].uploadPasswordHash,
          appPassword: dbData[0].appPasswordHash,
        };
        return cachedCredentials;
      }
    }
    if (config.NODE_ENV === 'production') {
      throw new Error('Database security-config record is missing.');
    }
  } catch (err: unknown) {
    if (config.NODE_ENV === 'production') {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, 'Failed to retrieve security configuration from DB in production environment.');
      throw new Error('Database security-config is unavailable or missing. Plain-text env fallback is disabled in production.');
    }
    logger.warn('Failed to retrieve security configuration from DB. Falling back to env values (dev mode only).');
  }

  // Dev-only plain-text fallback — warn loudly so this is never silently used in production
  logger.warn(
    '[DEV MODE] Using plain-text password fallback from env. ' +
    'This is INSECURE - ensure NODE_ENV=production and security-config is initialised in DB for production use.'
  );

  return {
    uploadPassword: config.UPLOAD_PASSWORD,
    appPassword: config.APP_PASSWORD,
  };
}

/**
 * Verifies a password input against a stored credential string.
 * Supports Argon2 hashes or raw plain-text fallback (dev/env mode only).
 */
export async function verifyPasscode(stored: string, input: string): Promise<boolean> {
  if (stored.startsWith('$argon2')) {
    try {
      return await argon2.verify(stored, input);
    } catch (err) {
      logger.error({ err }, 'Error verifying Argon2 hash format');
      return false;
    }
  }
  // Plain-text comparison — only reachable in dev/env fallback mode
  return input === stored;
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * POST /api/security/verify-upload
 * Authenticates user password for spreadsheet uploads.
 */
export async function verifyUploadPasscode(
  request: FastifyRequest<{ Body: z.infer<typeof verifyUploadSchema> }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { password } = request.body;
    const creds = await getSecurityCredentials();
    const targetUploadPassword = creds.uploadPassword;

    if (!targetUploadPassword) {
      reply.code(200).send({ status: 'authorized', message: 'No upload password configured' });
      return;
    }

    const isMatch = await verifyPasscode(targetUploadPassword, password);
    if (isMatch) {
      const token = request.server.jwt.sign({ uploadAuthorized: true }, { expiresIn: '1h' });
      reply.code(200).send({ status: 'authorized', sessionToken: token });
      return;
    }

    logger.warn('Failed upload passcode verification attempt.');
    reply.code(401).send(Errors.unauthorized('Invalid upload password'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during upload password verification handler');
    reply.code(500).send(Errors.internalError('Server error processing request'));
  }
}

/**
 * POST /api/security/verify-app
 * Authenticates user password for app-wide lock screen access.
 */
export async function verifyAppPassword(
  request: FastifyRequest<{ Body: z.infer<typeof verifyAppSchema> }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { password, remember } = request.body;
    const creds = await getSecurityCredentials();
    const targetAppPassword = creds.appPassword;

    if (!targetAppPassword) {
      // Bypass if no app password configured
      reply.code(200).send({ status: 'authorized', message: 'No app password lock is currently active' });
      return;
    }

    const isMatch = await verifyPasscode(targetAppPassword, password);
    if (isMatch) {
      const durationSeconds = remember ? 604800 : 86400; // 7 days or 24 hours
      const token = request.server.jwt.sign({ appLockAuthorized: true }, { expiresIn: durationSeconds });
      const isProd = config.NODE_ENV === 'production';

      reply.setCookie('app_session_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: remember ? 604800 : undefined,
      });

      reply.code(200).send({ status: 'authorized', sessionToken: 'active' });
      return;
    }

    logger.warn('Failed app-lock login attempt.');
    reply.code(401).send(Errors.unauthorized('Invalid credentials entered'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during app password verification handler');
    reply.code(500).send(Errors.internalError('Server error processing request'));
  }
}

/**
 * POST /api/security/change
 * Updates app and upload authorization keys in the database.
 * Requires verification of the current app lock password.
 */
export async function changePasswords(
  request: FastifyRequest<{ Body: z.infer<typeof changePasswordsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { currentPassword, newUploadPassword, newAppPassword } = request.body;
    const creds = await getSecurityCredentials();

    // Ensure current password matches appPassword
    if (creds.appPassword) {
      const isMatch = await verifyPasscode(creds.appPassword, currentPassword);
      if (!isMatch) {
        reply.code(401).send(Errors.unauthorized('Current password verification failed'));
        return;
      }
    }

    const uploadHash = newUploadPassword ? await argon2.hash(newUploadPassword.trim()) : creds.uploadPassword;
    const appHash = newAppPassword ? await argon2.hash(newAppPassword.trim()) : creds.appPassword;

    if (db) {
      await db
        .insert(schema.securityConfig)
        .values({
          key: 'credentials',
          uploadPasswordHash: uploadHash!,
          appPasswordHash: appHash!,
        })
        .onConflictDoUpdate({
          target: schema.securityConfig.key,
          set: {
            uploadPasswordHash: uploadHash!,
            appPasswordHash: appHash!,
            updatedAt: new Date(),
          },
        });
    }
    cachedCredentials = null;
    logger.info('Database security credentials config updated successfully.');

    reply.code(200).send({ status: 'success', message: 'Credentials updated successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during password change execution');
    reply.code(500).send(Errors.internalError('Server error processing password update'));
  }
}

/**
 * GET /api/security/status
 * Verifies if the request contains a valid HttpOnly cookie session.
 */
export async function checkSessionStatus(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.cookies.app_session_token;
  if (!token) {
    reply.code(401).send({ error: 'No active session cookie found' });
    return;
  }

  try {
    const payload = request.server.jwt.verify<TokenPayload>(token);
    if (!payload || !payload.appLockAuthorized) {
      reply.code(401).send({ error: 'Session cookie is invalid or expired' });
      return;
    }
  } catch (err) {
    reply.code(401).send({ error: 'Session cookie is invalid or expired' });
    return;
  }

  reply.code(200).send({ status: 'authorized' });
}

/**
 * POST /api/security/logout
 * Clears the session cookie.
 */
export async function logoutUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const isProd = config.NODE_ENV === 'production';
  reply.clearCookie('app_session_token', {
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  reply.code(200).send({ status: 'success', message: 'Logged out successfully' });
}
