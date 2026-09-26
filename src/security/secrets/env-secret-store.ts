/**
 * ContentOS — Development Environment Secret Store
 *
 * Implements development secret-management backed by environment variables
 * per SPEC01 §93.
 */
import { SecretReference, ContentOSError, RetryCategory } from '../../domain/shared/types.js';
import { ISecretStore } from './secret-store-interface.js';

export class EnvSecretStore implements ISecretStore {
  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly prefix: string = '',
  ) {}

  async resolveSecret(ref: SecretReference): Promise<string> {
    if (!ref || !ref.secret_id) {
      throw new ContentOSError({
        error_code: 'INVALID_SECRET_REFERENCE',
        message: 'Secret reference must contain a non-empty secret_id',
        category: RetryCategory.DOMAIN_INVARIANT_FAILED,
      });
    }

    const key = this.prefix ? `${this.prefix}${ref.secret_id}` : ref.secret_id;
    const value = this.env[key] ?? this.env[ref.secret_id];

    if (value === undefined || value === '') {
      throw new ContentOSError({
        error_code: 'SECRET_NOT_FOUND',
        message: `Secret with id '${ref.secret_id}' was not found in secret store`,
        category: RetryCategory.AUTHORIZATION_FAILED,
      });
    }

    return value;
  }
}
