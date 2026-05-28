import crypto from 'crypto';
import { getReport, saveReport } from '../../db/db.client.js';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import * as argon2 from 'argon2';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const verifyUploadSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const verifyAppSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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

// ─── Lightweight Stateless Token Utilities ───────────────────────────────────

/**
 * Signs a payload as a lightweight stateless token (HMAC-SHA256, JWT-compatible format).
 */
export function signToken(payload: Record<string, unknown>, durationSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + durationSeconds;
  const tokenPayload = { ...payload, exp };
  const header = { alg: 'HS256', typ: 'JWT' };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a token. Returns the payload or null if invalid/expired.
 * Uses timing-safe comparison to prevent timing-based side-channel attacks.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', config.JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    // Timing-safe comparison to prevent timing-based side-channel attacks
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TokenPayload;

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // expired token
    }

    return payload;
  } catch {
    return null;
  }
}

// ─── Security Credentials ────────────────────────────────────────────────────

/**
 * Gets the current security credentials (from DB if active, otherwise env fallback in dev only).
 */
export async function getSecurityCredentials(): Promise<{ uploadPassword?: string; appPassword?: string }> {
  try {
    const dbData = await getReport('security-config');
    if (dbData) {
      return dbData;
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
    'This is INSECURE — ensure NODE_ENV=production and security-config is initialised in DB for production use.'
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
    const parseResult = verifyUploadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({ error: 'Invalid request payload: password is required' });
      return;
    }
    const { password } = parseResult.data;
    const creds = await getSecurityCredentials();
    const targetUploadPassword = creds.uploadPassword;

    if (!targetUploadPassword) {
      reply.code(200).send({ status: 'authorized', message: 'No upload password configured' });
      return;
    }

    const isMatch = await verifyPasscode(targetUploadPassword, password);
    if (isMatch) {
      const token = signToken({ uploadAuthorized: true }, 3600); // 1 hour validity
      reply.code(200).send({ status: 'authorized', sessionToken: token });
      return;
    }

    logger.warn('Failed upload passcode verification attempt.');
    reply.code(401).send({ error: 'Unauthorized: Invalid upload password' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during upload password verification handler');
    reply.code(500).send({ error: 'Server error processing request' });
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
    const parseResult = verifyAppSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({ error: 'Invalid request payload: password is required' });
      return;
    }
    const { password } = parseResult.data;
    const creds = await getSecurityCredentials();
    const targetAppPassword = creds.appPassword;

    if (!targetAppPassword) {
      // Bypass if no app password configured
      reply.code(200).send({ status: 'authorized', message: 'No app password lock is currently active' });
      return;
    }

    const isMatch = await verifyPasscode(targetAppPassword, password);
    if (isMatch) {
      const token = signToken({ appLockAuthorized: true }, 86400); // 24 Hours validity
      reply.code(200).send({ status: 'authorized', sessionToken: token });
      return;
    }

    logger.warn('Failed app-lock login attempt.');
    reply.code(401).send({ error: 'Unauthorized: Invalid credentials entered' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during app password verification handler');
    reply.code(500).send({ error: 'Server error processing request' });
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
    const parseResult = changePasswordsSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({ error: 'Invalid request payload: currentPassword is required' });
      return;
    }
    const { currentPassword, newUploadPassword, newAppPassword } = parseResult.data;
    const creds = await getSecurityCredentials();

    // Ensure current password matches appPassword
    if (creds.appPassword) {
      const isMatch = await verifyPasscode(creds.appPassword, currentPassword);
      if (!isMatch) {
        reply.code(401).send({ error: 'Unauthorized: Current password verification failed.' });
        return;
      }
    }

    const updatedCreds = {
      uploadPassword: newUploadPassword ? await argon2.hash(newUploadPassword.trim()) : creds.uploadPassword,
      appPassword: newAppPassword ? await argon2.hash(newAppPassword.trim()) : creds.appPassword,
    };

    await saveReport('security-config', updatedCreds);
    logger.info('Database security credentials config updated successfully.');

    reply.code(200).send({ status: 'success', message: 'Credentials updated successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed during password change execution');
    reply.code(500).send({ error: 'Server error processing password update' });
  }
}
