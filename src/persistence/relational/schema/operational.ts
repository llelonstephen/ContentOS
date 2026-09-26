/**
 * ContentOS — Operational Persistence Schema
 *
 * Implements SPEC02 §19:
 *   - Run (§19)
 *   - DecisionCycle (§19)
 *   - DecisionCycleBinding (§19)
 *   - StageExecution & StageExecutionOutputRef (§19)
 *   - AuditEvent (§19)
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { taskContractRevisions, runConfigs } from './control-plane.js';
import {
  baselineKnowledgeSnapshots,
  decisionSnapshots,
} from './governance-snapshots.js';

/**
 * Run (SPEC02 §19)
 * Mutable operational lifecycle state with optimistic concurrency versioning.
 */
export const runs = pgTable(
  'runs',
  {
    run_id: text('run_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    run_correlation_key: text('run_correlation_key').notNull(),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    initialization_cutoff: timestamp('initialization_cutoff', { withTimezone: true }).notNull(),
    initial_run_config_id: text('initial_run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    initial_baseline_snapshot_id: text('initial_baseline_snapshot_id')
      .notNull()
      .references(() => baselineKnowledgeSnapshots.baseline_snapshot_id),
    status: text('status').notNull(), // INITIALIZING | RUNNING | WAITING | COMPLETED | FAILED | CANCELLED
    current_decision_cycle_id: text('current_decision_cycle_id'),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uq_run_correlation_key').on(table.run_correlation_key),
    index('idx_run_tenant').on(table.tenant_id),
    index('idx_run_status').on(table.status),
  ],
);

/**
 * DecisionCycle (SPEC02 §19)
 * Discrete decision phase of a Run.
 */
export const decisionCycles = pgTable(
  'decision_cycles',
  {
    decision_cycle_id: text('decision_cycle_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    run_id: text('run_id')
      .notNull()
      .references(() => runs.run_id),
    cycle_number: integer('cycle_number').notNull(),
    parent_cycle_id: text('parent_cycle_id'),
    reason: text('reason').notNull(),
    status: text('status').notNull(), // OPEN | FREEZING | FROZEN | CANCELLED | FAILED
    fencing_epoch: integer('fencing_epoch').notNull().default(0),
    opened_at: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    freeze_started_at: timestamp('freeze_started_at', { withTimezone: true }),
    frozen_at: timestamp('frozen_at', { withTimezone: true }),
    superseded_by_cycle_id: text('superseded_by_cycle_id'),
  },
  (table) => [
    uniqueIndex('uq_cycle_run_number').on(table.run_id, table.cycle_number),
    uniqueIndex('uq_cycle_parent').on(table.parent_cycle_id),
    uniqueIndex('uq_cycle_superseded').on(table.superseded_by_cycle_id),
    index('idx_cycle_tenant').on(table.tenant_id),
    index('idx_cycle_run_status').on(table.run_id, table.status),
  ],
);

/**
 * DecisionCycleBinding (SPEC02 §19)
 * Persistence association between DecisionCycle and immutable DecisionSnapshot.
 * Does NOT duplicate knowledge or governance truth.
 */
export const decisionCycleBindings = pgTable(
  'decision_cycle_bindings',
  {
    decision_cycle_id: text('decision_cycle_id')
      .primaryKey()
      .references(() => decisionCycles.decision_cycle_id),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    decision_snapshot_id: text('decision_snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_cycle_binding_snapshot').on(table.decision_snapshot_id),
    index('idx_cycle_binding_tenant').on(table.tenant_id),
  ],
);

/**
 * StageExecution (SPEC02 §19)
 */
export const stageExecutions = pgTable(
  'stage_executions',
  {
    stage_execution_id: text('stage_execution_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    idempotency_key: text('idempotency_key').notNull(),
    run_id: text('run_id')
      .notNull()
      .references(() => runs.run_id),
    decision_cycle_id: text('decision_cycle_id')
      .notNull()
      .references(() => decisionCycles.decision_cycle_id),
    stage_name: text('stage_name').notNull(),
    status: text('status').notNull(), // PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
    lease_owner: text('lease_owner'),
    lease_expires_at: timestamp('lease_expires_at', { withTimezone: true }),
    fencing_token: integer('fencing_token').notNull().default(0),
    attempt_count: integer('attempt_count').notNull().default(0),
    canonical_input_hash: text('canonical_input_hash').notNull(),
    started_at: timestamp('started_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    error_code: text('error_code'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_stage_exec_idempotency_key').on(table.idempotency_key),
    index('idx_stage_exec_tenant').on(table.tenant_id),
    index('idx_stage_exec_run_cycle').on(table.run_id, table.decision_cycle_id),
  ],
);

/**
 * StageExecutionOutputRef (SPEC02 §19)
 */
export const stageExecutionOutputRefs = pgTable(
  'stage_execution_output_refs',
  {
    stage_execution_id: text('stage_execution_id')
      .notNull()
      .references(() => stageExecutions.stage_execution_id),
    ordinal: integer('ordinal').notNull(),
    ref_kind: text('ref_kind').notNull(), // IMMUTABLE_ENTITY | REVISION
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id'),
    stable_id: text('stable_id'),
    revision_id: text('revision_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.stage_execution_id, table.ordinal] }),
  ],
);

/**
 * AuditEvent (SPEC02 §19)
 * Append-only security & compliance audit trace.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    audit_event_id: text('audit_event_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    event_type: text('event_type').notNull(),
    principal_ref: text('principal_ref').notNull(),
    resource_ref: text('resource_ref'),
    run_id: text('run_id'),
    snapshot_id: text('snapshot_id'),
    decision_id: text('decision_id'),
    reason_codes: text('reason_codes').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_event_tenant').on(table.tenant_id),
    index('idx_audit_event_type').on(table.event_type),
  ],
);
