/**
 * ContentOS — Control Plane & Task Schema
 *
 * Implements SPEC02 §14:
 *   - RegisteredControlPlaneRevision & Payload
 *   - ControlPlaneActivation (SPEC02 §19, §29)
 *   - ContentProgramRevision, OutcomeModel, OutcomeEdge
 *   - AttributionModelRevision, MetricDefinitionRevision
 *   - EvalContractRevision, ChannelProfileRevision, TaskContractRevision
 *   - RunConfig (SPEC02 §17)
 *   - GuidanceRevision, NormativeRuleRevision, DecisionPolicyRevision
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
  uniqueIndex,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { objectRegistry, revisionRegistry } from './registries.js';

/**
 * RegisteredControlPlaneRevision (SPEC02 §14)
 * Generic config revision for PromptConfig, ModelConfig, ToolConfig, RetrieverConfig, EvaluatorConfig, SchemaDefinition
 */
export const registeredControlPlaneRevisions = pgTable(
  'registered_control_plane_revisions',
  {
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
    supersedes_revision_id: text('supersedes_revision_id'),
    payload_hash: text('payload_hash').notNull(),
    payload_schema_revision_id: text('payload_schema_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
    uniqueIndex('uq_cplane_rev_triple').on(table.entity_type, table.stable_id, table.revision_id),
    check(
      'ck_cplane_entity_type',
      sql`${table.entity_type} IN ('PromptConfig', 'ModelConfig', 'ToolConfig', 'RetrieverConfig', 'EvaluatorConfig', 'SchemaDefinition')`,
    ),
  ],
);

/**
 * RegisteredControlPlaneRevisionPayload (SPEC02 §14)
 * Binds immutable revision identity to immutable object in ObjectRegistry.
 * Enforces same-tenant ownership via composite foreign keys.
 */
export const registeredControlPlaneRevisionPayloads = pgTable(
  'registered_control_plane_revision_payloads',
  {
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    object_id: text('object_id').notNull(),
    payload_hash: text('payload_hash').notNull(),
    payload_schema_revision_id: text('payload_schema_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
    uniqueIndex('uq_cplane_payload_triple').on(table.entity_type, table.stable_id, table.revision_id),
    foreignKey({
      columns: [table.tenant_id, table.entity_type, table.stable_id, table.revision_id],
      foreignColumns: [
        revisionRegistry.tenant_id,
        revisionRegistry.entity_type,
        revisionRegistry.stable_id,
        revisionRegistry.revision_id,
      ],
    }),
    foreignKey({
      columns: [table.tenant_id, table.object_id],
      foreignColumns: [
        objectRegistry.tenant_id,
        objectRegistry.object_id,
      ],
    }),
  ],
);

/**
 * ControlPlaneActivation (SPEC02 §19, §29)
 * Operational activation interval table. Non-overlapping for single-active semantics.
 */
export const controlPlaneActivations = pgTable(
  'control_plane_activations',
  {
    activation_id: text('activation_id').primaryKey(),
    deployment_scope: text('deployment_scope').notNull(),
    component_type: text('component_type').notNull(),
    stable_id: text('stable_id').notNull(),
    active_revision_id: text('active_revision_id').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    effective_until: timestamp('effective_until', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_activation_interval_start').on(
      table.deployment_scope,
      table.component_type,
      table.stable_id,
      table.effective_from,
    ),
    foreignKey({
      columns: [table.component_type, table.stable_id, table.active_revision_id],
      foreignColumns: [
        revisionRegistry.entity_type,
        revisionRegistry.stable_id,
        revisionRegistry.revision_id,
      ],
    }),
    check(
      'ck_activation_effective_range',
      sql`${table.effective_until} IS NULL OR ${table.effective_until} > ${table.effective_from}`,
    ),
  ],
);

/**
 * ContentProgramRevision (SPEC02 §14)
 */
export const contentProgramRevisions = pgTable(
  'content_program_revisions',
  {
    program_id: text('program_id').notNull(),
    program_revision_id: text('program_revision_id').primaryKey(),
    supersedes_program_revision_id: text('supersedes_program_revision_id'),
    business_objective: text('business_objective').notNull(),
    brand_objective: text('brand_objective').notNull(),
    outcome_model_id: text('outcome_model_id'),
    target_audiences: text('target_audiences').notNull(),
    markets: text('markets').notNull(),
    message_hierarchy: text('message_hierarchy').notNull(),
    content_pillars: text('content_pillars').notNull(),
    channel_roles: text('channel_roles').notNull(),
    budget_context: text('budget_context').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    scheduled_expiration: timestamp('scheduled_expiration', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_prog_rev_stable').on(table.program_id, table.program_revision_id),
    check(
      'ck_content_program_expiration',
      sql`${table.scheduled_expiration} IS NULL OR ${table.scheduled_expiration} > ${table.effective_from}`,
    ),
  ],
);

/**
 * OutcomeModel (SPEC02 §14)
 */
export const outcomeModels = pgTable('outcome_models', {
  outcome_model_id: text('outcome_model_id').primaryKey(),
  business_outcomes: text('business_outcomes').notNull(),
  behavioral_outcomes: text('behavioral_outcomes').notNull(),
  time_horizons: text('time_horizons').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  tenant_id: text('tenant_id').notNull(),
  workspace_id: text('workspace_id'),
});

/**
 * OutcomeEdge (SPEC02 §14)
 */
export const outcomeEdges = pgTable('outcome_edges', {
  edge_id: text('edge_id').primaryKey(),
  from_node: text('from_node').notNull(),
  to_node: text('to_node').notNull(),
  relationship_type: text('relationship_type').notNull(),
  assumptions: text('assumptions').notNull(),
  known_confounders: text('known_confounders').notNull(),
  time_lag: text('time_lag').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  tenant_id: text('tenant_id').notNull(),
  workspace_id: text('workspace_id'),
});

/**
 * AttributionModelRevision (SPEC02 §14)
 */
export const attributionModelRevisions = pgTable(
  'attribution_model_revisions',
  {
    attribution_model_id: text('attribution_model_id').notNull(),
    attribution_model_revision_id: text('attribution_model_revision_id').primaryKey(),
    supersedes_attribution_model_revision_id: text('supersedes_attribution_model_revision_id'),
    model_type: text('model_type').notNull(),
    eligible_touchpoints: text('eligible_touchpoints').notNull(),
    lookback_window: text('lookback_window').notNull(),
    credit_assignment: text('credit_assignment').notNull(),
    assumptions: text('assumptions').notNull(),
    limitations: text('limitations').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_attrib_rev_stable').on(table.attribution_model_id, table.attribution_model_revision_id),
  ],
);

/**
 * MetricDefinitionRevision (SPEC02 §14)
 */
export const metricDefinitionRevisions = pgTable(
  'metric_definition_revisions',
  {
    metric_id: text('metric_id').notNull(),
    metric_revision_id: text('metric_revision_id').primaryKey(),
    supersedes_metric_revision_id: text('supersedes_metric_revision_id'),
    metric_name: text('metric_name').notNull(),
    layer: text('layer').notNull(),
    definition: text('definition').notNull(),
    numerator: text('numerator').notNull(),
    denominator: text('denominator').notNull(),
    window: text('window').notNull(),
    attribution_model_revision_id: text('attribution_model_revision_id'),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    scheduled_expiration: timestamp('scheduled_expiration', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_metric_rev_stable').on(table.metric_id, table.metric_revision_id),
    check(
      'ck_metric_definition_expiration',
      sql`${table.scheduled_expiration} IS NULL OR ${table.scheduled_expiration} > ${table.effective_from}`,
    ),
  ],
);

/**
 * EvalContractRevision (SPEC02 §14)
 */
export const evalContractRevisions = pgTable(
  'eval_contract_revisions',
  {
    eval_contract_id: text('eval_contract_id').notNull(),
    eval_contract_revision_id: text('eval_contract_revision_id').primaryKey(),
    supersedes_eval_contract_revision_id: text('supersedes_eval_contract_revision_id'),
    component: text('component').notNull(),
    capability: text('capability').notNull(),
    required_dimensions: text('required_dimensions').notNull(),
    hard_gates: text('hard_gates').notNull(),
    release_impact: text('release_impact').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_eval_contract_rev_stable').on(table.eval_contract_id, table.eval_contract_revision_id),
  ],
);

/**
 * ChannelProfileRevision (SPEC02 §14)
 */
export const channelProfileRevisions = pgTable(
  'channel_profile_revisions',
  {
    channel_profile_id: text('channel_profile_id').notNull(),
    channel_profile_revision_id: text('channel_profile_revision_id').primaryKey(),
    supersedes_channel_profile_revision_id: text('supersedes_channel_profile_revision_id'),
    identity: text('identity').notNull(),
    platform_if_applicable: text('platform_if_applicable').notNull(),
    supported_formats: text('supported_formats').notNull(),
    distribution_capabilities: text('distribution_capabilities').notNull(),
    technical_capabilities: text('technical_capabilities').notNull(),
    content_capabilities: text('content_capabilities').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_channel_profile_rev_stable').on(table.channel_profile_id, table.channel_profile_revision_id),
  ],
);

/**
 * TaskContractRevision (SPEC02 §14)
 */
export const taskContractRevisions = pgTable(
  'task_contract_revisions',
  {
    task_id: text('task_id').notNull(),
    task_revision_id: text('task_revision_id').primaryKey(),
    supersedes_task_revision_id: text('supersedes_task_revision_id'),
    program_revision_id: text('program_revision_id')
      .references(() => contentProgramRevisions.program_revision_id),
    standalone_task: boolean('standalone_task').notNull(),
    objective: text('objective').notNull(),
    channel: text('channel').notNull(),
    format: text('format').notNull(),
    language: text('language').notNull(),
    market: text('market').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    brand_id: text('brand_id').notNull(),
    product_id: text('product_id').notNull(),
    audience_context: text('audience_context').notNull(),
    success_metric_revision_id: text('success_metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
    constraints: text('constraints').notNull(),
    risk_context: text('risk_context').notNull(),
    compute_budget: text('compute_budget').notNull(),
    intended_publication_time: timestamp('intended_publication_time', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_task_rev_stable').on(table.task_id, table.task_revision_id),
    check(
      'ck_task_contract_standalone_program',
      sql`(${table.standalone_task} = TRUE AND ${table.program_revision_id} IS NULL) OR (${table.standalone_task} = FALSE AND ${table.program_revision_id} IS NOT NULL)`,
    ),
  ],
);

/**
 * RunConfig (SPEC02 §17)
 */
export const runConfigs = pgTable('run_configs', {
  run_config_id: text('run_config_id').primaryKey(),
  runtime_parameters: text('runtime_parameters').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  tenant_id: text('tenant_id').notNull(),
  workspace_id: text('workspace_id'),
});

/**
 * GuidanceRevision (SPEC02 §14)
 */
export const guidanceRevisions = pgTable(
  'guidance_revisions',
  {
    guidance_id: text('guidance_id').notNull(),
    guidance_revision_id: text('guidance_revision_id').primaryKey(),
    supersedes_guidance_revision_id: text('supersedes_guidance_revision_id'),
    guidance_type: text('guidance_type').notNull(),
    recommendation: text('recommendation').notNull(),
    scope: text('scope').notNull(),
    limitations: text('limitations').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    scheduled_expiration: timestamp('scheduled_expiration', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_guidance_rev_stable').on(table.guidance_id, table.guidance_revision_id),
    check(
      'ck_guidance_expiration',
      sql`${table.scheduled_expiration} IS NULL OR ${table.scheduled_expiration} > ${table.effective_from}`,
    ),
  ],
);

/**
 * NormativeRuleRevision (SPEC02 §14)
 */
export const normativeRuleRevisions = pgTable(
  'normative_rule_revisions',
  {
    rule_id: text('rule_id').notNull(),
    rule_revision_id: text('rule_revision_id').primaryKey(),
    supersedes_rule_revision_id: text('supersedes_rule_revision_id'),
    rule_type: text('rule_type').notNull(), // HARD_DENY | HARD_REQUIREMENT | PREFERENCE
    statement: text('statement').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    scope: text('scope').notNull(),
    applicability_conditions: text('applicability_conditions').notNull(),
    enforcement_level: text('enforcement_level').notNull(),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull(),
    known_from: timestamp('known_from', { withTimezone: true }).notNull(),
    scheduled_expiration: timestamp('scheduled_expiration', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_rule_rev_stable').on(table.rule_id, table.rule_revision_id),
    check(
      'ck_normative_rule_expiration',
      sql`${table.scheduled_expiration} IS NULL OR ${table.scheduled_expiration} > ${table.valid_from}`,
    ),
  ],
);

/**
 * DecisionPolicyRevision (SPEC02 §14)
 */
export const decisionPolicyRevisions = pgTable(
  'decision_policy_revisions',
  {
    policy_id: text('policy_id').notNull(),
    policy_revision_id: text('policy_revision_id').primaryKey(),
    supersedes_policy_revision_id: text('supersedes_policy_revision_id'),
    conditions: text('conditions').notNull(),
    required_inputs: text('required_inputs').notNull(),
    action: text('action').notNull(),
    priority_class: text('priority_class').notNull(),
    scope: text('scope').notNull(),
    override_allowed: boolean('override_allowed').notNull(),
    override_authority_requirements: text('override_authority_requirements'),
    override_scope_constraints: text('override_scope_constraints'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_decision_policy_rev_stable').on(table.policy_id, table.policy_revision_id),
  ],
);
