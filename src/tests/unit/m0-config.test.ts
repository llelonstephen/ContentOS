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

  describe('SPEC01 §90 SINGLE_TENANT Security Assumption Static Regression', () => {
    it('must define SINGLE_TENANT_SECURITY_ASSUMPTION as exact frozen string', async () => {
      const { SINGLE_TENANT_SECURITY_ASSUMPTION } = await import('../../config.js');
      expect(SINGLE_TENANT_SECURITY_ASSUMPTION).toBe('one trust tenant per deployment');
    });

    it('must enforce one trust tenant per deployment on default SINGLE_TENANT config', () => {
      const config = loadConfig({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
      });
      expect(config.DEPLOYMENT_MODE).toBe('SINGLE_TENANT');
      expect(config.SECURITY_ASSUMPTION).toBe('one trust tenant per deployment');
    });

    it('must enforce mandatory tenant boundary in MULTI_TENANT mode', () => {
      const config = loadConfig({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        DEPLOYMENT_MODE: 'MULTI_TENANT',
      });
      expect(config.DEPLOYMENT_MODE).toBe('MULTI_TENANT');
      expect(config.SECURITY_ASSUMPTION).toContain('mandatory server-side tenant boundary enforcement');
    });
  });
});
