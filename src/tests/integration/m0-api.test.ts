/**
 * M0 Integration Test — API Server
 *
 * Validates M0 API layer foundation (Fastify).
 * Tests health check endpoint, request ID tracking, and error handling.
 */
import { describe, it, expect } from 'vitest';
import { createServer } from '../../api/server.js';

describe('M0 Integration: Fastify API Server', () => {
  const server = createServer();

  it('GET /health should return 200 and status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      status: 'ok',
      service: 'contentos',
      version: '1.0.0',
    });
  });

  it('should return error envelope on unknown route', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/unknown-route',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error_code');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('retryable');
    expect(body).toHaveProperty('trace_id');
    expect(body.retryable).toBe(false);
  });
});
