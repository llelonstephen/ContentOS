/**
 * ContentOS — Publication, Measurement & Learning Schema
 *
 * Implements SPEC02 §18:
 *   - PublicationLineage (§18)
 *   - ExecutionArtifact (§18)
 *   - PublishedArtifact (§18)
 *   - MeasurementState (§18)
 *   - PerformanceObservation (§18)
 *   - ChangeProposal (§18)
 *   - ReplayabilityStatus (§18)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { metricDefinitionRevisions } from './control-plane.js';
import { contentCandidates } from './content.js';
import { decisionRecords } from './governance-snapshots.js';

/**
 * PublicationLineage (SPEC02 §18)
 * Owns channel and destination identity. Exactly one root per lineage.
 */
export const publicationLineages = pgTable(
  'publication_lineages',
  {
    publication_lineage_id: text('publication_lineage_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    channel: text('channel').notNull(),
    destination: text('destination').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_pub_lineage_tenant').on(table.tenant_id),
    index('idx_pub_lineage_channel_dest').on(table.channel, table.destination),
  ],
);

/**
 * ExecutionArtifact (SPEC02 §18)
 */
export const executionArtifacts = pgTable(
  'execution_artifacts',
  {
    execution_artifact_id: text('execution_artifact_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    candidate_id: text('candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
    actual_content: text('actual_content').notNull(),
    content_hash: text('content_hash').notNull(),
    production_changes: text('production_changes').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_exec_artifact_tenant').on(table.tenant_id),
    index('idx_exec_artifact_candidate').on(table.candidate_id),
  ],
);

/**
 * PublishedArtifact (SPEC02 §18)
 * Immutable published artifact in a PublicationLineage.
 */
export const publishedArtifacts = pgTable(
  'published_artifacts',
  {
    published_artifact_id: text('published_artifact_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    publication_lineage_id: text('publication_lineage_id')
      .notNull()
      .references(() => publicationLineages.publication_lineage_id),
    origin: text('origin').notNull(), // CONTENTOS_EXECUTION | MANUAL_EXTERNAL
    execution_artifact_id: text('execution_artifact_id')
      .references(() => executionArtifacts.execution_artifact_id),
    source_candidate_id: text('source_candidate_id')
      .references(() => contentCandidates.candidate_id),
    actual_content: text('actual_content').notNull(),
    published_hash: text('published_hash').notNull(),
    published_at: timestamp('published_at', { withTimezone: true }).notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    supersedes_published_artifact_id: text('supersedes_published_artifact_id'),
    platform_metadata: text('platform_metadata').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_published_artifact_supersedes').on(table.supersedes_published_artifact_id),
    index('idx_published_artifact_tenant').on(table.tenant_id),
    index('idx_published_artifact_lineage').on(table.publication_lineage_id),
    index('idx_published_artifact_effective').on(table.effective_from),
  ],
);

/**
 * MeasurementState (SPEC02 §18)
 */
export const measurementStates = pgTable(
  'measurement_states',
  {
    measurement_state_id: text('measurement_state_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_measurement_state_id: text('supersedes_measurement_state_id'),
    data_maturity: text('data_maturity').notNull(),
    is_final: boolean('is_final').notNull(),
    late_event_window: text('late_event_window').notNull(),
    missingness: text('missingness').notNull(),
    known_incidents: text('known_incidents').notNull(),
    observed_at: timestamp('observed_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_measurement_state_supersedes').on(table.supersedes_measurement_state_id),
    index('idx_measurement_state_tenant').on(table.tenant_id),
  ],
);

/**
 * PerformanceObservation (SPEC02 §18)
 * Immutable performance measurement.
 */
export const performanceObservations = pgTable(
  'performance_observations',
  {
    observation_id: text('observation_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    publication_state: text('publication_state').notNull(),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
    value: text('value').notNull(),
    measurement_window_start: timestamp('measurement_window_start', { withTimezone: true }).notNull(),
    measurement_window_end: timestamp('measurement_window_end', { withTimezone: true }).notNull(),
    population_or_denominator: text('population_or_denominator').notNull(),
    measurement_state_id: text('measurement_state_id')
      .notNull()
      .references(() => measurementStates.measurement_state_id),
    source_reference: text('source_reference').notNull(),
    supersedes_observation_id: text('supersedes_observation_id'),
    observed_at: timestamp('observed_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_perf_observation_supersedes').on(table.supersedes_observation_id),
    index('idx_perf_observation_tenant').on(table.tenant_id),
    index('idx_perf_observation_metric').on(table.metric_revision_id),
    index('idx_perf_observation_state').on(table.measurement_state_id),
  ],
);

/**
 * ChangeProposal (SPEC02 §18)
 */
export const changeProposals = pgTable(
  'change_proposals',
  {
    proposal_id: text('proposal_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    proposal_type: text('proposal_type').notNull(),
    target_entity_type: text('target_entity_type'),
    target_stable_id: text('target_stable_id'),
    target_revision_id: text('target_revision_id'),
    proposed_change: text('proposed_change').notNull(),
    uncertainty: text('uncertainty').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_change_proposal_tenant').on(table.tenant_id),
  ],
);

/**
 * ReplayabilityStatus (SPEC02 §18)
 * Mutable operational projection.
 */
export const replayabilityStatuses = pgTable(
  'replayability_statuses',
  {
    decision_id: text('decision_id')
      .primaryKey()
      .references(() => decisionRecords.decision_id),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    status: text('status').notNull(), // FULLY_REPLAYABLE | DEGRADED | UNREPLAYABLE
    reason_codes: text('reason_codes').notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_replayability_status_tenant').on(table.tenant_id),
  ],
);
