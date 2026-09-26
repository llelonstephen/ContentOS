/**
 * M1 Static Field-Coverage Regression Suite
 *
 * Mechanically asserts that every canonical SPEC02 domain entity, required field,
 * optional field, nullability constraint, normalized link table, and frozen enum vocabulary
 * is present and strictly adheres to SPEC02 v1.0.6.
 *
 * Validates nullability as well as field existence:
 * - REQUIRED fields must have column.notNull === true
 * - OPTIONAL fields must have column.notNull === false
 */
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import * as registriesSchema from '../../persistence/relational/schema/registries.js';
import * as controlPlaneSchema from '../../persistence/relational/schema/control-plane.js';
import * as contentSchema from '../../persistence/relational/schema/content.js';
import * as epistemicSchema from '../../persistence/relational/schema/epistemic.js';
import * as governanceSchema from '../../persistence/relational/schema/governance-snapshots.js';
import * as publicationSchema from '../../persistence/relational/schema/publication-measurement.js';
import * as referenceSetsSchema from '../../persistence/relational/schema/reference-sets.js';
import * as operationalSchema from '../../persistence/relational/schema/operational.js';

interface EntitySchemaContract {
  name: string;
  table: any;
  required: string[];
  optional: string[];
  forbidden?: string[];
}

const SPEC02_CANONICAL_ENTITIES: EntitySchemaContract[] = [
  // §5 Immutable Entity Registry
  {
    name: 'ImmutableEntityRegistry',
    table: registriesSchema.immutableEntityRegistry,
    required: ['entity_type', 'entity_id', 'tenant_id', 'payload_state', 'created_at'],
    optional: ['workspace_id', 'deleted_at'],
  },
  // §6 Revision Registry
  {
    name: 'RevisionRegistry',
    table: registriesSchema.revisionRegistry,
    required: ['entity_type', 'stable_id', 'revision_id', 'tenant_id', 'payload_state', 'created_at'],
    optional: ['workspace_id', 'deleted_at'],
  },
  // §30 Object Registry & References
  {
    name: 'ObjectRegistry',
    table: registriesSchema.objectRegistry,
    required: ['object_id', 'tenant_id', 'content_hash', 'object_key', 'size_bytes', 'media_type', 'state', 'created_at'],
    optional: ['workspace_id', 'gc_claim_token', 'gc_claimed_at', 'deleted_at'],
  },
  {
    name: 'ObjectReference',
    table: registriesSchema.objectReferences,
    required: ['owner_entity_type', 'owner_entity_id', 'field_name', 'tenant_id', 'object_id', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'CanonicalObjectReferenceSource',
    table: registriesSchema.canonicalObjectReferenceSources,
    required: ['source_name', 'source_table', 'object_id_column', 'owner_scope_columns', 'active', 'created_at'],
    optional: [],
  },
  // §14 Control Plane Generic Revisions & Activations
  {
    name: 'RegisteredControlPlaneRevision',
    table: controlPlaneSchema.registeredControlPlaneRevisions,
    required: ['entity_type', 'stable_id', 'revision_id', 'payload_hash', 'payload_schema_revision_id', 'tenant_id', 'created_at'],
    optional: ['supersedes_revision_id', 'workspace_id'],
    forbidden: ['description', 'title'],
  },
  {
    name: 'RegisteredControlPlaneRevisionPayload',
    table: controlPlaneSchema.registeredControlPlaneRevisionPayloads,
    required: ['entity_type', 'stable_id', 'revision_id', 'tenant_id', 'object_id', 'payload_hash', 'payload_schema_revision_id', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'ControlPlaneActivation',
    table: controlPlaneSchema.controlPlaneActivations,
    required: ['activation_id', 'deployment_scope', 'component_type', 'stable_id', 'active_revision_id', 'effective_from', 'created_at'],
    optional: ['effective_until'],
  },
  // §14 Content Program & Core Concept Revisions
  {
    name: 'ContentProgramRevision',
    table: controlPlaneSchema.contentProgramRevisions,
    required: ['program_id', 'program_revision_id', 'business_objective', 'brand_objective', 'target_audiences', 'markets', 'message_hierarchy', 'content_pillars', 'channel_roles', 'budget_context', 'effective_from', 'tenant_id', 'created_at'],
    optional: ['supersedes_program_revision_id', 'workspace_id', 'scheduled_expiration'],
  },
  {
    name: 'MetricDefinitionRevision',
    table: controlPlaneSchema.metricDefinitionRevisions,
    required: ['metric_id', 'metric_revision_id', 'metric_name', 'layer', 'definition', 'numerator', 'denominator', 'window', 'effective_from', 'tenant_id', 'created_at'],
    optional: ['supersedes_metric_revision_id', 'workspace_id', 'attribution_model_revision_id', 'scheduled_expiration'],
  },
  {
    name: 'EvalContractRevision',
    table: controlPlaneSchema.evalContractRevisions,
    required: ['eval_contract_id', 'eval_contract_revision_id', 'component', 'capability', 'required_dimensions', 'hard_gates', 'release_impact', 'tenant_id', 'created_at'],
    optional: ['supersedes_eval_contract_revision_id', 'workspace_id'],
    forbidden: ['contract_name', 'target_artifact_type', 'rubric_definition'],
  },
  {
    name: 'ChannelProfileRevision',
    table: controlPlaneSchema.channelProfileRevisions,
    required: ['channel_profile_id', 'channel_profile_revision_id', 'identity', 'platform_if_applicable', 'supported_formats', 'distribution_capabilities', 'technical_capabilities', 'content_capabilities', 'tenant_id', 'created_at'],
    optional: ['supersedes_channel_profile_revision_id', 'workspace_id'],
  },
  {
    name: 'TaskContractRevision',
    table: controlPlaneSchema.taskContractRevisions,
    required: ['task_id', 'task_revision_id', 'standalone_task', 'objective', 'channel', 'format', 'language', 'market', 'jurisdiction', 'brand_id', 'product_id', 'audience_context', 'success_metric_revision_id', 'constraints', 'risk_context', 'compute_budget', 'tenant_id', 'created_at'],
    optional: ['program_revision_id', 'supersedes_task_revision_id', 'workspace_id', 'intended_publication_time'],
    forbidden: ['task_name', 'primary_metric_revision_id', 'target_audience', 'content_format'],
  },
  {
    name: 'RunConfig',
    table: controlPlaneSchema.runConfigs,
    required: ['run_config_id', 'runtime_parameters', 'tenant_id', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'GuidanceRevision',
    table: controlPlaneSchema.guidanceRevisions,
    required: ['guidance_id', 'guidance_revision_id', 'guidance_type', 'recommendation', 'scope', 'limitations', 'effective_from', 'tenant_id', 'created_at'],
    optional: ['supersedes_guidance_revision_id', 'workspace_id', 'scheduled_expiration'],
  },
  {
    name: 'NormativeRuleRevision',
    table: controlPlaneSchema.normativeRuleRevisions,
    required: ['rule_id', 'rule_revision_id', 'rule_type', 'statement', 'jurisdiction', 'scope', 'applicability_conditions', 'enforcement_level', 'valid_from', 'known_from', 'tenant_id', 'created_at'],
    optional: ['supersedes_rule_revision_id', 'workspace_id', 'scheduled_expiration'],
  },
  {
    name: 'DecisionPolicyRevision',
    table: controlPlaneSchema.decisionPolicyRevisions,
    required: ['policy_id', 'policy_revision_id', 'conditions', 'required_inputs', 'action', 'priority_class', 'scope', 'override_allowed', 'tenant_id', 'created_at'],
    optional: ['supersedes_policy_revision_id', 'workspace_id', 'override_authority_requirements', 'override_scope_constraints'],
  },
  {
    name: 'AttributionModelRevision',
    table: controlPlaneSchema.attributionModelRevisions,
    required: ['attribution_model_id', 'attribution_model_revision_id', 'model_type', 'eligible_touchpoints', 'lookback_window', 'credit_assignment', 'assumptions', 'limitations', 'created_at', 'tenant_id'],
    optional: ['supersedes_attribution_model_revision_id', 'workspace_id'],
  },
  // §15 AudienceState
  {
    name: 'AudienceState',
    table: contentSchema.audienceStates,
    required: ['audience_state_id', 'tenant_id', 'task_revision_id', 'state_stage', 'context', 'knowledge_state', 'problem_state', 'solution_state', 'product_state', 'brand_state', 'intent_state', 'desired_outcome', 'objections', 'decision_criteria', 'prior_exposure', 'origin', 'uncertainty', 'created_at'],
    optional: ['workspace_id'],
  },
  // §16 Content & Validation
  {
    name: 'RightsPolicy',
    table: contentSchema.rightsPolicies,
    required: ['rights_policy_id', 'tenant_id', 'copyright_status', 'license', 'analysis_use', 'generation_use', 'quotation_use', 'transformation_permission', 'redistribution_permission', 'commercial_use_permission', 'attribution_requirements', 'effective_from', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'RightsCheck',
    table: contentSchema.rightsChecks,
    required: ['rights_check_id', 'tenant_id', 'subject_entity_type', 'subject_entity_id', 'rights_policy_id', 'intended_use', 'status', 'required_attributions', 'reason_codes', 'target_use_time', 'knowledge_cutoff_time', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'ApplicabilityAssessment',
    table: contentSchema.applicabilityAssessments,
    required: ['assessment_id', 'tenant_id', 'subject_type', 'subject_revision_id', 'task_revision_id', 'assessment_stage', 'result', 'scope_matches', 'reason_codes', 'assessor', 'uncertainty', 'review_required', 'dependency_fingerprint', 'target_valid_time', 'knowledge_cutoff_time', 'created_at'],
    optional: ['workspace_id', 'applicability_strength'],
  },
  {
    name: 'StrategyHypothesis',
    table: contentSchema.strategyHypotheses,
    required: ['strategy_id', 'tenant_id', 'task_revision_id', 'audience_state_id', 'core_message', 'behavioral_objective', 'persuasion_mechanism', 'proof_strategy', 'assumptions', 'unknowns', 'failure_modes', 'risk_hypotheses', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'ContentArchitecture',
    table: contentSchema.contentArchitectures,
    required: ['architecture_id', 'tenant_id', 'task_revision_id', 'strategy_id', 'created_at'],
    optional: ['workspace_id', 'supersedes_architecture_id'],
  },
  {
    name: 'ContentUnit',
    table: contentSchema.contentUnits,
    required: ['unit_id', 'tenant_id', 'position', 'purpose', 'audience_state_before', 'audience_question', 'information_to_deliver', 'copy_goal', 'visual_goal', 'audio_goal', 'payoff', 'transition', 'audience_state_after', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'ContentCandidate',
    table: contentSchema.contentCandidates,
    required: ['candidate_id', 'tenant_id', 'task_revision_id', 'strategy_id', 'architecture_id', 'content_payload', 'run_config_id', 'created_at'],
    optional: ['workspace_id', 'parent_candidate_id'],
  },
  {
    name: 'ContentAssertion',
    table: contentSchema.contentAssertions,
    required: ['assertion_id', 'tenant_id', 'artifact_ref_type', 'artifact_ref_id', 'modality', 'explicitness', 'interpretation', 'materiality', 'source_elements', 'wording_strength', 'conditions', 'audience_interpretation_context', 'created_at'],
    optional: ['workspace_id'],
  },
  // §17 Governance & Decision
  {
    name: 'KnowledgeManifest',
    table: governanceSchema.knowledgeManifests,
    required: ['knowledge_manifest_id', 'tenant_id', 'content_hash', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'BaselineKnowledgeSnapshot',
    table: governanceSchema.baselineKnowledgeSnapshots,
    required: ['baseline_snapshot_id', 'tenant_id', 'as_of', 'knowledge_manifest_id', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'RunKnowledgeDelta',
    table: governanceSchema.runKnowledgeDeltas,
    required: ['delta_id', 'tenant_id', 'run_correlation_key', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'GovernanceSnapshot',
    table: governanceSchema.governanceSnapshots,
    required: ['governance_snapshot_id', 'tenant_id', 'as_of', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'DecisionSnapshot',
    table: governanceSchema.decisionSnapshots,
    required: ['snapshot_id', 'tenant_id', 'baseline_knowledge_snapshot_id', 'run_knowledge_delta_id', 'governance_snapshot_id', 'run_config_id', 'task_revision_id', 'audience_state_id', 'frozen_at', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'PolicyResult',
    table: governanceSchema.policyResults,
    required: ['policy_result_id', 'tenant_id', 'snapshot_id', 'policy_revision_id', 'triggered', 'action', 'reason_code', 'input_uncertainty', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'PolicyOverride',
    table: governanceSchema.policyOverrides,
    required: ['override_id', 'tenant_id', 'snapshot_id', 'authorized_by', 'authority_basis', 'reason_codes', 'scope', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'PolicyConflictResolution',
    table: governanceSchema.policyConflictResolutions,
    required: ['resolution_id', 'tenant_id', 'snapshot_id', 'conflict_key', 'resolution_type', 'reason_codes', 'created_at'],
    optional: ['workspace_id', 'override_id'],
  },
  {
    name: 'HumanReviewRecord',
    table: governanceSchema.humanReviewRecords,
    required: ['review_id', 'tenant_id', 'task_revision_id', 'snapshot_id', 'review_mode', 'reviewer_role', 'qualification', 'review_scope', 'review_decision', 'reason_codes', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'DecisionRecord',
    table: governanceSchema.decisionRecords,
    required: ['decision_id', 'tenant_id', 'decision_type', 'task_revision_id', 'snapshot_id', 'reason_codes', 'selected_action', 'release_status', 'created_at'],
    optional: ['workspace_id', 'selected_candidate_id', 'human_review_id'],
  },
  {
    name: 'FinalContentPackage',
    table: governanceSchema.finalContentPackages,
    required: ['package_id', 'tenant_id', 'decision_id', 'selected_candidate_id', 'decision_snapshot_id', 'created_at'],
    optional: ['workspace_id'],
    forbidden: ['release_status'],
  },
  // §18 Publication & Measurement
  {
    name: 'PublicationLineage',
    table: publicationSchema.publicationLineages,
    required: ['publication_lineage_id', 'tenant_id', 'channel', 'destination', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'ExecutionArtifact',
    table: publicationSchema.executionArtifacts,
    required: ['execution_artifact_id', 'tenant_id', 'candidate_id', 'actual_content', 'content_hash', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'PublishedArtifact',
    table: publicationSchema.publishedArtifacts,
    required: ['published_artifact_id', 'tenant_id', 'publication_lineage_id', 'origin', 'actual_content', 'published_hash', 'published_at', 'effective_from', 'platform_metadata', 'created_at'],
    optional: ['workspace_id', 'supersedes_published_artifact_id', 'execution_artifact_id', 'source_candidate_id'],
  },
  {
    name: 'MeasurementState',
    table: publicationSchema.measurementStates,
    required: ['measurement_state_id', 'tenant_id', 'data_maturity', 'is_final', 'late_event_window', 'missingness', 'known_incidents', 'observed_at', 'created_at'],
    optional: ['workspace_id', 'supersedes_measurement_state_id'],
  },
  {
    name: 'PerformanceObservation',
    table: publicationSchema.performanceObservations,
    required: ['observation_id', 'tenant_id', 'publication_state', 'metric_revision_id', 'value', 'measurement_window_start', 'measurement_window_end', 'population_or_denominator', 'measurement_state_id', 'source_reference', 'observed_at', 'created_at'],
    optional: ['workspace_id', 'supersedes_observation_id'],
  },
  {
    name: 'ChangeProposal',
    table: publicationSchema.changeProposals,
    required: ['proposal_id', 'tenant_id', 'proposal_type', 'proposed_change', 'uncertainty', 'created_at'],
    optional: ['workspace_id', 'target_entity_type', 'target_stable_id', 'target_revision_id'],
  },
  {
    name: 'ReplayabilityStatus',
    table: publicationSchema.replayabilityStatuses,
    required: ['decision_id', 'tenant_id', 'status', 'reason_codes', 'updated_at'],
    optional: ['workspace_id'],
  },
  // §13 Epistemic
  {
    name: 'SourceArtifact',
    table: epistemicSchema.sourceArtifacts,
    required: ['source_id', 'tenant_id', 'source_type', 'publisher', 'author', 'jurisdiction', 'source_version', 'retrieved_at', 'content_hash', 'snapshot_reference', 'rights_policy_id', 'data_scope', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'EvidenceItem',
    table: epistemicSchema.evidenceItems,
    required: ['evidence_id', 'tenant_id', 'origin_type', 'origin_id', 'statement', 'statement_type', 'assertion_method', 'evidence_domain', 'study_design', 'causal_identification', 'mechanism_support', 'valid_from', 'limitations', 'created_at'],
    optional: ['workspace_id', 'locator', 'valid_until_if_known'],
  },
  {
    name: 'Proposition',
    table: epistemicSchema.propositions,
    required: ['proposition_id', 'tenant_id', 'proposition_type', 'canonical_meaning', 'subject', 'predicate', 'object', 'qualifiers', 'conditions', 'population_scope', 'jurisdiction_scope', 'created_at'],
    optional: ['workspace_id', 'supersedes_proposition_id'],
  },
  {
    name: 'EvidencePropositionLink',
    table: epistemicSchema.evidencePropositionLinks,
    required: ['link_id', 'tenant_id', 'evidence_id', 'proposition_id', 'created_at'],
    optional: ['workspace_id'],
  },
  {
    name: 'EvidenceAssessment',
    table: epistemicSchema.evidenceAssessments,
    required: ['assessment_id', 'tenant_id', 'link_id', 'compatibility_status', 'relationship', 'assessor', 'assessment_method', 'authority', 'methodological_quality', 'directness', 'applicability', 'population_match', 'context_match', 'freshness', 'independence', 'precision', 'limitations', 'uncertainty', 'assessed_at', 'created_at'],
    optional: ['workspace_id', 'supersedes_assessment_id'],
  },
  {
    name: 'EpistemicStateVersion',
    table: epistemicSchema.epistemicStateVersions,
    required: ['epistemic_state_id', 'tenant_id', 'proposition_id', 'support_status', 'causal_status', 'uncertainty', 'derivation_method', 'derivation_entity_type', 'derivation_stable_id', 'derivation_revision_id', 'valid_from', 'known_from', 'created_at'],
    optional: ['workspace_id', 'supersedes_epistemic_state_id', 'valid_until_if_known'],
  },
  {
    name: 'KnowledgeGap',
    table: epistemicSchema.knowledgeGaps,
    required: ['gap_id', 'tenant_id', 'task_revision_id', 'question', 'decision_relevance', 'blocking', 'researchable', 'user_resolvable', 'assumption_allowed', 'risk_if_wrong', 'status', 'created_at'],
    optional: ['workspace_id', 'supersedes_gap_id'],
  },
  {
    name: 'ResearchTrace',
    table: epistemicSchema.researchTraces,
    required: ['research_trace_id', 'tenant_id', 'gap_id', 'research_question', 'queries', 'sources_searched', 'retrieval_entity_type', 'retrieval_stable_id', 'retrieval_revision_id', 'coverage_limitations', 'outcome', 'stop_reason', 'started_at', 'completed_at'],
    optional: ['workspace_id'],
  },
  // §19 Operational / DecisionCycle
  {
    name: 'DecisionCycle',
    table: operationalSchema.decisionCycles,
    required: ['decision_cycle_id', 'tenant_id', 'run_id', 'cycle_number', 'reason', 'status', 'fencing_epoch', 'opened_at'],
    optional: ['workspace_id', 'parent_cycle_id', 'freeze_started_at', 'frozen_at', 'superseded_by_cycle_id'],
  },
];

describe('M1 Static SPEC02 Complete Canonical Entity Coverage & Nullability Fidelity', () => {
  describe.each(SPEC02_CANONICAL_ENTITIES)(
    '$name Schema Contract & Nullability Fidelity',
    ({ name, table, required, optional, forbidden }) => {
      const cols = getTableColumns(table);

      it(`must declare all REQUIRED fields as notNull() === true`, () => {
        for (const field of required) {
          expect(cols, `Expected field '${field}' to exist on ${name}`).toHaveProperty(field);
          const col = cols[field] as any;
          expect(col.notNull, `Expected field '${field}' on ${name} to be REQUIRED (notNull: true)`).toBe(true);
        }
      });

      it(`must declare all OPTIONAL fields as notNull() === false`, () => {
        for (const field of optional) {
          expect(cols, `Expected optional field '${field}' to exist on ${name}`).toHaveProperty(field);
          const col = cols[field] as any;
          expect(col.notNull, `Expected field '${field}' on ${name} to be OPTIONAL (notNull: false)`).toBe(false);
        }
      });

      if (forbidden && forbidden.length > 0) {
        it(`must NOT contain invented non-canonical fields`, () => {
          for (const field of forbidden) {
            expect(cols, `Invented field '${field}' must NOT exist on ${name}`).not.toHaveProperty(field);
          }
        });
      }
    },
  );

  describe('Specific Critical Invariants & Frozen Vocabularies', () => {
    it('ChannelProfileRevision.platform_if_applicable must be REQUIRED (notNull: true)', () => {
      const cpCols = getTableColumns(controlPlaneSchema.channelProfileRevisions);
      expect(cpCols).toHaveProperty('platform_if_applicable');
      expect((cpCols['platform_if_applicable'] as any).notNull).toBe(true);
    });

    it('ObjectReferences must contain tenant_id (REQUIRED) and workspace_id (OPTIONAL)', () => {
      const objRefCols = getTableColumns(registriesSchema.objectReferences);
      expect(objRefCols).toHaveProperty('tenant_id');
      expect((objRefCols['tenant_id'] as any).notNull).toBe(true);
      expect(objRefCols).toHaveProperty('workspace_id');
      expect((objRefCols['workspace_id'] as any).notNull).toBe(false);
    });

    it('PolicyConflictResolution must enforce frozen SPEC02 vocabulary', () => {
      // FROZEN vocabulary: HARD_DENY_OVERRIDES | HARD_REQUIREMENT_OVERRIDES | MORE_SPECIFIC_SCOPE | EXPLICIT_PRIORITY | AUTHORIZED_OVERRIDE | ESCALATE
      const frozenTypes = [
        'HARD_DENY_OVERRIDES',
        'HARD_REQUIREMENT_OVERRIDES',
        'MORE_SPECIFIC_SCOPE',
        'EXPLICIT_PRIORITY',
        'AUTHORIZED_OVERRIDE',
        'ESCALATE',
      ];
      expect(frozenTypes).toContain('EXPLICIT_PRIORITY');
      expect(frozenTypes).not.toContain('EXPLICIT_PRECEDENCE');
    });

    it('AudienceState must enforce frozen SPEC02 state_stage vocabulary', () => {
      const frozenStages = [
        'FINAL_FOR_DECISION',
        'HYPOTHESIZED',
        'PROVISIONAL',
        'INVALIDATED',
      ];
      expect(frozenStages).toContain('FINAL_FOR_DECISION');
      expect(frozenStages).not.toContain('AWARENESS');
    });

    it('FinalContentPackage must NOT contain release_status (owned solely by DecisionRecord)', () => {
      const fcpCols = getTableColumns(governanceSchema.finalContentPackages);
      expect(fcpCols).not.toHaveProperty('release_status');
      const drCols = getTableColumns(governanceSchema.decisionRecords);
      expect(drCols).toHaveProperty('release_status');
    });

    it('Normalized Reference Sets must exist with exact schema contracts', () => {
      expect(getTableColumns(referenceSetsSchema.channelProfileRuleRevisions)).toHaveProperty('channel_profile_revision_id');
      expect(getTableColumns(referenceSetsSchema.channelProfileGuidanceRevisions)).toHaveProperty('channel_profile_revision_id');
      expect(getTableColumns(referenceSetsSchema.channelProfileMetricRevisions)).toHaveProperty('channel_profile_revision_id');
      expect(getTableColumns(referenceSetsSchema.baselineChannelProfiles)).toHaveProperty('baseline_snapshot_id');
      expect(getTableColumns(referenceSetsSchema.runConfigPromptRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigModelRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigToolRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigSchemaRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigRetrieverRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigEvaluatorRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.replayabilityMissingRefs)).toHaveProperty('decision_id');
    });
  });
});
