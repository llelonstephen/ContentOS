/**
 * ContentOS — SPEC03 Canonical Vocabularies & Domain Types
 *
 * Implements SPEC03 §6, §8, §11, §18, §29, §37, §47, §56:
 * - EvidenceDomain (§6.1)
 * - DataScope (§6.2)
 * - PropositionType (§6.3)
 * - EvidenceCompatibilityStatus (§6.4)
 * - EvidenceRelationship (§6.5)
 * - Epistemic SupportStatus (§6.6)
 * - CausalStatus (§6.7)
 * - KnowledgeGapStatus (§9)
 * - ResearchOutcome (§12)
 * - EvidenceOriginType (§18)
 * - PropositionResolutionOutcome (§32)
 */

export const EVIDENCE_DOMAINS = [
  'PRODUCT_DOCUMENTATION',
  'FIRST_PARTY_OBSERVATION',
  'CUSTOMER_REPORT',
  'EXPERT_SOURCE',
  'ACADEMIC_STUDY',
  'REGULATORY_SOURCE',
  'PLATFORM_POLICY',
  'PLATFORM_ANALYTICS',
  'OBSERVATIONAL_PERFORMANCE',
  'RANDOMIZED_EXPERIMENT',
  'QUASI_EXPERIMENT',
  'MARKET_DATA',
] as const;
export type EvidenceDomain = typeof EVIDENCE_DOMAINS[number];

export const DATA_SCOPES = [
  'TENANT_PRIVATE',
  'WORKSPACE_SHARED',
  'AUTHORIZED_AGGREGATE',
  'GLOBAL_PUBLIC',
] as const;
export type DataScope = typeof DATA_SCOPES[number];

export const PROPOSITION_TYPES = [
  'FACTUAL',
  'CAUSAL',
  'PREDICTIVE',
  'STRATEGIC',
  'PERFORMANCE',
  'AUDIENCE',
  'MEASUREMENT',
  'DEFINITIONAL',
] as const;
export type PropositionType = typeof PROPOSITION_TYPES[number];

export const EVIDENCE_COMPATIBILITY_STATUSES = [
  'COMPATIBLE',
  'COMPATIBLE_WITH_LIMITS',
  'INCOMPATIBLE',
  'UNCERTAIN',
] as const;
export type EvidenceCompatibilityStatus = typeof EVIDENCE_COMPATIBILITY_STATUSES[number];

export const EVIDENCE_RELATIONSHIPS = [
  'SUPPORTS',
  'PARTIALLY_SUPPORTS',
  'QUALIFIES',
  'CONTRADICTS',
  'DOES_NOT_ADDRESS',
] as const;
export type EvidenceRelationship = typeof EVIDENCE_RELATIONSHIPS[number];

export const EPISTEMIC_SUPPORT_STATUSES = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'CONFLICTING',
  'CONTRADICTED',
  'INSUFFICIENT',
  'UNKNOWN',
] as const;
export type EpistemicSupportStatus = typeof EPISTEMIC_SUPPORT_STATUSES[number];

export const CAUSAL_STATUSES = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'ASSOCIATIONAL_ONLY',
  'CONFLICTING',
  'INSUFFICIENT',
  'UNKNOWN',
  'NOT_APPLICABLE',
] as const;
export type CausalStatus = typeof CAUSAL_STATUSES[number];

export const KNOWLEDGE_GAP_STATUSES = [
  'OPEN',
  'BLOCKING',
  'RESOLVED_BY_RESEARCH',
  'RESOLVED_BY_USER',
  'EXPLICIT_ASSUMPTION',
  'UNRESOLVED_NON_BLOCKING',
] as const;
export type KnowledgeGapStatus = typeof KNOWLEDGE_GAP_STATUSES[number];

export const RESEARCH_OUTCOMES = [
  'FOUND_RELEVANT_EVIDENCE',
  'NO_EVIDENCE_FOUND',
  'SEARCH_INCOMPLETE',
  'SEARCH_FAILED',
] as const;
export type ResearchOutcome = typeof RESEARCH_OUTCOMES[number];

export const EVIDENCE_ORIGIN_TYPES = [
  'SOURCE_ARTIFACT',
  'PERFORMANCE_OBSERVATION',
] as const;
export type EvidenceOriginType = typeof EVIDENCE_ORIGIN_TYPES[number];

export const PROPOSITION_RESOLUTION_OUTCOMES = [
  'REUSE_EXISTING',
  'CREATE_NEW',
  'REVIEW_REQUIRED',
] as const;
export type PropositionResolutionOutcome = typeof PROPOSITION_RESOLUTION_OUTCOMES[number];

/**
 * Material attributes comprising Proposition Semantic Identity (SPEC03 §30)
 */
export interface PropositionSemanticIdentity {
  propositionType: PropositionType;
  canonicalMeaning: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: string;
  conditions: string;
  populationScope: string;
  jurisdictionScope: string;
}

/**
 * Pinned Derivation Revision Reference (SPEC03 §63)
 */
export interface DerivationRevisionRef {
  entityType: string;
  stableId: string;
  revisionId: string;
}
