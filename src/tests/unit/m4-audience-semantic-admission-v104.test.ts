import { describe, expect, it } from 'vitest';
import {
  hashAudienceDerivationManifest,
  validateAudienceAdmission,
  type AudienceAdmissionInput,
  type AudienceSemanticProjectionRule,
  type AudienceStateView,
} from '../../domain/content/index.js';

const audience: AudienceStateView = {
  audience_state_id: 'aud-final', task_revision_id: 'task-rev-1',
  state_stage: 'FINAL_FOR_DECISION', context: {}, knowledge_state: {}, problem_state: {},
  solution_state: {}, product_state: {}, brand_state: {}, intent_state: { segment: 'developers' },
  desired_outcome: {}, objections: [], decision_criteria: [], prior_exposure: {},
  origin: [{ kind: 'PROPOSITION', reference_id: 'prop-1' }], uncertainty: [],
  created_at: '2026-09-29T01:00:00Z',
};

const rule: AudienceSemanticProjectionRule = {
  rule_id: 'intent-segment-v1', audience_field: 'intent_state',
  fact_path_selector: '/segment', classification: 'FACTUAL_ASSERTION',
  proposition_type: 'AUDIENCE',
  canonical_meaning_template: [
    { type: 'CONST', value: 'Audience intent segment is ' },
    { type: 'OPERAND', operand: 'FACT_VALUE_CANONICAL' },
  ],
  subject_template: [{ type: 'CONST', value: 'target audience' }],
  predicate_template: [{ type: 'CONST', value: 'has intent segment' }],
  object_template: [{ type: 'OPERAND', operand: 'FACT_VALUE_CANONICAL' }],
  qualifiers_template: [], conditions_template: [],
  population_scope_template: [{ type: 'OPERAND', operand: 'TASK_MARKET' }],
  jurisdiction_scope_template: [{ type: 'OPERAND', operand: 'TASK_JURISDICTION' }],
  required_input_refs: ['FACT_VALUE_CANONICAL', 'TASK_MARKET', 'TASK_JURISDICTION'],
};

function admissionInput(): AudienceAdmissionInput {
  const manifest = {
    tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_config_id: 'config-1',
    task_id: 'task-1', task_revision_id: 'task-rev-1',
    audience_knowledge_cutoff_time: '2026-09-29T00:00:00.000Z', canonical_input_hash: 'input-hash',
    derivation_manifest_hash: '',
    audience_schema_ref: { entity_type: 'SchemaDefinition', stable_id: 'audience-schema',
      revision_id: 'audience-schema-v1' },
    audience_schema_payload_hash: 'schema-hash', eligible_task_audience_context: [],
    eligible_epistemic_refs: [{ proposition_id: 'prop-1', epistemic_state_id: 'epi-1' }],
  };
  return {
    audience,
    manifest: { ...manifest, derivation_manifest_hash: hashAudienceDerivationManifest(manifest) },
    schema_role_bindings: [{
      run_config_id: 'config-1', role: 'CONTENT_INTELLIGENCE_AUDIENCE',
      schema_entity_type: 'SchemaDefinition', schema_stable_id: 'audience-schema',
      schema_revision_id: 'audience-schema-v1', schema_object_id: 'schema-object-1',
      schema_object_key: 'schemas/audience-v1.json', schema_payload_hash: 'schema-hash',
      schema_payload_schema_revision_id: 'meta-schema-v1',
    }],
    schema: {
      schema_ref: { entity_type: 'SchemaDefinition', stable_id: 'audience-schema',
        revision_id: 'audience-schema-v1' },
      payload_hash: 'schema-hash', path_encoding: 'JSON_POINTER_V1',
      scalar_serialization: 'CANONICAL_JSON_SCALAR_V1', classification_rules: [],
      projection_rules: [rule],
    },
    task_market: 'VN', task_jurisdiction: 'VN', task_audience_context: {},
    basis_selections: [{
      audience_field: 'intent_state', fact_path: '/segment', ordinal: 0,
      basis_kind: 'AUDIENCE_EPISTEMIC_STATE', proposition_id: 'prop-1',
      epistemic_state_id: 'epi-1',
    }],
    propositions: [{
      proposition_id: 'prop-1', proposition_type: 'AUDIENCE', scope_authorized: true,
      semantic_identity: {
        propositionType: 'AUDIENCE',
        canonicalMeaning: 'Audience intent segment is "developers"',
        subject: 'target audience', predicate: 'has intent segment', object: '"developers"',
        qualifiers: '', conditions: '', populationScope: 'VN', jurisdictionScope: 'VN',
      },
    }],
    epistemic_states: [{
      epistemic_state_id: 'epi-1', proposition_id: 'prop-1', support_status: 'SUPPORTED',
      known_from: '2026-09-28T23:00:00Z', valid_at_cutoff: true, scope_authorized: true,
    }],
  };
}

const expected = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_config_id: 'config-1',
  task_revision_id: 'task-rev-1', canonical_input_hash: 'input-hash',
};

describe('SPEC05 v1.0.4 Audience semantic admission', () => {
  it('admits exact supported semantic reuse through the role-bound pinned schema', () => {
    const admitted = validateAudienceAdmission(admissionInput(), expected);
    expect(admitted.fact_basis_links).toHaveLength(1);
    expect(admitted.fact_basis_links[0]).toMatchObject({
      basis_kind: 'AUDIENCE_EPISTEMIC_STATE', proposition_id: 'prop-1',
      epistemic_state_id: 'epi-1', fact_path: '/segment',
    });
  });

  it('rejects a semantically unrelated SUPPORTED Proposition', () => {
    const input = admissionInput();
    const propositions = [{
      ...input.propositions[0]!,
      semantic_identity: { ...input.propositions[0]!.semantic_identity, object: '"executives"' },
    }];
    expect(() => validateAudienceAdmission({ ...input, propositions }, expected))
      .toThrow(/AUDIENCE_FACT_SEMANTIC_MISMATCH/);
  });

  it('rejects future-known epistemic state and missing projection authority', () => {
    const input = admissionInput();
    expect(() => validateAudienceAdmission({
      ...input,
      epistemic_states: [{ ...input.epistemic_states[0]!, known_from: '2026-09-29T00:00:01Z' }],
    }, expected)).toThrow(/AUDIENCE_BASIS_REF_INVALID/);
    expect(() => validateAudienceAdmission({
      ...input, schema: { ...input.schema, projection_rules: [] },
    }, expected)).toThrow(/AUDIENCE_SEMANTIC_PROJECTION_MISSING/);
  });

  it('rejects zero/multiple or unpinned Audience role bindings', () => {
    const input = admissionInput();
    expect(() => validateAudienceAdmission({ ...input, schema_role_bindings: [] }, expected))
      .toThrow(/AUDIENCE_SCHEMA_ROLE_BINDING_INVALID/);
    expect(() => validateAudienceAdmission({
      ...input,
      schema_role_bindings: [input.schema_role_bindings[0]!, input.schema_role_bindings[0]!],
    }, expected)).toThrow(/AUDIENCE_SCHEMA_ROLE_BINDING_INVALID/);
    expect(() => validateAudienceAdmission({
      ...input,
      schema_role_bindings: [{ ...input.schema_role_bindings[0]!, schema_payload_hash: 'wrong-hash' }],
    }, expected)).toThrow(/AUDIENCE_SCHEMA_ROLE_BINDING_INVALID/);
  });

  it('allows exact path-bound unresolved uncertainty instead of confident basis', () => {
    const input = admissionInput();
    const uncertainAudience = {
      ...input.audience,
      uncertainty: [{
        kind: 'UNCERTAIN_INTENT', description: 'Segment remains unknown',
        audience_field: 'intent_state' as const, fact_path: '/segment', status: 'UNRESOLVED' as const,
      }],
    };
    const admitted = validateAudienceAdmission({
      ...input, audience: uncertainAudience, basis_selections: [],
      schema: { ...input.schema, projection_rules: [] },
    }, expected);
    expect(admitted.fact_basis_links).toEqual([]);
  });

  it('rejects unsupported certainty and provider-authored semantic override fields', () => {
    const input = admissionInput();
    expect(() => validateAudienceAdmission({ ...input, basis_selections: [] }, expected))
      .toThrow(/AUDIENCE_FACT_UNGROUNDED/);
    const overridden = {
      ...input.basis_selections[0]!,
      semantic_identity: input.propositions[0]!.semantic_identity,
    } as typeof input.basis_selections[number];
    expect(() => validateAudienceAdmission({ ...input, basis_selections: [overridden] }, expected))
      .toThrow(/AUDIENCE_PROVENANCE_INVALID/);
  });

  it('rejects ambiguous projection selectors and missing required projection input', () => {
    const input = admissionInput();
    expect(() => validateAudienceAdmission({
      ...input, schema: { ...input.schema, projection_rules: [rule, { ...rule, rule_id: 'other' }] },
    }, expected)).toThrow(/AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS/);
    const missingTaskInput = {
      ...rule, rule_id: 'task-input',
      conditions_template: [{ type: 'TASK_AUDIENCE_CONTEXT' as const, path: '/missing' }],
      required_input_refs: [...rule.required_input_refs, 'TASK_AUDIENCE_CONTEXT:/missing'],
    };
    expect(() => validateAudienceAdmission({
      ...input, schema: { ...input.schema, projection_rules: [missingTaskInput] },
    }, expected)).toThrow(/AUDIENCE_SEMANTIC_PROJECTION_INVALID/);
  });

  it('rejects REVIEW_REQUIRED and material population, jurisdiction, qualifier, subject, or object mismatch', () => {
    const input = admissionInput();
    const identity = input.propositions[0]!.semantic_identity;
    const mismatches = [
      { canonicalMeaning: 'Different wording' },
      { populationScope: 'US' }, { jurisdictionScope: 'US' }, { qualifiers: 'qualified' },
      { subject: 'another audience' }, { object: '"executives"' },
    ];
    for (const mismatch of mismatches) {
      expect(() => validateAudienceAdmission({
        ...input,
        propositions: [{ ...input.propositions[0]!, semantic_identity: { ...identity, ...mismatch } }],
      }, expected)).toThrow(/AUDIENCE_FACT_SEMANTIC_MISMATCH/);
    }
  });

  it('admits exact Task audience-context basis and rejects wrong path/value', () => {
    const input = admissionInput();
    const taskContext = { segment: 'developers' };
    const valueHash = 'd5d3f663ca304d59e3e198ec1e9ad5e710830b06d7d507a01d18e793ea0bb43a';
    const manifestBase = {
      ...input.manifest, eligible_epistemic_refs: [],
      eligible_task_audience_context: [{ path: '/segment', value_hash: valueHash }],
      derivation_manifest_hash: '',
    };
    const manifest = { ...manifestBase,
      derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase) };
    const taskInput = {
      ...input, manifest, task_audience_context: taskContext, propositions: [], epistemic_states: [],
      basis_selections: [{ audience_field: 'intent_state' as const, fact_path: '/segment', ordinal: 0,
        basis_kind: 'TASK_AUDIENCE_CONTEXT' as const, task_audience_context_path: '/segment' }],
    };
    expect(validateAudienceAdmission(taskInput, expected).fact_basis_links[0])
      .toMatchObject({ basis_kind: 'TASK_AUDIENCE_CONTEXT', task_revision_id: 'task-rev-1' });
    expect(() => validateAudienceAdmission({
      ...taskInput,
      basis_selections: [{ ...taskInput.basis_selections[0]!, task_audience_context_path: '/wrong' }],
    }, expected)).toThrow(/AUDIENCE_BASIS_REF_INVALID/);
  });

  it('does not let free text or sibling-path uncertainty cover a factual leaf', () => {
    const input = admissionInput();
    expect(() => validateAudienceAdmission({
      ...input, basis_selections: [],
      audience: { ...input.audience, uncertainty: [{ kind: 'UNKNOWN', description: 'free text only' }] },
    }, expected)).toThrow(/AUDIENCE_FACT_UNGROUNDED/);
    expect(() => validateAudienceAdmission({
      ...input, basis_selections: [],
      audience: { ...input.audience, uncertainty: [{ kind: 'UNKNOWN', description: 'wrong leaf',
        audience_field: 'intent_state', fact_path: '/sibling', status: 'UNRESOLVED' }] },
    }, expected)).toThrow(/AUDIENCE_UNCERTAINTY_COVERAGE_INVALID/);
  });

  it('allows STRUCTURAL_NON_FACTUAL only through the pinned schema classification', () => {
    const input = admissionInput();
    const admitted = validateAudienceAdmission({
      ...input, basis_selections: [],
      schema: { ...input.schema, projection_rules: [], classification_rules: [{
        audience_field: 'intent_state', fact_path_selector: '/segment',
        classification: 'STRUCTURAL_NON_FACTUAL',
      }] },
    }, expected);
    expect(admitted.fact_basis_links).toEqual([]);
  });

  it('changes manifest identity when schema binding, payload/projection, basis, cutoff, or scope changes', () => {
    const base = admissionInput().manifest;
    const mutations = [
      { audience_schema_ref: { ...base.audience_schema_ref, revision_id: 'v2' } },
      { audience_schema_payload_hash: 'other-payload' },
      { eligible_epistemic_refs: [{ proposition_id: 'prop-2', epistemic_state_id: 'epi-2' }] },
      { audience_knowledge_cutoff_time: '2026-09-29T00:00:01.000Z' },
      { tenant_id: 'tenant-2' },
    ];
    for (const mutation of mutations) {
      expect(hashAudienceDerivationManifest({ ...base, ...mutation }))
        .not.toBe(base.derivation_manifest_hash);
    }
  });
});
