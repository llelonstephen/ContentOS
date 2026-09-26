/**
 * ContentOS — Control Plane & Task Schema
 *
 * Implements SPEC02 §14:
 *   - RegisteredControlPlaneRevision & Payload
 *   - ControlPlaneActivation (SPEC02 §19, §29)
 *   - ContentProgramRevision, OutcomeModel, OutcomeEdge
 *   - AttributionModelRevision, MetricDefinitionRevision
 *   - EvalContractRevision, TaskContractRevision
 *   - RunConfig, ExecutionPlanRevision
 *   - GuidanceRevision, NormativeRuleRevision, RightsPolicyRevision
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { objectRegistry } from './registries.js';

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
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_revision_id: text('supersedes_revision_id'),
    description: text('description').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
  ],
);

/**
 * RegisteredControlPlaneRevisionPayload (SPEC02 §14)
 * Binds immutable revision identity to immutable object in ObjectRegistry.
 */
export const registeredControlPlaneRevisionPayloads = pgTable(
  'registered_control_plane_revision_payloads',
  {
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    object_id: text('object_id').notNull().references(() => objectRegistry.object_id),
    payload_hash: text('payload_hash').notNull(),
    payload_schema_revision_id: text('payload_schema_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
    uniqueIndex('uq_cplane_payload_triple').on(table.entity_type, table.stable_id, table.revision_id),
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
    contract_name: text('contract_name').notNull(),
    target_artifact_type: text('target_artifact_type').notNull(),
    rubric_definition: text('rubric_definition').notNull(),
    thresholds: text('thresholds').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_eval_contract_rev_stable').on(table.eval_contract_id, table.eval_contract_revision_id),
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
      .notNull()
      .references(() => contentProgramRevisions.program_revision_id),
    task_name: text('task_name').notNull(),
    primary_metric_revision_id: text('primary_metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
    target_audience: text('target_audience').notNull(),
    channel: text('channel').notNull(),
    content_format: text('content_format').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_task_rev_stable').on(table.task_id, table.task_revision_id),
  ],
);

/**
 * RunConfig (SPEC02 §14)
 */
export const runConfigs = pgTable('run_configs', {
  run_config_id: text('run_config_id').primaryKey(),
  task_revision_id: text('task_revision_id')
    .notNull()
    .references(() => taskContractRevisions.task_revision_id),
  eval_contract_revision_id: text('eval_contract_revision_id')
    .notNull()
    .references(() => evalContractRevisions.eval_contract_revision_id),
  prompt_config_revision_id: text('prompt_config_revision_id').notNull(),
  model_config_revision_id: text('model_config_revision_id').notNull(),
  retriever_config_revision_id: text('retriever_config_revision_id').notNull(),
  tool_config_revision_id: text('tool_config_revision_id').notNull(),
  evaluator_config_revision_id: text('evaluator_config_revision_id').notNull(),
  runtime_parameters: text('runtime_parameters').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  tenant_id: text('tenant_id').notNull(),
  workspace_id: text('workspace_id'),
});

/**
 * ExecutionPlanRevision (SPEC02 §14)
 */
export const executionPlanRevisions = pgTable(
  'execution_plan_revisions',
  {
    execution_plan_id: text('execution_plan_id').notNull(),
    execution_plan_revision_id: text('execution_plan_revision_id').primaryKey(),
    supersedes_plan_revision_id: text('supersedes_plan_revision_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    plan_definition: text('plan_definition').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_plan_rev_stable').on(table.execution_plan_id, table.execution_plan_revision_id),
  ],
);

/**
 * GuidanceRevision (SPEC02 §14)
 */
export const guidanceRevisions = pgTable(
  'guidance_revisions',
  {
    guidance_id: text('guidance_id').notNull(),
    guidance_revision_id: text('guidance_revision_id').primaryKey(),
    supersedes_guidance_revision_id: text('supersedes_guidance_revision_id'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_guidance_rev_stable').on(table.guidance_id, table.guidance_revision_id),
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
    rule_definition: text('rule_definition').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_rule_rev_stable').on(table.rule_id, table.rule_revision_id),
  ],
);

/**
 * RightsPolicyRevision (SPEC02 §14)
 */
export const rightsPolicyRevisions = pgTable(
  'rights_policy_revisions',
  {
    policy_id: text('policy_id').notNull(),
    policy_revision_id: text('policy_revision_id').primaryKey(),
    supersedes_policy_revision_id: text('supersedes_policy_revision_id'),
    policy_type: text('policy_type').notNull(),
    policy_definition: text('policy_definition').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
  },
  (table) => [
    uniqueIndex('uq_rights_rev_stable').on(table.policy_id, table.policy_revision_id),
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

