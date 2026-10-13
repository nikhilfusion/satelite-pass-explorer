import type { ApiError } from '@sat/contract';
import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';

/** Domain error that maps to a 4xx response. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const body = (code: string, message: string, details?: unknown): ApiError => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

/** One consistent JSON error envelope for validation, domain and unexpected errors. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send(body('NOT_FOUND', `Route ${req.method} ${req.url} not found`)),
  );

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply
        .status(400)
        .send(body('VALIDATION_ERROR', z.prettifyError(err), z.treeifyError(err)));
    }
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send(body(err.code, err.message, err.details));
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL_ERROR', 'Unexpected server error'));
  });
}
