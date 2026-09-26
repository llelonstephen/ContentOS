/**
 * ContentOS — Epistemic & Research Schema
 *
 * Implements SPEC02 §13:
 *   - SourceArtifact (§13)
 *   - EvidenceItem (§13)
 *   - Proposition (§13)
 *   - EvidencePropositionLink (§13)
 *   - EvidenceAssessment (§13)
 *   - EpistemicStateVersion (§13, §28)
 *   - KnowledgeGap (§13)
 *   - ResearchTrace (§13)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { objectRegistry } from './registries.js';
import { taskContractRevisions } from './control-plane.js';
import { rightsPolicies } from './content.js';

/**
 * SourceArtifact (SPEC02 §13)
 * Immutable external source record.
 */
export const sourceArtifacts = pgTable(
  'source_artifacts',
  {
    source_id: text('source_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    source_type: text('source_type').notNull(),
    publisher: text('publisher').notNull(),
    author: text('author').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    source_version: text('source_version').notNull(),
    retrieved_at: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    content_hash: text('content_hash').notNull(),
    snapshot_reference: text('snapshot_reference')
      .notNull()
      .references(() => objectRegistry.object_id),
    rights_policy_id: text('rights_policy_id')
      .notNull()
      .references(() => rightsPolicies.rights_policy_id),
    data_scope: text('data_scope').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_source_artifact_tenant').on(table.tenant_id),
    index('idx_source_artifact_snapshot_ref').on(table.snapshot_reference),
    check(
      'ck_source_artifact_data_scope',
      sql`${table.data_scope} IN ('TENANT_PRIVATE', 'WORKSPACE_SHARED', 'AUTHORIZED_AGGREGATE', 'GLOBAL_PUBLIC')`,
    ),
  ],
);

/**
 * EvidenceItem (SPEC02 §13)
 * Immutable atomic evidence extracted from SourceArtifact or PerformanceObservation.
 */
export const evidenceItems = pgTable(
  'evidence_items',
  {
    evidence_id: text('evidence_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    origin_type: text('origin_type').notNull(), // SOURCE_ARTIFACT | PERFORMANCE_OBSERVATION
    origin_id: text('origin_id').notNull(),
    locator: text('locator'),
    statement: text('statement').notNull(),
    statement_type: text('statement_type').notNull(),
    assertion_method: text('assertion_method').notNull(),
    evidence_domain: text('evidence_domain').notNull(),
    study_design: text('study_design').notNull(),
    causal_identification: text('causal_identification').notNull(),
    mechanism_support: text('mechanism_support').notNull(),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull(),
    valid_until_if_known: timestamp('valid_until_if_known', { withTimezone: true }),
    limitations: text('limitations').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_evidence_item_tenant').on(table.tenant_id),
    index('idx_evidence_item_origin').on(table.origin_type, table.origin_id),
    check(
      'ck_evidence_item_origin_type',
      sql`${table.origin_type} IN ('SOURCE_ARTIFACT', 'PERFORMANCE_OBSERVATION')`,
    ),
    check(
      'ck_evidence_item_domain',
      sql`${table.evidence_domain} IN ('PRODUCT_DOCUMENTATION', 'FIRST_PARTY_OBSERVATION', 'CUSTOMER_REPORT', 'EXPERT_SOURCE', 'ACADEMIC_STUDY', 'REGULATORY_SOURCE', 'PLATFORM_POLICY', 'PLATFORM_ANALYTICS', 'OBSERVATIONAL_PERFORMANCE', 'RANDOMIZED_EXPERIMENT', 'QUASI_EXPERIMENT', 'MARKET_DATA')`,
    ),
  ],
);

/**
 * Proposition (SPEC02 §13)
 * Immutable atomic fact or claim.
 */
export const propositions = pgTable(
  'propositions',
  {
    proposition_id: text('proposition_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    proposition_type: text('proposition_type').notNull(),
    canonical_meaning: text('canonical_meaning').notNull(),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    object: text('object').notNull(),
    qualifiers: text('qualifiers').notNull(),
    conditions: text('conditions').notNull(),
    population_scope: text('population_scope').notNull(),
    jurisdiction_scope: text('jurisdiction_scope').notNull(),
    supersedes_proposition_id: text('supersedes_proposition_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_proposition_tenant').on(table.tenant_id),
    index('idx_proposition_supersedes').on(table.supersedes_proposition_id),
    check(
      'ck_proposition_type',
      sql`${table.proposition_type} IN ('FACTUAL', 'CAUSAL', 'PREDICTIVE', 'STRATEGIC', 'PERFORMANCE', 'AUDIENCE', 'MEASUREMENT', 'DEFINITIONAL')`,
    ),
  ],
);

/**
 * EvidencePropositionLink (SPEC02 §13)
 * Immutable relation linking an EvidenceItem to a Proposition.
 */
export const evidencePropositionLinks = pgTable(
  'evidence_proposition_links',
  {
    link_id: text('link_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    evidence_id: text('evidence_id')
      .notNull()
      .references(() => evidenceItems.evidence_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_evidence_proposition_link').on(table.evidence_id, table.proposition_id),
    index('idx_evidence_prop_link_prop').on(table.proposition_id),
  ],
);

/**
 * EvidenceAssessment (SPEC02 §13)
 * Immutable assessment of an EvidencePropositionLink.
 */
export const evidenceAssessments = pgTable(
  'evidence_assessments',
  {
    assessment_id: text('assessment_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_assessment_id: text('supersedes_assessment_id'),
    link_id: text('link_id')
      .notNull()
      .references(() => evidencePropositionLinks.link_id),
    compatibility_status: text('compatibility_status').notNull(),
    relationship: text('relationship').notNull(),
    assessor: text('assessor').notNull(),
    assessment_method: text('assessment_method').notNull(),
    authority: text('authority').notNull(),
    methodological_quality: text('methodological_quality').notNull(),
    directness: text('directness').notNull(),
    applicability: text('applicability').notNull(),
    population_match: text('population_match').notNull(),
    context_match: text('context_match').notNull(),
    freshness: text('freshness').notNull(),
    independence: text('independence').notNull(),
    precision: text('precision').notNull(),
    limitations: text('limitations').notNull(),
    uncertainty: text('uncertainty').notNull(),
    assessed_at: timestamp('assessed_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_evidence_assessment_tenant').on(table.tenant_id),
    index('idx_evidence_assessment_link').on(table.link_id),
    index('idx_evidence_assessment_supersedes').on(table.supersedes_assessment_id),
    check(
      'ck_evidence_compat_status',
      sql`${table.compatibility_status} IN ('COMPATIBLE', 'COMPATIBLE_WITH_LIMITS', 'INCOMPATIBLE', 'UNCERTAIN')`,
    ),
    check(
      'ck_evidence_relationship',
      sql`${table.relationship} IN ('SUPPORTS', 'PARTIALLY_SUPPORTS', 'QUALIFIES', 'CONTRADICTS', 'DOES_NOT_ADDRESS')`,
    ),
  ],
);

/**
 * EpistemicStateVersion (SPEC02 §13, §28)
 * Immutable state version in a proposition-scoped chain.
 */
export const epistemicStateVersions = pgTable(
  'epistemic_state_versions',
  {
    epistemic_state_id: text('epistemic_state_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_epistemic_state_id: text('supersedes_epistemic_state_id'),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
    support_status: text('support_status').notNull(),
    causal_status: text('causal_status').notNull(),
    uncertainty: text('uncertainty').notNull(),
    derivation_method: text('derivation_method').notNull(),
    derivation_entity_type: text('derivation_entity_type').notNull(),
    derivation_stable_id: text('derivation_stable_id').notNull(),
    derivation_revision_id: text('derivation_revision_id').notNull(),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull(),
    valid_until_if_known: timestamp('valid_until_if_known', { withTimezone: true }),
    known_from: timestamp('known_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_epistemic_state_prop').on(table.proposition_id),
    index('idx_epistemic_state_tenant').on(table.tenant_id),
    uniqueIndex('uq_epistemic_state_predecessor')
      .on(table.supersedes_epistemic_state_id),
  ],
);

/**
 * KnowledgeGap (SPEC02 §13)
 * Immutable knowledge gap record.
 */
export const knowledgeGaps = pgTable(
  'knowledge_gaps',
  {
    gap_id: text('gap_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_gap_id: text('supersedes_gap_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    question: text('question').notNull(),
    decision_relevance: text('decision_relevance').notNull(),
    blocking: boolean('blocking').notNull(),
    researchable: boolean('researchable').notNull(),
    user_resolvable: boolean('user_resolvable').notNull(),
    assumption_allowed: boolean('assumption_allowed').notNull(),
    risk_if_wrong: text('risk_if_wrong').notNull(),
    status: text('status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_gap_tenant').on(table.tenant_id),
    index('idx_knowledge_gap_task').on(table.task_revision_id),
    index('idx_knowledge_gap_supersedes').on(table.supersedes_gap_id),
    check(
      'ck_knowledge_gap_status',
      sql`${table.status} IN ('OPEN', 'RESOLVED_BY_RESEARCH', 'RESOLVED_BY_USER', 'EXPLICIT_ASSUMPTION', 'UNRESOLVED_NON_BLOCKING', 'BLOCKING')`,
    ),
  ],
);

/**
 * ResearchTrace (SPEC02 §13)
 * Immutable record of a research inquiry resolving or attempting to resolve a KnowledgeGap.
 */
export const researchTraces = pgTable(
  'research_traces',
  {
    research_trace_id: text('research_trace_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    gap_id: text('gap_id')
      .notNull()
      .references(() => knowledgeGaps.gap_id),
    research_question: text('research_question').notNull(),
    queries: text('queries').notNull(),
    sources_searched: text('sources_searched').notNull(),
    retrieval_entity_type: text('retrieval_entity_type').notNull(),
    retrieval_stable_id: text('retrieval_stable_id').notNull(),
    retrieval_revision_id: text('retrieval_revision_id').notNull(),
    coverage_limitations: text('coverage_limitations').notNull(),
    outcome: text('outcome').notNull(),
    stop_reason: text('stop_reason').notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_research_trace_tenant').on(table.tenant_id),
    index('idx_research_trace_gap').on(table.gap_id),
    check(
      'ck_research_trace_outcome',
      sql`${table.outcome} IN ('FOUND_RELEVANT_EVIDENCE', 'NO_EVIDENCE_FOUND', 'SEARCH_INCOMPLETE', 'SEARCH_FAILED')`,
    ),
  ],
);
