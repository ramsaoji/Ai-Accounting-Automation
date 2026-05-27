import http from 'http';
import crypto from 'crypto';
import { getReport, saveReport } from '../../db/db.client.js';
import { logger } from '../../logger/logger.js';
import { corsHeaders } from '../cors.js';
import { config } from '../../config/config.js';
import * as argon2 from 'argon2';

// In-memory active session tokens for app lock and manual uploads
export const appSessions = new Set<string>();
export const uploadSessions = new Set<string>();

/**
 * Gets the current security credentials config (from DB if active, otherwise fallback to config/env).
 */
export async function getSecurityCredentials(): Promise<{ uploadPassword?: string; appPassword?: string }> {
  try {
    const dbData = await getReport('security-config');
    if (dbData) {
      return dbData;
    }
  } catch (err) {
    logger.warn('Failed to retrieve security configuration from DB. Falling back to env values.');
  }
  return {
    uploadPassword: config.UPLOAD_PASSWORD,
    appPassword: config.APP_PASSWORD
  };
}

/**
 * Verifies a password input against a stored credential string.
 * Supports Argon2 hashes or raw plain-text fallback (for local mode / env fallbacks).
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
  return input === stored;
}

/**
 * POST /api/security/verify-app
 * Authenticates user password for app-wide lock screen access.
 */
export function verifyAppPassword(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { password } = JSON.parse(body);
      const creds = await getSecurityCredentials();
      const targetAppPassword = creds.appPassword;

      if (!targetAppPassword) {
        // Bypass if no app password configured
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ status: 'authorized', message: 'No app password lock is currently active' }));
        return;
      }

      const isMatch = await verifyPasscode(targetAppPassword, password);
      if (isMatch) {
        const token = crypto.randomUUID();
        appSessions.add(token);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ status: 'authorized', sessionToken: token }));
        return;
      }

      logger.warn('Failed app-lock login attempt.');
      res.writeHead(401, corsHeaders);
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid credentials entered' }));
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed during app password verification handler');
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Server error processing request' }));
    }
  });
}

/**
 * POST /api/security/change
 * Updates app and upload authorization keys in the database.
 * Requires verification of the current app lock password.
 */
export function changePasswords(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { currentPassword, newUploadPassword, newAppPassword } = JSON.parse(body);
      const creds = await getSecurityCredentials();

      // Ensure current password matches appPassword
      if (creds.appPassword) {
        const isMatch = await verifyPasscode(creds.appPassword, currentPassword);
        if (!isMatch) {
          res.writeHead(401, corsHeaders);
          res.end(JSON.stringify({ error: 'Unauthorized: Current password verification failed.' }));
          return;
        }
      }

      const updatedCreds = {
        uploadPassword: newUploadPassword ? await argon2.hash(newUploadPassword.trim()) : creds.uploadPassword,
        appPassword: newAppPassword ? await argon2.hash(newAppPassword.trim()) : creds.appPassword
      };

      await saveReport('security-config', updatedCreds);
      logger.info('Database security credentials config updated successfully.');

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ status: 'success', message: 'Credentials updated successfully' }));
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed during password change execution');
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Server error processing password update' }));
    }
  });
}
