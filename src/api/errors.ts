/**
 * Standardized API error response utilities.
 *
 * All error responses from the API follow this shape:
 *   { error: string, code?: string, details?: unknown }
 *
 * Use `apiError()` to build responses and `sendError()` to send them.
 * This eliminates the inconsistency of some endpoints returning { error }
 * and others returning { status, message } or raw strings.
 */

import type { FastifyReply } from 'fastify';

export interface ApiError {
  /** Human-readable error description */
  error: string;
  /** Optional machine-readable code for client-side handling */
  code?: string;
  /** Optional additional details (never include sensitive data here) */
  details?: unknown;
}

/** Constructs a typed API error object */
export function apiError(error: string, code?: string, details?: unknown): ApiError {
  return { error, ...(code ? { code } : {}), ...(details !== undefined ? { details } : {}) };
}

/**
 * Sends a standardized error response.
 * @param reply  - Fastify reply instance
 * @param status - HTTP status code (4xx or 5xx)
 * @param error  - Human-readable message
 * @param code   - Optional machine-readable error code
 * @param details - Optional structured details (avoid sensitive data)
 */
export function sendError(
  reply: FastifyReply,
  status: number,
  error: string,
  code?: string,
  details?: unknown
): void {
  reply.code(status).send(apiError(error, code, details));
}

// ─── Common Error Factories ───────────────────────────────────────────────────

export const Errors = {
  notFound: (resource: string) =>
    apiError(`${resource} not found`, 'NOT_FOUND'),

  databaseError: (resource: string) =>
    apiError(`${resource} temporarily unavailable — database error`, 'DB_ERROR'),

  unauthorized: (reason = 'Missing or invalid session token') =>
    apiError(reason, 'UNAUTHORIZED'),

  forbidden: (reason = 'You do not have permission to perform this action') =>
    apiError(reason, 'FORBIDDEN'),

  conflict: (reason: string) =>
    apiError(reason, 'CONFLICT'),

  badRequest: (reason: string, details?: unknown) =>
    apiError(reason, 'BAD_REQUEST', details),

  internalError: (reason = 'An unexpected server error occurred') =>
    apiError(reason, 'INTERNAL_ERROR'),
};
