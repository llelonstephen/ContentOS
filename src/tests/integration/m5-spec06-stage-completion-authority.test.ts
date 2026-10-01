import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  claimContentStageExecution,
  completeContentStageExecution,
} from "../../persistence/relational/services/content-stage-execution-repository.js";
import { verifyStageFencing } from "../../persistence/relational/services/stage-fencing-coordinator.js";
import { EVALUATION_STAGE_NAMES } from "../../domain/evaluation/index.js";

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

async function seedClaimEnvironment(tx: any) {
  const tenantId = "tenant-" + randomUUID();
  const workspaceId = "ws-" + randomUUID();
  const taskId = "task-" + randomUUID();
  const taskRevId = "task-rev-" + randomUUID();

  const [existingSnapshot] = await tx`SELECT baseline_snapshot_id FROM baseline_knowledge_snapshots LIMIT 1`;
  const snapshotId = existingSnapshot ? existingSnapshot.baseline_snapshot_id : "bks-001";

  const configId = "cfg-" + randomUUID();

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

  await tx`INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id, workspace_id, payload_state)
    VALUES (${"RunConfig"}, ${configId}, ${tenantId}, ${workspaceId}, ${"AVAILABLE"})`;
  await tx`INSERT INTO run_configs (run_config_id, tenant_id, workspace_id, runtime_parameters)
    VALUES (${configId}, ${tenantId}, ${workspaceId}, ${"{}"})`;

  const runId = "run-" + randomUUID();
  const cycleId = "cycle-" + randomUUID();
  
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

  return { tenantId, workspaceId, runId, cycleId };
}

describe("M5 Checkpoint 2 - Stage Execution Authority", () => {
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
      "0010_m5_evaluation_completion_authority.sql",
    ];
    for (const f of files) {
      const filePath = path.join(migrationsDir, f);
      const fileSql = fs.readFileSync(filePath, "utf8");
      const stmts = fileSql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await sql.unsafe(stmt);
      }
    }
  });

  it("can claim all 8 frozen M5 stages", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      for (const stageName of EVALUATION_STAGE_NAMES) {
        const stageId = "stage-" + randomUUID();
        const claim = await claimContentStageExecution(tx, {
          tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
          stageExecutionId: stageId, stageName, idempotencyKey: "idem-" + randomUUID(), canonicalInputHash: "hash",
          leaseOwner: "worker-1", cycleEpoch: 1,
        });
        expect(claim.claimed).toBe(true);
      }
    });
  });

  it("completes each M5 stage only through valid authority and increments completion", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      for (const stageName of EVALUATION_STAGE_NAMES) {
        const stageId = "stage-" + randomUUID();
        const idem = "idem-" + randomUUID();
        const claim = await claimContentStageExecution(tx, {
          tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
          stageExecutionId: stageId, stageName, idempotencyKey: idem, canonicalInputHash: "hash",
          leaseOwner: "worker-1", cycleEpoch: 1,
        });
        
        await completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName, leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: idem,
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, []);

        const [row] = await tx`SELECT status FROM stage_executions WHERE stage_execution_id = ${stageId}`;
        expect(row.status).toBe("COMPLETED");
      }
    });
  });

  it("unknown/non-M5 stage rejected by M5 completion authority", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      // Bypass claim, insert directly to test the SQL function strictly
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'CONTENT_GENERATE', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'CONTENT_GENERATE', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      
      expect(res.completed).toBe(false);
    });
  });

  it("stale fencing token rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken - 1, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("takeover stale-worker rejection", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const first = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await tx`UPDATE stage_executions SET lease_expires_at = now() - interval '1 minute' WHERE stage_execution_id = ${stageId}`;

      const takeover = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-2", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: first.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });

      await completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-2", fencingToken: takeover.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, []);
    });
  });

  it("canonical_input_hash mutation rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "mutated-hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("freezing cycle rejects completion", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await tx`UPDATE decision_cycles SET status = 'FREEZING' WHERE decision_cycle_id = ${f.cycleId}`;

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });
  
  it("wrong tenant rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: "wrong-tenant", workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("wrong workspace rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: "wrong-workspace" }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });
  
  it("verifyStageFencing routes M5_EVALUATION scope correctly", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      
      const res = await verifyStageFencing(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId,
        authorityScope: "M5_EVALUATION", writeMode: "DECISION_CYCLE",
        fencingContext: {
          decisionCycleId: f.cycleId, stageExecutionId: stageId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash"
        }
      });
      expect(res.mode).toBe("DECISION_CYCLE");
      expect(res.stageStatus).toBe("RUNNING");
      
      // Unknown stage should fail
      await expect(verifyStageFencing(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId,
        authorityScope: "M5_EVALUATION", writeMode: "DECISION_CYCLE",
        fencingContext: {
          decisionCycleId: f.cycleId, stageExecutionId: stageId, runId: f.runId, cycleEpoch: 1,
          stageName: "UNKNOWN_STAGE", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash"
        }
      })).rejects.toMatchObject({ code: "M5_STAGE_NOT_ALLOWED" });
    });
  });

  // Focused M5 missing tests
  it("wrong run rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: "wrong-run", cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("wrong decision_cycle rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: "wrong-cycle", runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("expired lease completion rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await tx`UPDATE stage_executions SET lease_expires_at = now() - interval '1 minute' WHERE stage_execution_id = ${stageId}`;

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("already COMPLETED stage cannot complete again through normal completion", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const claim = await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });

      await completeContentStageExecution(tx, {
        stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
        stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
        canonicalInputHash: "hash",
      }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, []);

      await expect(completeContentStageExecution(tx, {
          stageExecutionId: stageId, decisionCycleId: f.cycleId, runId: f.runId, cycleEpoch: 1,
          stageName: "ASSERTION_EXTRACT", leaseOwner: "worker-1", fencingToken: claim.fencingToken, idempotencyKey: "idem",
          canonicalInputHash: "hash",
        }, { tenantId: f.tenantId, workspaceId: f.workspaceId }, [])
      ).rejects.toMatchObject({ code: "STALE_WORKER_COMMIT_REJECTED" });
    });
  });

  it("invalid/empty stage name rejected", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        '', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("UNKNOWN_STAGE rejected directly", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'UNKNOWN_STAGE', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("AUDIENCE_SYNTHESIS rejected directly", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'AUDIENCE_SYNTHESIS', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("CONTENT_GENERATE rejected directly", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'CONTENT_GENERATE', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  // Adversarial NULL tests M5
  it("Valid M5 stage + NULL p_fencing_token -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', NULL, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
      const [row] = await tx`SELECT status FROM stage_executions WHERE stage_execution_id = ${stageId}`;
      expect(row.status).toBe("RUNNING");
    });
  });

  it("Valid M5 stage + NULL p_lease_owner -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', NULL, 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
      const [row] = await tx`SELECT status FROM stage_executions WHERE stage_execution_id = ${stageId}`;
      expect(row.status).toBe("RUNNING");
    });
  });

  it("Valid M5 stage + NULL p_idempotency_key -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, NULL, 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Valid M5 stage + NULL p_canonical_input_hash -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', NULL
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("non-M5 stage + NULL p_stage_name -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'AUDIENCE_PROVISIONAL', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        NULL, 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
      const [row] = await tx`SELECT status FROM stage_executions WHERE stage_execution_id = ${stageId}`;
      expect(row.status).toBe("RUNNING");
    });
  });

  it("NULL p_cycle_epoch -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, NULL,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("NULL p_tenant_id -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await claimContentStageExecution(tx, {
        tenantId: f.tenantId, workspaceId: f.workspaceId, runId: f.runId, decisionCycleId: f.cycleId,
        stageExecutionId: stageId, stageName: "ASSERTION_EXTRACT", idempotencyKey: "idem", canonicalInputHash: "hash",
        leaseOwner: "worker-1", cycleEpoch: 1,
      });
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, NULL, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  // Adversarial NULL tests M4
  it("Valid M4 stage + NULL p_fencing_token -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      // Insert an M4 stage directly as RUNNING since claimContentStageExecution may check stage names in future
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'AUDIENCE_FINALIZE', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m4_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'AUDIENCE_FINALIZE', 'worker-1', NULL, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("non-M4 stage + NULL p_stage_name -> cannot bypass M4 whitelist", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m4_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        NULL, 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  describe("Static Security Regression", () => {
    it("migration 0010 implements explicitly fail-closed NULL handling, secure search_path, and SECURITY DEFINER", () => {
      const sqlPath = path.resolve(import.meta.dirname, "../../persistence/relational/migrations/0010_m5_evaluation_completion_authority.sql");
      const code = fs.readFileSync(sqlPath, "utf8");
      
      expect(code).toContain("SECURITY DEFINER");
      expect(code).toContain("SET search_path = pg_catalog, public");
      expect(code).toContain("REVOKE ALL ON FUNCTION public.complete_m5_stage_execution");
      expect(code).toContain("GRANT EXECUTE ON FUNCTION public.complete_m5_stage_execution");
      expect(code).toContain("IF p_stage_execution_id IS NULL OR p_tenant_id IS NULL OR p_run_id IS NULL");
      expect(code).toContain("IF btrim(p_stage_execution_id) = '' OR btrim(p_tenant_id) = ''");
      
      // Verify exact 8 M5 stages
      expect(code).toContain("'ASSERTION_EXTRACT', 'ASSERTION_MAP', 'ASSERTION_VALIDATE'");
      expect(code).toContain("'COMPOSITE_ASSESS', 'QUALITATIVE_EVALUATE', 'RISK_ASSESS'");
      expect(code).toContain("'UNCERTAINTY_ASSESS', 'EVALUATION_CLOSURE'");
      
      // Verify hardened M4 checks
      expect(code).toContain("CREATE OR REPLACE FUNCTION public.complete_m4_stage_execution");
      
      // Verify no direct UPDATE grants
      expect(code).not.toContain("GRANT UPDATE ON public.stage_executions");
    });
  });

  // Empty string M5 tests
  it("Valid M5 stage + matching empty lease_owner -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        '', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', '', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Valid M5 stage + matching empty idempotency_key -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, 'hash', ''
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, '', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Valid M5 stage + matching empty canonical_input_hash -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'ASSERTION_EXTRACT', 'RUNNING',
        'worker-1', now() + interval '1 minute', 1, 1, '', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', ''
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Empty p_stage_execution_id -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        '', ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Empty p_tenant_id -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, '', ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Empty p_run_id -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, '', ${f.cycleId}, 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Empty p_decision_cycle_id -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, '', 1,
        'ASSERTION_EXTRACT', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  it("Empty p_stage_name -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      const [res] = await tx`SELECT public.complete_m5_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        '   ', 'worker-1', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });

  // Empty string M4 tests
  it("M4 matching-empty attack (lease_owner) -> false", async () => {
    await withRollback(async (tx) => {
      const f = await seedClaimEnvironment(tx);
      const stageId = "stage-" + randomUUID();
      await tx`INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash, idempotency_key
      ) VALUES (
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 'AUDIENCE_FINALIZE', 'RUNNING',
        '', now() + interval '1 minute', 1, 1, 'hash', 'idem'
      )`;
      const [res] = await tx`SELECT public.complete_m4_stage_execution(
        ${stageId}, ${f.tenantId}, ${f.workspaceId}, ${f.runId}, ${f.cycleId}, 1,
        'AUDIENCE_FINALIZE', '', 1, 'idem', 'hash'
      ) as completed`;
      expect(res.completed).toBe(false);
    });
  });
});
