/**
 * M0 Test — Configuration Loader
 *
 * Validates config loading and validation.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, resetConfig } from '../../config.js';

describe('M0: Configuration Loader', () => {
  afterEach(() => {
    resetConfig();
  });

  it('should load valid configuration from env', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.PORT).toBe(3000); // default
    expect(config.DEPLOYMENT_MODE).toBe('SINGLE_TENANT'); // default
  });

  it('should reject missing DATABASE_URL', () => {
    expect(() => loadConfig({ REDIS_URL: 'redis://localhost:6379' }))
      .toThrow('Configuration validation failed');
  });

  it('should accept custom port', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '8080',
    });
    expect(config.PORT).toBe(8080);
  });
});
