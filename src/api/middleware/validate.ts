/**
 * Reusable Fastify preHandler factory for Zod request body validation.
 *
 * Usage:
 *   import { validateBody } from '../middleware/validate.js';
 *   import { mySchema } from './my.schema.js';
 *
 *   app.post('/some-route', { preHandler: validateBody(mySchema) }, myHandler);
 *
 * On validation failure, the middleware sends a 400 response with the standard
 * error envelope: { error, code: 'BAD_REQUEST', details: <zod flatten output> }
 * and calls next() only when validation passes, so handlers always receive
 * a type-safe, validated body.
 */

import { z } from 'zod';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { Errors } from '../errors.js';

/**
 * Returns a Fastify preHandler that validates `request.body` against the given
 * Zod schema. On success, replaces `request.body` with the parsed (coerced) data.
 *
 * @param schema - Any Zod schema describing the expected request body shape.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      reply
        .code(400)
        .send(
          Errors.badRequest(
            'Request body validation failed',
            result.error.flatten()
          )
        );
      return;
    }

    // Replace the body with the coerced/transformed output from Zod
    request.body = result.data as FastifyRequest['body'];
    done();
  };
}

/**
 * Returns a Fastify preHandler that validates `request.query` against the given
 * Zod schema. On success, replaces `request.query` with the parsed data.
 *
 * @param schema - Any Zod schema describing the expected query string shape.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      reply
        .code(400)
        .send(
          Errors.badRequest(
            'Query parameter validation failed',
            result.error.flatten()
          )
        );
      return;
    }

    request.query = result.data as FastifyRequest['query'];
    done();
  };
}

/**
 * Returns a Fastify preHandler that validates `request.params` against the given
 * Zod schema. On success, replaces `request.params` with the parsed data.
 *
 * @param schema - Any Zod schema describing the expected route params shape.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      reply
        .code(400)
        .send(
          Errors.badRequest(
            'Route parameter validation failed',
            result.error.flatten()
          )
        );
      return;
    }

    request.params = result.data as FastifyRequest['params'];
    done();
  };
}
