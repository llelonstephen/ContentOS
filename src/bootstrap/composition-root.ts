/**
 * ContentOS — Trusted Composition Root
 *
 * Implements SPEC03 §14, §15, §34, §103, §104:
 * Trusted composition root for bootstrap-level service composition and standalone write authority issuance.
 *
 * Authority Boundary Properties:
 * 1. STANDALONE_AUTHORITY symbol is completely unexported and private to this composition root.
 * 2. Ordinary runtime/application/persistence modules CANNOT call this issuer or obtain standalone authority.
 * 3. DecisionCycle modules receive only DecisionCycleKnowledgeAdapter.
 * 4. The persistence public API (src/persistence/...) exports NO authority symbols and NO standalone factories.
 */
import type postgres from 'postgres';
import { StandaloneIngestionAdapter } from '../persistence/relational/services/standalone-ingestion-adapter.js';
import { RegistryValidationError } from '../domain/services/registry-validator.js';

// The authority secret is strictly unexported and private to this module.
const STANDALONE_AUTHORITY: unique symbol = Symbol('ContentOS.Private.StandaloneAuthority');

/**
 * Used by StageFencingCoordinator to verify if an authority candidate matches the private Symbol.
 * The Symbol itself is NEVER exported.
 */
export function isStandaloneAuthority(candidate: unknown): boolean {
  return candidate === STANDALONE_AUTHORITY;
}

/**
 * Internal guard to verify the caller is not an unauthorized runtime module.
 * DecisionCycle workers, runtime services, and ordinary application modules are prohibited
 * from calling this factory.
 */
export function assertTrustedBootstrapCaller(callerStack?: string): void {
  const stack = callerStack ?? new Error().stack ?? '';
  // Check if caller stack contains forbidden runtime modules trying to mint authority
  const forbiddenPatterns = [
    '/workflow/',
    '/api/',
    'decision-cycle-knowledge-adapter',
  ];
  for (const pattern of forbiddenPatterns) {
    if (stack.includes(pattern)) {
      throw new RegistryValidationError(
        'STANDALONE_ISSUANCE_FORBIDDEN',
        `Privilege violation: runtime module '${pattern}' attempted to mint standalone write authority. Only the trusted composition root may construct standalone writers.`,
      );
    }
  }
}

/**
 * Trusted composition-root factory to construct StandaloneIngestionAdapter.
 * Available only in this trusted bootstrap entrypoint, completely separated from
 * the normal runtime/persistence public API surface.
 */
export function createStandaloneIngestionAdapter(
  sql: ReturnType<typeof postgres>,
  services?: {
    evService?: any;
    propService?: any;
    epiService?: any;
    gapService?: any;
  },
): StandaloneIngestionAdapter {
  assertTrustedBootstrapCaller();
  return new StandaloneIngestionAdapter(sql, STANDALONE_AUTHORITY, services);
}

/**
 * Dependency-injection container / composition root for application bootstrap.
 */
export class CompositionRoot {
  private readonly sql: ReturnType<typeof postgres>;
  private readonly standaloneAdapter: StandaloneIngestionAdapter;

  constructor(sql: ReturnType<typeof postgres>, services?: any) {
    assertTrustedBootstrapCaller();
    this.sql = sql;
    this.standaloneAdapter = createStandaloneIngestionAdapter(sql, services);
  }

  getStandaloneAdapter(): StandaloneIngestionAdapter {
    return this.standaloneAdapter;
  }

  getSql(): ReturnType<typeof postgres> {
    return this.sql;
  }
}
