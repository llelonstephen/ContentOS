/**
 * ContentOS — StageExecution & DecisionCycle Fencing Coordinator
 *
 * Implements SPEC01 §19, §82, §83, SPEC03 §103, §104:
 *   - Verifies DecisionCycle state (OPEN vs FREEZING/FROZEN/CANCELLED/SUPERSEDED)
 *   - Enforces StageExecution status (RUNNING required for canonical commits)
 *   - Enforces fencing token match to reject stale workers after lease takeover
 *   - Enforces lease owner and expiration
 *   - Prohibits omitting stage authorization when writing within a DecisionCycle
 */
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import { isStandaloneAuthority } from '../../../bootstrap/composition-root.js';

export interface StageFencingContext {
  decisionCycleId?: string | null;
  stageExecutionId?: string | null;
  fencingToken?: number | null;
  leaseOwner?: string | null;
}

export type WriteMode = 'STANDALONE' | 'DECISION_CYCLE';

export async function verifyStageFencing(
  sqlTx: any,
  params: {
    fencingContext?: StageFencingContext | null;
    tenantId: string;
    workspaceId?: string | null;
    requireCycleContext?: boolean;
    writeMode?: WriteMode;
    _standaloneAuthority?: unknown;
  },
): Promise<void> {
  const { fencingContext, tenantId, workspaceId, requireCycleContext, writeMode, _standaloneAuthority } = params;

  const hasCycleContext = !!fencingContext?.decisionCycleId;
  const isCycleMode = writeMode === 'DECISION_CYCLE' || requireCycleContext || hasCycleContext;

  if (writeMode === 'STANDALONE' && hasCycleContext) {
    throw new RegistryValidationError(
      'DECISION_CYCLE_CONTEXT_INVALID',
      'Standalone write mode cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
    );
  }

  if (!isCycleMode && !isStandaloneAuthority(_standaloneAuthority)) {
    throw new RegistryValidationError(
      'WRITE_AUTHORITY_REQUIRED',
      'Direct invocation of canonical knowledge persistence without verified write authority is forbidden. Decision-cycle writes require DecisionCycle and StageExecution fencing context; standalone writes require trusted StandaloneIngestionAdapter capability.',
    );
  }

  if (isCycleMode && !hasCycleContext) {
    throw new RegistryValidationError(
      'DECISION_CYCLE_CONTEXT_REQUIRED',
      'Canonical decision-cycle commit requires an explicit DecisionCycle context. Omitting stage authorization fails closed.',
    );
  }

  if (!hasCycleContext) {
    // Verified standalone write path under trusted capability
    return;
  }

  const { decisionCycleId, stageExecutionId, fencingToken, leaseOwner } = fencingContext;

  // 1. Verify DecisionCycle state
  const [cycle] = await sqlTx`
    SELECT decision_cycle_id, tenant_id, workspace_id, status, fencing_epoch, superseded_by_cycle_id
    FROM decision_cycles
    WHERE decision_cycle_id = ${decisionCycleId}
  `;

  if (!cycle) {
    throw new RegistryValidationError(
      'DECISION_CYCLE_NOT_FOUND',
      `DecisionCycle '${decisionCycleId}' does not exist.`,
    );
  }

  if (cycle.tenant_id !== tenantId) {
    throw new RegistryValidationError(
      'TENANT_ISOLATION_VIOLATION',
      `DecisionCycle tenant '${cycle.tenant_id}' does not match caller tenant '${tenantId}'.`,
    );
  }

  if (cycle.workspace_id && cycle.workspace_id !== workspaceId) {
    throw new RegistryValidationError(
      'WORKSPACE_ISOLATION_VIOLATION',
      `DecisionCycle is scoped to workspace '${cycle.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
    );
  }

  if (cycle.status === 'FREEZING' || cycle.status === 'FROZEN') {
    throw new RegistryValidationError(
      'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING',
      `Cannot commit canonical knowledge to DecisionCycle '${decisionCycleId}' in status '${cycle.status}'. Upstream knowledge commits are prohibited after FREEZING begins.`,
    );
  }

  if (
    cycle.status === 'CANCELLED' ||
    cycle.status === 'SUPERSEDED' ||
    cycle.status === 'FAILED' ||
    cycle.superseded_by_cycle_id
  ) {
    throw new RegistryValidationError(
      'STALE_WORKER_COMMIT_REJECTED',
      `Cannot commit canonical knowledge: DecisionCycle '${decisionCycleId}' is in terminal/stale status '${cycle.status}'. Stale worker commit rejected.`,
    );
  }

  // 2. In a decision cycle, StageExecution and fencing token are mandatory
  if (!stageExecutionId) {
    throw new RegistryValidationError(
      'STAGE_EXECUTION_CONTEXT_REQUIRED',
      `Decision-cycle commit requires stageExecutionId. Omitting stage authorization fails closed.`,
    );
  }

  if (fencingToken === undefined || fencingToken === null) {
    throw new RegistryValidationError(
      'FENCING_TOKEN_REQUIRED',
      `Decision-cycle commit requires fencingToken. Omitting fencing token fails closed.`,
    );
  }

  // 3. Verify StageExecution
  const [stage] = await sqlTx`
    SELECT stage_execution_id, tenant_id, workspace_id, status, lease_owner, lease_expires_at, fencing_token
    FROM stage_executions
    WHERE stage_execution_id = ${stageExecutionId}
  `;

  if (!stage) {
    throw new RegistryValidationError(
      'STAGE_EXECUTION_NOT_FOUND',
      `StageExecution '${stageExecutionId}' does not exist.`,
    );
  }

  if (stage.tenant_id !== tenantId) {
    throw new RegistryValidationError(
      'TENANT_ISOLATION_VIOLATION',
      `StageExecution tenant '${stage.tenant_id}' does not match caller tenant '${tenantId}'.`,
    );
  }

  if (stage.workspace_id && stage.workspace_id !== workspaceId) {
    throw new RegistryValidationError(
      'WORKSPACE_ISOLATION_VIOLATION',
      `StageExecution is scoped to workspace '${stage.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
    );
  }

  if (stage.status !== 'RUNNING') {
    throw new RegistryValidationError(
      'STAGE_EXECUTION_NOT_RUNNING',
      `StageExecution '${stageExecutionId}' has status '${stage.status}', expected 'RUNNING'. Stale worker commit rejected.`,
    );
  }

  if (stage.lease_expires_at && new Date(stage.lease_expires_at) < new Date()) {
    throw new RegistryValidationError(
      'LEASE_EXPIRED',
      `StageExecution '${stageExecutionId}' lease has expired. Stale worker commit rejected.`,
    );
  }

  if (leaseOwner && stage.lease_owner && stage.lease_owner !== leaseOwner) {
    throw new RegistryValidationError(
      'LEASE_OWNER_MISMATCH',
      `StageExecution '${stageExecutionId}' lease owner is '${stage.lease_owner}', expected '${leaseOwner}'. Lease was taken over by another worker.`,
    );
  }

  if (stage.fencing_token !== fencingToken) {
    throw new RegistryValidationError(
      'STALE_FENCING_TOKEN',
      `Stale fencing token ${fencingToken} for StageExecution '${stageExecutionId}'. Current token is ${stage.fencing_token}.`,
    );
  }
}
