import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  ASSERTION_PROPOSITION_RELATIONS,
  ASSERTION_VALIDATION_STATUSES,
  COMPOSITE_ASSESSMENT_STATUSES,
  EVALUATION_STAGE_NAMES,
  EvaluationDomainError,
  validateAssertionPropositionLinkStructural,
  validateAssertionValidationResultStructural,
  validateCompositeAssessmentStructural,
  validateEvalContractRevisionStructural,
  ASSERTION_MODALITIES,
  ASSERTION_EXPLICITNESS,
  type AssertionPropositionLinkView,
  type AssertionValidationResultView,
  type CompositeImpressionAssessmentView,
  type EvalContractRevisionView,
  type ContentAssertionView,
  type ExactEntityRef,
  type ExactRevisionRef,
} from '../../domain/evaluation/index.js';

describe('M5 Domain Contracts & Invariants (SPEC06 v1.0.2 FROZEN)', () => {
  describe('Case M: Domain closed vocabularies contain no unauthorized enum values', () => {
    it('preserves exact AssertionPropositionLink relations (§22)', () => {
      expect(ASSERTION_PROPOSITION_RELATIONS).toEqual([
        'EQUIVALENT',
        'NARROWER',
        'BROADER',
        'CONJUNCT',
        'IMPLIES',
        'CONTRADICTS',
      ]);
      expect(ASSERTION_PROPOSITION_RELATIONS).toHaveLength(6);
    });

    it('preserves exact AssertionValidationResult statuses (§34)', () => {
      expect(ASSERTION_VALIDATION_STATUSES).toEqual([
        'SUPPORTED',
        'SUPPORTED_WITH_QUALIFICATION',
        'OVERCLAIM',
        'UNSUPPORTED',
        'CONTRADICTORY',
      ]);
      expect(ASSERTION_VALIDATION_STATUSES).toHaveLength(5);

      // Explicitly guard against epistemic inputs becoming validation statuses
      const forbidden = ['UNKNOWN', 'INSUFFICIENT', 'CONFLICTING'];
      for (const status of forbidden) {
        expect(ASSERTION_VALIDATION_STATUSES).not.toContain(status);
      }
    });

    it('preserves exact CompositeImpressionAssessment statuses (§57)', () => {
      expect(COMPOSITE_ASSESSMENT_STATUSES).toEqual([
        'STABLE',
        'STABLE_WITH_REQUIREMENTS',
        'INVALID',
        'REVIEW_REQUIRED',
      ]);
      expect(COMPOSITE_ASSESSMENT_STATUSES).toHaveLength(4);
    });

    it('preserves all 8 evaluation stage names (§126)', () => {
      expect(EVALUATION_STAGE_NAMES).toEqual([
        'ASSERTION_EXTRACT',
        'ASSERTION_MAP',
        'ASSERTION_VALIDATE',
        'COMPOSITE_ASSESS',
        'QUALITATIVE_EVALUATE',
        'RISK_ASSESS',
        'UNCERTAINTY_ASSESS',
        'EVALUATION_CLOSURE',
      ]);
      expect(EVALUATION_STAGE_NAMES).toHaveLength(8);
    });

    it('preserves exact AssertionModality vocabulary', () => {
      expect(ASSERTION_MODALITIES).toEqual(['TEXT', 'VISUAL', 'AUDIO', 'MULTIMODAL']);
    });

    it('preserves exact AssertionExplicitness vocabulary', () => {
      expect(ASSERTION_EXPLICITNESS).toEqual(['EXPLICIT', 'IMPLIED']);
    });
  });

  describe('Case N & Structural Invariants: Pure validation helpers without DB access', () => {
    it('Case N: SUPPORTED_WITH_QUALIFICATION with empty qualification fails structural validation', () => {
      const baseResult: AssertionValidationResultView = {
        result_id: 'res-1',
        assertion_id: 'as-1',
        status: 'SUPPORTED_WITH_QUALIFICATION',
        reason_codes: ['QUALIFIED_BY_SCOPE'],
        required_qualification: '',
        evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'rev-1' },
        proposition_link_ids: [],
        created_at: new Date(),
      };

      // Empty string
      expect(() => validateAssertionValidationResultStructural(baseResult)).toThrowError(
        EvaluationDomainError,
      );
      expect(() => validateAssertionValidationResultStructural(baseResult)).toThrowError(
        /VALIDATION_QUALIFICATION_MISSING/,
      );

      // Whitespace only
      expect(() =>
        validateAssertionValidationResultStructural({ ...baseResult, required_qualification: '   ' }),
      ).toThrowError(/VALIDATION_QUALIFICATION_MISSING/);

      // Null / undefined
      expect(() =>
        validateAssertionValidationResultStructural({ ...baseResult, required_qualification: null }),
      ).toThrowError(/VALIDATION_QUALIFICATION_MISSING/);

      // Non-empty passes
      expect(() =>
        validateAssertionValidationResultStructural({
          ...baseResult,
          required_qualification: 'Valid only for EU market users under 2026 guidelines',
        }),
      ).not.toThrow();
    });



    it('rejects unapproved validation status', () => {
      const invalidStatus = {
        result_id: 'res-3',
        assertion_id: 'as-1',
        status: 'INSUFFICIENT' as any,
        reason_codes: [],
        evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'rev-1' },
        proposition_link_ids: [],
        created_at: new Date(),
      };

      expect(() => validateAssertionValidationResultStructural(invalidStatus)).toThrowError(
        /INVALID_VALIDATION_STATUS/,
      );
    });

    it('validates CompositeImpressionAssessment STABLE_WITH_REQUIREMENTS requires non-empty disclosures', () => {
      const baseComp: CompositeImpressionAssessmentView = {
        assessment_id: 'comp-1',
        candidate_id: 'cand-1',
        input_assertion_ids: [],
        likely_interpretations: ['Product is vegan'],
        implied_assertion_ids: [],
        misleading_risks: [],
        required_disclosures: '',
        status: 'STABLE_WITH_REQUIREMENTS',
        evaluator_revision_ref: { entity_type: 'EvaluatorConfig', stable_id: 'ev-1', revision_id: 'rev-1' },
        created_at: new Date(),
      };

      expect(() => validateCompositeAssessmentStructural(baseComp)).toThrowError(
        /COMPOSITE_REQUIREMENTS_MISSING/,
      );

      expect(() =>
        validateCompositeAssessmentStructural({ ...baseComp, required_disclosures: [] }),
      ).toThrowError(/COMPOSITE_REQUIREMENTS_MISSING/);

      expect(() =>
        validateCompositeAssessmentStructural({
          ...baseComp,
          required_disclosures: ['Must include dietary footnote in visual lower third'],
        }),
      ).not.toThrow();
    });

    it('validates AssertionPropositionLink relation vocabulary', () => {
      const validLink: AssertionPropositionLinkView = {
        link_id: 'link-1',
        assertion_id: 'as-1',
        proposition_id: 'prop-1',
        relation: 'EQUIVALENT',
        mapping_uncertainty: {},
        created_at: new Date(),
      };

      expect(() => validateAssertionPropositionLinkStructural(validLink)).not.toThrow();

      const invalidLink = { ...validLink, relation: 'PARAPHRASE' as any };
      expect(() => validateAssertionPropositionLinkStructural(invalidLink)).toThrowError(
        /INVALID_RELATION_VOCABULARY/,
      );
    });

    it('validates EvalContractRevision completeness', () => {
      const validContract: EvalContractRevisionView = {
        eval_contract_id: 'ec-1',
        eval_contract_revision_id: 'ecr-1',
        component: 'CLAIM_VALIDATION',
        capability: 'FACTUAL_ACCURACY',
        required_dimensions: ['ACCURACY', 'PRECISION'],
        hard_gates: ['NO_CONTRADICTIONS'],
        release_impact: 'BLOCKING',
        created_at: new Date(),
      };

      expect(() => validateEvalContractRevisionStructural(validContract)).not.toThrow();

      expect(() =>
        validateEvalContractRevisionStructural({ ...validContract, component: '' }),
      ).toThrowError(/EVAL_CONTRACT_STRUCTURAL_INVALID/);

      expect(() =>
        validateEvalContractRevisionStructural({ ...validContract, capability: '   ' }),
      ).toThrowError(/EVAL_CONTRACT_STRUCTURAL_INVALID/);

      expect(() =>
        validateEvalContractRevisionStructural({ ...validContract, release_impact: '' }),
      ).toThrowError(/EVAL_CONTRACT_STRUCTURAL_INVALID/);
    });

    it('Regression tests: valid ContentAssertionView structural type instantiation', () => {
      // Type test for regression
      const assertion: ContentAssertionView = {
        assertion_id: 'as-1',
        artifact_ref: { entity_type: 'ContentArtifact', entity_id: 'art-1' },
        modality: 'VISUAL',
        explicitness: 'EXPLICIT',
        interpretation: 'The color of the car is red',
        materiality: 'MATERIAL',
        source_elements: {},
        wording_strength: 'STRONG',
        conditions: {},
        audience_interpretation_context: {},
        created_at: new Date(),
      };
      
      // Prove that content_text and qualifier_text are NOT present in the type
      // Using @ts-expect-error as requested
      // @ts-expect-error
      const _checkContentText = assertion.content_text;
      // @ts-expect-error
      const _checkQualifierText = assertion.qualifier_text;
      
      expectTypeOf(assertion).not.toHaveProperty('content_text');
      expectTypeOf(assertion).not.toHaveProperty('qualifier_text');
      expect(assertion.modality).toBe('VISUAL');
    });

    it('Regression tests: Required fields and Ref strictness', () => {
      type IsRequired<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;

      // AssertionValidationResultView.proposition_link_ids is required
      expectTypeOf<IsRequired<AssertionValidationResultView, 'proposition_link_ids'>>().toEqualTypeOf<true>();
      
      // CompositeImpressionAssessmentView.input_assertion_ids and implied_assertion_ids are required
      expectTypeOf<IsRequired<CompositeImpressionAssessmentView, 'input_assertion_ids'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<CompositeImpressionAssessmentView, 'implied_assertion_ids'>>().toEqualTypeOf<true>();
      
      // UncertaintyAssessmentView.subject_refs is required
      expectTypeOf<IsRequired<import('../../domain/evaluation/index.js').UncertaintyAssessmentView, 'subject_refs'>>().toEqualTypeOf<true>();
      
      // RunConfig normal ref sets are required
      type RunConfigClosure = import('../../domain/evaluation/index.js').EvaluationRunConfigClosure;
      expectTypeOf<IsRequired<RunConfigClosure, 'prompt_revision_refs'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<RunConfigClosure, 'model_config_revision_refs'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<RunConfigClosure, 'tool_config_revision_refs'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<RunConfigClosure, 'schema_revision_refs'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<RunConfigClosure, 'retriever_revision_refs'>>().toEqualTypeOf<true>();
      expectTypeOf<IsRequired<RunConfigClosure, 'evaluator_revision_refs'>>().toEqualTypeOf<true>();

      // Prove exact ref sets
      type AssertMap = import('../../domain/evaluation/index.js').AssertionMapStageInputCore;
      expectTypeOf<AssertMap['available_proposition_refs']>().toEqualTypeOf<readonly ExactEntityRef[]>();
      
      type RiskAssess = import('../../domain/evaluation/index.js').RiskAssessStageInputCore;
      expectTypeOf<RiskAssess['assessment_method_revision']>().toEqualTypeOf<ExactRevisionRef>();

      // Negative type tests: bare string is not assignable to ExactRevisionRef
      // @ts-expect-error
      const _badRevRef: ExactRevisionRef = 'bare-string';

      // Negative type tests: bare string is not assignable to available_proposition_refs
      // @ts-expect-error
      const _badPropRef: AssertMap['available_proposition_refs'] = ['bare-string'];
    });
  });
});
