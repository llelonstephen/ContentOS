import type {
  M4ContentRuntimeStage,
  StageFencingContext,
} from './stage-fencing-coordinator.js';

export interface ContentRuntimeCommitAuthority {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly run_id: string;
  readonly decision_cycle_id: string;
  readonly stage_execution_id: string;
  readonly fencing_token: number;
  readonly lease_owner: string;
  readonly cycle_epoch: number;
  readonly stage_name: M4ContentRuntimeStage;
  readonly idempotency_key: string;
  readonly run_config_id: string;
  readonly canonical_input_hash: string;
  readonly slot?: StageFencingContext['slot'];
}

export function assertContentRuntimeCommitAuthority(
  authority: ContentRuntimeCommitAuthority,
  expectedStage: M4ContentRuntimeStage | readonly M4ContentRuntimeStage[],
): void {
  const required = {
    tenant_id: authority.tenant_id,
    workspace_id: authority.workspace_id,
    run_id: authority.run_id,
    decision_cycle_id: authority.decision_cycle_id,
    stage_execution_id: authority.stage_execution_id,
    lease_owner: authority.lease_owner,
    idempotency_key: authority.idempotency_key,
    run_config_id: authority.run_config_id,
    canonical_input_hash: authority.canonical_input_hash,
  };
  for (const [name, value] of Object.entries(required)) {
    if (!value.trim()) throw new Error(`M4 commit authority requires ${name}`);
  }
  if (!Number.isSafeInteger(authority.fencing_token) || authority.fencing_token < 0) {
    throw new Error('M4 commit authority requires a non-negative fencing_token');
  }
  if (!Number.isSafeInteger(authority.cycle_epoch) || authority.cycle_epoch < 0) {
    throw new Error('M4 commit authority requires a non-negative cycle_epoch');
  }
  const allowed = Array.isArray(expectedStage) ? expectedStage : [expectedStage];
  if (!allowed.includes(authority.stage_name)) {
    throw new Error(
      `M4 stage '${authority.stage_name}' cannot commit this artifact; expected ${allowed.join(' or ')}`,
    );
  }
}

export function toStageFencingContext(
  authority: ContentRuntimeCommitAuthority,
): StageFencingContext {
  return {
    decisionCycleId: authority.decision_cycle_id,
    stageExecutionId: authority.stage_execution_id,
    fencingToken: authority.fencing_token,
    leaseOwner: authority.lease_owner,
    runId: authority.run_id,
    cycleEpoch: authority.cycle_epoch,
    stageName: authority.stage_name,
    canonicalInputHash: authority.canonical_input_hash,
    idempotencyKey: authority.idempotency_key,
    ...(authority.slot ? { slot: authority.slot } : {}),
  };
}
