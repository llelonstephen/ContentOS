/**
 * M0 Test — Secret Store Abstraction (SPEC01 §93)
 *
 * Validates:
 *   - Domain objects use secret_reference, not raw secret values.
 *   - Secret reference resolution returns plaintext from secret store.
 *   - Missing secret reference throws non-retryable error.
 *   - Empty/invalid reference is rejected.
 */
import { describe, it, expect } from 'vitest';
import { EnvSecretStore } from '../../security/secrets/env-secret-store.js';
import { type SecretReference, ContentOSError } from '../../domain/shared/types.js';

describe('M0: Secret Store Abstraction (SPEC01 §93)', () => {
  const mockEnv: Record<string, string | undefined> = {
    API_KEY_OPENAI: 'sk-test-openai-12345',
    DATABASE_PASSWORD: 'super-secret-db-pass',
    CUSTOM_PREFIX_TEST_SECRET: 'prefixed-secret-value',
  };

  it('should accept SecretReference in domain types without containing raw secret', () => {
    const ref: SecretReference = {
      secret_id: 'API_KEY_OPENAI',
      version: 'v1',
    };
    expect(ref.secret_id).toBe('API_KEY_OPENAI');
    expect(ref.version).toBe('v1');
    expect(ref).not.toHaveProperty('value');
  });

  it('should resolve secret reference through EnvSecretStore', async () => {
    const store = new EnvSecretStore(mockEnv);
    const secret = await store.resolveSecret({ secret_id: 'API_KEY_OPENAI' });
    expect(secret).toBe('sk-test-openai-12345');
  });

  it('should resolve prefixed secret correctly', async () => {
    const store = new EnvSecretStore(mockEnv, 'CUSTOM_PREFIX_');
    const secret = await store.resolveSecret({ secret_id: 'TEST_SECRET' });
    expect(secret).toBe('prefixed-secret-value');
  });

  it('should throw ContentOSError with SECRET_NOT_FOUND when secret does not exist', async () => {
    const store = new EnvSecretStore(mockEnv);
    await expect(
      store.resolveSecret({ secret_id: 'NON_EXISTENT_SECRET' }),
    ).rejects.toThrowError(ContentOSError);

    try {
      await store.resolveSecret({ secret_id: 'NON_EXISTENT_SECRET' });
    } catch (err) {
      expect(err).toBeInstanceOf(ContentOSError);
      const ce = err as ContentOSError;
      expect(ce.error_code).toBe('SECRET_NOT_FOUND');
      expect(ce.retryable).toBe(false);
    }
  });

  it('should reject invalid secret reference with missing or empty secret_id', async () => {
    const store = new EnvSecretStore(mockEnv);
    await expect(
      store.resolveSecret({ secret_id: '' }),
    ).rejects.toThrowError(ContentOSError);
  });
});
