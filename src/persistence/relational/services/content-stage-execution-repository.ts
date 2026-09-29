import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { StageFencingContext } from './stage-fencing-coordinator.js';
import type { ContentRuntimeReference } from './content-runtime-reference-loader.js';

export type StageExecutionOutputRef = ContentRuntimeReference & { ordinal: number };

export async function loadStageExecutionOutputRefs(
  sqlTx: any,
  stageExecutionId: string,
): Promise<StageExecutionOutputRef[]> {
  const rows = await sqlTx`
    SELECT ordinal, ref_kind, entity_type, entity_id, stable_id, revision_id
    FROM stage_execution_output_refs
    WHERE stage_execution_id = ${stageExecutionId}
    ORDER BY ordinal ASC
  `;
  return rows.map((row: any) => {
    if (row.ref_kind === 'IMMUTABLE_ENTITY' && row.entity_id && !row.stable_id && !row.revision_id) {
      return {
        ordinal: Number(row.ordinal), refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: String(row.entity_type), entityId: String(row.entity_id),
      };
    }
    if (row.ref_kind === 'REVISION' && !row.entity_id && row.stable_id && row.revision_id) {
      return {
        ordinal: Number(row.ordinal), refKind: 'REVISION' as const,
        entityType: String(row.entity_type), stableId: String(row.stable_id),
        revisionId: String(row.revision_id),
      };
    }
    throw new RegistryValidationError(
      'INVALID_STAGE_OUTPUT_REFERENCE',
      `StageExecution '${stageExecutionId}' contains an invalid output reference.`,
    );
  });
}

export async function completeContentStageExecution(
  sqlTx: any,
  context: StageFencingContext,
  scope: { tenantId: string; workspaceId?: string | null },
  outputRefs: readonly StageExecutionOutputRef[],
): Promise<void> {
  const ordinals = new Set<number>();
  for (const ref of outputRefs) {
    if (!Number.isInteger(ref.ordinal) || ref.ordinal < 0 || ordinals.has(ref.ordinal)) {
      throw new RegistryValidationError('INVALID_STAGE_OUTPUT_ORDINAL', 'Stage output ordinals must be unique non-negative integers.');
    }
    ordinals.add(ref.ordinal);
    if (ref.refKind === 'IMMUTABLE_ENTITY') {
      await sqlTx`
        INSERT INTO stage_execution_output_refs (
          stage_execution_id, ordinal, ref_kind, entity_type, entity_id, created_at
        ) VALUES (
          ${context.stageExecutionId}, ${ref.ordinal}, 'IMMUTABLE_ENTITY',
          ${ref.entityType}, ${ref.entityId}, now()
        )
      `;
    } else {
      await sqlTx`
        INSERT INTO stage_execution_output_refs (
          stage_execution_id, ordinal, ref_kind, entity_type, stable_id, revision_id, created_at
        ) VALUES (
          ${context.stageExecutionId}, ${ref.ordinal}, 'REVISION', ${ref.entityType},
          ${ref.stableId}, ${ref.revisionId}, now()
        )
      `;
    }
  }
  const [result] = await sqlTx`
    SELECT public.complete_m4_stage_execution(
      ${context.stageExecutionId}, ${scope.tenantId}, ${scope.workspaceId ?? null},
      ${context.runId}, ${context.decisionCycleId}, ${context.cycleEpoch},
      ${context.stageName}, ${context.leaseOwner}, ${context.fencingToken},
      ${context.idempotencyKey}, ${context.canonicalInputHash}
    ) AS completed
  `;
  if (result?.completed !== true) {
    throw new RegistryValidationError(
      'STALE_WORKER_COMMIT_REJECTED',
      'StageExecution changed before completion; the transaction must roll back.',
    );
  }
}

export interface ClaimContentStageExecutionParams {
  readonly tenantId: string;
  readonly workspaceId?: string | null;
  readonly runId: string;
  readonly decisionCycleId: string;
  readonly stageExecutionId: string;
  readonly stageName: string;
  readonly idempotencyKey: string;
  readonly canonicalInputHash: string;
  readonly leaseOwner: string;
  readonly cycleEpoch: number;
  readonly leaseDurationMs?: number;
}

export interface ClaimContentStageExecutionResult {
  readonly claimed: boolean;
  readonly stageExecutionId: string;
  readonly fencingToken: number;
  readonly leaseOwner: string;
  readonly canonicalInputHash: string;
  readonly cycleEpoch: number;
  readonly reason?: string;
}

export async function claimContentStageExecution(
  sqlTx: any,
  params: ClaimContentStageExecutionParams,
): Promise<ClaimContentStageExecutionResult> {
  const leaseMs = params.leaseDurationMs ?? 300000;
  const targetWorkspaceId = params.workspaceId ?? null;

  // 1. Close run / cycle scope before stage claim
  const [run] = await sqlTx`
    SELECT run_id, tenant_id, workspace_id, status, current_decision_cycle_id
    FROM runs WHERE run_id = ${params.runId} FOR UPDATE
  `;
  if (!run) {
    throw new RegistryValidationError("RUN_NOT_FOUND", `Run '${params.runId}' does not exist.`);
  }
  if (run.tenant_id !== params.tenantId) {
    throw new RegistryValidationError("TENANT_ISOLATION_VIOLATION", "Run tenant mismatch.");
  }
  const runWorkspaceId = run.workspace_id ?? null;
  if (runWorkspaceId !== targetWorkspaceId) {
    throw new RegistryValidationError("WORKSPACE_ISOLATION_VIOLATION", "Run workspace mismatch.");
  }
  if (run.status !== "RUNNING") {
    throw new RegistryValidationError("STALE_WORKER_COMMIT_REJECTED", `Run '${params.runId}' is '${run.status}', not RUNNING.`);
  }
  if (run.current_decision_cycle_id !== params.decisionCycleId) {
    throw new RegistryValidationError("DECISION_CYCLE_NOT_CURRENT", "Supplied DecisionCycle is not current cycle.");
  }

  const [cycle] = await sqlTx`
    SELECT decision_cycle_id, tenant_id, workspace_id, run_id, status, fencing_epoch, superseded_by_cycle_id
    FROM decision_cycles WHERE decision_cycle_id = ${params.decisionCycleId} FOR UPDATE
  `;
  if (!cycle) {
    throw new RegistryValidationError("DECISION_CYCLE_NOT_FOUND", `DecisionCycle '${params.decisionCycleId}' does not exist.`);
  }
  if (cycle.tenant_id !== params.tenantId) {
    throw new RegistryValidationError("TENANT_ISOLATION_VIOLATION", "DecisionCycle tenant mismatch.");
  }
  const cycleWorkspaceId = cycle.workspace_id ?? null;
  if (cycleWorkspaceId !== targetWorkspaceId) {
    throw new RegistryValidationError("WORKSPACE_ISOLATION_VIOLATION", "DecisionCycle workspace mismatch.");
  }
  if (cycle.run_id !== params.runId) {
    throw new RegistryValidationError("RUN_CYCLE_MISMATCH", "DecisionCycle run mismatch.");
  }
  if (cycle.status === "FREEZING" || cycle.status === "FROZEN") {
    throw new RegistryValidationError("KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING", "Cannot claim StageExecution in freezing/frozen cycle.");
  }
  if (cycle.status !== "OPEN" || cycle.superseded_by_cycle_id != null) {
    throw new RegistryValidationError("STALE_WORKER_COMMIT_REJECTED", "DecisionCycle is not OPEN.");
  }
  if (cycle.fencing_epoch !== params.cycleEpoch) {
    throw new RegistryValidationError("STALE_CYCLE_EPOCH", `Cycle epoch ${params.cycleEpoch} is stale; current epoch is ${cycle.fencing_epoch}.`);
  }

  // 2. Resolve both stage identifiers safely under same locking boundary
  const [stageById] = await sqlTx`
    SELECT * FROM stage_executions WHERE stage_execution_id = ${params.stageExecutionId} FOR UPDATE
  `;

  const [stageByIdempotency] = await sqlTx`
    SELECT * FROM stage_executions WHERE idempotency_key = ${params.idempotencyKey} FOR UPDATE
  `;

  // A. Neither exists: create the new exact StageExecution
  if (!stageById && !stageByIdempotency) {
    await sqlTx`
      INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, idempotency_key, run_id,
        decision_cycle_id, stage_name, status, lease_owner, lease_expires_at,
        fencing_token, attempt_count, canonical_input_hash, started_at, created_at
      ) VALUES (
        ${params.stageExecutionId}, ${params.tenantId}, ${targetWorkspaceId},
        ${params.idempotencyKey}, ${params.runId}, ${params.decisionCycleId},
        ${params.stageName}, 'RUNNING', ${params.leaseOwner},
        now() + (${leaseMs} || ' milliseconds')::interval,
        1, 1, ${params.canonicalInputHash}, now(), now()
      )
    `;
    return {
      claimed: true,
      stageExecutionId: params.stageExecutionId,
      fencingToken: 1,
      leaseOwner: params.leaseOwner,
      canonicalInputHash: params.canonicalInputHash,
      cycleEpoch: cycle.fencing_epoch,
    };
  }

  // C. Both exist but resolve to DIFFERENT StageExecutions: FAIL CLOSED
  if (stageById && stageByIdempotency && stageById.stage_execution_id !== stageByIdempotency.stage_execution_id) {
    throw new RegistryValidationError(
      "IDEMPOTENCY_CONFLICT",
      `Ambiguous StageExecution claim: stage_execution_id '${params.stageExecutionId}' and idempotency_key '${params.idempotencyKey}' resolve to different StageExecutions ('${stageById.stage_execution_id}' vs '${stageByIdempotency.stage_execution_id}').`,
    );
  }

  // B, D, E. Resolve to candidate existing stage
  const existingStage = stageById ?? stageByIdempotency;

  // 3. Exact existing-stage binding: require exact equality before renew/takeover
  if (existingStage.stage_execution_id !== params.stageExecutionId) {
    throw new RegistryValidationError(
      "IDEMPOTENCY_CONFLICT",
      `Existing stage stage_execution_id '${existingStage.stage_execution_id}' does not match claimed '${params.stageExecutionId}'.`,
    );
  }

  if (existingStage.tenant_id !== params.tenantId) {
    throw new RegistryValidationError(
      "TENANT_ISOLATION_VIOLATION",
      `Existing stage tenant_id '${existingStage.tenant_id}' does not match claimed '${params.tenantId}'.`,
    );
  }

  const existingWorkspaceId = existingStage.workspace_id ?? null;
  if (existingWorkspaceId !== targetWorkspaceId) {
    throw new RegistryValidationError(
      "WORKSPACE_ISOLATION_VIOLATION",
      `Existing stage workspace_id '${existingWorkspaceId}' does not match claimed '${targetWorkspaceId}'.`,
    );
  }

  if (existingStage.run_id !== params.runId) {
    throw new RegistryValidationError(
      "STAGE_CLAIM_SCOPE_MISMATCH",
      `Existing stage run_id '${existingStage.run_id}' does not match claimed '${params.runId}'.`,
    );
  }

  if (existingStage.decision_cycle_id !== params.decisionCycleId) {
    throw new RegistryValidationError(
      "STAGE_CLAIM_SCOPE_MISMATCH",
      `Existing stage decision_cycle_id '${existingStage.decision_cycle_id}' does not match claimed '${params.decisionCycleId}'.`,
    );
  }

  if (existingStage.stage_name !== params.stageName) {
    throw new RegistryValidationError(
      "STAGE_CLAIM_SCOPE_MISMATCH",
      `Existing stage stage_name '${existingStage.stage_name}' does not match claimed '${params.stageName}'.`,
    );
  }

  if (existingStage.idempotency_key !== params.idempotencyKey) {
    throw new RegistryValidationError(
      "IDEMPOTENCY_CONFLICT",
      `Existing stage idempotency_key '${existingStage.idempotency_key}' does not match claimed '${params.idempotencyKey}'.`,
    );
  }

  if (existingStage.canonical_input_hash !== params.canonicalInputHash) {
    throw new RegistryValidationError(
      "IDEMPOTENCY_CONFLICT",
      `StageExecution already finalized with canonical_input_hash '${existingStage.canonical_input_hash}', cannot replace with '${params.canonicalInputHash}'.`,
    );
  }

  // 4. Takeover / Renewal
  if (existingStage.status === "COMPLETED") {
    return {
      claimed: false,
      stageExecutionId: existingStage.stage_execution_id,
      fencingToken: existingStage.fencing_token,
      leaseOwner: existingStage.lease_owner,
      canonicalInputHash: existingStage.canonical_input_hash,
      cycleEpoch: cycle.fencing_epoch,
      reason: "STAGE_ALREADY_COMPLETED",
    };
  }

  const leaseExpiresAt = existingStage.lease_expires_at ? new Date(existingStage.lease_expires_at).getTime() : 0;
  const nowTime = Date.now();

  if (existingStage.status === "RUNNING" && leaseExpiresAt > nowTime && existingStage.lease_owner !== params.leaseOwner) {
    return {
      claimed: false,
      stageExecutionId: existingStage.stage_execution_id,
      fencingToken: existingStage.fencing_token,
      leaseOwner: existingStage.lease_owner,
      canonicalInputHash: existingStage.canonical_input_hash,
      cycleEpoch: cycle.fencing_epoch,
      reason: "LEASE_HELD_BY_ANOTHER_WORKER",
    };
  }

  if (existingStage.lease_owner === params.leaseOwner && leaseExpiresAt > nowTime) {
    await sqlTx`
      UPDATE stage_executions
      SET lease_expires_at = now() + (${leaseMs} || ' milliseconds')::interval
      WHERE stage_execution_id = ${existingStage.stage_execution_id}
        AND tenant_id = ${params.tenantId}
    `;
    return {
      claimed: true,
      stageExecutionId: existingStage.stage_execution_id,
      fencingToken: existingStage.fencing_token,
      leaseOwner: params.leaseOwner,
      canonicalInputHash: existingStage.canonical_input_hash,
      cycleEpoch: cycle.fencing_epoch,
    };
  }

  const nextToken = existingStage.fencing_token + 1;
  const nextAttempt = existingStage.attempt_count + 1;
  await sqlTx`
    UPDATE stage_executions
    SET lease_owner = ${params.leaseOwner},
        fencing_token = ${nextToken},
        attempt_count = ${nextAttempt},
        lease_expires_at = now() + (${leaseMs} || ' milliseconds')::interval,
        started_at = now(),
        status = 'RUNNING'
    WHERE stage_execution_id = ${existingStage.stage_execution_id}
      AND tenant_id = ${params.tenantId}
  `;
  return {
    claimed: true,
    stageExecutionId: existingStage.stage_execution_id,
    fencingToken: nextToken,
    leaseOwner: params.leaseOwner,
    canonicalInputHash: existingStage.canonical_input_hash,
    cycleEpoch: cycle.fencing_epoch,
  };
}
