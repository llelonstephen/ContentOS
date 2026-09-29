import { describe, expect, it } from "vitest";
import {
  hashPreProviderManifestCore,
  hashAudienceDerivationManifest,
  validateAudienceAdmission,
  type AudienceAdmissionInput,
  type AudienceSemanticProjectionRule,
  type AudienceStateView,
  type PreProviderManifestCore,
} from "../../domain/content/index.js";

const audience: AudienceStateView = {
  audience_state_id: "aud-v105",
  task_revision_id: "task-rev-v105",
  state_stage: "FINAL_FOR_DECISION",
  context: {},
  knowledge_state: {},
  problem_state: {},
  solution_state: {},
  product_state: {},
  brand_state: {},
  intent_state: { segment: "engineering-leads" },
  desired_outcome: {},
  objections: [],
  decision_criteria: [],
  prior_exposure: {},
  origin: [{ kind: "PROPOSITION", reference_id: "prop-105" }],
  uncertainty: [],
  created_at: "2026-09-29T12:00:00Z",
};

const rule: AudienceSemanticProjectionRule = {
  rule_id: "intent-rule-105",
  audience_field: "intent_state",
  fact_path_selector: "/segment",
  classification: "FACTUAL_ASSERTION",
  proposition_type: "AUDIENCE",
  canonical_meaning_template: [
    { type: "CONST", value: "Audience segment is " },
    { type: "OPERAND", operand: "FACT_VALUE_CANONICAL" },
  ],
  subject_template: [{ type: "CONST", value: "target audience" }],
  predicate_template: [{ type: "CONST", value: "has segment" }],
  object_template: [{ type: "OPERAND", operand: "FACT_VALUE_CANONICAL" }],
  qualifiers_template: [],
  conditions_template: [],
  population_scope_template: [{ type: "OPERAND", operand: "TASK_MARKET" }],
  jurisdiction_scope_template: [{ type: "OPERAND", operand: "TASK_JURISDICTION" }],
  required_input_refs: ["FACT_VALUE_CANONICAL", "TASK_MARKET", "TASK_JURISDICTION"],
};

const baseCore: PreProviderManifestCore = {
  tenant_id: "tenant-105",
  workspace_id: "workspace-105",
  run_config_id: "config-105",
  task_id: "task-stable-105",
  task_revision_id: "task-rev-v105",
  audience_knowledge_cutoff_time: "2026-09-29T10:00:00.000Z",
  audience_schema_ref: {
    entity_type: "SchemaDefinition",
    stable_id: "audience-schema-105",
    revision_id: "schema-rev-1",
  },
  audience_schema_payload_hash: "schema-hash-105",
  audience_schema_role_binding: {
    run_config_id: "config-105",
    role: "CONTENT_INTELLIGENCE_AUDIENCE",
    schema_entity_type: "SchemaDefinition",
    schema_stable_id: "audience-schema-105",
    schema_revision_id: "schema-rev-1",
    schema_object_id: "obj-105",
    schema_object_key: "schemas/aud-105.json",
    schema_payload_hash: "schema-hash-105",
    schema_payload_schema_revision_id: "meta-schema-1",
  },
  eligible_task_audience_context: [{ path: "/industry", value_hash: "ind-hash-1" }],
  eligible_epistemic_refs: [{ proposition_id: "prop-105", epistemic_state_id: "epi-105" }],
  knowledge_gap_refs: ["gap-1"],
};

function createAdmissionInput(canonicalInputHash: string): AudienceAdmissionInput {
  return {
    audience,
    manifest: (() => {
      const base = {
        tenant_id: baseCore.tenant_id,
        workspace_id: baseCore.workspace_id!,
        run_config_id: baseCore.run_config_id,
        task_id: baseCore.task_id,
        task_revision_id: baseCore.task_revision_id,
        audience_knowledge_cutoff_time: baseCore.audience_knowledge_cutoff_time,
        canonical_input_hash: canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: baseCore.audience_schema_ref,
        audience_schema_payload_hash: baseCore.audience_schema_payload_hash,
        eligible_task_audience_context: baseCore.eligible_task_audience_context,
        eligible_epistemic_refs: baseCore.eligible_epistemic_refs,
      };
      return {
        ...base,
        derivation_manifest_hash: hashAudienceDerivationManifest(base),
      };
    })(),
    schema_role_bindings: [baseCore.audience_schema_role_binding!],
    schema: {
      schema_ref: baseCore.audience_schema_ref,
      payload_hash: baseCore.audience_schema_payload_hash,
      path_encoding: "JSON_POINTER_V1",
      scalar_serialization: "CANONICAL_JSON_SCALAR_V1",
      classification_rules: [],
      projection_rules: [rule],
    },
    task_market: "US",
    task_jurisdiction: "US",
    task_audience_context: { industry: "tech" },
    basis_selections: [
      {
        audience_field: "intent_state",
        fact_path: "/segment",
        ordinal: 0,
        basis_kind: "AUDIENCE_EPISTEMIC_STATE",
        proposition_id: "prop-105",
        epistemic_state_id: "epi-105",
      },
    ],
    propositions: [
      {
        proposition_id: "prop-105",
        proposition_type: "AUDIENCE",
        scope_authorized: true,
        tenant_id: "tenant-105",
        workspace_id: "workspace-105",
        semantic_identity: {
          propositionType: "AUDIENCE",
          canonicalMeaning: 'Audience segment is "engineering-leads"',
          subject: "target audience",
          predicate: "has segment",
          object: '"engineering-leads"',
          qualifiers: "",
          conditions: "",
          populationScope: "US",
          jurisdictionScope: "US",
        },
      },
    ],
    epistemic_states: [
      {
        epistemic_state_id: "epi-105",
        proposition_id: "prop-105",
        support_status: "SUPPORTED",
        known_from: "2026-09-29T09:00:00Z",
        valid_from: "2026-09-29T09:00:00Z",
        valid_at_cutoff: true,
        scope_authorized: true,
        tenant_id: "tenant-105",
        workspace_id: "workspace-105",
      },
    ],
  };
}

describe("SPEC05 v1.0.5 Two-Phase Hash & Manifest Core Closure", () => {
  it("computes deterministic canonical_input_hash strictly from PRE_PROVIDER_MANIFEST_CORE", () => {
    const hash1 = hashPreProviderManifestCore(baseCore);
    const hash2 = hashPreProviderManifestCore({ ...baseCore });
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
    expect(hash1).toHaveLength(64);
  });

  it("changes canonical_input_hash whenever pre-provider material input changes", () => {
    const baseHash = hashPreProviderManifestCore(baseCore);
    const variations: Array<Partial<PreProviderManifestCore>> = [
      { tenant_id: "tenant-other" },
      { task_revision_id: "task-rev-v2" },
      { audience_knowledge_cutoff_time: "2026-09-29T11:00:00.000Z" },
      { audience_schema_payload_hash: "schema-hash-other" },
      { audience_schema_ref: { ...baseCore.audience_schema_ref, revision_id: "schema-rev-2" } },
      {
        eligible_epistemic_refs: [
          ...baseCore.eligible_epistemic_refs,
          { proposition_id: "prop-2", epistemic_state_id: "epi-2" },
        ],
      },
      {
        eligible_task_audience_context: [
          { path: "/industry", value_hash: "ind-hash-changed" },
        ],
      },
      { knowledge_gap_refs: ["gap-2"] },
      { provider_context_hash: "hash-context-other" },
      { run_config_runtime_parameters_hash: "params-hash-other" },
      { schema_revision_refs: ["schema-other-ref"] },
      {
        generation_config: {
          run_config_id: "cfg-001",
          prompt_revision_id: "prompt-v2",
          model_revision_id: "model-v1",
          tool_revision_ids: [],
          schema_revision_id: "schema-aud-v1",
        },
      },
    ];

    for (const variation of variations) {
      const variedHash = hashPreProviderManifestCore({ ...baseCore, ...variation });
      expect(variedHash).not.toBe(baseHash);
    }
  });

  it("computes distinct audience_admission_hash post-provider and binds admission decisions", () => {
    const canonicalInputHash = hashPreProviderManifestCore(baseCore);
    const input = createAdmissionInput(canonicalInputHash);
    const expected = {
      tenant_id: baseCore.tenant_id,
      workspace_id: baseCore.workspace_id!,
      run_config_id: baseCore.run_config_id,
      task_revision_id: baseCore.task_revision_id,
      canonical_input_hash: canonicalInputHash,
    };

    const admitted = validateAudienceAdmission(input, expected);
    expect(admitted.audience_admission_hash).toBeDefined();
    expect(typeof admitted.audience_admission_hash).toBe("string");
    expect(admitted.audience_admission_hash).toHaveLength(64);
    // audience_admission_hash MUST NOT equal canonical_input_hash (§113.2 role separation)
    expect(admitted.audience_admission_hash).not.toBe(canonicalInputHash);
  });

  it("changes audience_admission_hash when generated proposal content changes with same pre-provider input", () => {
    const canonicalInputHash = hashPreProviderManifestCore(baseCore);
    const input1 = createAdmissionInput(canonicalInputHash);
    const expected = {
      tenant_id: baseCore.tenant_id,
      workspace_id: baseCore.workspace_id!,
      run_config_id: baseCore.run_config_id,
      task_revision_id: baseCore.task_revision_id,
      canonical_input_hash: canonicalInputHash,
    };

    const admitted1 = validateAudienceAdmission(input1, expected);

    // Modify generated context (non-factual structural field)
    const input2 = {
      ...input1,
      audience: {
        ...input1.audience,
        context: { notes: "extra provider-generated summary" },
      },
    };
    const admitted2 = validateAudienceAdmission(input2, expected);

    // canonical_input_hash is identical (pre-provider inputs are identical)
    expect(input1.manifest.canonical_input_hash).toBe(input2.manifest.canonical_input_hash);
    // audience_admission_hash must differ because admitted proposal content differs
    expect(admitted1.audience_admission_hash).not.toBe(admitted2.audience_admission_hash);
  });

  it("changes audience_admission_hash when admitted basis link changes", () => {
    const canonicalInputHash = hashPreProviderManifestCore(baseCore);
    const input1 = createAdmissionInput(canonicalInputHash);
    const expected = {
      tenant_id: baseCore.tenant_id,
      workspace_id: baseCore.workspace_id!,
      run_config_id: baseCore.run_config_id,
      task_revision_id: baseCore.task_revision_id,
      canonical_input_hash: canonicalInputHash,
    };

    const admitted1 = validateAudienceAdmission(input1, expected);

    // Admission with different ordinal or path
    const input2 = {
      ...input1,
      basis_selections: [
        {
          ...input1.basis_selections[0]!,
          ordinal: 1,
        },
      ],
    };
    const admitted2 = validateAudienceAdmission(input2, expected);
    expect(admitted1.audience_admission_hash).not.toBe(admitted2.audience_admission_hash);
  });

  it("enforces fail-closed validation when expected canonical_input_hash mismatches", () => {
    const canonicalInputHash = hashPreProviderManifestCore(baseCore);
    const input = createAdmissionInput(canonicalInputHash);
    const tamperedExpected = {
      tenant_id: baseCore.tenant_id,
      workspace_id: baseCore.workspace_id!,
      run_config_id: baseCore.run_config_id,
      task_revision_id: baseCore.task_revision_id,
      canonical_input_hash: "tampered-claim-hash",
    };

    expect(() => validateAudienceAdmission(input, tamperedExpected))
      .toThrow(/AUDIENCE_PROVENANCE_INVALID/);
  });
});
