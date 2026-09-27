/**
 * ContentOS — Bootstrap Composition Root
 *
 * Implements SPEC03 §14, §15, §34, §103, §104:
 * Composition root for application bootstrap.
 *
 * In accordance with SPEC03 security architecture, the final source of truth
 * for standalone write authority is the PostgreSQL database principal identity
 * (contentos_standalone_role), NOT in-process JavaScript/TypeScript constructs.
 *
 * Calling createStandaloneIngestionAdapter or constructing CompositionRoot with
 * an ordinary runtime DB connection grants NO standalone write authority;
 * any canonical write attempt will fail closed with WRITE_AUTHORITY_REQUIRED.
 */
import type postgres from 'postgres';
import { StandaloneIngestionAdapter } from '../persistence/relational/services/standalone-ingestion-adapter.js';

/**
 * Bootstrap factory to construct StandaloneIngestionAdapter.
 * Authority is derived exclusively from the provided database connection identity;
 * an ordinary runtime connection will fail canonical write execution.
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
  return new StandaloneIngestionAdapter(sql, services);
}

/**
 * Dependency-injection container / composition root for application bootstrap.
 */
export class CompositionRoot {
  private readonly sql: ReturnType<typeof postgres>;
  private readonly standaloneAdapter: StandaloneIngestionAdapter;

  constructor(sql: ReturnType<typeof postgres>, services?: any) {
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
