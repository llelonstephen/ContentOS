/**
 * ContentOS — Content, Validation, Risk & Rights Schema
 *
 * Implements SPEC02 §15, §16:
 *   - AudienceState (§15)
 *   - ApplicabilityAssessment (§16)
 *   - StrategyHypothesis (§16)
 *   - ContentArchitecture (§16)
 *   - ContentUnit (§16)
 *   - ContentCandidate (§16)
 *   - ContentAssertion (§16)
 *   - AssertionPropositionLink (§16)
 *   - AssertionValidationResult (§16)
 *   - CompositeImpressionAssessment (§16)
 *   - QualitativeEvaluation (§16)
 *   - RiskAssessment (§16)
 *   - UncertaintyAssessment (§16)
 *   - RightsPolicy (§16)
 *   - RightsCheck (§16)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  taskContractRevisions,
  runConfigs,
  evalContractRevisions,
} from './control-plane.js';
import { propositions } from './epistemic.js';

/**
 * AudienceState (SPEC02 §15)
 */
export const audienceStates = pgTable(
  'audience_states',
  {
    audience_state_id: text('audience_state_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    state_stage: text('state_stage').notNull(),
    context: text('context').notNull(),
    knowledge_state: text('knowledge_state').notNull(),
    problem_state: text('problem_state').notNull(),
    solution_state: text('solution_state').notNull(),
    product_state: text('product_state').notNull(),
    brand_state: text('brand_state').notNull(),
    intent_state: text('intent_state').notNull(),
    desired_outcome: text('desired_outcome').notNull(),
    objections: text('objections').notNull(),
    decision_criteria: text('decision_criteria').notNull(),
    prior_exposure: text('prior_exposure').notNull(),
    origin: text('origin').notNull(),
    uncertainty: text('uncertainty').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audience_state_tenant').on(table.tenant_id),
    index('idx_audience_state_task').on(table.task_revision_id),
    check(
      'ck_audience_state_stage',
      sql`${table.state_stage} IN ('PROVISIONAL', 'REFINED', 'FINAL_FOR_DECISION')`,
    ),
  ],
);

/**
 * ApplicabilityAssessment (SPEC02 §16)
 */
export const applicabilityAssessments = pgTable(
  'applicability_assessments',
  {
    assessment_id: text('assessment_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    subject_type: text('subject_type').notNull(), // GUIDANCE | NORMATIVE_RULE
    subject_revision_id: text('subject_revision_id').notNull(),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    assessment_stage: text('assessment_stage').notNull(), // PRE_GENERATION_PROVISIONAL | PRE_GENERATION_FINAL | CONTENT_LEVEL
    result: text('result').notNull(), // APPLICABLE | PARTIALLY_APPLICABLE | NOT_APPLICABLE | UNCERTAIN
    applicability_strength: text('applicability_strength'),
    scope_matches: text('scope_matches').notNull(),
    reason_codes: text('reason_codes').notNull(),
    assessor: text('assessor').notNull(),
    uncertainty: text('uncertainty').notNull(),
    review_required: boolean('review_required').notNull(),
    dependency_fingerprint: text('dependency_fingerprint').notNull(),
    target_valid_time: timestamp('target_valid_time', { withTimezone: true }).notNull(),
    knowledge_cutoff_time: timestamp('knowledge_cutoff_time', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_applicability_assessment_tenant').on(table.tenant_id),
    index('idx_applicability_assessment_task').on(table.task_revision_id),
    check(
      'ck_applicability_subject_type',
      sql`${table.subject_type} IN ('GUIDANCE', 'NORMATIVE_RULE')`,
    ),
    check(
      'ck_applicability_stage',
      sql`${table.assessment_stage} IN ('PRE_GENERATION_PROVISIONAL', 'PRE_GENERATION_FINAL', 'CONTENT_LEVEL')`,
    ),
    check(
      'ck_applicability_result',
      sql`${table.result} IN ('APPLICABLE', 'PARTIALLY_APPLICABLE', 'NOT_APPLICABLE', 'UNCERTAIN')`,
    ),
  ],
);

/**
 * StrategyHypothesis (SPEC02 §16)
 */
export const strategyHypotheses = pgTable(
  'strategy_hypotheses',
  {
    strategy_id: text('strategy_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    audience_state_id: text('audience_state_id')
      .notNull()
      .references(() => audienceStates.audience_state_id),
    core_message: text('core_message').notNull(),
    behavioral_objective: text('behavioral_objective').notNull(),
    persuasion_mechanism: text('persuasion_mechanism').notNull(),
    proof_strategy: text('proof_strategy').notNull(),
    assumptions: text('assumptions').notNull(),
    unknowns: text('unknowns').notNull(),
    failure_modes: text('failure_modes').notNull(),
    risk_hypotheses: text('risk_hypotheses').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_strategy_hypothesis_tenant').on(table.tenant_id),
    index('idx_strategy_hypothesis_task').on(table.task_revision_id),
    index('idx_strategy_hypothesis_audience').on(table.audience_state_id),
  ],
);

/**
 * ContentArchitecture (SPEC02 §16)
 */
export const contentArchitectures = pgTable(
  'content_architectures',
  {
    architecture_id: text('architecture_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    supersedes_architecture_id: text('supersedes_architecture_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    strategy_id: text('strategy_id')
      .notNull()
      .references(() => strategyHypotheses.strategy_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_content_arch_tenant').on(table.tenant_id),
    index('idx_content_arch_task').on(table.task_revision_id),
    index('idx_content_arch_strategy').on(table.strategy_id),
  ],
);

/**
 * ContentUnit (SPEC02 §16)
 */
export const contentUnits = pgTable(
  'content_units',
  {
    unit_id: text('unit_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    position: integer('position').notNull(),
    purpose: text('purpose').notNull(),
    audience_state_before: text('audience_state_before').notNull(),
    audience_question: text('audience_question').notNull(),
    information_to_deliver: text('information_to_deliver').notNull(),
    copy_goal: text('copy_goal').notNull(),
    visual_goal: text('visual_goal').notNull(),
    audio_goal: text('audio_goal').notNull(),
    payoff: text('payoff').notNull(),
    transition: text('transition').notNull(),
    audience_state_after: text('audience_state_after').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_content_unit_tenant').on(table.tenant_id),
  ],
);

/**
 * ContentCandidate (SPEC02 §16)
 */
export const contentCandidates = pgTable(
  'content_candidates',
  {
    candidate_id: text('candidate_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    strategy_id: text('strategy_id')
      .notNull()
      .references(() => strategyHypotheses.strategy_id),
    architecture_id: text('architecture_id')
      .notNull()
      .references(() => contentArchitectures.architecture_id),
    content_payload: text('content_payload').notNull(),
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    parent_candidate_id: text('parent_candidate_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_content_candidate_tenant').on(table.tenant_id),
    index('idx_content_candidate_task').on(table.task_revision_id),
    index('idx_content_candidate_run_cfg').on(table.run_config_id),
  ],
);

/**
 * ContentAssertion (SPEC02 §16)
 */
export const contentAssertions = pgTable(
  'content_assertions',
  {
    assertion_id: text('assertion_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    artifact_ref_type: text('artifact_ref_type').notNull(),
    artifact_ref_id: text('artifact_ref_id').notNull(),
    modality: text('modality').notNull(),
    explicitness: text('explicitness').notNull(),
    interpretation: text('interpretation').notNull(),
    materiality: text('materiality').notNull(),
    source_elements: text('source_elements').notNull(),
    wording_strength: text('wording_strength').notNull(),
    conditions: text('conditions').notNull(),
    audience_interpretation_context: text('audience_interpretation_context').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_content_assertion_tenant').on(table.tenant_id),
    index('idx_content_assertion_artifact').on(table.artifact_ref_type, table.artifact_ref_id),
  ],
);

/**
 * AssertionPropositionLink (SPEC02 §16)
 */
export const assertionPropositionLinks = pgTable(
  'assertion_proposition_links',
  {
    link_id: text('link_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
    relation: text('relation').notNull(),
    mapping_uncertainty: text('mapping_uncertainty').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_assertion_prop_link_tenant').on(table.tenant_id),
    index('idx_assertion_prop_link_pair').on(table.assertion_id, table.proposition_id),
    check(
      'ck_assertion_prop_relation',
      sql`${table.relation} IN ('EQUIVALENT', 'NARROWER', 'BROADER', 'CONJUNCT', 'IMPLIES', 'CONTRADICTS')`,
    ),
  ],
);

/**
 * AssertionValidationResult (SPEC02 §16)
 */
export const assertionValidationResults = pgTable(
  'assertion_validation_results',
  {
    result_id: text('result_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
    status: text('status').notNull(),
    reason_codes: text('reason_codes').notNull(),
    required_qualification: text('required_qualification'),
    evaluator_revision_ref_entity_type: text('evaluator_revision_ref_entity_type').notNull(),
    evaluator_revision_ref_stable_id: text('evaluator_revision_ref_stable_id').notNull(),
    evaluator_revision_ref_revision_id: text('evaluator_revision_ref_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_assertion_val_result_tenant').on(table.tenant_id),
    index('idx_assertion_val_result_assertion').on(table.assertion_id),
    check(
      'ck_assertion_validation_status',
      sql`${table.status} IN ('SUPPORTED', 'SUPPORTED_WITH_QUALIFICATION', 'OVERCLAIM', 'UNSUPPORTED', 'CONTRADICTORY')`,
    ),
  ],
);

/**
 * CompositeImpressionAssessment (SPEC02 §16)
 */
export const compositeImpressionAssessments = pgTable(
  'composite_impression_assessments',
  {
    assessment_id: text('assessment_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    candidate_id: text('candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
    likely_interpretations: text('likely_interpretations').notNull(),
    misleading_risks: text('misleading_risks').notNull(),
    required_disclosures: text('required_disclosures').notNull(),
    status: text('status').notNull(),
    evaluator_revision_ref_entity_type: text('evaluator_revision_ref_entity_type').notNull(),
    evaluator_revision_ref_stable_id: text('evaluator_revision_ref_stable_id').notNull(),
    evaluator_revision_ref_revision_id: text('evaluator_revision_ref_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_composite_assessment_tenant').on(table.tenant_id),
    index('idx_composite_assessment_candidate').on(table.candidate_id),
    check(
      'ck_composite_assessment_status',
      sql`${table.status} IN ('STABLE', 'STABLE_WITH_REQUIREMENTS', 'INVALID', 'REVIEW_REQUIRED')`,
    ),
  ],
);

/**
 * QualitativeEvaluation (SPEC02 §16)
 */
export const qualitativeEvaluations = pgTable(
  'qualitative_evaluations',
  {
    evaluation_id: text('evaluation_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    candidate_id: text('candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
    eval_contract_revision_id: text('eval_contract_revision_id')
      .notNull()
      .references(() => evalContractRevisions.eval_contract_revision_id),
    dimension_results: text('dimension_results').notNull(),
    hard_gate_results: text('hard_gate_results').notNull(),
    overall_state: text('overall_state'),
    evaluator_revision_ref_entity_type: text('evaluator_revision_ref_entity_type').notNull(),
    evaluator_revision_ref_stable_id: text('evaluator_revision_ref_stable_id').notNull(),
    evaluator_revision_ref_revision_id: text('evaluator_revision_ref_revision_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_qual_eval_tenant').on(table.tenant_id),
    index('idx_qual_eval_candidate').on(table.candidate_id),
    index('idx_qual_eval_contract').on(table.eval_contract_revision_id),
  ],
);

/**
 * RiskAssessment (SPEC02 §16)
 */
export const riskAssessments = pgTable(
  'risk_assessments',
  {
    risk_assessment_id: text('risk_assessment_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    subject_entity_type: text('subject_entity_type').notNull(),
    subject_entity_id: text('subject_entity_id').notNull(),
    harm_type: text('harm_type').notNull(),
    severity: text('severity').notNull(),
    likelihood: text('likelihood').notNull(),
    exposure: text('exposure').notNull(),
    reversibility: text('reversibility').notNull(),
    regulatory_materiality: text('regulatory_materiality').notNull(),
    business_impact: text('business_impact').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_risk_assessment_tenant').on(table.tenant_id),
    index('idx_risk_assessment_subject').on(table.subject_entity_type, table.subject_entity_id),
  ],
);

/**
 * UncertaintyAssessment (SPEC02 §16)
 */
export const uncertaintyAssessments = pgTable(
  'uncertainty_assessments',
  {
    uncertainty_assessment_id: text('uncertainty_assessment_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    dimensions: text('dimensions').notNull(),
    assessment_method: text('assessment_method').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_uncertainty_assessment_tenant').on(table.tenant_id),
  ],
);

/**
 * RightsPolicy (SPEC02 §16)
 * Immutable rights policy entity.
 */
export const rightsPolicies = pgTable(
  'rights_policies',
  {
    rights_policy_id: text('rights_policy_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    copyright_status: text('copyright_status').notNull(),
    license: text('license').notNull(),
    analysis_use: boolean('analysis_use').notNull(),
    generation_use: boolean('generation_use').notNull(),
    quotation_use: boolean('quotation_use').notNull(),
    transformation_permission: boolean('transformation_permission').notNull(),
    redistribution_permission: boolean('redistribution_permission').notNull(),
    commercial_use_permission: boolean('commercial_use_permission').notNull(),
    attribution_requirements: text('attribution_requirements').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    scheduled_expiration: timestamp('scheduled_expiration', { withTimezone: true }),
    supersedes_rights_policy_id: text('supersedes_rights_policy_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_rights_policy_tenant').on(table.tenant_id),
    check(
      'ck_rights_policy_expiration',
      sql`${table.scheduled_expiration} IS NULL OR ${table.scheduled_expiration} > ${table.effective_from}`,
    ),
  ],
);

/**
 * RightsCheck (SPEC02 §16)
 */
export const rightsChecks = pgTable(
  'rights_checks',
  {
    rights_check_id: text('rights_check_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    subject_entity_type: text('subject_entity_type').notNull(),
    subject_entity_id: text('subject_entity_id').notNull(),
    rights_policy_id: text('rights_policy_id')
      .notNull()
      .references(() => rightsPolicies.rights_policy_id),
    intended_use: text('intended_use').notNull(),
    status: text('status').notNull(),
    required_attributions: text('required_attributions').notNull(),
    reason_codes: text('reason_codes').notNull(),
    target_use_time: text('target_use_time').notNull(),
    knowledge_cutoff_time: timestamp('knowledge_cutoff_time', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_rights_check_tenant').on(table.tenant_id),
    index('idx_rights_check_subject').on(table.subject_entity_type, table.subject_entity_id),
    index('idx_rights_check_policy').on(table.rights_policy_id),
    check(
      'ck_rights_check_status',
      sql`${table.status} IN ('ALLOWED', 'ALLOWED_WITH_REQUIREMENTS', 'REVIEW_REQUIRED', 'BLOCKED')`,
    ),
  ],
);
