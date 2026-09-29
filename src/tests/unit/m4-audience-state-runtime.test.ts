import { describe, expect, it } from "vitest";
import {
  DeriveAudienceState,
  type AudienceStageClaimPort,
} from "../../application/content-intelligence/derive-audience-state.js";
import {
  hashAudienceDerivationManifest,
  type AudienceStateView,
} from "../../domain/content/index.js";
import {
  AudienceStatePersistenceService,
  type AudienceStateAtomicCommitPort,
} from "../../persistence/relational/services/audience-state-persistence-service.js";
import {
  hashPreProviderManifestCore,
  hashProviderContext,
  type PreProviderManifestCore,
} from "../../domain/content/pre-provider-manifest-core.js";

const previous: AudienceStateView = {
  audience_state_id: "aud-refined",
  task_revision_id: "task-1",
  state_stage: "REFINED",
  context: {},
  knowledge_state: {},
  problem_state: {},
  solution_state: {},
  product_state: {},
  brand_state: {},
  intent_state: {},
  desired_outcome: {},
  objections: [],
  decision_criteria: [],
  prior_exposure: {},
  origin: [{ kind: "PROPOSITION", reference_id: "prop-1" }],
  uncertainty: [{ kind: "UNKNOWN", description: "Sparse evidence" }],
  created_at: "2026-09-28T00:00:00Z",
};

const pins = {
  prompt_revision_id: "prompt-1",
  model_revision_id: "model-1",
  schema_revision_id: "schema-1",
  tool_revision_ids: ["tool-1"],
};

const preProviderCore: PreProviderManifestCore = {
  tenant_id: "tenant-1",
  workspace_id: "workspace-1",
  run_config_id: "config-1",
  generation_config: { run_config_id: "config-1", ...pins },
  run_config_runtime_parameters_hash: "params-hash-1",
  schema_revision_refs: ["schema-1"],
  provider_context_hash: hashProviderContext({ exact: true }),
  task_id: "task-stable-1",
  task_revision_id: "task-1",
  audience_knowledge_cutoff_time: "2026-09-28T00:30:00.000Z",
  audience_schema_ref: {
    entity_type: "SchemaDefinition",
    stable_id: "audience-schema",
    revision_id: "schema-1",
  },
  audience_schema_payload_hash: "schema-hash-1",
  audience_schema_role_binding: {
    run_config_id: "config-1",
    role: "CONTENT_INTELLIGENCE_AUDIENCE",
    schema_entity_type: "SchemaDefinition",
    schema_stable_id: "audience-schema",
    schema_revision_id: "schema-1",
    schema_object_id: "schema-object-1",
    schema_object_key: "schemas/audience-v1.json",
    schema_payload_hash: "schema-hash-1",
    schema_payload_schema_revision_id: "meta-schema-v1",
  },
  eligible_task_audience_context: [],
  eligible_epistemic_refs: [],
};

const canonicalInputHash = hashPreProviderManifestCore(preProviderCore);

const authority = {
  tenant_id: "tenant-1",
  workspace_id: "workspace-1",
  run_id: "run-1",
  decision_cycle_id: "cycle-1",
  stage_execution_id: "stage-1",
  fencing_token: 2,
  lease_owner: "worker-1",
  cycle_epoch: 1,
  stage_name: "AUDIENCE_FINALIZE" as const,
  idempotency_key: "audience-request-1",
  run_config_id: "config-1",
  canonical_input_hash: canonicalInputHash,
};

const trustedInputsStub = {
  trustedCutoff: "2026-09-28T00:30:00.000Z",
  task: {
    task_id: "task-stable-1",
    task_revision_id: "task-1",
    market: "VN",
    jurisdiction: "VN",
    brand_id: "brand-1",
    product_id: "prod-1",
    audience_context: {},
  },
  runConfig: {
    run_config_id: "config-1",
    ...pins,
  },
  schemaBinding: preProviderCore.audience_schema_role_binding!,
  schemaPayload: {
    schema_ref: preProviderCore.audience_schema_ref,
    payload_hash: "schema-hash-1",
    path_encoding: "JSON_POINTER_V1" as const,
    scalar_serialization: "CANONICAL_JSON_SCALAR_V1" as const,
    classification_rules: [],
    projection_rules: [],
  },
  eligibleTaskAudienceContext: [],
  eligibleEpistemicRefs: [],
  propositions: [],
  epistemicStates: [],
  knowledgeGapRefs: [],
  researchTraceRefs: [],
  preProviderCore,
  canonicalInputHash,
};

describe("M4 audience runtime", () => {
  it("generates before atomic commit and executes strictly: resolve -> trusted -> pins -> claim -> provider -> commit", async () => {
    const order: string[] = [];
    const port: AudienceStateAtomicCommitPort = {
      async commitAudienceState(request) {
        order.push("commit");
        expect(request.governance_refresh?.audience_state_id).toBe("aud-final");
        return request.state;
      },
    };
    const claimPort: AudienceStageClaimPort = {
      async claimStageExecution() {
        order.push("claim");
        return { claimed: true, fencingToken: 3 };
      },
    };
    const service = new DeriveAudienceState(
      {
        async resolveAuthorizedInputs() {
          order.push("resolve");
          return {
            previous_state: previous,
            provider_context: { exact: true },
            material_governance_dependencies_changed: true,
            governance_refresh: {
              governance_snapshot_id: "gov-refresh-1",
              dependency_fingerprint: "deps-2",
            },
          };
        },
      },
      {
        async generateAudienceProposal() {
          order.push("provider");
          const {
            audience_state_id: _id,
            task_revision_id: _task,
            state_stage: _stage,
            created_at: _created,
            ...proposal
          } = previous;
          return { proposal, basis_selections: [] };
        },
      },
      new AudienceStatePersistenceService(port),
      { nextAudienceStateId: () => "aud-final", now: () => new Date("2026-09-28T01:00:00Z") },
      {
        async resolve() {
          order.push("pins");
          return pins;
        },
      },
      {
        async resolveCanonicalInputs() {
          order.push("trusted");
          return trustedInputsStub;
        },
      } as any,
      claimPort,
    );

    const state = await service.execute({
      authority,
      request_identity: "audience-request-1",
      task_revision_id: "task-1",
      target_stage: "FINAL_FOR_DECISION",
      previous_audience_state_id: "aud-refined",
    });
    expect(state.audience_state_id).toBe("aud-final");
    expect(order).toEqual(["resolve", "trusted", "pins", "claim", "provider", "commit"]);
  });

  it("cannot instantiate or execute without claimPort authority (fails closed)", async () => {
    expect(
      () =>
        new DeriveAudienceState(
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          null as any,
        ),
    ).toThrow(/StageExecution claim authority/);
  });

  it("atomic claim rejection halts pipeline before provider invocation (provider calls = 0)", async () => {
    let providerCalls = 0;
    const claimPort: AudienceStageClaimPort = {
      async claimStageExecution() {
        return { claimed: false, reason: "Stage execution lease active on competitor" };
      },
    };
    const service = new DeriveAudienceState(
      {
        async resolveAuthorizedInputs() {
          return {
            previous_state: previous,
            provider_context: { exact: true },
            material_governance_dependencies_changed: false,
          };
        },
      },
      {
        async generateAudienceProposal() {
          providerCalls++;
          return {} as any;
        },
      },
      new AudienceStatePersistenceService({ commitAudienceState: async () => ({} as any) }),
      { nextAudienceStateId: () => "aud-final", now: () => new Date() },
      {
        async resolve() {
          return pins;
        },
      },
      {
        async resolveCanonicalInputs() {
          return trustedInputsStub;
        },
      } as any,
      claimPort,
    );

    await expect(
      service.execute({
        authority,
        request_identity: "audience-request-claim-fail",
        task_revision_id: "task-1",
        target_stage: "FINAL_FOR_DECISION",
        previous_audience_state_id: "aud-refined",
      }),
    ).rejects.toThrow(/Stage execution lease active on competitor/);
    expect(providerCalls).toBe(0);
  });

  it("forged / mismatched generation pins are rejected before claim and before provider", async () => {
    let claimCalls = 0;
    let providerCalls = 0;
    const claimPort: AudienceStageClaimPort = {
      async claimStageExecution() {
        claimCalls++;
        return { claimed: true, fencingToken: 4 };
      },
    };
    const service = new DeriveAudienceState(
      {
        async resolveAuthorizedInputs() {
          return {
            previous_state: previous,
            provider_context: { exact: true },
            material_governance_dependencies_changed: false,
          };
        },
      },
      {
        async generateAudienceProposal() {
          providerCalls++;
          return {} as any;
        },
      },
      new AudienceStatePersistenceService({ commitAudienceState: async () => ({} as any) }),
      { nextAudienceStateId: () => "aud-final", now: () => new Date() },
      {
        async resolve() {
          return {
            ...pins,
            model_revision_id: "forged-model-revision-v99",
          };
        },
      },
      {
        async resolveCanonicalInputs() {
          return trustedInputsStub;
        },
      } as any,
      claimPort,
    );

    await expect(
      service.execute({
        authority,
        request_identity: "audience-request-forged-pins",
        task_revision_id: "task-1",
        target_stage: "FINAL_FOR_DECISION",
        previous_audience_state_id: "aud-refined",
      }),
    ).rejects.toMatchObject({ code: "PINNED_GENERATION_CONFIG_MISMATCH" });

    expect(claimCalls).toBe(0);
    expect(providerCalls).toBe(0);
  });

  it("materially different provider_context produces different canonical_input_hash", () => {
    const hashA = hashPreProviderManifestCore({
      ...preProviderCore,
      provider_context_hash: hashProviderContext({ segment: "tech", locale: "en" }),
    });
    const hashB = hashPreProviderManifestCore({
      ...preProviderCore,
      provider_context_hash: hashProviderContext({ segment: "healthcare", locale: "en" }),
    });
    expect(hashA).not.toBe(hashB);
  });

  it("FINAL_FOR_DECISION persistence requires non-empty audience_admission_hash", async () => {
    const persistence = new AudienceStatePersistenceService({
      async commitAudienceState(request) {
        return request.state;
      },
    });

    const validAuthorityMetadata = {
      audience_knowledge_cutoff_time: "2026-09-28T00:30:00.000Z",
      derivation_manifest: { some: "data" },
      derivation_manifest_hash: "hash-manifest-1",
      schema_binding: preProviderCore.audience_schema_role_binding!,
    };

    // Missing admission hash
    await expect(
      persistence.commit({
        authority,
        request_identity: "req-missing-hash",
        previous_state: previous,
        material_governance_dependencies_changed: false,
        generation_config: pins,
        state: { ...previous, audience_state_id: "aud-final", state_stage: "FINAL_FOR_DECISION" },
        derivation_authority: validAuthorityMetadata,
        fact_basis_links: [],
      }),
    ).rejects.toMatchObject({ code: "AUDIENCE_ADMISSION_HASH_REQUIRED" });

    // Empty string admission hash
    await expect(
      persistence.commit({
        authority,
        request_identity: "req-empty-hash",
        previous_state: previous,
        material_governance_dependencies_changed: false,
        generation_config: pins,
        state: { ...previous, audience_state_id: "aud-final", state_stage: "FINAL_FOR_DECISION" },
        derivation_authority: { ...validAuthorityMetadata, audience_admission_hash: "" },
        audience_admission_hash: "",
        fact_basis_links: [],
      }),
    ).rejects.toMatchObject({ code: "AUDIENCE_ADMISSION_HASH_REQUIRED" });
  });

  it("rejects final admission when changed governance dependencies lack refresh evidence", async () => {
    const persistence = new AudienceStatePersistenceService({
      async commitAudienceState(request) {
        return request.state;
      },
    });
    await expect(
      persistence.commit({
        authority,
        request_identity: "audience-request-2",
        previous_state: previous,
        material_governance_dependencies_changed: true,
        generation_config: pins,
        state: { ...previous, audience_state_id: "aud-final", state_stage: "FINAL_FOR_DECISION" },
      }),
    ).rejects.toThrow(/refresh evidence/);
  });

  it("rejects refinement that reuses the previous immutable identity", async () => {
    const persistence = new AudienceStatePersistenceService({
      async commitAudienceState(request) {
        return request.state;
      },
    });
    await expect(
      persistence.commit({
        authority,
        request_identity: "audience-request-3",
        previous_state: previous,
        material_governance_dependencies_changed: false,
        generation_config: pins,
        state: { ...previous, state_stage: "FINAL_FOR_DECISION" },
      }),
    ).rejects.toThrow(/new immutable ID/);
  });
});
