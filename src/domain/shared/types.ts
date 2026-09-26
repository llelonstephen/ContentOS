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

// ──────────────────────────────────────────────
// Canonical Enum Vocabulary (SPEC02 §12)
// ──────────────────────────────────────────────

export const EvidenceDomain = {
  PRODUCT_DOCUMENTATION: 'PRODUCT_DOCUMENTATION',
  FIRST_PARTY_OBSERVATION: 'FIRST_PARTY_OBSERVATION',
  CUSTOMER_REPORT: 'CUSTOMER_REPORT',
  EXPERT_SOURCE: 'EXPERT_SOURCE',
  ACADEMIC_STUDY: 'ACADEMIC_STUDY',
  REGULATORY_SOURCE: 'REGULATORY_SOURCE',
  PLATFORM_POLICY: 'PLATFORM_POLICY',
  PLATFORM_ANALYTICS: 'PLATFORM_ANALYTICS',
  OBSERVATIONAL_PERFORMANCE: 'OBSERVATIONAL_PERFORMANCE',
  RANDOMIZED_EXPERIMENT: 'RANDOMIZED_EXPERIMENT',
  QUASI_EXPERIMENT: 'QUASI_EXPERIMENT',
  MARKET_DATA: 'MARKET_DATA',
} as const;
export type EvidenceDomain = typeof EvidenceDomain[keyof typeof EvidenceDomain];

export const PropositionType = {
  FACTUAL: 'FACTUAL',
  CAUSAL: 'CAUSAL',
  PREDICTIVE: 'PREDICTIVE',
  STRATEGIC: 'STRATEGIC',
  PERFORMANCE: 'PERFORMANCE',
  AUDIENCE: 'AUDIENCE',
  MEASUREMENT: 'MEASUREMENT',
  DEFINITIONAL: 'DEFINITIONAL',
} as const;
export type PropositionType = typeof PropositionType[keyof typeof PropositionType];

export const EvidenceCompatibilityStatus = {
  COMPATIBLE: 'COMPATIBLE',
  COMPATIBLE_WITH_LIMITS: 'COMPATIBLE_WITH_LIMITS',
  INCOMPATIBLE: 'INCOMPATIBLE',
  UNCERTAIN: 'UNCERTAIN',
} as const;
export type EvidenceCompatibilityStatus = typeof EvidenceCompatibilityStatus[keyof typeof EvidenceCompatibilityStatus];

export const EvidenceRelationship = {
  SUPPORTS: 'SUPPORTS',
  PARTIALLY_SUPPORTS: 'PARTIALLY_SUPPORTS',
  QUALIFIES: 'QUALIFIES',
  CONTRADICTS: 'CONTRADICTS',
  DOES_NOT_ADDRESS: 'DOES_NOT_ADDRESS',
} as const;
export type EvidenceRelationship = typeof EvidenceRelationship[keyof typeof EvidenceRelationship];

export const ResearchOutcome = {
  FOUND_RELEVANT_EVIDENCE: 'FOUND_RELEVANT_EVIDENCE',
  NO_EVIDENCE_FOUND: 'NO_EVIDENCE_FOUND',
  SEARCH_INCOMPLETE: 'SEARCH_INCOMPLETE',
  SEARCH_FAILED: 'SEARCH_FAILED',
} as const;
export type ResearchOutcome = typeof ResearchOutcome[keyof typeof ResearchOutcome];

export const AudienceStateStage = {
  PROVISIONAL: 'PROVISIONAL',
  REFINED: 'REFINED',
  FINAL_FOR_DECISION: 'FINAL_FOR_DECISION',
} as const;
export type AudienceStateStage = typeof AudienceStateStage[keyof typeof AudienceStateStage];

export const KnowledgeGapStatus = {
  OPEN: 'OPEN',
  RESOLVED_BY_RESEARCH: 'RESOLVED_BY_RESEARCH',
  RESOLVED_BY_USER: 'RESOLVED_BY_USER',
  EXPLICIT_ASSUMPTION: 'EXPLICIT_ASSUMPTION',
  UNRESOLVED_NON_BLOCKING: 'UNRESOLVED_NON_BLOCKING',
  BLOCKING: 'BLOCKING',
} as const;
export type KnowledgeGapStatus = typeof KnowledgeGapStatus[keyof typeof KnowledgeGapStatus];

export const ApplicabilityStage = {
  PRE_GENERATION_PROVISIONAL: 'PRE_GENERATION_PROVISIONAL',
  PRE_GENERATION_FINAL: 'PRE_GENERATION_FINAL',
  CONTENT_LEVEL: 'CONTENT_LEVEL',
} as const;
export type ApplicabilityStage = typeof ApplicabilityStage[keyof typeof ApplicabilityStage];

export const ApplicabilitySubjectType = {
  GUIDANCE: 'GUIDANCE',
  NORMATIVE_RULE: 'NORMATIVE_RULE',
} as const;
export type ApplicabilitySubjectType = typeof ApplicabilitySubjectType[keyof typeof ApplicabilitySubjectType];

export const ApplicabilityResult = {
  APPLICABLE: 'APPLICABLE',
  PARTIALLY_APPLICABLE: 'PARTIALLY_APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNCERTAIN: 'UNCERTAIN',
} as const;
export type ApplicabilityResult = typeof ApplicabilityResult[keyof typeof ApplicabilityResult];

export const AssertionPropositionRelation = {
  EQUIVALENT: 'EQUIVALENT',
  NARROWER: 'NARROWER',
  BROADER: 'BROADER',
  CONJUNCT: 'CONJUNCT',
  IMPLIES: 'IMPLIES',
  CONTRADICTS: 'CONTRADICTS',
} as const;
export type AssertionPropositionRelation = typeof AssertionPropositionRelation[keyof typeof AssertionPropositionRelation];

export const AssertionValidationStatus = {
  SUPPORTED: 'SUPPORTED',
  SUPPORTED_WITH_QUALIFICATION: 'SUPPORTED_WITH_QUALIFICATION',
  OVERCLAIM: 'OVERCLAIM',
  UNSUPPORTED: 'UNSUPPORTED',
  CONTRADICTORY: 'CONTRADICTORY',
} as const;
export type AssertionValidationStatus = typeof AssertionValidationStatus[keyof typeof AssertionValidationStatus];

export const CompositeAssessmentStatus = {
  STABLE: 'STABLE',
  STABLE_WITH_REQUIREMENTS: 'STABLE_WITH_REQUIREMENTS',
  INVALID: 'INVALID',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
} as const;
export type CompositeAssessmentStatus = typeof CompositeAssessmentStatus[keyof typeof CompositeAssessmentStatus];

export const RightsCheckStatus = {
  ALLOWED: 'ALLOWED',
  ALLOWED_WITH_REQUIREMENTS: 'ALLOWED_WITH_REQUIREMENTS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  BLOCKED: 'BLOCKED',
} as const;
export type RightsCheckStatus = typeof RightsCheckStatus[keyof typeof RightsCheckStatus];

export const HumanReviewMode = {
  ADJUDICATION_ONLY: 'ADJUDICATION_ONLY',
  NEW_INFORMATION_INTRODUCED: 'NEW_INFORMATION_INTRODUCED',
} as const;
export type HumanReviewMode = typeof HumanReviewMode[keyof typeof HumanReviewMode];

export const ReleaseStatus = {
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  BLOCKED: 'BLOCKED',
} as const;
export type ReleaseStatus = typeof ReleaseStatus[keyof typeof ReleaseStatus];

export const ConflictResolutionType = {
  HARD_DENY_OVERRIDES: 'HARD_DENY_OVERRIDES',
  HARD_REQUIREMENT_OVERRIDES: 'HARD_REQUIREMENT_OVERRIDES',
  MORE_SPECIFIC_SCOPE: 'MORE_SPECIFIC_SCOPE',
  EXPLICIT_PRIORITY: 'EXPLICIT_PRIORITY',
  AUTHORIZED_OVERRIDE: 'AUTHORIZED_OVERRIDE',
  ESCALATE: 'ESCALATE',
} as const;
export type ConflictResolutionType = typeof ConflictResolutionType[keyof typeof ConflictResolutionType];

export const PublicationState = {
  SINGLE_ARTIFACT: 'SINGLE_ARTIFACT',
  MIXED_PUBLICATION_STATE: 'MIXED_PUBLICATION_STATE',
  UNRESOLVED_PUBLICATION_STATE: 'UNRESOLVED_PUBLICATION_STATE',
} as const;
export type PublicationState = typeof PublicationState[keyof typeof PublicationState];

export const ReplayabilityStatusValue = {
  FULL: 'FULL',
  PARTIAL_REDACTED: 'PARTIAL_REDACTED',
  UNAVAILABLE_DUE_TO_RETENTION: 'UNAVAILABLE_DUE_TO_RETENTION',
  INVALIDATED_BY_DELETION: 'INVALIDATED_BY_DELETION',
} as const;
export type ReplayabilityStatusValue = typeof ReplayabilityStatusValue[keyof typeof ReplayabilityStatusValue];

export const PayloadState = {
  AVAILABLE: 'AVAILABLE',
  REDACTED: 'REDACTED',
  DELETED: 'DELETED',
} as const;
export type PayloadState = typeof PayloadState[keyof typeof PayloadState];

export const ObjectState = {
  AVAILABLE: 'AVAILABLE',
  GC_CLAIMED: 'GC_CLAIMED',
  DELETED: 'DELETED',
} as const;
export type ObjectState = typeof ObjectState[keyof typeof ObjectState];


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
