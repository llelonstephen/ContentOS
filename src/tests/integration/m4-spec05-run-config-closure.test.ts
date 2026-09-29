import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import {
  TrustedPreProviderResolver,
} from "../../persistence/relational/services/trusted-pre-provider-resolver.js";
import {
  PostgresAudienceStateCommitPort,
} from "../../persistence/relational/services/postgres-audience-state-commit-port.js";
import {
  claimContentStageExecution,
} from "../../persistence/relational/services/content-stage-execution-repository.js";
import {
  hashPreProviderManifestCore,
  type PreProviderManifestCore,
} from "../../domain/content/pre-provider-manifest-core.js";
import {
  validateAudienceAdmission,
  hashAudienceDerivationManifest,
  type AudienceDerivationManifest,
  type AudienceSemanticProjectionRule,
  type AudienceStateView,
  type AudienceAdmissionInput,
} from "../../domain/content/index.js";
import { getDefaultObjectStore } from "../../persistence/objects/default-object-store.js";
import type { ExactRevisionRef } from "../../domain/content/types.js";

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

async function seedClosureEnvironment(tx: any) {
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

  // Schema payload
  const rawSchema = {
    path_encoding: "JSON_POINTER_V1",
    scalar_serialization: "CANONICAL_JSON_SCALAR_V1",
    classification_rules: [],
    projection_rules: [rule],
  };
  const finalBytes = Buffer.from(JSON.stringify(rawSchema));
  const payloadHash = createHash("sha256").update(finalBytes).digest("hex");
  const schemaPayload = {
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

  // Proposition & Epistemic state
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
    schemaObjId,
    payloadHash,
    propId,
    epiId,
    runId,
    cycleId,
    stageId,
    objectStore,
    runtimeParams,
  };
}

async function createAlternateRunConfig(tx: any, base: Awaited<ReturnType<typeof seedClosureEnvironment>>) {
  const newConfigId = "cfg-" + randomUUID();
  await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
    VALUES (${"RunConfig"}, ${newConfigId}, ${base.tenantId}, ${base.workspaceId}, ${"AVAILABLE"})`;
  await tx`INSERT INTO run_configs (run_config_id, tenant_id, workspace_id, runtime_parameters)
    VALUES (${newConfigId}, ${base.tenantId}, ${base.workspaceId}, ${base.runtimeParams})`;

  await tx`INSERT INTO run_config_schema_revisions (
    run_config_id, entity_type, stable_id, revision_id
  ) VALUES (
    ${newConfigId}, ${"SchemaDefinition"}, ${base.schemaStableId}, ${base.schemaRevId}
  )`;
  await tx`INSERT INTO run_config_schema_role_bindings (
    run_config_id, role, schema_entity_type, schema_stable_id, schema_revision_id
  ) VALUES (
    ${newConfigId}, ${"CONTENT_INTELLIGENCE_AUDIENCE"}, ${"SchemaDefinition"}, ${base.schemaStableId}, ${base.schemaRevId}
  )`;

  const newRunId = "run-" + randomUUID();
  const newCycleId = "cycle-" + randomUUID();
  const [existingSnapshot] = await tx`SELECT baseline_snapshot_id FROM baseline_knowledge_snapshots LIMIT 1`;
  const snapshotId = existingSnapshot ? existingSnapshot.baseline_snapshot_id : "bks-001";

  await tx`INSERT INTO runs (
    run_id, tenant_id, workspace_id, run_correlation_key, task_revision_id, initialization_cutoff,
    initial_run_config_id, initial_baseline_snapshot_id, status, version
  ) VALUES (
    ${newRunId}, ${base.tenantId}, ${base.workspaceId}, ${"corr-" + randomUUID()}, ${base.taskRevId}, now(),
    ${newConfigId}, ${snapshotId}, ${"RUNNING"}, 0
  )`;
  await tx`INSERT INTO decision_cycles (
    decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number, reason, status, fencing_epoch
  ) VALUES (
    ${newCycleId}, ${base.tenantId}, ${base.workspaceId}, ${newRunId}, 1, ${"TEST"}, ${"OPEN"}, 1
  )`;
  await tx`UPDATE runs SET current_decision_cycle_id = ${newCycleId} WHERE run_id = ${newRunId}`;

  return {
    configId: newConfigId,
    runId: newRunId,
    cycleId: newCycleId,
  };
}

describe("RunConfig Canonical Identity Closure Suite", () => {
  beforeAll(async () => {
    const migrationsDir = path.resolve(import.meta.dirname, "../../persistence/relational/migrations");
    const files = [
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
        await sql.unsafe(stmt);
      }
    }
  });

  it("1. changing prompt normalized ref set changes canonical_input_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      await tx`INSERT INTO run_config_prompt_revisions (run_config_id, revision_id) VALUES (${f.configId}, ${"prompt-v1"})`;
      await tx`INSERT INTO run_config_prompt_revisions (run_config_id, revision_id) VALUES (${alt.configId}, ${"prompt-v2"})`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
    });
  });

  it("2. changing model normalized ref set changes canonical_input_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      await tx`INSERT INTO run_config_model_revisions (run_config_id, revision_id) VALUES (${f.configId}, ${"model-v1"})`;
      await tx`INSERT INTO run_config_model_revisions (run_config_id, revision_id) VALUES (${alt.configId}, ${"model-v2"})`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
    });
  });

  it("3. changing tool normalized ref set changes canonical_input_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      await tx`INSERT INTO run_config_tool_revisions (run_config_id, revision_id) VALUES (${f.configId}, ${"tool-v1"})`;
      await tx`INSERT INTO run_config_tool_revisions (run_config_id, revision_id) VALUES (${alt.configId}, ${"tool-v2"})`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
    });
  });

  it("4. changing retriever normalized ref set changes canonical_input_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      await tx`INSERT INTO run_config_retriever_revisions (run_config_id, revision_id) VALUES (${alt.configId}, ${"retriever-v1"})`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
    });
  });

  it("5. changing evaluator normalized ref set changes canonical_input_hash", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      await tx`INSERT INTO run_config_evaluator_revisions (run_config_id, revision_id) VALUES (${alt.configId}, ${"evaluator-v1"})`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
    });
  });

  it("6. changing a non-role schema member changes exact RunConfig identity", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      // Register a second schema definition
      const extraStableId = "extra-schema-" + randomUUID();
      const extraRevId = "extra-rev-" + randomUUID();
      await tx`INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id, workspace_id)
        VALUES (${"SchemaDefinition"}, ${extraStableId}, ${extraRevId}, ${f.tenantId}, ${f.workspaceId})`;
      await tx`INSERT INTO registered_control_plane_revisions (
        entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_hash, payload_schema_revision_id
      ) VALUES (
        ${"SchemaDefinition"}, ${extraStableId}, ${extraRevId}, ${f.tenantId}, ${f.workspaceId}, ${"payload-extra"}, ${"meta-v1"}
      )`;

      // Add non-role member to alt config
      await tx`INSERT INTO run_config_schema_revisions (
        run_config_id, entity_type, stable_id, revision_id
      ) VALUES (
        ${alt.configId}, ${"SchemaDefinition"}, ${extraStableId}, ${extraRevId}
      )`;

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const res1 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });
      const res2 = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: alt.runId, decision_cycle_id: alt.cycleId,
        run_config_id: alt.configId, task_revision_id: f.taskRevId,
      });

      expect(res1.canonicalInputHash).not.toBe(res2.canonicalInputHash);
      expect(res2.preProviderCore.schema_revision_refs).toHaveLength(2);
    });
  });

  it("7. same revision_id with different schema stable_id does NOT collide", () => {
    const tupleA: ExactRevisionRef = {
      entity_type: "SchemaDefinition",
      stable_id: "schema-stable-A",
      revision_id: "shared-rev-1",
    };
    const tupleB: ExactRevisionRef = {
      entity_type: "SchemaDefinition",
      stable_id: "schema-stable-B",
      revision_id: "shared-rev-1",
    };

    const base: PreProviderManifestCore = {
      tenant_id: "tenant-1",
      run_config_id: "cfg-1",
      task_id: "task-1",
      task_revision_id: "task-rev-1",
      audience_knowledge_cutoff_time: "2026-09-29T10:00:00.000Z",
      audience_schema_ref: tupleA,
      audience_schema_payload_hash: "hash-payload",
      eligible_task_audience_context: [],
      eligible_epistemic_refs: [],
    };

    const hashA = hashPreProviderManifestCore({ ...base, schema_revision_refs: [tupleA] });
    const hashB = hashPreProviderManifestCore({ ...base, schema_revision_refs: [tupleB] });
    const hashBoth = hashPreProviderManifestCore({ ...base, schema_revision_refs: [tupleA, tupleB] });

    expect(hashA).not.toBe(hashB);
    expect(hashBoth).not.toBe(hashA);
    expect(hashBoth).not.toBe(hashB);
  });

  it("8. role binding must match the complete typed schema tuple", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const alt = await createAlternateRunConfig(tx, f);

      // Disable triggers temporarily to simulate out-of-band tampering or replica drift
      await tx.unsafe("SET session_replication_role = 'replica'");
      await tx`UPDATE run_config_schema_revisions SET stable_id = ${"tampered-stable"} WHERE run_config_id = ${alt.configId}`;
      await tx.unsafe("SET session_replication_role = 'origin'");

      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      await expect(
        resolver.resolveCanonicalInputs({
          tenant_id: f.tenantId, workspace_id: f.workspaceId,
          run_id: alt.runId, decision_cycle_id: alt.cycleId,
          run_config_id: alt.configId, task_revision_id: f.taskRevId,
        }),
      ).rejects.toMatchObject({ code: "AUDIENCE_SCHEMA_ROLE_BINDING_INVALID" });
    });
  });

  it("9. commit reconstruction uses complete tuples", async () => {
    await withRollback(async (tx) => {
      const f = await seedClosureEnvironment(tx);
      const resolver = new TrustedPreProviderResolver(tx, f.objectStore);
      const resolved = await resolver.resolveCanonicalInputs({
        tenant_id: f.tenantId, workspace_id: f.workspaceId,
        run_id: f.runId, decision_cycle_id: f.cycleId,
        run_config_id: f.configId, task_revision_id: f.taskRevId,
      });

      const idemKey = "idem-" + randomUUID();
      const claimResult = await claimContentStageExecution(tx, {
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
      const commitRequest = {
        authority: {
          tenant_id: f.tenantId, workspace_id: f.workspaceId,
          run_id: f.runId, decision_cycle_id: f.cycleId,
          stage_execution_id: f.stageId, stage_name: "AUDIENCE_FINALIZE" as const,
          idempotency_key: idemKey, lease_owner: "worker-1",
          cycle_epoch: 1, fencing_token: claimResult.fencingToken,
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
      };

      const committed = await commitPort.commitAudienceState(commitRequest);
      expect(committed.audience_state_id).toBe(proposal.audience_state_id);
    });
  });

  it("10. normalized ref-set row ordering does not change hash", () => {
    const tupleA: ExactRevisionRef = {
      entity_type: "SchemaDefinition",
      stable_id: "schema-stable-A",
      revision_id: "rev-A",
    };
    const tupleB: ExactRevisionRef = {
      entity_type: "SchemaDefinition",
      stable_id: "schema-stable-B",
      revision_id: "rev-B",
    };

    const base: PreProviderManifestCore = {
      tenant_id: "tenant-1",
      run_config_id: "cfg-1",
      task_id: "task-1",
      task_revision_id: "task-rev-1",
      audience_knowledge_cutoff_time: "2026-09-29T10:00:00.000Z",
      audience_schema_ref: tupleA,
      audience_schema_payload_hash: "hash-payload",
      eligible_task_audience_context: [],
      eligible_epistemic_refs: [],
    };

    const core1: PreProviderManifestCore = {
      ...base,
      prompt_revision_refs: ["p-alpha", "p-beta"],
      model_config_revision_refs: ["m-alpha", "m-beta"],
      tool_config_revision_refs: ["t-alpha", "t-beta"],
      schema_revision_refs: [tupleA, tupleB],
      retriever_revision_refs: ["r-alpha", "r-beta"],
      evaluator_revision_refs: ["e-alpha", "e-beta"],
    };

    const core2: PreProviderManifestCore = {
      ...base,
      prompt_revision_refs: ["p-beta", "p-alpha"],
      model_config_revision_refs: ["m-beta", "m-alpha"],
      tool_config_revision_refs: ["t-beta", "t-alpha"],
      schema_revision_refs: [tupleB, tupleA],
      retriever_revision_refs: ["r-beta", "r-alpha"],
      evaluator_revision_refs: ["e-beta", "e-alpha"],
    };

    expect(hashPreProviderManifestCore(core1)).toBe(hashPreProviderManifestCore(core2));
  });
});
