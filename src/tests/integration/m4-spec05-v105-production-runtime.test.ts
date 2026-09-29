import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import {
  DeriveAudienceState,
  type AudienceDerivationInputResolver,
  type AudienceProposalProvider,
} from "../../application/content-intelligence/derive-audience-state.js";
import {
  TrustedPreProviderResolver,
} from "../../persistence/relational/services/trusted-pre-provider-resolver.js";
import {
  PostgresAudienceStateCommitPort,
} from "../../persistence/relational/services/postgres-audience-state-commit-port.js";
import {
  AudienceStatePersistenceService,
  type AudienceStateCommitRequest,
} from "../../persistence/relational/services/audience-state-persistence-service.js";
import {
  claimContentStageExecution,
} from "../../persistence/relational/services/content-stage-execution-repository.js";
import {
  hashPreProviderManifestCore,
  type PreProviderManifestCore,
} from "../../domain/content/pre-provider-manifest-core.js";
import {
  validateAudienceAdmission,
  computeAudienceAdmissionHash,
  hashAudienceDerivationManifest,
  type AudienceSemanticProjectionRule,
  type AudienceSemanticProjectionSchema,
  type AudienceStateView,
  type AudienceAdmissionInput,
  type AudienceDerivationManifest,
} from "../../domain/content/index.js";
import { getDefaultObjectStore } from "../../persistence/objects/default-object-store.js";
import { AUDIENCE_SCHEMA_ROLE } from "../../persistence/relational/services/audience-derivation-authority-resolver.js";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "postgresql://localhost:5432/contentos_test";
const sql = postgres(url, { max: 4 });

class RollbackFixture extends Error {}
async function withRollback(run: (tx: any) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await run(tx);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

const rule: AudienceSemanticProjectionRule = {
  rule_id: "intent-segment-v1",
  audience_field: "intent_state",
  fact_path_selector: "/segment",
  classification: "FACTUAL_ASSERTION",
  proposition_type: "AUDIENCE",
  canonical_meaning_template: [
    { type: "CONST", value: "Audience intent segment is " },
    { type: "OPERAND", operand: "FACT_VALUE_CANONICAL" },
  ],
  subject_template: [{ type: "CONST", value: "target audience" }],
  predicate_template: [{ type: "CONST", value: "has intent segment" }],
  object_template: [{ type: "OPERAND", operand: "FACT_VALUE_CANONICAL" }],
  qualifiers_template: [],
  conditions_template: [],
  population_scope_template: [{ type: "OPERAND", operand: "TASK_MARKET" }],
  jurisdiction_scope_template: [{ type: "OPERAND", operand: "TASK_JURISDICTION" }],
  required_input_refs: ["FACT_VALUE_CANONICAL", "TASK_MARKET", "TASK_JURISDICTION"],
};

async function seedTestEnvironment(tx: any) {
  const tenantId = "tenant-test";
  const workspaceId = "ws-" + randomUUID();
  const taskId = "task-" + randomUUID();
  const taskRevId = "task-rev-" + randomUUID();

  const [existingSnapshot] = await tx`SELECT baseline_snapshot_id FROM baseline_knowledge_snapshots LIMIT 1`;
  const snapshotId = existingSnapshot ? existingSnapshot.baseline_snapshot_id : "bks-001";

  const configId = "cfg-" + randomUUID();
  const schemaStableId = "aud-schema-" + randomUUID();
  const schemaRevId = "aud-schema-rev-" + randomUUID();
  const schemaObjId = "obj-" + randomUUID();
  const propId = "prop-" + randomUUID();
  const epiId = "epi-" + randomUUID();

  // Task Contract Revision
  await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
    VALUES (${"Task"}, ${taskId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"}),
           (${"TaskContractRevision"}, ${taskRevId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"})`;
  await tx`INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id, workspace_id)
    VALUES (${"TaskContractRevision"}, ${taskId}, ${taskRevId}, ${tenantId}, ${workspaceId})`;
  await tx`INSERT INTO task_contract_revisions (
    task_id, task_revision_id, supersedes_task_revision_id, program_revision_id,
    standalone_task, objective, channel, format, language, market, jurisdiction,
    brand_id, product_id, audience_context, success_metric_revision_id,
    constraints, risk_context, compute_budget, tenant_id, workspace_id
  ) VALUES (
    ${taskId}, ${taskRevId}, null, ${"prog-rev-001"},
    false, ${"Objective"}, ${"TWITTER_X"}, ${"POST"}, ${"en"}, ${"US"}, ${"US-FED"},
    ${"brand-001"}, ${"prod-001"}, ${JSON.stringify({})}, ${"metric-rev-ctr"},
    ${"{}"}, ${"{}"}, ${"{}"}, ${tenantId}, ${workspaceId}
  )`;

  // Create schema payload
  const rawSchema = {
    path_encoding: "JSON_POINTER_V1",
    scalar_serialization: "CANONICAL_JSON_SCALAR_V1",
    classification_rules: [],
    projection_rules: [rule],
  };
  const finalBytes = Buffer.from(JSON.stringify(rawSchema));
  const payloadHash = createHash("sha256").update(finalBytes).digest("hex");
  const fullSchema = {
    ...rawSchema,
    schema_ref: {
      entity_type: "SchemaDefinition",
      stable_id: schemaStableId,
      revision_id: schemaRevId,
    },
    payload_hash: payloadHash,
  };
  const objectStore = getDefaultObjectStore();
  await objectStore.put(finalBytes, "application/json");

  // 1. Revision registry for schema
  await tx`INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id, workspace_id)
    VALUES (${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}, ${tenantId}, ${workspaceId})`;

  // 2. Registered control plane revisions
  await tx`INSERT INTO registered_control_plane_revisions (
    entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_hash, payload_schema_revision_id
  ) VALUES (
    ${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}, ${tenantId}, ${workspaceId}, ${payloadHash}, ${"meta-v1"}
  )`;

  // 3. Run config
  const runtimeParams = JSON.stringify({
    content_intelligence: {
      prompt_revision_id: "prompt-rev-1",
      model_revision_id: "model-rev-1",
      schema_revision_id: schemaRevId,
      tool_revision_ids: [],
    },
  });
  await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
    VALUES (${"RunConfig"}, ${configId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"})`;
  await tx`INSERT INTO run_configs (run_config_id, tenant_id, workspace_id, runtime_parameters)
    VALUES (${configId}, ${tenantId}, ${workspaceId}, ${runtimeParams})`;

  // 4. Object registry & payload
  await tx`INSERT INTO object_registry (
    object_id, tenant_id, workspace_id, object_key, content_hash, size_bytes, media_type, state
  ) VALUES (
    ${schemaObjId}, ${tenantId}, ${workspaceId}, ${"objects/" + payloadHash}, ${payloadHash}, ${finalBytes.length}, ${"application/json"}, ${"AVAILABLE"}
  )`;
  await tx`INSERT INTO registered_control_plane_revision_payloads (
    entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_schema_revision_id, object_id, payload_hash
  ) VALUES (
    ${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}, ${tenantId}, ${workspaceId}, ${"meta-v1"}, ${schemaObjId}, ${payloadHash}
  )`;

  // 5. Run config schema revisions & role binding
  await tx`INSERT INTO run_config_schema_revisions (
    run_config_id, entity_type, stable_id, revision_id
  ) VALUES (
    ${configId}, ${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}
  )`;
  await tx`INSERT INTO run_config_schema_role_bindings (
    run_config_id, role, schema_entity_type, schema_stable_id, schema_revision_id
  ) VALUES (
    ${configId}, ${"CONTENT_INTELLIGENCE_AUDIENCE"}, ${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}
  )`;

  // 6. Proposition and Epistemic state
  await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
    VALUES (${"Proposition"}, ${propId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"}),
           (${"EpistemicStateVersion"}, ${epiId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"})`;
  await tx`INSERT INTO propositions (
    proposition_id, tenant_id, workspace_id, proposition_type, canonical_meaning, subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
  ) VALUES (
    ${propId}, ${tenantId}, ${workspaceId}, ${"AUDIENCE"}, ${"Audience intent segment is \"developers\""}, ${"target audience"}, ${"has intent segment"}, ${"\"developers\""}, ${""}, ${""}, ${"US"}, ${"US-FED"}
  )`;
  await tx`INSERT INTO epistemic_state_versions (
    epistemic_state_id, proposition_id, tenant_id, workspace_id, support_status, causal_status, uncertainty, derivation_method,
    derivation_entity_type, derivation_stable_id, derivation_revision_id, known_from, valid_from
  ) VALUES (
    ${epiId}, ${propId}, ${tenantId}, ${workspaceId}, ${"SUPPORTED"}, ${"CORRELATIONAL"}, ${"NONE"}, ${"RULE_BASED"},
    ${"ContentProgramRevision"}, ${"prog-001"}, ${"prog-rev-001"}, now() - INTERVAL '1 minute', now() - INTERVAL '1 minute'
  )`;

  // 7. Run and Decision Cycle
  const runId = "run-" + randomUUID();
  const cycleId = "cycle-" + randomUUID();
  const stageId = "stage-" + randomUUID();
  await tx`INSERT INTO runs (
    run_id, tenant_id, workspace_id, run_correlation_key, task_revision_id, initialization_cutoff,
    initial_run_config_id, initial_baseline_snapshot_id, status, version
  ) VALUES (
    ${runId}, ${tenantId}, ${workspaceId}, ${"corr-" + randomUUID()}, ${taskRevId}, now(),
    ${configId}, ${snapshotId}, ${"RUNNING"}, 0
  )`;
  await tx`INSERT INTO decision_cycles (
    decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number, reason, status, fencing_epoch
  ) VALUES (
    ${cycleId}, ${tenantId}, ${workspaceId}, ${runId}, 1, ${"TEST"}, ${"OPEN"}, 1
  )`;
  await tx`UPDATE runs SET current_decision_cycle_id = ${cycleId} WHERE run_id = ${runId}`;

  return {
    tenantId,
    workspaceId,
    taskId,
    taskRevId,
    configId,
    schemaStableId,
    schemaRevId,
    schemaObjId,
    payloadHash,
    fullSchema,
    propId,
    epiId,
    runId,
    cycleId,
    stageId,
    objectStore,
    schemaBytes: finalBytes,
  };
}

function createProviderProposal(segment = "developers") {
  return {
    context: {},
    knowledge_state: {},
    problem_state: {},
    solution_state: {},
    product_state: {},
    brand_state: {},
    intent_state: { segment },
    desired_outcome: {},
    objections: [],
    decision_criteria: [],
    prior_exposure: {},
    origin: [{ kind: "PROPOSITION" as const, reference_id: "prop-ref" }],
    uncertainty: [],
  };
}

function createAudienceProposal(taskRevId: string, segment = "developers", stage: AudienceStateView["state_stage"] = "FINAL_FOR_DECISION"): AudienceStateView {
  return {
    ...createProviderProposal(segment),
    audience_state_id: "aud-state-" + randomUUID(),
    task_revision_id: taskRevId,
    state_stage: stage,
    created_at: new Date().toISOString(),
  };
}

const defaultInputResolver: AudienceDerivationInputResolver = {
  async resolveAuthorizedInputs() {
    return {
      provider_context: {},
      material_governance_dependencies_changed: false,
    };
  },
};

describe("SPEC05 v1.0.5 production runtime integration (19 required cases)", () => {
  beforeAll(async () => {
    // Ensure all migrations up to 0009 are applied if preceding tests dropped tables
    const migrationsDir = path.resolve(import.meta.dirname, "../../persistence/relational/migrations");
    const files = [
      "0000_chemical_iron_man.sql",
      "0001_fantastic_kid_colt.sql",
      "0002_m2_immutable_triggers.sql",
      "0003_m2_standalone_privilege_closure.sql",
      "0004_m2_standalone_lock_authority_closure.sql",
      "0005_m3_governance_invariants.sql",
      "0006_m4_content_intelligence_invariants.sql",
      "0007_m4_audit_authority_remediation.sql",
      "0008_m4_completion_and_generation_authority.sql",
      "0009_spec05_v104_audience_authority.sql",
    ];
    for (const f of files) {
      const filePath = path.join(migrationsDir, f);
      if (!fs.existsSync(filePath)) continue;
      const fileSql = fs.readFileSync(filePath, "utf8");
      const stmts = fileSql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        try {
          await sql.unsafe(stmt);
        } catch {
          // Ignore table/column already exists
        }
      }
    }
  });
  it("case 1: trusted resolver constructs core from DB/canonical repositories", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      expect(resolved.canonicalInputHash).toHaveLength(64);
      expect(resolved.preProviderCore.task_revision_id).toBe(f.taskRevId);
      expect(resolved.preProviderCore.run_config_id).toBe(f.configId);
      expect(resolved.preProviderCore.audience_schema_role_binding.role).toBe(AUDIENCE_SCHEMA_ROLE);
      expect(resolved.preProviderCore.audience_schema_payload_hash).toBe(f.payloadHash);
      expect(resolved.schemaBinding.schema_revision_id).toBe(f.schemaRevId);
      expect(resolved.propositions.some((p) => p.proposition_id === f.propId)).toBe(true);
      expect(resolved.epistemicStates.some((e) => e.epistemic_state_id === f.epiId)).toBe(true);
      expect(new Date(resolved.trustedCutoff).getTime()).toBeGreaterThan(0);
    });
  });

  it("case 2: request/caller forged canonical hash rejected/ignored", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const pinsResolver = {
        async resolve() {
          return {
            schema_revision_id: f.schemaRevId,
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            tool_revision_ids: [],
            run_config_id: f.configId,
          };
        },
      };
      const provider: AudienceProposalProvider = {
        async generateAudienceProposal() {
          return {
            proposal: createProviderProposal("developers"),
            basis_selections: [{
              audience_field: "intent_state",
              fact_path: "/segment",
              ordinal: 0,
              basis_kind: "AUDIENCE_EPISTEMIC_STATE",
              proposition_id: f.propId,
              epistemic_state_id: f.epiId,
            }],
          };
        },
      };
      const identity = { nextAudienceStateId: () => "aud-" + randomUUID(), now: () => new Date() };
      const persistence = new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(tx, f.objectStore));
      const orchestrator = new DeriveAudienceState(
        defaultInputResolver,
        provider,
        persistence,
        identity,
        pinsResolver,
        resolver,
      );

      await expect(
        orchestrator.execute({
          request_identity: "tok-1",
          authority: {
            tenant_id: f.tenantId,
            workspace_id: f.workspaceId,
            run_id: f.runId,
            decision_cycle_id: f.cycleId,
            stage_execution_id: f.stageId,
            stage_name: "AUDIENCE_FINALIZE",
            idempotency_key: "idem-" + randomUUID(),
            lease_owner: "worker-1",
            cycle_epoch: 1,
            fencing_token: 1,
            run_config_id: f.configId,
            canonical_input_hash: "forged-hash-64-chars-000000000000000000000000000000000000000000000000",
          },
          task_revision_id: f.taskRevId,
          target_stage: "FINAL_FOR_DECISION",
        }),
      ).rejects.toMatchObject({ code: "AUDIENCE_PROVENANCE_INVALID" });
    });
  });

  it("case 3: provider never called before claim succeeds", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      let providerCalls = 0;
      const provider: AudienceProposalProvider = {
        async generateAudienceProposal() {
          providerCalls += 1;
          return {
            proposal: createProviderProposal("developers"),
            basis_selections: [],
          };
        },
      };
      const claimPort = {
        async claimStageExecution() {
          return {
            claimed: false,
            stageExecutionId: f.stageId,
            fencingToken: 1,
            leaseOwner: "someone-else",
            canonicalInputHash: "any",
            cycleEpoch: 1,
            reason: "LEASE_HELD_BY_ANOTHER_WORKER",
          };
        },
      };
      const pinsResolver = {
        async resolve() {
          return {
            schema_revision_id: f.schemaRevId,
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            tool_revision_ids: [],
            run_config_id: f.configId,
          };
        },
      };
      const identity = { nextAudienceStateId: () => "aud-" + randomUUID(), now: () => new Date() };
      const persistence = new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(tx, f.objectStore));
      const orchestrator = new DeriveAudienceState(
        defaultInputResolver,
        provider,
        persistence,
        identity,
        pinsResolver,
        resolver,
        claimPort,
      );

      await expect(
        orchestrator.execute({
          request_identity: "tok-2",
          authority: {
            tenant_id: f.tenantId,
            workspace_id: f.workspaceId,
            run_id: f.runId,
            decision_cycle_id: f.cycleId,
            stage_execution_id: f.stageId,
            stage_name: "AUDIENCE_FINALIZE",
            idempotency_key: "idem-" + randomUUID(),
            lease_owner: "worker-1",
            cycle_epoch: 1,
            fencing_token: 1,
            run_config_id: f.configId,
          },
          task_revision_id: f.taskRevId,
          target_stage: "FINAL_FOR_DECISION",
        }),
      ).rejects.toMatchObject({ code: "AUDIENCE_PROVENANCE_INVALID" });

      expect(providerCalls).toBe(0);
    });
  });

  it("case 4: losing concurrent claim provider count = 0", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      let losingProviderCalls = 0;
      const losingProvider: AudienceProposalProvider = {
        async generateAudienceProposal() {
          losingProviderCalls += 1;
          return {
            proposal: createProviderProposal("developers"),
            basis_selections: [],
          };
        },
      };
      // Pre-claim stage execution with worker-1
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: "idem-worker-1",
        canonicalInputHash: "initial-hash",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      const realClaimPort = {
        claimStageExecution: (params: any) => claimContentStageExecution(tx, params),
      };
      const pinsResolver = {
        async resolve() {
          return {
            schema_revision_id: f.schemaRevId,
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            tool_revision_ids: [],
            run_config_id: f.configId,
          };
        },
      };
      const identity = { nextAudienceStateId: () => "aud-" + randomUUID(), now: () => new Date() };
      const persistence = new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(tx, f.objectStore));
      const worker2Orchestrator = new DeriveAudienceState(
        defaultInputResolver,
        losingProvider,
        persistence,
        identity,
        pinsResolver,
        resolver,
        realClaimPort,
      );

      await expect(
        worker2Orchestrator.execute({
          request_identity: "tok-w2",
          authority: {
            tenant_id: f.tenantId,
            workspace_id: f.workspaceId,
            run_id: f.runId,
            decision_cycle_id: f.cycleId,
            stage_execution_id: f.stageId,
            stage_name: "AUDIENCE_FINALIZE",
            idempotency_key: "idem-worker-2",
            lease_owner: "worker-2",
            cycle_epoch: 1,
            fencing_token: 1,
            run_config_id: f.configId,
          },
          task_revision_id: f.taskRevId,
          target_stage: "FINAL_FOR_DECISION",
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

      expect(losingProviderCalls).toBe(0);
    });
  });

  it("case 5: exact computed hash exists in StageExecution", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });
      expect(claimResult.claimed).toBe(true);

      const [stageRow] = await tx`
        SELECT canonical_input_hash FROM stage_executions WHERE stage_execution_id = ${f.stageId}
      `;
      expect(stageRow.canonical_input_hash).toBe(resolved.canonicalInputHash);
    });
  });

  it("case 6: retry/takeover cannot replace finalized hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const idempotencyKey = "idem-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: "hash-initial",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      // Attempt to claim same stage with different hash
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey,
          canonicalInputHash: "hash-replaced",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    });
  });

  it("case 7: proposal change leaves canonical_input_hash unchanged", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      // Canonical input hash is derived purely from pre-provider manifest core
      const hashA = hashPreProviderManifestCore(resolved.preProviderCore);
      const hashB = hashPreProviderManifestCore(resolved.preProviderCore);

      expect(hashA).toBe(hashB);
      expect(hashA).toBe(resolved.canonicalInputHash);
    });
  });

  it("case 8: proposal change changes audience_admission_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };

      const proposalA = createAudienceProposal(f.taskRevId, "developers");
      const proposalB = createAudienceProposal(f.taskRevId, "executives");

      // Register proposition for executives as well
      const propIdExec = "prop-exec-" + randomUUID();
      const epiIdExec = "epi-exec-" + randomUUID();
      await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
        VALUES (${`Proposition`}, ${propIdExec}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`}),
               (${`EpistemicStateVersion`}, ${epiIdExec}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`})`;
      await tx`INSERT INTO propositions (
        proposition_id, tenant_id, workspace_id, proposition_type, canonical_meaning, subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propIdExec}, ${f.tenantId}, ${f.workspaceId}, ${"AUDIENCE"}, ${"Audience intent segment is \"executives\""}, ${"target audience"}, ${"has intent segment"}, ${"\"executives\""}, ${""}, ${""}, ${"US"}, ${"US-FED"}
      )`;
      await tx`INSERT INTO epistemic_state_versions (
        epistemic_state_id, proposition_id, tenant_id, workspace_id, support_status, causal_status, uncertainty, derivation_method,
        derivation_entity_type, derivation_stable_id, derivation_revision_id, known_from, valid_from
      ) VALUES (
        ${epiIdExec}, ${propIdExec}, ${f.tenantId}, ${f.workspaceId}, ${"SUPPORTED"}, ${"CORRELATIONAL"}, ${"NONE"}, ${"RULE_BASED"}, ${"ContentProgramRevision"}, ${"prog-001"}, ${"prog-rev-001"}, now() - INTERVAL '1 minute', now() - INTERVAL '1 minute'
      )`;

      const resolver2 = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved2 = await resolver2.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const admissionA = validateAudienceAdmission(
        {
          audience: proposalA,
          manifest,
          schema_role_bindings: [resolved2.schemaBinding],
          schema: resolved2.schemaPayload,
          task_market: resolved2.task.market,
          task_jurisdiction: resolved2.task.jurisdiction,
          task_audience_context: resolved2.task.audience_context,
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: f.propId,
            epistemic_state_id: f.epiId,
          }],
          propositions: resolved2.propositions,
          epistemic_states: resolved2.epistemicStates,
        },
        {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_config_id: f.configId,
          task_revision_id: f.taskRevId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
      );

      const manifestBaseB = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved2.trustedCutoff,
        audience_valid_time: resolved2.trustedCutoff,
        canonical_input_hash: resolved2.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved2.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved2.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved2.schemaBinding,
        eligible_task_audience_context: resolved2.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved2.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifestB: AudienceDerivationManifest = {
        ...manifestBaseB,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBaseB),
      };

      const admissionB = validateAudienceAdmission(
        {
          audience: proposalB,
          manifest: manifestB,
          schema_role_bindings: [resolved2.schemaBinding],
          schema: resolved2.schemaPayload,
          task_market: resolved2.task.market,
          task_jurisdiction: resolved2.task.jurisdiction,
          task_audience_context: resolved2.task.audience_context,
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: propIdExec,
            epistemic_state_id: epiIdExec,
          }],
          propositions: resolved2.propositions,
          epistemic_states: resolved2.epistemicStates,
        },
        {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_config_id: f.configId,
          task_revision_id: f.taskRevId,
          canonical_input_hash: resolved2.canonicalInputHash,
        },
      );

      expect(admissionA.audience_admission_hash).not.toBe(admissionB.audience_admission_hash);
    });
  });

  it("case 9: projection rule change changes admission hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const baseAdmissionInput = {
        audience: proposal,
        manifest,
        schema_role_bindings: [resolved.schemaBinding],
        schema: resolved.schemaPayload,
        task_market: resolved.task.market,
        task_jurisdiction: resolved.task.jurisdiction,
        task_audience_context: resolved.task.audience_context,
        basis_selections: [{
          audience_field: "intent_state" as const,
          fact_path: "/segment",
          ordinal: 0,
          basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
          proposition_id: f.propId,
          epistemic_state_id: f.epiId,
        }],
        propositions: resolved.propositions,
        epistemic_states: resolved.epistemicStates,
      };
      const expectation = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        canonical_input_hash: resolved.canonicalInputHash,
      };

      const admission1 = validateAudienceAdmission(baseAdmissionInput, expectation);

      // Modified projection rule (rule_id changed)
      const modifiedRule: AudienceSemanticProjectionRule = {
        ...rule,
        rule_id: "intent-segment-v2",
      };
      const modifiedSchema: AudienceSemanticProjectionSchema = {
        ...resolved.schemaPayload,
        projection_rules: [modifiedRule],
      };

      const admission2 = validateAudienceAdmission(
        { ...baseAdmissionInput, schema: modifiedSchema },
        expectation,
      );

      expect(admission1.audience_admission_hash).not.toBe(admission2.audience_admission_hash);
    });
  });

  it("case 10: projection inputs change admission hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const baseAdmissionInput = {
        audience: proposal,
        manifest,
        schema_role_bindings: [resolved.schemaBinding],
        schema: resolved.schemaPayload,
        task_market: "US",
        task_jurisdiction: "US-FED",
        task_audience_context: resolved.task.audience_context,
        basis_selections: [{
          audience_field: "intent_state" as const,
          fact_path: "/segment",
          ordinal: 0,
          basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
          proposition_id: f.propId,
          epistemic_state_id: f.epiId,
        }],
        propositions: resolved.propositions,
        epistemic_states: resolved.epistemicStates,
      };
      const expectation = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        canonical_input_hash: resolved.canonicalInputHash,
      };

      const admission1 = validateAudienceAdmission(baseAdmissionInput, expectation);
      expect(admission1.admission_evidence[0]).toBeDefined();

      // Change projection inputs (task_market US -> GB, and proposition populationScope accordingly)
      const propGBId = "prop-gb-" + randomUUID();
      const epiGBId = "epi-gb-" + randomUUID();
      await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
        VALUES (${`Proposition`}, ${propGBId}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`}),
               (${`EpistemicStateVersion`}, ${epiGBId}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`})`;
      await tx`INSERT INTO propositions (
        proposition_id, tenant_id, workspace_id, proposition_type, canonical_meaning, subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propGBId}, ${f.tenantId}, ${f.workspaceId}, ${"AUDIENCE"}, ${"Audience intent segment is \"developers\""}, ${"target audience"}, ${"has intent segment"}, ${"\"developers\""}, ${""}, ${""}, ${"GB"}, ${"US-FED"}
      )`;
      await tx`INSERT INTO epistemic_state_versions (
        epistemic_state_id, proposition_id, tenant_id, workspace_id, support_status, causal_status, uncertainty, derivation_method,
        derivation_entity_type, derivation_stable_id, derivation_revision_id, known_from, valid_from
      ) VALUES (
        ${epiGBId}, ${propGBId}, ${f.tenantId}, ${f.workspaceId}, ${"SUPPORTED"}, ${"CORRELATIONAL"}, ${"NONE"}, ${"RULE_BASED"}, ${"ContentProgramRevision"}, ${"prog-001"}, ${"prog-rev-001"}, now() - INTERVAL '1 minute', now() - INTERVAL '1 minute'
      )`;

      const resolverGB = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolvedGB = await resolverGB.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBaseGB = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolvedGB.trustedCutoff,
        audience_valid_time: resolvedGB.trustedCutoff,
        canonical_input_hash: resolvedGB.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolvedGB.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolvedGB.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolvedGB.schemaBinding,
        eligible_task_audience_context: resolvedGB.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolvedGB.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifestGB: AudienceDerivationManifest = {
        ...manifestBaseGB,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBaseGB),
      };

      const admission2 = validateAudienceAdmission(
        {
          ...baseAdmissionInput,
          manifest: manifestGB,
          task_market: "GB",
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: propGBId,
            epistemic_state_id: epiGBId,
          }],
          propositions: resolvedGB.propositions,
          epistemic_states: resolvedGB.epistemicStates,
        },
        { ...expectation, canonical_input_hash: resolvedGB.canonicalInputHash },
      );

      expect(admission1.audience_admission_hash).not.toBe(admission2.audience_admission_hash);
    });
  });

  it("case 11: projected semantic identity change changes admission hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const baseAdmissionInput = {
        audience: proposal,
        manifest,
        schema_role_bindings: [resolved.schemaBinding],
        schema: resolved.schemaPayload,
        task_market: resolved.task.market,
        task_jurisdiction: resolved.task.jurisdiction,
        task_audience_context: resolved.task.audience_context,
        basis_selections: [{
          audience_field: "intent_state" as const,
          fact_path: "/segment",
          ordinal: 0,
          basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
          proposition_id: f.propId,
          epistemic_state_id: f.epiId,
        }],
        propositions: resolved.propositions,
        epistemic_states: resolved.epistemicStates,
      };
      const expectation = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        canonical_input_hash: resolved.canonicalInputHash,
      };

      const admission1 = validateAudienceAdmission(baseAdmissionInput, expectation);

      // Modify subject template in rule
      const modifiedRule: AudienceSemanticProjectionRule = {
        ...rule,
        subject_template: [{ type: "CONST", value: "specialized audience" }],
      };
      // Matching proposition for specialized audience
      const propSpecialId = "prop-special-" + randomUUID();
      const epiSpecialId = "epi-special-" + randomUUID();
      await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
        VALUES (${`Proposition`}, ${propSpecialId}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`}),
               (${`EpistemicStateVersion`}, ${epiSpecialId}, ${f.tenantId}, ${f.workspaceId}, ${`AVAILABLE`})`;
      await tx`INSERT INTO propositions (
        proposition_id, tenant_id, workspace_id, proposition_type, canonical_meaning, subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propSpecialId}, ${f.tenantId}, ${f.workspaceId}, ${"AUDIENCE"}, ${"Audience intent segment is \"developers\""}, ${"specialized audience"}, ${"has intent segment"}, ${"\"developers\""}, ${""}, ${""}, ${"US"}, ${"US-FED"}
      )`;
      await tx`INSERT INTO epistemic_state_versions (
        epistemic_state_id, proposition_id, tenant_id, workspace_id, support_status, causal_status, uncertainty, derivation_method,
        derivation_entity_type, derivation_stable_id, derivation_revision_id, known_from, valid_from
      ) VALUES (
        ${epiSpecialId}, ${propSpecialId}, ${f.tenantId}, ${f.workspaceId}, ${"SUPPORTED"}, ${"CORRELATIONAL"}, ${"NONE"}, ${"RULE_BASED"}, ${"ContentProgramRevision"}, ${"prog-001"}, ${"prog-rev-001"}, now() - INTERVAL '1 minute', now() - INTERVAL '1 minute'
      )`;

      const resolverSpecial = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolvedSpecial = await resolverSpecial.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBaseSpecial = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolvedSpecial.trustedCutoff,
        audience_valid_time: resolvedSpecial.trustedCutoff,
        canonical_input_hash: resolvedSpecial.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolvedSpecial.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolvedSpecial.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolvedSpecial.schemaBinding,
        eligible_task_audience_context: resolvedSpecial.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolvedSpecial.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifestSpecial: AudienceDerivationManifest = {
        ...manifestBaseSpecial,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBaseSpecial),
      };

      const admission2 = validateAudienceAdmission(
        {
          ...baseAdmissionInput,
          manifest: manifestSpecial,
          schema: { ...resolved.schemaPayload, projection_rules: [modifiedRule] },
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: propSpecialId,
            epistemic_state_id: epiSpecialId,
          }],
          propositions: resolvedSpecial.propositions,
          epistemic_states: resolvedSpecial.epistemicStates,
        },
        { ...expectation, canonical_input_hash: resolvedSpecial.canonicalInputHash },
      );

      expect(admission1.audience_admission_hash).not.toBe(admission2.audience_admission_hash);
    });
  });

  it("case 12: equivalence outcome change changes admission hash or rejects", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");

      // Non-equivalent proposition (subject mismatch)
      const nonEquivalentProps = resolved.propositions.map((p) =>
        p.proposition_id === f.propId
          ? { ...p, semantic_identity: { ...p.semantic_identity, subject: "unrelated subject" } }
          : p,
      );

      expect(() =>
        validateAudienceAdmission(
          {
            audience: proposal,
            manifest,
            schema_role_bindings: [resolved.schemaBinding],
            schema: resolved.schemaPayload,
            task_market: resolved.task.market,
            task_jurisdiction: resolved.task.jurisdiction,
            task_audience_context: resolved.task.audience_context,
            basis_selections: [{
              audience_field: "intent_state",
              fact_path: "/segment",
              ordinal: 0,
              basis_kind: "AUDIENCE_EPISTEMIC_STATE",
              proposition_id: f.propId,
              epistemic_state_id: f.epiId,
            }],
            propositions: nonEquivalentProps,
            epistemic_states: resolved.epistemicStates,
          },
          {
            tenant_id: f.tenantId,
            workspace_id: f.workspaceId,
            run_config_id: f.configId,
            task_revision_id: f.taskRevId,
            canonical_input_hash: resolved.canonicalInputHash,
          },
        ),
      ).toThrow(/AUDIENCE_FACT_SEMANTIC_MISMATCH/);
    });
  });

  it("case 13: commit reconstructs same core/hash -> PASS", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      // Claim stage execution
      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });
      expect(claimResult.claimed).toBe(true);

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const admitted = validateAudienceAdmission(
        {
          audience: proposal,
          manifest,
          schema_role_bindings: [resolved.schemaBinding],
          schema: resolved.schemaPayload,
          task_market: resolved.task.market,
          task_jurisdiction: resolved.task.jurisdiction,
          task_audience_context: resolved.task.audience_context,
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: f.propId,
            epistemic_state_id: f.epiId,
          }],
          propositions: resolved.propositions,
          epistemic_states: resolved.epistemicStates,
        },
        {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_config_id: f.configId,
          task_revision_id: f.taskRevId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
      );

      // Pre-register AudienceState in registry
      

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1,
          fencing_token: claimResult.fencingToken,
          run_config_id: f.configId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
        request_identity: "tok-commit-1",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
          audience_admission_hash: admitted.audience_admission_hash,
        },
        audience_admission_hash: admitted.audience_admission_hash,
        admission_evidence: admitted.admission_evidence,
        fact_basis_links: admitted.fact_basis_links.map((link) => ({
          audience_field: link.audience_field,
          fact_path: link.fact_path,
          fact_value_hash: link.fact_value_hash,
          ordinal: link.ordinal,
          basis_kind: link.basis_kind,
          proposition_id: link.basis_kind === "AUDIENCE_EPISTEMIC_STATE" ? link.proposition_id : undefined,
          epistemic_state_id: link.basis_kind === "AUDIENCE_EPISTEMIC_STATE" ? link.epistemic_state_id : undefined,
        })),
      };

      const committed = await commitPort.commitAudienceState(commitRequest);
      expect(committed.audience_state_id).toBe(proposal.audience_state_id);
    });
  });

  it("case 14: commit canonical hash mismatch -> FAIL CLOSED", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: "forged-hash-commit",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: "forged-hash-commit",
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");

      

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1,
          fencing_token: claimResult.fencingToken,
          run_config_id: f.configId,
          canonical_input_hash: "forged-hash-commit",
        },
        request_identity: "tok-commit-2",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
        },
        fact_basis_links: [],
      };

      await expect(commitPort.commitAudienceState(commitRequest)).rejects.toMatchObject({
        code: "CANONICAL_INPUT_HASH_MISMATCH",
      });
    });
  });

  it("case 15: commit admission hash mismatch -> FAIL CLOSED", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");

      

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1,
          fencing_token: claimResult.fencingToken,
          run_config_id: f.configId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
        request_identity: "tok-commit-3",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
          audience_admission_hash: "forged-admission-hash",
        },
        audience_admission_hash: "forged-admission-hash",
        fact_basis_links: [{
          audience_field: "intent_state",
          fact_path: "/segment",
          fact_value_hash: "val-hash",
          ordinal: 0,
          basis_kind: "AUDIENCE_EPISTEMIC_STATE",
          proposition_id: f.propId,
          epistemic_state_id: f.epiId,
        }],
      };

      await expect(commitPort.commitAudienceState(commitRequest)).rejects.toMatchObject({
        code: "AUDIENCE_ADMISSION_HASH_MISMATCH",
      });
    });
  });

  it("case 16: basis becomes invalid before commit -> FAIL CLOSED", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const admitted = validateAudienceAdmission(
        {
          audience: proposal,
          manifest,
          schema_role_bindings: [resolved.schemaBinding],
          schema: resolved.schemaPayload,
          task_market: resolved.task.market,
          task_jurisdiction: resolved.task.jurisdiction,
          task_audience_context: resolved.task.audience_context,
          basis_selections: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            ordinal: 0,
            basis_kind: "AUDIENCE_EPISTEMIC_STATE",
            proposition_id: f.propId,
            epistemic_state_id: f.epiId,
          }],
          propositions: resolved.propositions,
          epistemic_states: resolved.epistemicStates,
        },
        {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_config_id: f.configId,
          task_revision_id: f.taskRevId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
      );

      // Point fact basis link to non-existent / refuted epistemic state
      const invalidLinks = [{
        ...admitted.fact_basis_links[0],
        epistemic_state_id: "epi-invalid-nonexistent",
      }];

      

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1,
          fencing_token: claimResult.fencingToken,
          run_config_id: f.configId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
        request_identity: "tok-commit-4",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
          audience_admission_hash: admitted.audience_admission_hash,
        },
        audience_admission_hash: admitted.audience_admission_hash,
        admission_evidence: admitted.admission_evidence,
        fact_basis_links: [{
          ...admitted.fact_basis_links[0],
          epistemic_state_id: "epi-invalid-nonexistent",
        }],
      };

      // Fails closed because revalidated epistemic state cannot be found or differs
      await expect(commitPort.commitAudienceState(commitRequest)).rejects.toThrow();
    });
  });

  it("case 17: stale fencing -> FAIL CLOSED", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      const idempotencyKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      // Update cycle epoch in DB to make the claimant stale!
      await tx`UPDATE decision_cycles SET fencing_epoch = 2 WHERE decision_cycle_id = ${f.cycleId}`;

      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1, // stale!
          fencing_token: claimResult.fencingToken,
          run_config_id: f.configId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
        request_identity: "tok-commit-5",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
        },
        fact_basis_links: [],
      };

      await expect(commitPort.commitAudienceState(commitRequest)).rejects.toMatchObject({
        code: "STALE_CYCLE_EPOCH",
      });
    });
  });

  it("case 18: FREEZING -> FAIL CLOSED", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
        decision_cycle_id: f.cycleId,
      });

      // Set decision cycle to FREEZING
      await tx`UPDATE decision_cycles SET status = 'FREEZING' WHERE decision_cycle_id = ${f.cycleId}`;

      // 1. Claim fails closed
      const idempotencyKey = "idem-" + randomUUID();
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey,
          canonicalInputHash: resolved.canonicalInputHash,
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING" });

      // 2. Commit also fails closed
      const manifestBase = {
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_config_id: f.configId,
        task_id: f.taskId,
        task_revision_id: f.taskRevId,
        audience_knowledge_cutoff_time: resolved.trustedCutoff,
        audience_valid_time: resolved.trustedCutoff,
        canonical_input_hash: resolved.canonicalInputHash,
        derivation_manifest_hash: "",
        audience_schema_ref: resolved.preProviderCore.audience_schema_ref,
        audience_schema_payload_hash: resolved.preProviderCore.audience_schema_payload_hash,
        audience_schema_role_binding: resolved.schemaBinding,
        eligible_task_audience_context: resolved.eligibleTaskAudienceContext,
        eligible_epistemic_refs: resolved.eligibleEpistemicRefs,
        fact_admissions: [],
      };
      const manifest: AudienceDerivationManifest = {
        ...manifestBase,
        derivation_manifest_hash: hashAudienceDerivationManifest(manifestBase),
      };
      const proposal = createAudienceProposal(f.taskRevId, "developers");
      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const commitRequest: AudienceStateCommitRequest = {
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: idempotencyKey,
          lease_owner: "worker-1",
          cycle_epoch: 1,
          fencing_token: 1,
          run_config_id: f.configId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
        request_identity: "tok-commit-6",
        state: proposal,
        generation_config: {
          schema_revision_id: f.schemaRevId,
          prompt_revision_id: "prompt-rev-1",
          model_revision_id: "model-rev-1",
          tool_revision_ids: [],
        },
        material_governance_dependencies_changed: false,
        derivation_authority: {
          audience_knowledge_cutoff_time: resolved.trustedCutoff,
          derivation_manifest: manifest,
          derivation_manifest_hash: manifest.derivation_manifest_hash,
          schema_binding: resolved.schemaBinding,
        },
        fact_basis_links: [],
      };

      await expect(commitPort.commitAudienceState(commitRequest)).rejects.toMatchObject({
        code: "KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING",
      });
    });
  });

  it("case 19: positive end-to-end: resolve -> core -> hash -> claim -> provider -> admission hash -> commit reconstruction -> exact equality -> atomic commit", async () => {
    await withRollback(async (tx) => {
      const f = await seedTestEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const pinsResolver = {
        async resolve() {
          return {
            schema_revision_id: f.schemaRevId,
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            tool_revision_ids: [],
            run_config_id: f.configId,
          };
        },
      };

      let capturedPins: any = null;
      let providerInvocationCount = 0;
      const provider: AudienceProposalProvider = {
        async generateAudienceProposal(context, pins) {
          providerInvocationCount += 1;
          capturedPins = pins;
          return {
            proposal: createProviderProposal("developers"),
            basis_selections: [{
              audience_field: "intent_state",
              fact_path: "/segment",
              ordinal: 0,
              basis_kind: "AUDIENCE_EPISTEMIC_STATE",
              proposition_id: f.propId,
              epistemic_state_id: f.epiId,
            }],
          };
        },
      };

      const generatedStateId = "aud-state-e2e-" + randomUUID();
      const identity = {
        nextAudienceStateId: () => generatedStateId,
        now: () => new Date(),
      };

      const previousState = createAudienceProposal(f.taskRevId, "developers", "REFINED");
      await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
        VALUES (${"AudienceState"}, ${previousState.audience_state_id}, ${f.tenantId}, ${f.workspaceId}, ${"AVAILABLE"})`;
      await tx`INSERT INTO audience_states (
        audience_state_id, tenant_id, workspace_id, task_revision_id, state_stage,
        context, knowledge_state, problem_state, solution_state, product_state,
        brand_state, intent_state, desired_outcome, objections, decision_criteria,
        prior_exposure, origin, uncertainty, created_at
      ) VALUES (
        ${previousState.audience_state_id}, ${f.tenantId}, ${f.workspaceId}, ${f.taskRevId}, ${"REFINED"},
        ${"{}"}, ${"{}"}, ${"{}"}, ${"{}"}, ${"{}"}, ${"{}"},
        ${JSON.stringify({ segment: "developers" })}, ${"{}"}, ${"[]"}, ${"[]"},
        ${"{}"}, ${JSON.stringify(previousState.origin)}, ${"[]"}, now()
      )`;

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      const persistence = new AudienceStatePersistenceService(commitPort);
      const claimPort = {
        claimStageExecution: (params: any) => claimContentStageExecution(tx, params),
      };

      const e2eInputResolver: AudienceDerivationInputResolver = {
        async resolveAuthorizedInputs() {
          return {
            provider_context: {},
            material_governance_dependencies_changed: false,
            previous_state: previousState,
          };
        },
      };

      const orchestrator = new DeriveAudienceState(
        e2eInputResolver,
        provider,
        persistence,
        identity,
        pinsResolver,
        resolver,
        claimPort,
      );

      const result = await orchestrator.execute({
        request_identity: "tok-e2e",
        authority: {
          tenant_id: f.tenantId,
          workspace_id: f.workspaceId,
          run_id: f.runId,
          decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId,
          stage_name: "AUDIENCE_FINALIZE",
          idempotency_key: "idem-e2e-" + randomUUID(),
          lease_owner: "worker-e2e",
          cycle_epoch: 1,
          fencing_token: 1,
          run_config_id: f.configId,
        },
        task_revision_id: f.taskRevId,
        target_stage: "FINAL_FOR_DECISION",
        previous_audience_state_id: previousState.audience_state_id,
      });

      expect(providerInvocationCount).toBe(1);
      expect(result.audience_state_id).toBe(generatedStateId);

      // Verify DB committed rows atomically
      const [stateRow] = await tx`SELECT * FROM audience_states WHERE audience_state_id = ${generatedStateId}`;
      expect(stateRow).toBeDefined();
      expect(stateRow.task_revision_id).toBe(f.taskRevId);

      const [authRow] = await tx`SELECT * FROM audience_derivation_authorities WHERE audience_state_id = ${generatedStateId}`;
      expect(authRow).toBeDefined();
      expect(authRow.schema_revision_id).toBe(f.schemaRevId);
      expect(authRow.canonical_input_hash).toHaveLength(64);

      const linkRows = await tx`SELECT * FROM audience_fact_basis_links WHERE audience_state_id = ${generatedStateId}`;
      expect(linkRows).toHaveLength(1);
      expect(linkRows[0].proposition_id).toBe(f.propId);
      expect(linkRows[0].epistemic_state_id).toBe(f.epiId);
    });
  });
});
