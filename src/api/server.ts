/**
 * ContentOS — API Server
 *
 * Fastify-based HTTP API implementing SPEC01 §94-96.
 * Command/Query separation (SPEC01 §94).
 * Error envelope (SPEC01 §96).
 * Authentication stubs (SPEC01 §97-98).
 */
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { createLogger } from '../observability/logger.js';

const logger = createLogger({ module: 'api' });

/**
 * Create and configure the Fastify server instance.
 */
export function createServer() {
  const server = Fastify({
    logger: false, // We use our own structured logger
    genReqId: () => crypto.randomUUID(),
  });

  // CORS
  void server.register(cors, {
    origin: true,
  });

  // Request logging
  server.addHook('onRequest', async (request) => {
    logger.info({
      trace_id: request.id,
      method: request.method,
      url: request.url,
    }, 'Request received');
  });

  // Error envelope (SPEC01 §96)
  server.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const errorEnvelope = {
      error_code: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
      retryable: statusCode >= 500,
      trace_id: _request.id,
    };

    logger.error({
      trace_id: _request.id,
      error_code: errorEnvelope.error_code,
    }, error.message);

    void reply.status(statusCode).send(errorEnvelope);
  });

  // Not found handler (SPEC01 §96)
  server.setNotFoundHandler((request, reply) => {
    const errorEnvelope = {
      error_code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      retryable: false,
      trace_id: request.id,
    };

    logger.warn({
      trace_id: request.id,
      error_code: errorEnvelope.error_code,
    }, errorEnvelope.message);

    void reply.status(404).send(errorEnvelope);
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', service: 'contentos', version: '1.0.0' };
  });

  return server;
}
