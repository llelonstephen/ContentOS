/**
 * ContentOS — Milestone M5 Evaluation Domain Contracts (SPEC06 v1.0.2 FROZEN)
 *
 * Authoritative specification: ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md
 * SHA256: 5c8e61eb5203a33a58727ec0eb98a194326c512b01e536e5bea5ef0a093c8df5
 *
 * Pure TypeScript domain contracts only. Does not create new persistence schemas.
 * Closed vocabularies and fields match the frozen upstream specification byte-for-byte.
 */

import type {
  ExactEntityRef,
  ExactRevisionRef,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  TimestampInput,
} from '../content/types.js';

// Re-export foundational JSON / ref primitives for convenience
export type {
  ExactEntityRef,
  ExactRevisionRef,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  TimestampInput,
};

// ============================================================================
// Closed Vocabularies (§22, §34, §57, §126)
// ============================================================================

/**
 * Closed relation vocabulary for AssertionPropositionLink (SPEC06 §22).
 */
export const ASSERTION_PROPOSITION_RELATIONS = [
  'EQUIVALENT',
  'NARROWER',
  'BROADER',
  'CONJUNCT',
  'IMPLIES',
  'CONTRADICTS',
] as const;
export type AssertionPropositionRelation = (typeof ASSERTION_PROPOSITION_RELATIONS)[number];

/**
 * Closed validation status vocabulary for AssertionValidationResult (SPEC06 §34).
 * NOTE: UNKNOWN, INSUFFICIENT, and CONFLICTING are epistemic inputs, NOT validation output statuses.
 */
export const ASSERTION_VALIDATION_STATUSES = [
  'SUPPORTED',
  'SUPPORTED_WITH_QUALIFICATION',
  'OVERCLAIM',
  'UNSUPPORTED',
  'CONTRADICTORY',
] as const;
export type AssertionValidationStatus = (typeof ASSERTION_VALIDATION_STATUSES)[number];

/**
 * Closed composite status vocabulary for CompositeImpressionAssessment (SPEC06 §57).
 */
export const COMPOSITE_ASSESSMENT_STATUSES = [
  'STABLE',
  'STABLE_WITH_REQUIREMENTS',
  'INVALID',
  'REVIEW_REQUIRED',
] as const;
export type CompositeAssessmentStatus = (typeof COMPOSITE_ASSESSMENT_STATUSES)[number];

/**
 * Canonical SPEC06 evaluation stage execution names (§126).
 */
export const EVALUATION_STAGE_NAMES = [
  'ASSERTION_EXTRACT',
  'ASSERTION_MAP',
  'ASSERTION_VALIDATE',
  'COMPOSITE_ASSESS',
  'QUALITATIVE_EVALUATE',
  'RISK_ASSESS',
  'UNCERTAINTY_ASSESS',
  'EVALUATION_CLOSURE',
] as const;
export type EvaluationStageName = (typeof EVALUATION_STAGE_NAMES)[number];

/**
 * Recognized modalities for ContentAssertion extraction (SPEC06 §10).
 */
export const ASSERTION_MODALITIES = [
  'TEXT',
  'VISUAL',
  'AUDIO',
  'MULTIMODAL',
] as const;
export type AssertionModality = (typeof ASSERTION_MODALITIES)[number];

/**
 * Explicitness classification for ContentAssertion (SPEC06 §11).
 */
export const ASSERTION_EXPLICITNESS = [
  'EXPLICIT',
  'IMPLIED',
] as const;
export type AssertionExplicitness = (typeof ASSERTION_EXPLICITNESS)[number];

// ============================================================================
// Canonical Domain Contracts (Read-Only Views, SPEC06 §6, §21, §33, §56, §73, §86, §95)
// ============================================================================

/**
 * ContentAssertion (SPEC02 §16, SPEC06 §6).
 * Read-only domain contract for an immutable audience-interpretable assertion extracted from a Candidate.
 */
export interface ContentAssertionView {
  readonly assertion_id: string;
  readonly artifact_ref: ExactEntityRef;
  readonly modality: AssertionModality;
  readonly explicitness: AssertionExplicitness;
  readonly interpretation: JsonValue;
  readonly materiality: string;
  readonly source_elements: JsonValue;
  readonly wording_strength: JsonValue;
  readonly conditions: JsonValue;
  readonly audience_interpretation_context: JsonValue;
  readonly created_at: TimestampInput;
}
export type ContentAssertion = ContentAssertionView;

/**
 * AssertionPropositionLink (SPEC02 §16, SPEC06 §21).
 * Read-only domain contract for an immutable semantic mapping from an assertion to a canonical proposition.
 */
export interface AssertionPropositionLinkView {
  readonly link_id: string;
  readonly assertion_id: string;
  readonly proposition_id: string;
  readonly relation: AssertionPropositionRelation;
  readonly mapping_uncertainty: JsonValue;
  readonly created_at: TimestampInput;
}
export type AssertionPropositionLink = AssertionPropositionLinkView;

/**
 * AssertionValidationResult (SPEC02 §16, SPEC06 §33).
 * Read-only domain contract for an immutable validation decision over a ContentAssertion against epistemic state.
 */
export interface AssertionValidationResultView {
  readonly result_id: string;
  readonly assertion_id: string;
  readonly status: AssertionValidationStatus;
  readonly reason_codes: JsonValue;
  readonly required_qualification?: JsonValue | null;
  readonly evaluator_revision_ref: ExactRevisionRef;
  readonly proposition_link_ids: readonly string[];
  readonly created_at: TimestampInput;
}
export type AssertionValidationResult = AssertionValidationResultView;

/**
 * CompositeImpressionAssessment (SPEC02 §16, SPEC06 §56).
 * Read-only domain contract for an immutable holistic assessment of candidate claims and impressions as a whole.
 */
export interface CompositeImpressionAssessmentView {
  readonly assessment_id: string;
  readonly candidate_id: string;
  readonly input_assertion_ids: readonly string[];
  readonly likely_interpretations: JsonValue;
  readonly implied_assertion_ids: readonly string[];
  readonly misleading_risks: JsonValue;
  readonly required_disclosures: JsonValue;
  readonly status: CompositeAssessmentStatus;
  readonly evaluator_revision_ref: ExactRevisionRef;
  readonly created_at: TimestampInput;
}
export type CompositeImpressionAssessment = CompositeImpressionAssessmentView;

/**
 * QualitativeEvaluation (SPEC02 §16, SPEC06 §73).
 * Read-only domain contract for qualitative rubric evaluation against a pinned EvalContractRevision.
 */
export interface QualitativeEvaluationView {
  readonly evaluation_id: string;
  readonly candidate_id: string;
  readonly eval_contract_revision_id: string;
  readonly dimension_results: JsonValue;
  readonly hard_gate_results: JsonValue;
  readonly overall_state?: JsonValue | null;
  readonly evaluator_revision_ref: ExactRevisionRef;
  readonly created_at: TimestampInput;
}
export type QualitativeEvaluation = QualitativeEvaluationView;

/**
 * RiskAssessment (SPEC02 §16, SPEC06 §86).
 * Read-only domain contract for potential harm/impact assessment over an immutable subject.
 * NOTE: Per SPEC06 §90, RiskAssessment has NO evaluator revision field in the frozen schema.
 */
export interface RiskAssessmentView {
  readonly risk_assessment_id: string;
  readonly subject_ref: ExactEntityRef;
  readonly harm_type: JsonValue;
  readonly severity: JsonValue;
  readonly likelihood: JsonValue;
  readonly exposure: JsonValue;
  readonly reversibility: JsonValue;
  readonly regulatory_materiality: JsonValue;
  readonly business_impact: JsonValue;
  readonly created_at: TimestampInput;
}
export type RiskAssessment = RiskAssessmentView;

/**
 * UncertaintyAssessment (SPEC02 §16, SPEC06 §95).
 * Read-only domain contract capturing decision-material epistemic or aleatoric uncertainty.
 */
export interface UncertaintyAssessmentView {
  readonly uncertainty_assessment_id: string;
  readonly subject_refs: readonly (ExactEntityRef | ExactRevisionRef)[];
  readonly dimensions: JsonValue;
  readonly assessment_method: JsonValue;
  readonly created_at: TimestampInput;
}
export type UncertaintyAssessment = UncertaintyAssessmentView;

/**
 * EvalContractRevision (SPEC02 §14, SPEC06 §74).
 * Read-only domain contract for an immutable evaluation contract and rubric specification.
 */
export interface EvalContractRevisionView {
  readonly eval_contract_id: string;
  readonly eval_contract_revision_id: string;
  readonly supersedes_eval_contract_revision_id?: string | null;
  readonly component: JsonValue;
  readonly capability: JsonValue;
  readonly required_dimensions: JsonValue;
  readonly hard_gates: JsonValue;
  readonly release_impact: JsonValue;
  readonly created_at: TimestampInput;
}
export type EvalContractRevision = EvalContractRevisionView;

// ============================================================================
// Error Codes & Domain Invariant Structural Validation (Pure / DB-Free)
// ============================================================================

export const EVALUATION_ERROR_CODES = [
  'INVALID_RELATION_VOCABULARY',
  'INVALID_VALIDATION_STATUS',
  'INVALID_COMPOSITE_STATUS',
  'VALIDATION_QUALIFICATION_MISSING',
  'COMPOSITE_REQUIREMENTS_MISSING',
  'EVAL_CONTRACT_STRUCTURAL_INVALID',
  'EVALUATION_INPUT_INVALID',
  'RUN_CONFIG_BINDING_MISMATCH',
  'CANONICAL_HASH_MISMATCH',
] as const;
export type EvaluationErrorCode = (typeof EVALUATION_ERROR_CODES)[number];

export class EvaluationDomainError extends Error {
  constructor(
    public readonly code: EvaluationErrorCode,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'EvaluationDomainError';
  }
}

export function isStructuredValueEmpty(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string' && val.trim().length === 0) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === 'object' && Object.keys(val).length === 0) return true;
  return false;
}

/**
 * Validates structural invariants of an AssertionValidationResult without DB access (SPEC06 §34, §37).
 * - status must be in frozen closed vocabulary.
 * - SUPPORTED_WITH_QUALIFICATION requires a non-empty required_qualification string.
 * - other statuses must not supply required_qualification.
 */
export function validateAssertionValidationResultStructural(result: AssertionValidationResultView): void {
  if (!ASSERTION_VALIDATION_STATUSES.includes(result.status)) {
    throw new EvaluationDomainError(
      'INVALID_VALIDATION_STATUS',
      `Validation status '${String(result.status)}' is not in frozen vocabulary: ${ASSERTION_VALIDATION_STATUSES.join(', ')}`,
    );
  }
  if (result.status === 'SUPPORTED_WITH_QUALIFICATION') {
    if (isStructuredValueEmpty(result.required_qualification)) {
      throw new EvaluationDomainError(
        'VALIDATION_QUALIFICATION_MISSING',
        'SUPPORTED_WITH_QUALIFICATION requires a non-empty required_qualification.',
      );
    }
  }
}

/**
 * Validates structural invariants of a CompositeImpressionAssessment without DB access (SPEC06 §57, §66).
 * - status must be in frozen closed vocabulary.
 * - STABLE_WITH_REQUIREMENTS requires non-empty required_disclosures.
 */
export function validateCompositeAssessmentStructural(assessment: CompositeImpressionAssessmentView): void {
  if (!COMPOSITE_ASSESSMENT_STATUSES.includes(assessment.status)) {
    throw new EvaluationDomainError(
      'INVALID_COMPOSITE_STATUS',
      `Composite status '${String(assessment.status)}' is not in frozen vocabulary: ${COMPOSITE_ASSESSMENT_STATUSES.join(', ')}`,
    );
  }
  if (assessment.status === 'STABLE_WITH_REQUIREMENTS') {
    if (isStructuredValueEmpty(assessment.required_disclosures)) {
      throw new EvaluationDomainError(
        'COMPOSITE_REQUIREMENTS_MISSING',
        'STABLE_WITH_REQUIREMENTS requires non-empty required_disclosures.',
      );
    }
  }
}

/**
 * Validates structural invariants of an AssertionPropositionLink without DB access (SPEC06 §22).
 */
export function validateAssertionPropositionLinkStructural(link: AssertionPropositionLinkView): void {
  if (!ASSERTION_PROPOSITION_RELATIONS.includes(link.relation)) {
    throw new EvaluationDomainError(
      'INVALID_RELATION_VOCABULARY',
      `Relation '${String(link.relation)}' is not in frozen vocabulary: ${ASSERTION_PROPOSITION_RELATIONS.join(', ')}`,
    );
  }
}

/**
 * Validates structural completeness of an EvalContractRevision without DB access (SPEC06 §74).
 */
export function validateEvalContractRevisionStructural(contract: EvalContractRevisionView): void {
  if (
    isStructuredValueEmpty(contract.component) ||
    isStructuredValueEmpty(contract.capability) ||
    isStructuredValueEmpty(contract.release_impact)
  ) {
    throw new EvaluationDomainError(
      'EVAL_CONTRACT_STRUCTURAL_INVALID',
      'EvalContractRevision must have non-empty component, capability, and release_impact.',
    );
  }
}
