/**
 * ContentOS — Milestone M5 Evaluation Stage Input Core & Deterministic Hashing
 *
 * Authoritative specification: ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md §127A–§133A
 * SHA256: 5c8e61eb5203a33a58727ec0eb98a194326c512b01e536e5bea5ef0a093c8df5
 *
 * Normative requirements (§127A):
 * 1. Non-Canonical DTO Nature: Reconstructable operational DTOs; never persisted as canonical entities.
 * 2. Symmetric Reconstruction: Same serializer used at claim time and commit time.
 * 3. Preimage Self-Exclusion: canonical_input_hash MUST NOT appear in its own preimage.
 * 4. Deterministic Set-Like Ref Sorting: Normalized ref sets and un-ordered identifier collections sorted deterministically.
 * 5. Full RunConfig Closure + Distinct Stage-Utilized Selections: Both bound distinctly in preimage.
 * 6. Repository-Wide Convention: Reuses existing content-runtime-input.v1 canonical serializer.
 */

import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  serializeCanonicalInput,
  type CanonicalField,
  type CanonicalInputManifest,
} from '../content/canonical-input-serialization.js';
import type {
  ExactEntityRef,
  ExactRevisionRef,
  JsonValue,
} from '../content/types.js';
import type { EvaluationStageName } from './types.js';

// ============================================================================
// RunConfig Closure & Selected Config Binding (§127A, Item 11)
// ============================================================================

/**
 * Full immutable RunConfig closure identity bound to an EvaluationStageInputCore.
 * Encapsulates the entire pinned configuration space.
 */
export interface EvaluationRunConfigClosure {
  readonly run_config_id: string;
  readonly runtime_parameters: JsonValue;
  readonly prompt_revision_refs: readonly ExactRevisionRef[];
  readonly model_config_revision_refs: readonly ExactRevisionRef[];
  readonly tool_config_revision_refs: readonly ExactRevisionRef[];
  readonly schema_revision_refs: readonly ExactRevisionRef[];
  readonly retriever_revision_refs: readonly ExactRevisionRef[];
  readonly evaluator_revision_refs: readonly ExactRevisionRef[];
}

/**
 * Exact stage-utilized config member selections actually utilized by the evaluation stage.
 * Must be exact, proven members of the normalized RunConfig sets, but represented distinctly.
 */
export interface StageUtilizedConfigSelections {
  readonly selected_prompt_revision_ref?: ExactRevisionRef | null;
  readonly selected_model_revision_ref?: ExactRevisionRef | null;
  readonly selected_tool_revision_refs?: readonly ExactRevisionRef[];
  readonly selected_schema_revision_ref?: ExactRevisionRef | null;
  readonly selected_retriever_revision_ref?: ExactRevisionRef | null;
  readonly selected_evaluator_revision_ref?: ExactRevisionRef | null;
}

// ============================================================================
// Stage-Specific EvaluationStageInputCore Variants (§128–§133A)
// ============================================================================

export interface BaseEvaluationStageInputCore {
  readonly stage_name: EvaluationStageName;
  readonly tenant_id: string;
  readonly workspace_id?: string | null;
  readonly run_id: string;
  readonly decision_cycle_id: string;
  readonly run_config: EvaluationRunConfigClosure;
  readonly selected_configs: StageUtilizedConfigSelections;
}

/**
 * Stage 1: ASSERTION_EXTRACT (§128)
 */
export interface AssertionExtractStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'ASSERTION_EXTRACT';
  readonly candidate_id: string;
  readonly selected_configs: StageUtilizedConfigSelections & {
    readonly selected_evaluator_revision_ref: ExactRevisionRef;
    readonly selected_schema_revision_ref: ExactRevisionRef;
  };
  readonly extraction_parameters?: JsonValue;
}

/**
 * Stage 2: ASSERTION_MAP (§129)
 */
export interface AssertionMapStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'ASSERTION_MAP';
  readonly assertion_id: string;
  readonly candidate_id: string;
  readonly available_proposition_refs: readonly ExactEntityRef[];
  readonly selected_configs: StageUtilizedConfigSelections & {
    readonly selected_evaluator_revision_ref: ExactRevisionRef;
  };
  readonly mapping_parameters?: JsonValue;
}

/**
 * Stage 3: ASSERTION_VALIDATE (§130)
 */
export interface AssertionValidateStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'ASSERTION_VALIDATE';
  readonly assertion_id: string;
  readonly proposition_link_ids: readonly string[];
  readonly epistemic_state_version_refs: readonly ExactEntityRef[];
  readonly selected_configs: StageUtilizedConfigSelections & {
    readonly selected_evaluator_revision_ref: ExactRevisionRef;
  };
  readonly validation_parameters?: JsonValue;
}

/**
 * Stage 4: COMPOSITE_ASSESS (§131)
 */
export interface CompositeAssessStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'COMPOSITE_ASSESS';
  readonly candidate_id: string;
  readonly input_assertion_ids: readonly string[];
  readonly selected_validation_result_ids: readonly string[];
  readonly selected_configs: StageUtilizedConfigSelections & {
    readonly selected_evaluator_revision_ref: ExactRevisionRef;
  };
  readonly composite_parameters?: JsonValue;
}

/**
 * Stage 5: QUALITATIVE_EVALUATE (§132)
 * Note: eval_contract_revision_id is an exact immutable input, NOT an evaluator revision member.
 */
export interface QualitativeEvaluateStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'QUALITATIVE_EVALUATE';
  readonly candidate_id: string;
  readonly eval_contract_revision_id: string;
  readonly selected_configs: StageUtilizedConfigSelections & {
    readonly selected_evaluator_revision_ref: ExactRevisionRef;
  };
  readonly evaluation_parameters?: JsonValue;
}

/**
 * Stage 6: RISK_ASSESS (§133)
 */
export interface RiskAssessStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'RISK_ASSESS';
  readonly subject_refs: readonly ExactEntityRef[];
  readonly assessment_method_revision: ExactRevisionRef;
  readonly method_inputs?: JsonValue;
}

/**
 * Stage 7: UNCERTAINTY_ASSESS (§133)
 */
export interface UncertaintyAssessStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'UNCERTAINTY_ASSESS';
  readonly subject_refs: readonly ExactEntityRef[];
  readonly assessment_method_revision: ExactRevisionRef;
  readonly method_inputs?: JsonValue;
}

/**
 * Stage 8: EVALUATION_CLOSURE (§133A)
 * Binds the exact trusted closure reference package.
 */
export interface EvaluationClosureStageInputCore extends BaseEvaluationStageInputCore {
  readonly stage_name: 'EVALUATION_CLOSURE';
  readonly selected_candidate_id: string;
  readonly material_assertion_ids: readonly string[];
  readonly selected_assertion_validation_result_ids: readonly string[];
  readonly final_composite_assessment_refs: readonly ExactEntityRef[];
  readonly qualitative_evaluation_ids: readonly string[];
  readonly material_risk_assessment_ids: readonly string[];
  readonly uncertainty_assessment_id?: string | null;
  readonly eval_contract_revision_refs: readonly ExactRevisionRef[];
  readonly required_config_revision_refs: readonly ExactRevisionRef[];
  readonly closure_parameters?: JsonValue;
}

export type EvaluationStageInputCoreVariant =
  | AssertionExtractStageInputCore
  | AssertionMapStageInputCore
  | AssertionValidateStageInputCore
  | CompositeAssessStageInputCore
  | QualitativeEvaluateStageInputCore
  | RiskAssessStageInputCore
  | UncertaintyAssessStageInputCore
  | EvaluationClosureStageInputCore;

// ============================================================================
// Canonical Serialization & Hashing Implementation
// ============================================================================

function toRefJson(ref: ExactEntityRef | ExactRevisionRef): JsonValue {
  return ref as unknown as JsonValue;
}

/**
 * Builds a deterministic CanonicalInputManifest for any EvaluationStageInputCoreVariant.
 * Follows SPEC06 §127A common normative serialization contract.
 */
export function buildEvaluationStageCanonicalManifest(
  input: EvaluationStageInputCoreVariant,
): CanonicalInputManifest {
  const fields: CanonicalField[] = [
    { name: 'stage_name', kind: 'VALUE', value: input.stage_name },
    { name: 'tenant_id', kind: 'VALUE', value: input.tenant_id },
    { name: 'workspace_id', kind: 'VALUE', value: input.workspace_id ?? null },
    { name: 'run_id', kind: 'VALUE', value: input.run_id },
    { name: 'decision_cycle_id', kind: 'VALUE', value: input.decision_cycle_id },
  ];

  // Stage-specific fields
  switch (input.stage_name) {
    case 'ASSERTION_EXTRACT':
      fields.push(
        { name: 'candidate_id', kind: 'VALUE', value: input.candidate_id },
        { name: 'extraction_parameters', kind: 'VALUE', value: input.extraction_parameters ?? {} },
      );
      break;

    case 'ASSERTION_MAP':
      fields.push(
        { name: 'assertion_id', kind: 'VALUE', value: input.assertion_id },
        { name: 'candidate_id', kind: 'VALUE', value: input.candidate_id },
        {
          name: 'available_proposition_refs',
          kind: 'SEMANTIC_SET',
          value: input.available_proposition_refs.map(toRefJson),
        },
        { name: 'mapping_parameters', kind: 'VALUE', value: input.mapping_parameters ?? {} },
      );
      break;

    case 'ASSERTION_VALIDATE':
      fields.push(
        { name: 'assertion_id', kind: 'VALUE', value: input.assertion_id },
        {
          name: 'proposition_link_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.proposition_link_ids],
        },
        {
          name: 'epistemic_state_version_refs',
          kind: 'SEMANTIC_SET',
          value: input.epistemic_state_version_refs.map(toRefJson),
        },
        { name: 'validation_parameters', kind: 'VALUE', value: input.validation_parameters ?? {} },
      );
      break;

    case 'COMPOSITE_ASSESS':
      fields.push(
        { name: 'candidate_id', kind: 'VALUE', value: input.candidate_id },
        {
          name: 'input_assertion_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.input_assertion_ids],
        },
        {
          name: 'selected_validation_result_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.selected_validation_result_ids],
        },
        { name: 'composite_parameters', kind: 'VALUE', value: input.composite_parameters ?? {} },
      );
      break;

    case 'QUALITATIVE_EVALUATE':
      fields.push(
        { name: 'candidate_id', kind: 'VALUE', value: input.candidate_id },
        { name: 'eval_contract_revision_id', kind: 'VALUE', value: input.eval_contract_revision_id },
        { name: 'evaluation_parameters', kind: 'VALUE', value: input.evaluation_parameters ?? {} },
      );
      break;

    case 'RISK_ASSESS':
      fields.push(
        {
          name: 'subject_refs',
          kind: 'SEMANTIC_SET',
          value: input.subject_refs.map(toRefJson),
        },
        { name: 'assessment_method_revision', kind: 'VALUE', value: toRefJson(input.assessment_method_revision) },
        { name: 'method_inputs', kind: 'VALUE', value: input.method_inputs ?? {} },
      );
      break;

    case 'UNCERTAINTY_ASSESS':
      fields.push(
        {
          name: 'subject_refs',
          kind: 'SEMANTIC_SET',
          value: input.subject_refs.map(toRefJson),
        },
        { name: 'assessment_method_revision', kind: 'VALUE', value: toRefJson(input.assessment_method_revision) },
        { name: 'method_inputs', kind: 'VALUE', value: input.method_inputs ?? {} },
      );
      break;

    case 'EVALUATION_CLOSURE':
      fields.push(
        { name: 'selected_candidate_id', kind: 'VALUE', value: input.selected_candidate_id },
        {
          name: 'material_assertion_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.material_assertion_ids],
        },
        {
          name: 'selected_assertion_validation_result_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.selected_assertion_validation_result_ids],
        },
        {
          name: 'final_composite_assessment_refs',
          kind: 'SEMANTIC_SET',
          value: input.final_composite_assessment_refs.map(toRefJson),
        },
        {
          name: 'qualitative_evaluation_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.qualitative_evaluation_ids],
        },
        {
          name: 'material_risk_assessment_ids',
          kind: 'SEMANTIC_SET',
          value: [...input.material_risk_assessment_ids],
        },
        {
          name: 'uncertainty_assessment_id',
          kind: 'VALUE',
          value: input.uncertainty_assessment_id ?? null,
        },
        {
          name: 'eval_contract_revision_refs',
          kind: 'SEMANTIC_SET',
          value: input.eval_contract_revision_refs.map(toRefJson),
        },
        {
          name: 'required_config_revision_refs',
          kind: 'SEMANTIC_SET',
          value: input.required_config_revision_refs.map(toRefJson),
        },
        { name: 'closure_parameters', kind: 'VALUE', value: input.closure_parameters ?? {} },
      );
      break;
  }

  // Full RunConfig closure identity (§127A, Item 11)
  const rc = input.run_config;
  fields.push(
    { name: 'run_config_id', kind: 'VALUE', value: rc.run_config_id },
    { name: 'runtime_parameters', kind: 'VALUE', value: rc.runtime_parameters },
    {
      name: 'prompt_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.prompt_revision_refs.map(toRefJson),
    },
    {
      name: 'model_config_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.model_config_revision_refs.map(toRefJson),
    },
    {
      name: 'tool_config_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.tool_config_revision_refs.map(toRefJson),
    },
    {
      name: 'schema_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.schema_revision_refs.map(toRefJson),
    },
    {
      name: 'retriever_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.retriever_revision_refs.map(toRefJson),
    },
    {
      name: 'evaluator_revision_refs',
      kind: 'SEMANTIC_SET',
      value: rc.evaluator_revision_refs.map(toRefJson),
    },
  );

  // Exact stage-utilized config member selections (§127A, Item 11)
  const sc = input.selected_configs;
  fields.push(
    {
      name: 'selected_prompt_revision_ref',
      kind: 'VALUE',
      value: sc?.selected_prompt_revision_ref ? toRefJson(sc.selected_prompt_revision_ref) : null,
    },
    {
      name: 'selected_model_revision_ref',
      kind: 'VALUE',
      value: sc?.selected_model_revision_ref ? toRefJson(sc.selected_model_revision_ref) : null,
    },
    {
      name: 'selected_tool_revision_refs',
      kind: 'SEMANTIC_SET',
      value: sc?.selected_tool_revision_refs ? sc.selected_tool_revision_refs.map(toRefJson) : [],
    },
    {
      name: 'selected_schema_revision_ref',
      kind: 'VALUE',
      value: sc?.selected_schema_revision_ref ? toRefJson(sc.selected_schema_revision_ref) : null,
    },
    {
      name: 'selected_retriever_revision_ref',
      kind: 'VALUE',
      value: sc?.selected_retriever_revision_ref ? toRefJson(sc.selected_retriever_revision_ref) : null,
    },
    {
      name: 'selected_evaluator_revision_ref',
      kind: 'VALUE',
      value: sc?.selected_evaluator_revision_ref ? toRefJson(sc.selected_evaluator_revision_ref) : null,
    },
  );

  return {
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields,
  };
}

/**
 * Computes deterministic canonical SHA-256 hash (lowercase hex) for any EvaluationStageInputCore variant.
 * In accordance with SPEC06 §127A, canonical_input_hash is not in its own preimage.
 */
export function hashEvaluationStageInput(input: EvaluationStageInputCoreVariant): string {
  const manifest = buildEvaluationStageCanonicalManifest(input);
  return hashCanonicalInput(manifest);
}

/**
 * Serializes an EvaluationStageInputCore variant to its deterministic JSON string representation.
 */
export function serializeEvaluationStageInput(input: EvaluationStageInputCoreVariant): string {
  const manifest = buildEvaluationStageCanonicalManifest(input);
  return serializeCanonicalInput(manifest);
}
