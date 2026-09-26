/**
 * ContentOS — Governance, Snapshots & Decision Schema
 *
 * Implements SPEC02 §17:
 *   - KnowledgeManifest (§17)
 *   - BaselineKnowledgeSnapshot (§17)
 *   - RunKnowledgeDelta (§17)
 *   - GovernanceSnapshot (§17)
 *   - DecisionSnapshot (§17)
 *   - PolicyResult (§17)
 *   - PolicyOverride (§17)
 *   - PolicyConflictResolution (§17)
 *   - HumanReviewRecord (§17)
 *   - DecisionRecord (§17)
 *   - FinalContentPackage (§17)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import {
  contentProgramRevisions,
  runConfigs,
  taskContractRevisions,
  decisionPolicyRevisions,
} from './control-plane.js';
import {
  audienceStates,
  uncertaintyAssessments,
  contentCandidates,
  strategyHypotheses,
  contentArchitectures,
} from './content.js';

/**
 * KnowledgeManifest (SPEC02 §17)
 */
export const knowledgeManifests = pgTable(
  'knowledge_manifests',
  {
    knowledge_manifest_id: text('knowledge_manifest_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    content_hash: text('content_hash').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_manifest_tenant').on(table.tenant_id),
  ],
);

/**
 * BaselineKnowledgeSnapshot (SPEC02 §17)
 */
export const baselineKnowledgeSnapshots = pgTable(
  'baseline_knowledge_snapshots',
  {
    baseline_snapshot_id: text('baseline_snapshot_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    as_of: timestamp('as_of', { withTimezone: true }).notNull(),
    knowledge_manifest_id: text('knowledge_manifest_id')
      .notNull()
      .references(() => knowledgeManifests.knowledge_manifest_id),
    program_revision_id: text('program_revision_id')
      .references(() => contentProgramRevisions.program_revision_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_baseline_snapshot_tenant').on(table.tenant_id),
    index('idx_baseline_snapshot_manifest').on(table.knowledge_manifest_id),
  ],
);

/**
 * RunKnowledgeDelta (SPEC02 §17)
 */
export const runKnowledgeDeltas = pgTable(
  'run_knowledge_deltas',
  {
    delta_id: text('delta_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    run_correlation_key: text('run_correlation_key').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_run_knowledge_delta_tenant').on(table.tenant_id),
    index('idx_run_knowledge_delta_key').on(table.run_correlation_key),
  ],
);

/**
 * GovernanceSnapshot (SPEC02 §17)
 */
export const governanceSnapshots = pgTable(
  'governance_snapshots',
  {
    governance_snapshot_id: text('governance_snapshot_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    as_of: timestamp('as_of', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_gov_snapshot_tenant').on(table.tenant_id),
  ],
);

/**
 * DecisionSnapshot (SPEC02 §17)
 */
export const decisionSnapshots = pgTable(
  'decision_snapshots',
  {
    snapshot_id: text('snapshot_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    baseline_knowledge_snapshot_id: text('baseline_knowledge_snapshot_id')
      .notNull()
      .references(() => baselineKnowledgeSnapshots.baseline_snapshot_id),
    run_knowledge_delta_id: text('run_knowledge_delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    audience_state_id: text('audience_state_id')
      .notNull()
      .references(() => audienceStates.audience_state_id),
    uncertainty_assessment_id: text('uncertainty_assessment_id')
      .references(() => uncertaintyAssessments.uncertainty_assessment_id),
    frozen_at: timestamp('frozen_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_decision_snapshot_tenant').on(table.tenant_id),
    index('idx_decision_snapshot_baseline').on(table.baseline_knowledge_snapshot_id),
    index('idx_decision_snapshot_delta').on(table.run_knowledge_delta_id),
    index('idx_decision_snapshot_gov').on(table.governance_snapshot_id),
    index('idx_decision_snapshot_task').on(table.task_revision_id),
  ],
);

/**
 * PolicyResult (SPEC02 §17)
 */
export const policyResults = pgTable(
  'policy_results',
  {
    policy_result_id: text('policy_result_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    policy_revision_id: text('policy_revision_id')
      .notNull()
      .references(() => decisionPolicyRevisions.policy_revision_id),
    triggered: boolean('triggered').notNull(),
    action: text('action').notNull(),
    reason_code: text('reason_code').notNull(),
    input_uncertainty: text('input_uncertainty').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_policy_result_snapshot_policy').on(table.snapshot_id, table.policy_revision_id),
    index('idx_policy_result_tenant').on(table.tenant_id),
    index('idx_policy_result_snapshot').on(table.snapshot_id),
  ],
);

/**
 * PolicyOverride (SPEC02 §17)
 */
export const policyOverrides = pgTable(
  'policy_overrides',
  {
    override_id: text('override_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    authorized_by: text('authorized_by').notNull(),
    authority_basis: text('authority_basis').notNull(),
    reason_codes: text('reason_codes').notNull(),
    scope: text('scope').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_policy_override_tenant').on(table.tenant_id),
    index('idx_policy_override_snapshot').on(table.snapshot_id),
  ],
);

/**
 * PolicyConflictResolution (SPEC02 §17)
 */
export const policyConflictResolutions = pgTable(
  'policy_conflict_resolutions',
  {
    resolution_id: text('resolution_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    conflict_key: text('conflict_key').notNull(),
    resolution_type: text('resolution_type').notNull(),
    override_id: text('override_id').references(() => policyOverrides.override_id),
    reason_codes: text('reason_codes').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_policy_conflict_res_snapshot_key').on(table.snapshot_id, table.conflict_key),
    index('idx_policy_conflict_tenant').on(table.tenant_id),
    index('idx_policy_conflict_snapshot').on(table.snapshot_id),
  ],
);

/**
 * HumanReviewRecord (SPEC02 §17)
 */
export const humanReviewRecords = pgTable(
  'human_review_records',
  {
    review_id: text('review_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    review_mode: text('review_mode').notNull(),
    reviewer_role: text('reviewer_role').notNull(),
    qualification: text('qualification').notNull(),
    review_scope: text('review_scope').notNull(),
    review_decision: text('review_decision').notNull(),
    reason_codes: text('reason_codes').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_human_review_tenant').on(table.tenant_id),
    index('idx_human_review_snapshot').on(table.snapshot_id),
    index('idx_human_review_task').on(table.task_revision_id),
  ],
);

/**
 * DecisionRecord (SPEC02 §17)
 * Sole canonical owner of release_status.
 */
export const decisionRecords = pgTable(
  'decision_records',
  {
    decision_id: text('decision_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    decision_type: text('decision_type').notNull(),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    reason_codes: text('reason_codes').notNull(),
    selected_action: text('selected_action').notNull(),
    selected_candidate_id: text('selected_candidate_id')
      .references(() => contentCandidates.candidate_id),
    release_status: text('release_status').notNull(),
    human_review_id: text('human_review_id')
      .references(() => humanReviewRecords.review_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_decision_record_tenant').on(table.tenant_id),
    index('idx_decision_record_snapshot').on(table.snapshot_id),
    index('idx_decision_record_task').on(table.task_revision_id),
    index('idx_decision_record_candidate').on(table.selected_candidate_id),
  ],
);

/**
 * FinalContentPackage (SPEC02 §17)
 * Frozen content package. Must NOT duplicate release_status.
 */
export const finalContentPackages = pgTable(
  'final_content_packages',
  {
    package_id: text('package_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    decision_id: text('decision_id')
      .notNull()
      .references(() => decisionRecords.decision_id),
    decision_snapshot_id: text('decision_snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    selected_candidate_id: text('selected_candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
    strategy_id: text('strategy_id')
      .notNull()
      .references(() => strategyHypotheses.strategy_id),
    architecture_id: text('architecture_id')
      .notNull()
      .references(() => contentArchitectures.architecture_id),
    audience_state_id: text('audience_state_id')
      .notNull()
      .references(() => audienceStates.audience_state_id),
    warnings: text('warnings').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_content_package_tenant').on(table.tenant_id),
    index('idx_content_package_decision').on(table.decision_id),
    index('idx_content_package_snapshot').on(table.decision_snapshot_id),
    index('idx_content_package_candidate').on(table.selected_candidate_id),
  ],
);
