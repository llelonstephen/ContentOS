import { describe, it, expect } from "vitest";
import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
import {
  claimContentStageExecution,
} from "../../persistence/relational/services/content-stage-execution-repository.js";
import {
  TrustedPreProviderResolver,
} from "../../persistence/relational/services/trusted-pre-provider-resolver.js";
import {
  PostgresAudienceStateCommitPort,
} from "../../persistence/relational/services/postgres-audience-state-commit-port.js";
import {
  DeriveAudienceState,
  type AudienceStageClaimPort,
  type AudienceDerivationInputResolver,
} from "../../application/content-intelligence/derive-audience-state.js";
import {
  AudienceStatePersistenceService,
} from "../../persistence/relational/services/audience-state-persistence-service.js";
import {
  validateAudienceAdmission,
  hashAudienceDerivationManifest,
  type AudienceDerivationManifest,
  type AudienceSemanticProjectionRule,
  type AudienceStateView,
} from "../../domain/content/index.js";
import { getDefaultObjectStore } from "../../persistence/objects/default-object-store.js";
import type { ExactRevisionRef } from "../../domain/content/types.js";

const url =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/contentos_test";
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
  rule_id: "intent-segment-claim-v1",
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

async function seedClaimEnvironment(tx: any) {
  const tenantId = "tenant-" + randomUUID();
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
  const objectStore = getDefaultObjectStore();
  await objectStore.put(finalBytes, "application/json");

  await tx`INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id, workspace_id)
    VALUES (${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}, ${tenantId}, ${workspaceId})`;
  await tx`INSERT INTO registered_control_plane_revisions (
    entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_hash, payload_schema_revision_id
  ) VALUES (
    ${"SchemaDefinition"}, ${schemaStableId}, ${schemaRevId}, ${tenantId}, ${workspaceId}, ${payloadHash}, ${"meta-v1"}
  )`;

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

  await tx`INSERT INTO run_config_prompt_revisions (run_config_id, revision_id) VALUES (${configId}, ${"prompt-rev-1"})`;
  await tx`INSERT INTO run_config_model_revisions (run_config_id, revision_id) VALUES (${configId}, ${"model-rev-1"})`;
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
    propId,
    epiId,
    runId,
    cycleId,
    stageId,
    objectStore,
  };
}

describe("StageExecution Exact Identity & Scope Closure Suite (14 required cases)", () => {
  it("1. cross-tenant stage_execution_id claim fails and foreign row is unchanged", async () => {
    await withRollback(async (tx) => {
      const f1 = await seedClaimEnvironment(tx);
      const f2 = await seedClaimEnvironment(tx);

      // Create a stage in tenant 1
      const initialClaim = await claimContentStageExecution(tx, {
        tenantId: f1.tenantId,
        workspaceId: f1.workspaceId,
        runId: f1.runId,
        decisionCycleId: f1.cycleId,
        stageExecutionId: f1.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: "idem-" + randomUUID(),
        canonicalInputHash: "hash-initial-1",
        leaseOwner: "worker-tenant-1",
        cycleEpoch: 1,
      });
      expect(initialClaim.claimed).toBe(true);

      // Tenant 2 attempts to claim tenant 1's stage_execution_id
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f2.tenantId,
          workspaceId: f2.workspaceId,
          runId: f2.runId,
          decisionCycleId: f2.cycleId,
          stageExecutionId: f1.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: "idem-" + randomUUID(),
          canonicalInputHash: "hash-initial-1",
          leaseOwner: "worker-tenant-2",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "TENANT_ISOLATION_VIOLATION" });

      // Verify foreign row in tenant 1 is untouched
      const [foreignStage] = await tx`
        SELECT lease_owner, fencing_token, attempt_count, status, tenant_id
        FROM stage_executions WHERE stage_execution_id = ${f1.stageId}
      `;
      expect(foreignStage.tenant_id).toBe(f1.tenantId);
      expect(foreignStage.lease_owner).toBe("worker-tenant-1");
      expect(foreignStage.fencing_token).toBe(1);
      expect(foreignStage.attempt_count).toBe(1);
      expect(foreignStage.status).toBe("RUNNING");
    });
  });

  it("2. cross-workspace stage_execution_id claim fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const otherWorkspaceId = "ws-other-" + randomUUID();

      // Attempting to claim with wrong workspace on existing run
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: otherWorkspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: "idem-" + randomUUID(),
          canonicalInputHash: "hash-ws",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "WORKSPACE_ISOLATION_VIOLATION" });
    });
  });

  it("3. stage belonging to another run fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);

      // Create Stage on run 1
      const idemKey = "idem-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-run-1",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      // Create run 2 in same tenant & workspace
      const run2Id = "run-" + randomUUID();
      const cycle2Id = "cycle-" + randomUUID();
      await tx`INSERT INTO runs (
        run_id, tenant_id, workspace_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status, version
      ) VALUES (
        ${run2Id}, ${f.tenantId}, ${f.workspaceId}, ${"corr-" + randomUUID()}, ${f.taskRevId}, now(),
        ${f.configId}, ${"bks-001"}, ${"RUNNING"}, 0
      )`;
      await tx`INSERT INTO decision_cycles (
        decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number, reason, status, fencing_epoch
      ) VALUES (
        ${cycle2Id}, ${f.tenantId}, ${f.workspaceId}, ${run2Id}, 1, ${"TEST"}, ${"OPEN"}, 1
      )`;
      await tx`UPDATE runs SET current_decision_cycle_id = ${cycle2Id} WHERE run_id = ${run2Id}`;

      // Attempt to claim existing stageId with run 2
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: run2Id,
          decisionCycleId: cycle2Id,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: idemKey,
          canonicalInputHash: "hash-run-1",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "STAGE_CLAIM_SCOPE_MISMATCH" });
    });
  });

  it("4. stage belonging to another DecisionCycle fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);

      const idemKey = "idem-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-cycle-1",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      // Create cycle 2 on the same run
      const cycle2Id = "cycle-" + randomUUID();
      await tx`INSERT INTO decision_cycles (
        decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number, reason, status, fencing_epoch
      ) VALUES (
        ${cycle2Id}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, 2, ${"TEST"}, ${"OPEN"}, 1
      )`;
      await tx`UPDATE runs SET current_decision_cycle_id = ${cycle2Id} WHERE run_id = ${f.runId}`;

      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: cycle2Id,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: idemKey,
          canonicalInputHash: "hash-cycle-1",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "STAGE_CLAIM_SCOPE_MISMATCH" });
    });
  });

  it("5. stage_name mismatch fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const idemKey = "idem-" + randomUUID();

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-stage-name",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "DIFFERENT_STAGE_NAME",
          idempotencyKey: idemKey,
          canonicalInputHash: "hash-stage-name",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "STAGE_CLAIM_SCOPE_MISMATCH" });
    });
  });

  it("6. idempotency_key mismatch fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: "idem-first",
        canonicalInputHash: "hash-idem",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: "idem-second",
          canonicalInputHash: "hash-idem",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    });
  });

  it("7. canonical_input_hash mismatch still fails", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const idemKey = "idem-" + randomUUID();

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-original",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: idemKey,
          canonicalInputHash: "hash-tampered",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    });
  });

  it("8. idempotency_key resolves Stage A while stage_execution_id resolves Stage B => fail closed deterministically", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageA = "stage-A-" + randomUUID();
      const stageB = "stage-B-" + randomUUID();
      const idemA = "idem-A-" + randomUUID();
      const idemB = "idem-B-" + randomUUID();

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: stageA,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemA,
        canonicalInputHash: "hash-A",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: stageB,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemB,
        canonicalInputHash: "hash-B",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });

      // Cross-claim: stageExecutionId is stageB, but idempotencyKey is idemA!
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: stageB,
          stageName: "AUDIENCE_FINALIZE",
          idempotencyKey: idemA,
          canonicalInputHash: "hash-A",
          leaseOwner: "worker-1",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    });
  });

  it("9. failed claim invokes provider zero times", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const previousState: AudienceStateView = {
        audience_state_id: "aud-prev",
        task_revision_id: f.taskRevId,
        state_stage: "PROVISIONAL",
        context: {}, knowledge_state: {}, problem_state: {}, solution_state: {},
        product_state: {}, brand_state: {}, intent_state: { segment: "developers" },
        desired_outcome: {}, objections: [], decision_criteria: [], prior_exposure: {},
        origin: [{ kind: "PROPOSITION", reference_id: f.propId }], uncertainty: [],
        created_at: new Date(),
      };

      let providerCalled = 0;
      const failingClaimPort: AudienceStageClaimPort = {
        async claimStageExecution() {
          return {
            claimed: false,
            stageExecutionId: f.stageId,
            fencingToken: 1,
            leaseOwner: "other-worker",
            canonicalInputHash: "hash-1",
            cycleEpoch: 1,
            reason: "LEASE_HELD_BY_ANOTHER_WORKER",
          };
        },
      };

      const orchestrator = new DeriveAudienceState(
        {
          async resolveAuthorizedInputs() {
            return {
              provider_context: {},
              material_governance_dependencies_changed: false,
              previous_state: previousState,
            };
          },
        },
        {
          async deriveAudienceState() {
            providerCalled++;
            return previousState;
          },
        },
        new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(tx, f.objectStore)),
        { nextAudienceStateId: () => "aud-" + randomUUID(), now: () => new Date() },
        {
          async resolve() {
            return {
              schema_revision_id: f.schemaRevId,
              prompt_revision_id: "prompt-rev-1",
              model_revision_id: "model-rev-1",
              tool_revision_ids: [],
              run_config_id: f.configId,
            };
          },
        },
        resolver,
        failingClaimPort,
      );

      await expect(
        orchestrator.execute({
          request_identity: "req-" + randomUUID(),
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
            canonical_input_hash: "canonical-hash-1",
          },
          generation_config: {
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            schema_revision_id: f.schemaRevId,
            tool_revision_ids: [],
          },
        }),
      ).rejects.toThrow();

      expect(providerCalled).toBe(0);
    });
  });

  it("10. failed cross-scope claim does not change: lease_owner, fencing_token, attempt_count, status", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const idemKey = "idem-" + randomUUID();

      await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-preserve",
        leaseOwner: "original-owner",
        cycleEpoch: 1,
      });

      // Attempt invalid claim with mismatched stage_name
      await expect(
        claimContentStageExecution(tx, {
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          runId: f.runId,
          decisionCycleId: f.cycleId,
          stageExecutionId: f.stageId,
          stageName: "WRONG_STAGE_NAME",
          idempotencyKey: idemKey,
          canonicalInputHash: "hash-preserve",
          leaseOwner: "rogue-owner",
          cycleEpoch: 1,
        }),
      ).rejects.toMatchObject({ code: "STAGE_CLAIM_SCOPE_MISMATCH" });

      const [stageRow] = await tx`
        SELECT lease_owner, fencing_token, attempt_count, status
        FROM stage_executions WHERE stage_execution_id = ${f.stageId}
      `;
      expect(stageRow.lease_owner).toBe("original-owner");
      expect(stageRow.fencing_token).toBe(1);
      expect(stageRow.attempt_count).toBe(1);
      expect(stageRow.status).toBe("RUNNING");
    });
  });

  it("11. exact same-worker renewal still passes", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const idemKey = "idem-" + randomUUID();

      const first = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-renewal",
        leaseOwner: "worker-same",
        cycleEpoch: 1,
      });
      expect(first.claimed).toBe(true);
      expect(first.fencingToken).toBe(1);

      const renewed = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-renewal",
        leaseOwner: "worker-same",
        cycleEpoch: 1,
      });
      expect(renewed.claimed).toBe(true);
      expect(renewed.fencingToken).toBe(1);
      expect(renewed.leaseOwner).toBe("worker-same");
    });
  });

  it("12. valid expired-lease takeover on exact same stage passes and increments fencing_token/attempt_count", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const idemKey = "idem-" + randomUUID();

      const first = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-takeover",
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });
      expect(first.claimed).toBe(true);
      expect(first.fencingToken).toBe(1);

      // Force lease expiration
      await tx`
        UPDATE stage_executions
        SET lease_expires_at = now() - INTERVAL '1 second'
        WHERE stage_execution_id = ${f.stageId}
      `;

      const takeover = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: "hash-takeover",
        leaseOwner: "worker-2",
        cycleEpoch: 1,
      });
      expect(takeover.claimed).toBe(true);
      expect(takeover.fencingToken).toBe(2);
      expect(takeover.leaseOwner).toBe("worker-2");

      const [updated] = await tx`
        SELECT attempt_count, fencing_token, lease_owner
        FROM stage_executions WHERE stage_execution_id = ${f.stageId}
      `;
      expect(updated.fencing_token).toBe(2);
      expect(updated.attempt_count).toBe(2);
      expect(updated.lease_owner).toBe("worker-2");
    });
  });

  it("13. stale old worker cannot commit afterward", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId,
        workspace_id: f.workspaceId,
        run_id: f.runId,
        decision_cycle_id: f.cycleId,
        run_config_id: f.configId,
        task_revision_id: f.taskRevId,
      });

      const idemKey = "idem-" + randomUUID();
      const worker1Claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-1",
        cycleEpoch: 1,
      });
      expect(worker1Claim.fencingToken).toBe(1);

      // Expire lease and worker 2 takes over
      await tx`UPDATE stage_executions SET lease_expires_at = now() - INTERVAL '1 second' WHERE stage_execution_id = ${f.stageId}`;
      const worker2Claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        runId: f.runId,
        decisionCycleId: f.cycleId,
        stageExecutionId: f.stageId,
        stageName: "AUDIENCE_FINALIZE",
        idempotencyKey: idemKey,
        canonicalInputHash: resolved.canonicalInputHash,
        leaseOwner: "worker-2",
        cycleEpoch: 1,
      });
      expect(worker2Claim.fencingToken).toBe(2);

      // Worker 1 attempts to commit with stale fencing_token = 1
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

      const proposal: AudienceStateView = {
        audience_state_id: "aud-" + randomUUID(),
        task_revision_id: f.taskRevId,
        state_stage: "FINAL_FOR_DECISION",
        context: {}, knowledge_state: {}, problem_state: {}, solution_state: {},
        product_state: {}, brand_state: {}, intent_state: { segment: "developers" },
        desired_outcome: {}, objections: [], decision_criteria: [], prior_exposure: {},
        origin: [{ kind: "PROPOSITION", reference_id: f.propId }], uncertainty: [],
        created_at: new Date(),
      };

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
          tenant_id: f.tenantId, workspace_id: f.workspaceId,
          run_config_id: f.configId, task_revision_id: f.taskRevId,
          canonical_input_hash: resolved.canonicalInputHash,
        },
      );

      const commitPort = new PostgresAudienceStateCommitPort(tx, f.objectStore);
      await expect(
        commitPort.commitAudienceState({
          authority: {
            tenant_id: f.tenantId, workspace_id: f.workspaceId,
            run_id: f.runId, decision_cycle_id: f.cycleId,
            stage_execution_id: f.stageId, stage_name: "AUDIENCE_FINALIZE",
            idempotency_key: idemKey, lease_owner: "worker-1",
            cycle_epoch: 1, fencing_token: worker1Claim.fencingToken, // STALE!
            run_config_id: f.configId, canonical_input_hash: resolved.canonicalInputHash,
          },
          request_identity: "req-" + randomUUID(),
          generation_config: {
            prompt_revision_id: "prompt-rev-1",
            model_revision_id: "model-rev-1",
            schema_revision_id: f.schemaRevId,
            tool_revision_ids: [],
          },
          state: proposal,
          material_governance_dependencies_changed: false,
          derivation_authority: {
            audience_knowledge_cutoff_time: resolved.trustedCutoff,
            derivation_manifest: manifest,
            derivation_manifest_hash: manifest.derivation_manifest_hash,
            schema_binding: resolved.schemaBinding,
            audience_admission_hash: admitted.audience_admission_hash,
          },
          audience_admission_hash: admitted.audience_admission_hash,
          fact_basis_links: [{
            audience_field: "intent_state",
            fact_path: "/segment",
            fact_value_hash: "fvh-1",
            basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
            proposition_id: f.propId,
            epistemic_state_id: f.epiId,
            ordinal: 0,
          }],
        }),
      ).rejects.toMatchObject({ code: "STALE_FENCING_TOKEN" });
    });
  });

  it("14. positive Audience production flow remains green", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const realClaimPort: AudienceStageClaimPort = {
        claimStageExecution: (params) => claimContentStageExecution(tx, params),
      };

      const previousState: AudienceStateView = {
        audience_state_id: "aud-prev-" + randomUUID(),
        task_revision_id: f.taskRevId,
        state_stage: "PROVISIONAL",
        context: {}, knowledge_state: {}, problem_state: {}, solution_state: {},
        product_state: {}, brand_state: {}, intent_state: { segment: "developers" },
        desired_outcome: {}, objections: [], decision_criteria: [], prior_exposure: {},
        origin: [{ kind: "PROPOSITION", reference_id: f.propId }], uncertainty: [],
        created_at: new Date(),
      };

      // Seed previous state into DB
      await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
        VALUES (${"AudienceState"}, ${previousState.audience_state_id}, ${f.tenantId}, ${f.workspaceId}, ${"AVAILABLE"})`;
      await tx`INSERT INTO audience_states (
        audience_state_id, tenant_id, workspace_id, task_revision_id, state_stage,
        context, knowledge_state, problem_state, solution_state, product_state, brand_state,
        intent_state, desired_outcome, objections, decision_criteria,
        prior_exposure, origin, uncertainty, created_at
      ) VALUES (
        ${previousState.audience_state_id}, ${f.tenantId}, ${f.workspaceId}, ${f.taskRevId}, 'PROVISIONAL',
        '{}', '{}', '{}', '{}', '{}', '{}',
        ${JSON.stringify({ segment: "developers" })}, '{}', '[]', '[]',
        '{}', ${JSON.stringify(previousState.origin)}, '[]', now()
      )`;

      const inputResolver: AudienceDerivationInputResolver = {
        async resolveAuthorizedInputs() {
          return {
            provider_context: {},
            material_governance_dependencies_changed: false,
            previous_state: previousState,
          };
        },
      };

      const generatedStateId = "aud-gen-" + randomUUID();
      const provider = {
        async generateAudienceProposal() {
          return {
            proposal: {
              context: {},
              knowledge_state: {},
              problem_state: {},
              solution_state: {},
              product_state: {},
              brand_state: {},
              intent_state: { segment: "developers" },
              desired_outcome: {},
              objections: [],
              decision_criteria: [],
              prior_exposure: {},
              origin: [{ kind: "PROPOSITION" as const, reference_id: f.propId }],
              uncertainty: [],
            },
            basis_selections: [{
              audience_field: "intent_state",
              fact_path: "/segment",
              ordinal: 0,
              basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
              proposition_id: f.propId,
              epistemic_state_id: f.epiId,
            }],
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

      const identity = { nextAudienceStateId: () => generatedStateId, now: () => new Date() };
      const persistence = new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(tx, f.objectStore));

      const orchestrator = new DeriveAudienceState(
        inputResolver,
        provider,
        persistence,
        identity,
        pinsResolver,
        resolver,
        realClaimPort,
      );

      const result = await orchestrator.execute({
        request_identity: "req-" + randomUUID(),
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
        previous_audience_state_id: previousState.audience_state_id,
      });

      expect(result.state_stage).toBe("FINAL_FOR_DECISION");
      expect(result.audience_state_id).toBe(generatedStateId);

      const [storedStage] = await tx`
        SELECT status FROM stage_executions WHERE stage_execution_id = ${f.stageId}
      `;
      expect(storedStage.status).toBe("COMPLETED");
    });
  });
});
