/**
 * ContentOS Domain — Shared Types
 *
 * Core type definitions used across all domain modules.
 * These types implement the Blueprint's fundamental type contracts:
 *   - ImmutableEntityRef (Blueprint §3)
 *   - RevisionRef (Blueprint §4)
 *   - Temporal types (SPEC01 §115)
 *   - Deployment mode (SPEC01 §89)
 */

// ──────────────────────────────────────────────
// Branded types for type-safe IDs
// ──────────────────────────────────────────────

/** Nominal brand to distinguish ID types at compile time */
type Brand<K, T> = K & { readonly __brand: T };

/** UUID-based identifier */
export type UUID = Brand<string, 'UUID'>;

/** Tenant identifier */
export type TenantId = Brand<string, 'TenantId'>;

/** Workspace identifier */
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

// ──────────────────────────────────────────────
// Timestamp types (SPEC01 §115 — all UTC)
// ──────────────────────────────────────────────

/** UTC timestamp stored as ISO 8601 string */
export type UTCTimestamp = Brand<string, 'UTCTimestamp'>;

// ──────────────────────────────────────────────
// ImmutableEntityRef (Blueprint §3)
// ──────────────────────────────────────────────

/**
 * Used when one ID identifies exactly one immutable historical state.
 * entity_type discriminates the target entity kind.
 * entity_id is the globally unique immutable ID of that entity.
 */
export interface ImmutableEntityRef {
  readonly entity_type: string;
  readonly entity_id: string;
}

// ──────────────────────────────────────────────
// RevisionRef (Blueprint §4)
// ──────────────────────────────────────────────

/**
 * Used for revisioned concepts.
 * stable_id identifies the conceptual object.
 * revision_id identifies the exact historical revision.
 */
export interface RevisionRef {
  readonly entity_type: string;
  readonly stable_id: string;
  readonly revision_id: string;
}

// ──────────────────────────────────────────────
// Secret Reference (SPEC01 §93)
// ──────────────────────────────────────────────

/**
 * Used for secret references.
 * Secrets live in a dedicated secret-management system.
 * Domain objects contain secret_reference, NOT raw secret values.
 */
export interface SecretReference {
  readonly secret_id: string;
  readonly version?: string;
}

// ──────────────────────────────────────────────
// Deployment Mode (SPEC01 §89)
// ──────────────────────────────────────────────

export const DeploymentMode = {
  SINGLE_TENANT: 'SINGLE_TENANT',
  MULTI_TENANT: 'MULTI_TENANT',
} as const;

export type DeploymentMode = typeof DeploymentMode[keyof typeof DeploymentMode];

// ──────────────────────────────────────────────
// Data Scope (Blueprint §13B)
// ──────────────────────────────────────────────

export const DataScope = {
  TENANT_PRIVATE: 'TENANT_PRIVATE',
  WORKSPACE_SHARED: 'WORKSPACE_SHARED',
  AUTHORIZED_AGGREGATE: 'AUTHORIZED_AGGREGATE',
  GLOBAL_PUBLIC: 'GLOBAL_PUBLIC',
} as const;

export type DataScope = typeof DataScope[keyof typeof DataScope];

// ──────────────────────────────────────────────
// Principal types (SPEC01 §97)
// ──────────────────────────────────────────────

export const PrincipalType = {
  USER: 'USER',
  SERVICE: 'SERVICE',
  SYSTEM_WORKER: 'SYSTEM_WORKER',
  REVIEWER: 'REVIEWER',
  ADMIN: 'ADMIN',
} as const;

export type PrincipalType = typeof PrincipalType[keyof typeof PrincipalType];

export interface Principal {
  readonly principal_type: PrincipalType;
  readonly principal_id: string;
  readonly tenant_id: TenantId;
}

// ──────────────────────────────────────────────
// Error envelope (SPEC01 §96)
// ──────────────────────────────────────────────

export interface ErrorEnvelope {
  readonly error_code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly trace_id: string;
  readonly entity_refs?: ReadonlyArray<ImmutableEntityRef | RevisionRef>;
  readonly validation_failures?: ReadonlyArray<{
    readonly field: string;
    readonly code: string;
    readonly message: string;
  }>;
}

// ──────────────────────────────────────────────
// Retry categories (SPEC01 §82)
// ──────────────────────────────────────────────

export const RetryCategory = {
  TRANSIENT: 'TRANSIENT',
  RATE_LIMITED: 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  INVALID_EXTERNAL_PAYLOAD: 'INVALID_EXTERNAL_PAYLOAD',
  MODEL_OUTPUT_INVALID: 'MODEL_OUTPUT_INVALID',
  DOMAIN_INVARIANT_FAILED: 'DOMAIN_INVARIANT_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  PERMANENT_CONFIGURATION_ERROR: 'PERMANENT_CONFIGURATION_ERROR',
  HUMAN_ACTION_REQUIRED: 'HUMAN_ACTION_REQUIRED',
  STALE_DECISION_CYCLE: 'STALE_DECISION_CYCLE',
  STALE_FENCING_TOKEN: 'STALE_FENCING_TOKEN',
} as const;

export type RetryCategory = typeof RetryCategory[keyof typeof RetryCategory];

/**
 * Categories that MUST NOT be blindly retried (SPEC01 §83).
 */
export const NON_RETRYABLE_CATEGORIES: ReadonlySet<RetryCategory> = new Set([
  RetryCategory.DOMAIN_INVARIANT_FAILED,
  RetryCategory.AUTHORIZATION_FAILED,
  RetryCategory.STALE_DECISION_CYCLE,
  RetryCategory.STALE_FENCING_TOKEN,
]);

// ──────────────────────────────────────────────
// Domain error base class
// ──────────────────────────────────────────────

export class ContentOSError extends Error {
  public readonly error_code: string;
  public readonly retryable: boolean;
  public readonly category: RetryCategory;

  constructor(params: {
    error_code: string;
    message: string;
    category: RetryCategory;
    cause?: Error;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'ContentOSError';
    this.error_code = params.error_code;
    this.category = params.category;
    this.retryable = !NON_RETRYABLE_CATEGORIES.has(params.category);
  }
}

// ──────────────────────────────────────────────
// Hash type for content-addressable storage
// ──────────────────────────────────────────────

export type ContentHash = Brand<string, 'ContentHash'>;
