import { describe, expect, it } from 'vitest';
import {
  hashEvaluationStageInput,
  serializeEvaluationStageInput,
  type AssertionExtractStageInputCore,
  type AssertionMapStageInputCore,
  type AssertionValidateStageInputCore,
  type CompositeAssessStageInputCore,
  type EvaluationClosureStageInputCore,
  type EvaluationRunConfigClosure,
  type QualitativeEvaluateStageInputCore,
  type RiskAssessStageInputCore,
  type UncertaintyAssessStageInputCore,
} from '../../domain/evaluation/index.js';
import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
} from '../../domain/content/canonical-input-serialization.js';

describe('M5 EvaluationStageInputCore Deterministic Hashing (SPEC06 §127A–§133A)', () => {
  const baseRunConfig: EvaluationRunConfigClosure = {
    run_config_id: 'cfg-001',
    runtime_parameters: {
      temperature: 0.2,
      max_tokens: 4096,
      top_p: 0.95,
    },
    prompt_revision_refs: [
      { entity_type: 'PromptRevision', stable_id: 'p-1', revision_id: 'prev-1' },
      { entity_type: 'PromptRevision', stable_id: 'p-2', revision_id: 'prev-2' },
    ],
    model_config_revision_refs: [
      { entity_type: 'ModelConfigRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
      { entity_type: 'ModelConfigRevision', stable_id: 'm-2', revision_id: 'mrev-2' },
    ],
    tool_config_revision_refs: [
      { entity_type: 'ToolContractRevision', stable_id: 't-1', revision_id: 'trev-1' },
    ],
    schema_revision_refs: [
      { entity_type: 'SchemaRevision', stable_id: 's-1', revision_id: 'srev-1' },
    ],
    retriever_revision_refs: [
      { entity_type: 'RetrieverContractRevision', stable_id: 'r-1', revision_id: 'rrev-1' },
    ],
    evaluator_revision_refs: [
      { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
      { entity_type: 'EvaluatorConfig', stable_id: 'ev-2', revision_id: 'evrev-2' },
    ],
  };

  const baseExtractInput: AssertionExtractStageInputCore = {
    stage_name: 'ASSERTION_EXTRACT',
    tenant_id: 'tenant-test',
    workspace_id: 'workspace-a',
    run_id: 'run-100',
    decision_cycle_id: 'cycle-01',
    candidate_id: 'cand-001',
    run_config: baseRunConfig,
    selected_configs: {
      selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
      selected_schema_revision_ref: { entity_type: 'SchemaRevision', stable_id: 's-1', revision_id: 'srev-1' },
      selected_model_revision_ref: { entity_type: 'ModelConfigRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
    },
    extraction_parameters: { extract_implied: true },
  };

  it('generates a valid 64-character lowercase hex SHA-256 hash', () => {
    const hash = hashEvaluationStageInput(baseExtractInput);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('Case A: Identical semantic input with different normalized-ref insertion order produces identical canonical_input_hash', () => {
    it('sorts normalized RunConfig refs deterministically', () => {
      const configA: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        model_config_revision_refs: [
          { entity_type: 'ModelConfigRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
          { entity_type: 'ModelConfigRevision', stable_id: 'm-2', revision_id: 'mrev-2' },
        ],
        evaluator_revision_refs: [
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-2', revision_id: 'evrev-2' },
        ],
      };

      const configB: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        model_config_revision_refs: [
          { entity_type: 'ModelConfigRevision', stable_id: 'm-2', revision_id: 'mrev-2' },
          { entity_type: 'ModelConfigRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
        ],
        evaluator_revision_refs: [
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-2', revision_id: 'evrev-2' },
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        ],
      };

      const hashA = hashEvaluationStageInput({ ...baseExtractInput, run_config: configA });
      const hashB = hashEvaluationStageInput({ ...baseExtractInput, run_config: configB });

      expect(hashA).toBe(hashB);
    });
  });

  describe('Case B: Change runtime_parameters materially produces different canonical_input_hash', () => {
    it('detects parameter value change', () => {
      const hashOriginal = hashEvaluationStageInput(baseExtractInput);

      const modifiedConfig: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        runtime_parameters: {
          temperature: 0.7, // changed from 0.2
          max_tokens: 4096,
          top_p: 0.95,
        },
      };

      const hashModified = hashEvaluationStageInput({ ...baseExtractInput, run_config: modifiedConfig });
      expect(hashModified).not.toBe(hashOriginal);
    });

    it('preserves key-order insensitivity in runtime_parameters object', () => {
      const config1: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        runtime_parameters: { a: 1, b: 2, c: 3 },
      };
      const config2: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        runtime_parameters: { c: 3, a: 1, b: 2 },
      };

      const hash1 = hashEvaluationStageInput({ ...baseExtractInput, run_config: config1 });
      const hash2 = hashEvaluationStageInput({ ...baseExtractInput, run_config: config2 });
      expect(hash1).toBe(hash2);
    });

    it('detects runtime_parameters null vs empty object', () => {
      const configNull: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        runtime_parameters: null,
      };
      const configEmpty: EvaluationRunConfigClosure = {
        ...baseRunConfig,
        runtime_parameters: {},
      };

      const hashNull = hashEvaluationStageInput({ ...baseExtractInput, run_config: configNull });
      const hashEmpty = hashEvaluationStageInput({ ...baseExtractInput, run_config: configEmpty });
      expect(hashNull).not.toBe(hashEmpty);
    });
  });

  describe('Case C: Same RunConfig allowed model set {M1, M2} but selected M1 vs M2 produces different canonical_input_hash', () => {
    it('binds stage-utilized selections distinctly from full RunConfig set', () => {
      const inputM1: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        selected_configs: {
          ...baseExtractInput.selected_configs,
          selected_model_revision_ref: { entity_type: 'ModelConfigRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
        },
      };

      const inputM2: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        selected_configs: {
          ...baseExtractInput.selected_configs,
          selected_model_revision_ref: { entity_type: 'ModelConfigRevision', stable_id: 'm-2', revision_id: 'mrev-2' },
        },
      };

      const hashM1 = hashEvaluationStageInput(inputM1);
      const hashM2 = hashEvaluationStageInput(inputM2);

      expect(hashM1).not.toBe(hashM2);
    });
  });

  describe('Case D: Change selected evaluator revision produces different canonical_input_hash', () => {
    it('detects change in selected_evaluator_revision_ref', () => {
      const inputEv1: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        selected_configs: {
          ...baseExtractInput.selected_configs,
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const inputEv2: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        selected_configs: {
          ...baseExtractInput.selected_configs,
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-2', revision_id: 'evrev-2' },
        },
      };

      const hashEv1 = hashEvaluationStageInput(inputEv1);
      const hashEv2 = hashEvaluationStageInput(inputEv2);

      expect(hashEv1).not.toBe(hashEv2);
    });
  });

  describe('Case E: Change exact EpistemicStateVersion ref in ASSERTION_VALIDATE produces different canonical_input_hash', () => {
    it('detects epistemic state version divergence', () => {
      const validateInputA: AssertionValidateStageInputCore = {
        stage_name: 'ASSERTION_VALIDATE',
        tenant_id: 'tenant-test',
        workspace_id: 'workspace-a',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        assertion_id: 'as-001',
        proposition_link_ids: ['link-1', 'link-2'],
        epistemic_state_version_refs: [
          { entity_type: 'EpistemicStateVersion', entity_id: 'epi-v1' },
        ],
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const validateInputB: AssertionValidateStageInputCore = {
        ...validateInputA,
        epistemic_state_version_refs: [
          { entity_type: 'EpistemicStateVersion', entity_id: 'epi-v2' }, // updated version
        ],
      };

      const hashA = hashEvaluationStageInput(validateInputA);
      const hashB = hashEvaluationStageInput(validateInputB);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('Case F: Reorder set-like proposition / validation / subject refs produces same canonical_input_hash', () => {
    it('preserves hash when available_proposition_refs reordered in ASSERTION_MAP', () => {
      const mapA: AssertionMapStageInputCore = {
        stage_name: 'ASSERTION_MAP',
        tenant_id: 'tenant-test',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        assertion_id: 'as-001',
        candidate_id: 'cand-001',
        available_proposition_refs: [
          { entity_type: 'Proposition', entity_id: 'prop-alpha' },
          { entity_type: 'Proposition', entity_id: 'prop-beta' },
          { entity_type: 'Proposition', entity_id: 'prop-gamma' },
        ],
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const mapB: AssertionMapStageInputCore = {
        ...mapA,
        available_proposition_refs: [
          { entity_type: 'Proposition', entity_id: 'prop-gamma' },
          { entity_type: 'Proposition', entity_id: 'prop-alpha' },
          { entity_type: 'Proposition', entity_id: 'prop-beta' },
        ],
      };

      expect(hashEvaluationStageInput(mapA)).toBe(hashEvaluationStageInput(mapB));
    });

    it('preserves hash when subject_refs reordered in RISK_ASSESS', () => {
      const riskA: RiskAssessStageInputCore = {
        stage_name: 'RISK_ASSESS',
        tenant_id: 'tenant-test',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        subject_refs: [
          { entity_type: 'ContentAssertion', entity_id: 'as-001' },
          { entity_type: 'ContentAssertion', entity_id: 'as-002' },
        ],
        assessment_method_revision: { entity_type: 'MethodRevision', stable_id: 'm-1', revision_id: 'mrev-1' },
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const riskB: RiskAssessStageInputCore = {
        ...riskA,
        subject_refs: [
          { entity_type: 'ContentAssertion', entity_id: 'as-002' },
          { entity_type: 'ContentAssertion', entity_id: 'as-001' },
        ],
      };

      expect(hashEvaluationStageInput(riskA)).toBe(hashEvaluationStageInput(riskB));
    });
  });

  describe('Case G: Reorder semantically ordered collection changes hash where order is meaningful', () => {
    it('detects order changes in ORDERED_LIST canonical fields', () => {
      const manifest1 = {
        serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
        fields: [
          { name: 'ordered_units', kind: 'ORDERED_LIST' as const, value: ['unit-1', 'unit-2', 'unit-3'] },
        ],
      };
      const manifest2 = {
        serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
        fields: [
          { name: 'ordered_units', kind: 'ORDERED_LIST' as const, value: ['unit-3', 'unit-2', 'unit-1'] },
        ],
      };

      const hash1 = hashCanonicalInput(manifest1);
      const hash2 = hashCanonicalInput(manifest2);
      expect(hash1).not.toBe(hash2);
    });

    it('Partial 2: proves order sensitivity in an actual EvaluationStageInputCore instance (e.g., list of ordered assertion IDs)', () => {
      // Create a mock extraction with parameters containing an array
      const extract1: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        extraction_parameters: { ordered_hints: ['hint-1', 'hint-2'] },
      };
      const extract2: AssertionExtractStageInputCore = {
        ...baseExtractInput,
        extraction_parameters: { ordered_hints: ['hint-2', 'hint-1'] },
      };
      expect(hashEvaluationStageInput(extract1)).not.toBe(hashEvaluationStageInput(extract2));
    });
  });

  describe('Case H: Change eval_contract_revision_id causes QUALITATIVE_EVALUATE hash to change', () => {
    it('detects eval contract revision divergence', () => {
      const qualA: QualitativeEvaluateStageInputCore = {
        stage_name: 'QUALITATIVE_EVALUATE',
        tenant_id: 'tenant-test',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        candidate_id: 'cand-001',
        eval_contract_revision_id: 'ecr-v1',
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const qualB: QualitativeEvaluateStageInputCore = {
        ...qualA,
        eval_contract_revision_id: 'ecr-v2', // changed
      };

      expect(hashEvaluationStageInput(qualA)).not.toBe(hashEvaluationStageInput(qualB));
    });
  });

  describe('Case I & J & K: EVALUATION_CLOSURE package hashing (§133A)', () => {
    const baseClosure: EvaluationClosureStageInputCore = {
      stage_name: 'EVALUATION_CLOSURE',
      tenant_id: 'tenant-test',
      workspace_id: 'workspace-a',
      run_id: 'run-100',
      decision_cycle_id: 'cycle-01',
      selected_candidate_id: 'cand-001',
      material_assertion_ids: ['as-1', 'as-2', 'as-3'],
      selected_assertion_validation_result_ids: ['avr-1', 'avr-2', 'avr-3'],
      final_composite_assessment_refs: [
        { entity_type: 'CompositeImpressionAssessment', entity_id: 'comp-01' },
      ],
      qualitative_evaluation_ids: ['qev-01', 'qev-02'],
      material_risk_assessment_ids: ['risk-01'],
      uncertainty_assessment_id: 'unc-01',
      eval_contract_revision_refs: [
        { entity_type: 'EvalContractRevision', stable_id: 'ec-1', revision_id: 'ecr-1' },
      ],
      required_config_revision_refs: [
        { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
      ],
      run_config: baseRunConfig,
      selected_configs: {
        selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
      },
      closure_parameters: { strict_mode: true },
    };

    it('Case I: Change closure selected validation result set changes EVALUATION_CLOSURE hash', () => {
      const closureB: EvaluationClosureStageInputCore = {
        ...baseClosure,
        selected_assertion_validation_result_ids: ['avr-1', 'avr-2', 'avr-revalidated-3'],
      };

      expect(hashEvaluationStageInput(baseClosure)).not.toBe(hashEvaluationStageInput(closureB));
    });

    it('Case J: Change final composite assessment ref changes EVALUATION_CLOSURE hash', () => {
      const closureB: EvaluationClosureStageInputCore = {
        ...baseClosure,
        final_composite_assessment_refs: [
          { entity_type: 'CompositeImpressionAssessment', entity_id: 'comp-02' },
        ],
      };

      expect(hashEvaluationStageInput(baseClosure)).not.toBe(hashEvaluationStageInput(closureB));
    });

    it('Case K: Remove / add uncertainty_assessment_id changes EVALUATION_CLOSURE hash', () => {
      const closureWithoutUncertainty: EvaluationClosureStageInputCore = {
        ...baseClosure,
        uncertainty_assessment_id: null,
      };

      const hashWith = hashEvaluationStageInput(baseClosure);
      const hashWithout = hashEvaluationStageInput(closureWithoutUncertainty);

      expect(hashWith).not.toBe(hashWithout);
    });

    it('preserves hash when closure set references are shuffled', () => {
      const shuffledClosure: EvaluationClosureStageInputCore = {
        ...baseClosure,
        material_assertion_ids: ['as-3', 'as-1', 'as-2'],
        selected_assertion_validation_result_ids: ['avr-2', 'avr-3', 'avr-1'],
        qualitative_evaluation_ids: ['qev-02', 'qev-01'],
      };

      expect(hashEvaluationStageInput(baseClosure)).toBe(hashEvaluationStageInput(shuffledClosure));
    });

    it('Case M: Changing evaluator config ref changes closure hash', () => {
      const closureB: EvaluationClosureStageInputCore = {
        ...baseClosure,
        required_config_revision_refs: [
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-2', revision_id: 'evrev-2' },
        ],
      };
      expect(hashEvaluationStageInput(baseClosure)).not.toBe(hashEvaluationStageInput(closureB));
    });

    it('Case N: Changing NON-evaluator config ref changes closure hash', () => {
      const closureB: EvaluationClosureStageInputCore = {
        ...baseClosure,
        required_config_revision_refs: [
          { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
          { entity_type: 'PromptRevision', stable_id: 'p-1', revision_id: 'prev-1' },
        ],
      };
      expect(hashEvaluationStageInput(baseClosure)).not.toBe(hashEvaluationStageInput(closureB));
    });
  });

  describe('Case L: canonical_input_hash cannot appear in preimage DTO', () => {
    it('verifies EvaluationStageInputCoreVariant types have no canonical_input_hash property', () => {
      const sample = baseExtractInput as any;
      expect(sample.canonical_input_hash).toBeUndefined();

      // Serialized manifest string does not include any canonical_input_hash field
      const serialized = serializeEvaluationStageInput(baseExtractInput);
      expect(serialized).not.toContain('canonical_input_hash');
    });
  });

  describe('Coverage across all 8 EvaluationStageInputCore variants', () => {
    it('successfully serializes and hashes COMPOSITE_ASSESS', () => {
      const comp: CompositeAssessStageInputCore = {
        stage_name: 'COMPOSITE_ASSESS',
        tenant_id: 'tenant-test',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        candidate_id: 'cand-001',
        input_assertion_ids: ['as-1', 'as-2'],
        selected_validation_result_ids: ['avr-1', 'avr-2'],
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const hash = hashEvaluationStageInput(comp);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('successfully serializes and hashes UNCERTAINTY_ASSESS', () => {
      const unc: UncertaintyAssessStageInputCore = {
        stage_name: 'UNCERTAINTY_ASSESS',
        tenant_id: 'tenant-test',
        run_id: 'run-100',
        decision_cycle_id: 'cycle-01',
        subject_refs: [{ entity_type: 'ContentCandidate', entity_id: 'cand-001' }],
        assessment_method_revision: { entity_type: 'MethodRevision', stable_id: 'm-2', revision_id: 'mrev-2' },
        run_config: baseRunConfig,
        selected_configs: {
          selected_evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'evrev-1' },
        },
      };

      const hash = hashEvaluationStageInput(unc);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
