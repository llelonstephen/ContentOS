/**
 * ContentOS — Normalized Reference-Set Tables
 *
 * Implements SPEC02 §20:
 * Relational normalization for all canonical ID collections.
 * No canonical references stored as opaque JSON arrays.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
  foreignKey,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  contentProgramRevisions,
  outcomeModels,
  outcomeEdges,
  metricDefinitionRevisions,
  channelProfileRevisions,
  taskContractRevisions,
  runConfigs,
  guidanceRevisions,
  normativeRuleRevisions,
  decisionPolicyRevisions,
  attributionModelRevisions,
  registeredControlPlaneRevisions,
} from './control-plane.js';
import {
  sourceArtifacts,
  evidenceItems,
  propositions,
  evidencePropositionLinks,
  evidenceAssessments,
  epistemicStateVersions,
  knowledgeGaps,
  researchTraces,
} from './epistemic.js';
import {
  strategyHypotheses,
  contentArchitectures,
  contentUnits,
  contentCandidates,
  contentAssertions,
  assertionPropositionLinks,
  assertionValidationResults,
  compositeImpressionAssessments,
  qualitativeEvaluations,
  applicabilityAssessments,
  riskAssessments,
  rightsPolicies,
  rightsChecks,
  audienceStates,
} from './content.js';
import {
  knowledgeManifests,
  baselineKnowledgeSnapshots,
  runKnowledgeDeltas,
  governanceSnapshots,
  decisionSnapshots,
  policyResults,
  policyOverrides,
  policyConflictResolutions,
  humanReviewRecords,
  decisionRecords,
  finalContentPackages,
} from './governance-snapshots.js';
import {
  publishedArtifacts,
  performanceObservations,
  replayabilityStatuses,
} from './publication-measurement.js';
import { stageExecutions } from './operational.js';
import { objectRegistry } from './registries.js';

// --- Control Plane Link Tables ---

export const contentProgramSuccessMetrics = pgTable(
  'content_program_success_metrics',
  {
    program_revision_id: text('program_revision_id')
      .notNull()
      .references(() => contentProgramRevisions.program_revision_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.program_revision_id, table.metric_revision_id] }),
  ],
);

export const contentProgramGuardrailMetrics = pgTable(
  'content_program_guardrail_metrics',
  {
    program_revision_id: text('program_revision_id')
      .notNull()
      .references(() => contentProgramRevisions.program_revision_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.program_revision_id, table.metric_revision_id] }),
  ],
);

export const outcomeModelMetrics = pgTable(
  'outcome_model_metrics',
  {
    outcome_model_id: text('outcome_model_id')
      .notNull()
      .references(() => outcomeModels.outcome_model_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
    metric_role: text('metric_role').notNull(), // PRIMARY | SECONDARY | GUARDRAIL
  },
  (table) => [
    primaryKey({ columns: [table.outcome_model_id, table.metric_revision_id] }),
  ],
);

export const outcomeModelEdges = pgTable(
  'outcome_model_edges',
  {
    outcome_model_id: text('outcome_model_id')
      .notNull()
      .references(() => outcomeModels.outcome_model_id),
    edge_id: text('edge_id')
      .notNull()
      .references(() => outcomeEdges.edge_id),
  },
  (table) => [
    primaryKey({ columns: [table.outcome_model_id, table.edge_id] }),
  ],
);

export const taskSecondaryMetrics = pgTable(
  'task_secondary_metrics',
  {
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.task_revision_id, table.metric_revision_id] }),
  ],
);

export const taskGuardrailMetrics = pgTable(
  'task_guardrail_metrics',
  {
    task_revision_id: text('task_revision_id')
      .notNull()
      .references(() => taskContractRevisions.task_revision_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.task_revision_id, table.metric_revision_id] }),
  ],
);

// --- Epistemic & Research Link Tables ---

export const researchTraceEvidence = pgTable(
  'research_trace_evidence',
  {
    research_trace_id: text('research_trace_id')
      .notNull()
      .references(() => researchTraces.research_trace_id),
    evidence_id: text('evidence_id')
      .notNull()
      .references(() => evidenceItems.evidence_id),
  },
  (table) => [
    primaryKey({ columns: [table.research_trace_id, table.evidence_id] }),
  ],
);

export const epistemicStateAssessments = pgTable(
  'epistemic_state_assessments',
  {
    epistemic_state_id: text('epistemic_state_id')
      .notNull()
      .references(() => epistemicStateVersions.epistemic_state_id),
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => evidenceAssessments.assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.epistemic_state_id, table.assessment_id] }),
  ],
);

export const strategyRequiredPropositions = pgTable(
  'strategy_required_propositions',
  {
    strategy_id: text('strategy_id')
      .notNull()
      .references(() => strategyHypotheses.strategy_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.strategy_id, table.proposition_id] }),
  ],
);

export const contentArchitectureUnits = pgTable(
  'content_architecture_units',
  {
    architecture_id: text('architecture_id')
      .notNull()
      .references(() => contentArchitectures.architecture_id),
    unit_id: text('unit_id')
      .notNull()
      .references(() => contentUnits.unit_id),
  },
  (table) => [
    primaryKey({ columns: [table.architecture_id, table.unit_id] }),
  ],
);

export const contentUnitPropositions = pgTable(
  'content_unit_propositions',
  {
    unit_id: text('unit_id')
      .notNull()
      .references(() => contentUnits.unit_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.unit_id, table.proposition_id] }),
  ],
);

export const assertionValidationLinks = pgTable(
  'assertion_validation_links',
  {
    result_id: text('result_id')
      .notNull()
      .references(() => assertionValidationResults.result_id),
    link_id: text('link_id')
      .notNull()
      .references(() => assertionPropositionLinks.link_id),
  },
  (table) => [
    primaryKey({ columns: [table.result_id, table.link_id] }),
  ],
);

export const compositeInputAssertions = pgTable(
  'composite_input_assertions',
  {
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => compositeImpressionAssessments.assessment_id),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
  },
  (table) => [
    primaryKey({ columns: [table.assessment_id, table.assertion_id] }),
  ],
);

export const compositeImpliedAssertions = pgTable(
  'composite_implied_assertions',
  {
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => compositeImpressionAssessments.assessment_id),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
  },
  (table) => [
    primaryKey({ columns: [table.assessment_id, table.assertion_id] }),
  ],
);

// --- Knowledge Manifest Link Tables ---

export const knowledgeManifestSources = pgTable(
  'knowledge_manifest_sources',
  {
    knowledge_manifest_id: text('knowledge_manifest_id')
      .notNull()
      .references(() => knowledgeManifests.knowledge_manifest_id),
    source_id: text('source_id')
      .notNull()
      .references(() => sourceArtifacts.source_id),
  },
  (table) => [
    primaryKey({ columns: [table.knowledge_manifest_id, table.source_id] }),
  ],
);

export const knowledgeManifestEvidence = pgTable(
  'knowledge_manifest_evidence',
  {
    knowledge_manifest_id: text('knowledge_manifest_id')
      .notNull()
      .references(() => knowledgeManifests.knowledge_manifest_id),
    evidence_id: text('evidence_id')
      .notNull()
      .references(() => evidenceItems.evidence_id),
  },
  (table) => [
    primaryKey({ columns: [table.knowledge_manifest_id, table.evidence_id] }),
  ],
);

export const knowledgeManifestPropositions = pgTable(
  'knowledge_manifest_propositions',
  {
    knowledge_manifest_id: text('knowledge_manifest_id')
      .notNull()
      .references(() => knowledgeManifests.knowledge_manifest_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.knowledge_manifest_id, table.proposition_id] }),
  ],
);

export const knowledgeManifestEpistemicStates = pgTable(
  'knowledge_manifest_epistemic_states',
  {
    knowledge_manifest_id: text('knowledge_manifest_id')
      .notNull()
      .references(() => knowledgeManifests.knowledge_manifest_id),
    epistemic_state_id: text('epistemic_state_id')
      .notNull()
      .references(() => epistemicStateVersions.epistemic_state_id),
  },
  (table) => [
    primaryKey({ columns: [table.knowledge_manifest_id, table.epistemic_state_id] }),
  ],
);

// --- Run Knowledge Delta Link Tables ---

export const runDeltaSources = pgTable(
  'run_delta_sources',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    source_id: text('source_id')
      .notNull()
      .references(() => sourceArtifacts.source_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.source_id] }),
  ],
);

export const runDeltaEvidence = pgTable(
  'run_delta_evidence',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    evidence_id: text('evidence_id')
      .notNull()
      .references(() => evidenceItems.evidence_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.evidence_id] }),
  ],
);

export const runDeltaPropositions = pgTable(
  'run_delta_propositions',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.proposition_id] }),
  ],
);

export const runDeltaEvidencePropositionLinks = pgTable(
  'run_delta_evidence_proposition_links',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    link_id: text('link_id')
      .notNull()
      .references(() => evidencePropositionLinks.link_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.link_id] }),
  ],
);

export const runDeltaEvidenceAssessments = pgTable(
  'run_delta_evidence_assessments',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => evidenceAssessments.assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.assessment_id] }),
  ],
);

export const runDeltaEpistemicStates = pgTable(
  'run_delta_epistemic_states',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    epistemic_state_id: text('epistemic_state_id')
      .notNull()
      .references(() => epistemicStateVersions.epistemic_state_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.epistemic_state_id] }),
  ],
);

export const runDeltaKnowledgeGaps = pgTable(
  'run_delta_knowledge_gaps',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    gap_id: text('gap_id')
      .notNull()
      .references(() => knowledgeGaps.gap_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.gap_id] }),
  ],
);

export const runDeltaResearchTraces = pgTable(
  'run_delta_research_traces',
  {
    delta_id: text('delta_id')
      .notNull()
      .references(() => runKnowledgeDeltas.delta_id),
    research_trace_id: text('research_trace_id')
      .notNull()
      .references(() => researchTraces.research_trace_id),
  },
  (table) => [
    primaryKey({ columns: [table.delta_id, table.research_trace_id] }),
  ],
);

// --- Governance Snapshot Link Tables ---

export const governanceSnapshotGuidance = pgTable(
  'governance_snapshot_guidance',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    guidance_revision_id: text('guidance_revision_id')
      .notNull()
      .references(() => guidanceRevisions.guidance_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.guidance_revision_id] }),
  ],
);

export const governanceSnapshotRules = pgTable(
  'governance_snapshot_rules',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    rule_revision_id: text('rule_revision_id')
      .notNull()
      .references(() => normativeRuleRevisions.rule_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.rule_revision_id] }),
  ],
);

export const governanceSnapshotPolicies = pgTable(
  'governance_snapshot_policies',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    policy_revision_id: text('policy_revision_id')
      .notNull()
      .references(() => decisionPolicyRevisions.policy_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.policy_revision_id] }),
  ],
);

export const governanceSnapshotMetrics = pgTable(
  'governance_snapshot_metrics',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.metric_revision_id] }),
  ],
);

export const governanceSnapshotAttributions = pgTable(
  'governance_snapshot_attributions',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    attribution_model_revision_id: text('attribution_model_revision_id')
      .notNull()
      .references(() => attributionModelRevisions.attribution_model_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.attribution_model_revision_id] }),
  ],
);

export const governanceSnapshotRights = pgTable(
  'governance_snapshot_rights',
  {
    governance_snapshot_id: text('governance_snapshot_id')
      .notNull()
      .references(() => governanceSnapshots.governance_snapshot_id),
    rights_policy_id: text('rights_policy_id')
      .notNull()
      .references(() => rightsPolicies.rights_policy_id),
  },
  (table) => [
    primaryKey({ columns: [table.governance_snapshot_id, table.rights_policy_id] }),
  ],
);

// --- Decision Snapshot Link Tables ---

export const decisionSnapshotCandidates = pgTable(
  'decision_snapshot_candidates',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    candidate_id: text('candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.candidate_id] }),
  ],
);

export const decisionSnapshotStrategies = pgTable(
  'decision_snapshot_strategies',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    strategy_id: text('strategy_id')
      .notNull()
      .references(() => strategyHypotheses.strategy_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.strategy_id] }),
  ],
);

export const decisionSnapshotArchitectures = pgTable(
  'decision_snapshot_architectures',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    architecture_id: text('architecture_id')
      .notNull()
      .references(() => contentArchitectures.architecture_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.architecture_id] }),
  ],
);

export const decisionSnapshotKnowledgeGaps = pgTable(
  'decision_snapshot_knowledge_gaps',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    gap_id: text('gap_id')
      .notNull()
      .references(() => knowledgeGaps.gap_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.gap_id] }),
  ],
);

export const decisionSnapshotResearchTraces = pgTable(
  'decision_snapshot_research_traces',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    research_trace_id: text('research_trace_id')
      .notNull()
      .references(() => researchTraces.research_trace_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.research_trace_id] }),
  ],
);

export const decisionSnapshotAssertions = pgTable(
  'decision_snapshot_assertions',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.assertion_id] }),
  ],
);

export const decisionSnapshotAssertionValidationResults = pgTable(
  'decision_snapshot_assertion_validation_results',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    result_id: text('result_id')
      .notNull()
      .references(() => assertionValidationResults.result_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.result_id] }),
  ],
);

export const decisionSnapshotCompositeAssessments = pgTable(
  'decision_snapshot_composite_assessments',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => compositeImpressionAssessments.assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.assessment_id] }),
  ],
);

export const decisionSnapshotQualitativeEvaluations = pgTable(
  'decision_snapshot_qualitative_evaluations',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    evaluation_id: text('evaluation_id')
      .notNull()
      .references(() => qualitativeEvaluations.evaluation_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.evaluation_id] }),
  ],
);

export const decisionSnapshotApplicabilityAssessments = pgTable(
  'decision_snapshot_applicability_assessments',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    assessment_id: text('assessment_id')
      .notNull()
      .references(() => applicabilityAssessments.assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.assessment_id] }),
  ],
);

export const decisionSnapshotRiskAssessments = pgTable(
  'decision_snapshot_risk_assessments',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    risk_assessment_id: text('risk_assessment_id')
      .notNull()
      .references(() => riskAssessments.risk_assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.risk_assessment_id] }),
  ],
);

export const decisionSnapshotRightsChecks = pgTable(
  'decision_snapshot_rights_checks',
  {
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => decisionSnapshots.snapshot_id),
    rights_check_id: text('rights_check_id')
      .notNull()
      .references(() => rightsChecks.rights_check_id),
  },
  (table) => [
    primaryKey({ columns: [table.snapshot_id, table.rights_check_id] }),
  ],
);

// --- Policy & Decision Link Tables ---

export const policyOverrideResults = pgTable(
  'policy_override_results',
  {
    override_id: text('override_id')
      .notNull()
      .references(() => policyOverrides.override_id),
    policy_result_id: text('policy_result_id')
      .notNull()
      .references(() => policyResults.policy_result_id),
  },
  (table) => [
    primaryKey({ columns: [table.override_id, table.policy_result_id] }),
  ],
);

export const policyConflictResults = pgTable(
  'policy_conflict_results',
  {
    resolution_id: text('resolution_id')
      .notNull()
      .references(() => policyConflictResolutions.resolution_id),
    policy_result_id: text('policy_result_id')
      .notNull()
      .references(() => policyResults.policy_result_id),
  },
  (table) => [
    primaryKey({ columns: [table.resolution_id, table.policy_result_id] }),
  ],
);

export const humanReviewPolicyResults = pgTable(
  'human_review_policy_results',
  {
    review_id: text('review_id')
      .notNull()
      .references(() => humanReviewRecords.review_id),
    policy_result_id: text('policy_result_id')
      .notNull()
      .references(() => policyResults.policy_result_id),
  },
  (table) => [
    primaryKey({ columns: [table.review_id, table.policy_result_id] }),
  ],
);

export const decisionPolicyResults = pgTable(
  'decision_policy_results',
  {
    decision_id: text('decision_id')
      .notNull()
      .references(() => decisionRecords.decision_id),
    policy_result_id: text('policy_result_id')
      .notNull()
      .references(() => policyResults.policy_result_id),
  },
  (table) => [
    primaryKey({ columns: [table.decision_id, table.policy_result_id] }),
  ],
);

export const decisionConflictResolutions = pgTable(
  'decision_conflict_resolutions',
  {
    decision_id: text('decision_id')
      .notNull()
      .references(() => decisionRecords.decision_id),
    resolution_id: text('resolution_id')
      .notNull()
      .references(() => policyConflictResolutions.resolution_id),
  },
  (table) => [
    primaryKey({ columns: [table.decision_id, table.resolution_id] }),
  ],
);

// --- Final Content Package Link Tables ---

export const packageAlternativeCandidates = pgTable(
  'package_alternative_candidates',
  {
    package_id: text('package_id')
      .notNull()
      .references(() => finalContentPackages.package_id),
    candidate_id: text('candidate_id')
      .notNull()
      .references(() => contentCandidates.candidate_id),
  },
  (table) => [
    primaryKey({ columns: [table.package_id, table.candidate_id] }),
  ],
);

export const packageAssertions = pgTable(
  'package_assertions',
  {
    package_id: text('package_id')
      .notNull()
      .references(() => finalContentPackages.package_id),
    assertion_id: text('assertion_id')
      .notNull()
      .references(() => contentAssertions.assertion_id),
  },
  (table) => [
    primaryKey({ columns: [table.package_id, table.assertion_id] }),
  ],
);

export const packagePropositions = pgTable(
  'package_propositions',
  {
    package_id: text('package_id')
      .notNull()
      .references(() => finalContentPackages.package_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.package_id, table.proposition_id] }),
  ],
);

export const packageRisks = pgTable(
  'package_risks',
  {
    package_id: text('package_id')
      .notNull()
      .references(() => finalContentPackages.package_id),
    risk_assessment_id: text('risk_assessment_id')
      .notNull()
      .references(() => riskAssessments.risk_assessment_id),
  },
  (table) => [
    primaryKey({ columns: [table.package_id, table.risk_assessment_id] }),
  ],
);

export const packageRights = pgTable(
  'package_rights',
  {
    package_id: text('package_id')
      .notNull()
      .references(() => finalContentPackages.package_id),
    rights_check_id: text('rights_check_id')
      .notNull()
      .references(() => rightsChecks.rights_check_id),
  },
  (table) => [
    primaryKey({ columns: [table.package_id, table.rights_check_id] }),
  ],
);

// --- Publication & Measurement Link Tables ---

export const performanceObservationArtifacts = pgTable(
  'performance_observation_artifacts',
  {
    observation_id: text('observation_id')
      .notNull()
      .references(() => performanceObservations.observation_id),
    published_artifact_id: text('published_artifact_id')
      .notNull()
      .references(() => publishedArtifacts.published_artifact_id),
  },
  (table) => [
    primaryKey({ columns: [table.observation_id, table.published_artifact_id] }),
  ],
);

// --- SPEC02 Reconciled Link Tables ---

export const channelProfileRuleRevisions = pgTable(
  'channel_profile_rule_revisions',
  {
    channel_profile_revision_id: text('channel_profile_revision_id')
      .notNull()
      .references(() => channelProfileRevisions.channel_profile_revision_id),
    rule_revision_id: text('rule_revision_id')
      .notNull()
      .references(() => normativeRuleRevisions.rule_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.channel_profile_revision_id, table.rule_revision_id] }),
  ],
);

export const channelProfileGuidanceRevisions = pgTable(
  'channel_profile_guidance_revisions',
  {
    channel_profile_revision_id: text('channel_profile_revision_id')
      .notNull()
      .references(() => channelProfileRevisions.channel_profile_revision_id),
    guidance_revision_id: text('guidance_revision_id')
      .notNull()
      .references(() => guidanceRevisions.guidance_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.channel_profile_revision_id, table.guidance_revision_id] }),
  ],
);

export const channelProfileMetricRevisions = pgTable(
  'channel_profile_metric_revisions',
  {
    channel_profile_revision_id: text('channel_profile_revision_id')
      .notNull()
      .references(() => channelProfileRevisions.channel_profile_revision_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.channel_profile_revision_id, table.metric_revision_id] }),
  ],
);

export const baselineChannelProfiles = pgTable(
  'baseline_channel_profiles',
  {
    baseline_snapshot_id: text('baseline_snapshot_id')
      .notNull()
      .references(() => baselineKnowledgeSnapshots.baseline_snapshot_id),
    channel_profile_revision_id: text('channel_profile_revision_id')
      .notNull()
      .references(() => channelProfileRevisions.channel_profile_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.baseline_snapshot_id, table.channel_profile_revision_id] }),
  ],
);

export const guidanceSupportingPropositions = pgTable(
  'guidance_supporting_propositions',
  {
    guidance_revision_id: text('guidance_revision_id')
      .notNull()
      .references(() => guidanceRevisions.guidance_revision_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.guidance_revision_id, table.proposition_id] }),
  ],
);

export const normativeRuleSources = pgTable(
  'normative_rule_sources',
  {
    rule_revision_id: text('rule_revision_id')
      .notNull()
      .references(() => normativeRuleRevisions.rule_revision_id),
    source_id: text('source_id')
      .notNull()
      .references(() => sourceArtifacts.source_id),
  },
  (table) => [
    primaryKey({ columns: [table.rule_revision_id, table.source_id] }),
  ],
);

export const runConfigPromptRevisions = pgTable(
  'run_config_prompt_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.revision_id] }),
  ],
);

export const runConfigModelRevisions = pgTable(
  'run_config_model_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.revision_id] }),
  ],
);

export const runConfigToolRevisions = pgTable(
  'run_config_tool_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.revision_id] }),
  ],
);

export const runConfigSchemaRevisions = pgTable(
  'run_config_schema_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [
      table.run_config_id, table.entity_type, table.stable_id, table.revision_id,
    ] }),
    foreignKey({
      columns: [table.entity_type, table.stable_id, table.revision_id],
      foreignColumns: [
        registeredControlPlaneRevisions.entity_type,
        registeredControlPlaneRevisions.stable_id,
        registeredControlPlaneRevisions.revision_id,
      ],
    }),
    check('ck_run_config_schema_member_type', sql`${table.entity_type} = 'SchemaDefinition'`),
  ],
);

export const runConfigSchemaRoleBindings = pgTable(
  'run_config_schema_role_bindings',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    role: text('role').notNull(),
    schema_entity_type: text('schema_entity_type').notNull(),
    schema_stable_id: text('schema_stable_id').notNull(),
    schema_revision_id: text('schema_revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.role] }),
    uniqueIndex('uq_run_config_schema_role_exact').on(
      table.run_config_id, table.role, table.schema_entity_type,
      table.schema_stable_id, table.schema_revision_id,
    ),
    foreignKey({
      columns: [
        table.run_config_id, table.schema_entity_type,
        table.schema_stable_id, table.schema_revision_id,
      ],
      foreignColumns: [
        runConfigSchemaRevisions.run_config_id, runConfigSchemaRevisions.entity_type,
        runConfigSchemaRevisions.stable_id, runConfigSchemaRevisions.revision_id,
      ],
    }),
    check(
      'ck_run_config_schema_role',
      sql`${table.role} = 'CONTENT_INTELLIGENCE_AUDIENCE'`,
    ),
    check(
      'ck_run_config_schema_role_entity_type',
      sql`${table.schema_entity_type} = 'SchemaDefinition'`,
    ),
  ],
);

export const audienceDerivationAuthorities = pgTable(
  'audience_derivation_authorities',
  {
    audience_state_id: text('audience_state_id')
      .primaryKey()
      .references(() => audienceStates.audience_state_id),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    stage_execution_id: text('stage_execution_id')
      .notNull()
      .references(() => stageExecutions.stage_execution_id),
    run_config_id: text('run_config_id').notNull(),
    schema_role: text('schema_role').notNull(),
    schema_entity_type: text('schema_entity_type').notNull(),
    schema_stable_id: text('schema_stable_id').notNull(),
    schema_revision_id: text('schema_revision_id').notNull(),
    schema_object_id: text('schema_object_id')
      .notNull()
      .references(() => objectRegistry.object_id),
    schema_payload_hash: text('schema_payload_hash').notNull(),
    audience_knowledge_cutoff_time: timestamp('audience_knowledge_cutoff_time', {
      withTimezone: true,
    }).notNull(),
    derivation_manifest: text('derivation_manifest').notNull(),
    derivation_manifest_hash: text('derivation_manifest_hash').notNull(),
    canonical_input_hash: text('canonical_input_hash').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_audience_derivation_stage').on(table.stage_execution_id),
    foreignKey({
      columns: [
        table.run_config_id, table.schema_role, table.schema_entity_type,
        table.schema_stable_id, table.schema_revision_id,
      ],
      foreignColumns: [
        runConfigSchemaRoleBindings.run_config_id, runConfigSchemaRoleBindings.role,
        runConfigSchemaRoleBindings.schema_entity_type,
        runConfigSchemaRoleBindings.schema_stable_id,
        runConfigSchemaRoleBindings.schema_revision_id,
      ],
    }),
    check(
      'ck_audience_derivation_schema_role',
      sql`${table.schema_role} = 'CONTENT_INTELLIGENCE_AUDIENCE'`,
    ),
    check(
      'ck_audience_derivation_schema_type',
      sql`${table.schema_entity_type} = 'SchemaDefinition'`,
    ),
  ],
);

export const audienceFactBasisLinks = pgTable(
  'audience_fact_basis_links',
  {
    audience_state_id: text('audience_state_id')
      .notNull()
      .references(() => audienceStates.audience_state_id),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    audience_field: text('audience_field').notNull(),
    fact_path: text('fact_path').notNull(),
    fact_value_hash: text('fact_value_hash').notNull(),
    basis_kind: text('basis_kind').notNull(),
    task_id: text('task_id'),
    task_revision_id: text('task_revision_id').references(
      () => taskContractRevisions.task_revision_id,
    ),
    task_audience_context_path: text('task_audience_context_path'),
    task_audience_context_value_hash: text('task_audience_context_value_hash'),
    proposition_id: text('proposition_id').references(() => propositions.proposition_id),
    epistemic_state_id: text('epistemic_state_id').references(
      () => epistemicStateVersions.epistemic_state_id,
    ),
    ordinal: integer('ordinal').notNull(),
  },
  (table) => [
    primaryKey({ columns: [
      table.audience_state_id, table.audience_field, table.fact_path, table.ordinal,
    ] }),
    uniqueIndex('uq_audience_fact_task_basis').on(
      table.audience_state_id, table.audience_field, table.fact_path,
      table.task_id, table.task_revision_id, table.task_audience_context_path,
    ),
    uniqueIndex('uq_audience_fact_epistemic_basis').on(
      table.audience_state_id, table.audience_field, table.fact_path,
      table.proposition_id, table.epistemic_state_id,
    ),
    check('ck_audience_fact_basis_ordinal', sql`${table.ordinal} >= 0`),
    check(
      'ck_audience_fact_basis_branch',
      sql`(
        ${table.basis_kind} = 'TASK_AUDIENCE_CONTEXT'
        AND ${table.task_id} IS NOT NULL
        AND ${table.task_revision_id} IS NOT NULL
        AND ${table.task_audience_context_path} IS NOT NULL
        AND ${table.task_audience_context_value_hash} IS NOT NULL
        AND ${table.proposition_id} IS NULL
        AND ${table.epistemic_state_id} IS NULL
      ) OR (
        ${table.basis_kind} = 'AUDIENCE_EPISTEMIC_STATE'
        AND ${table.task_id} IS NULL
        AND ${table.task_revision_id} IS NULL
        AND ${table.task_audience_context_path} IS NULL
        AND ${table.task_audience_context_value_hash} IS NULL
        AND ${table.proposition_id} IS NOT NULL
        AND ${table.epistemic_state_id} IS NOT NULL
      )`,
    ),
  ],
);

export const runConfigRetrieverRevisions = pgTable(
  'run_config_retriever_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.revision_id] }),
  ],
);

export const runConfigEvaluatorRevisions = pgTable(
  'run_config_evaluator_revisions',
  {
    run_config_id: text('run_config_id')
      .notNull()
      .references(() => runConfigs.run_config_id),
    revision_id: text('revision_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.run_config_id, table.revision_id] }),
  ],
);

export const outcomeModelContentMetrics = pgTable(
  'outcome_model_content_metrics',
  {
    outcome_model_id: text('outcome_model_id')
      .notNull()
      .references(() => outcomeModels.outcome_model_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.outcome_model_id, table.metric_revision_id] }),
  ],
);

export const outcomeModelDiagnosticMetrics = pgTable(
  'outcome_model_diagnostic_metrics',
  {
    outcome_model_id: text('outcome_model_id')
      .notNull()
      .references(() => outcomeModels.outcome_model_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.outcome_model_id, table.metric_revision_id] }),
  ],
);

export const outcomeModelGuardrailMetrics = pgTable(
  'outcome_model_guardrail_metrics',
  {
    outcome_model_id: text('outcome_model_id')
      .notNull()
      .references(() => outcomeModels.outcome_model_id),
    metric_revision_id: text('metric_revision_id')
      .notNull()
      .references(() => metricDefinitionRevisions.metric_revision_id),
  },
  (table) => [
    primaryKey({ columns: [table.outcome_model_id, table.metric_revision_id] }),
  ],
);

export const outcomeEdgePropositions = pgTable(
  'outcome_edge_propositions',
  {
    edge_id: text('edge_id')
      .notNull()
      .references(() => outcomeEdges.edge_id),
    proposition_id: text('proposition_id')
      .notNull()
      .references(() => propositions.proposition_id),
  },
  (table) => [
    primaryKey({ columns: [table.edge_id, table.proposition_id] }),
  ],
);

export const replayabilityMissingRefs = pgTable(
  'replayability_missing_refs',
  {
    decision_id: text('decision_id')
      .notNull()
      .references(() => replayabilityStatuses.decision_id),
    ordinal: integer('ordinal').notNull(),
    ref_kind: text('ref_kind').notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id'),
    stable_id: text('stable_id'),
    revision_id: text('revision_id'),
  },
  (table) => [
    primaryKey({ columns: [table.decision_id, table.ordinal] }),
  ],
);
