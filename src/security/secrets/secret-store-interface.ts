/**
 * ContentOS — Secret Store Interface
 *
 * Implements SPEC01 §93:
 *   - Secrets live in a dedicated secret-management system.
 *   - Domain objects contain secret_reference, not raw secret values.
 *   - Security/infrastructure boundary provides resolution.
 */
import { SecretReference } from '../../domain/shared/types.js';

export interface ISecretStore {
  /**
   * Resolves a secret reference to its plaintext secret value.
   * Throws ContentOSError(AUTHORIZATION_FAILED) if the secret cannot be found or accessed.
   */
  resolveSecret(ref: SecretReference): Promise<string>;
}
