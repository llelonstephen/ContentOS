/** Dual-fence authority checks for generic and M4 decision-cycle writes. */
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import {
  assertContentRuntimeSlot,
  type ContentRuntimeSlot,
} from './content-runtime-idempotency-repository.js';

export const M4_CONTENT_RUNTIME_STAGES = [
  'AUDIENCE_PROVISIONAL', 'AUDIENCE_REFINE', 'AUDIENCE_FINALIZE',
  'STRATEGY_GENERATE', 'STRATEGY_GATE', 'ARCHITECTURE_GENERATE',
  'CANDIDATE_GENERATE', 'CANDIDATE_REWRITE', 'SPEC06_HANDOFF',
] as const;

export type M4ContentRuntimeStage = (typeof M4_CONTENT_RUNTIME_STAGES)[number];
export type WriteMode = 'STANDALONE' | 'DECISION_CYCLE';
export type StageAuthorityScope = 'GENERIC' | 'M4_CONTENT_RUNTIME';

export interface StageFencingContext {
  decisionCycleId?: string | null;
  stageExecutionId?: string | null;
  fencingToken?: number | null;
  leaseOwner?: string | null;
  runId?: string | null;
  cycleEpoch?: number | null;
  stageName?: string | null;
  canonicalInputHash?: string | null;
  idempotencyKey?: string | null;
  slot?: ContentRuntimeSlot | null;
}

export interface VerifiedStageFencing {
  mode: WriteMode;
  stageStatus?: 'RUNNING' | 'COMPLETED';
}

interface VerifyParams {
  fencingContext?: StageFencingContext | null;
  tenantId: string;
  workspaceId?: string | null;
  requireCycleContext?: boolean;
  writeMode?: WriteMode;
  authorityScope?: StageAuthorityScope;
  allowCompletedReplay?: boolean;
  _standaloneAuthority?: unknown;
}

function fail(code: string, message: string): never {
  throw new RegistryValidationError(code, message);
}

function sameWorkspace(actual: unknown, expected?: string | null): boolean {
  return (actual ?? null) === (expected ?? null);
}

export async function verifyStandaloneDatabaseAuthority(sqlTx: any): Promise<void> {
  const [row] = await sqlTx`SELECT CURRENT_USER AS current_role`;
  if (row?.current_role !== 'contentos_standalone_role') {
    fail('WRITE_AUTHORITY_REQUIRED',
      `Canonical standalone write requires database role 'contentos_standalone_role'; active role is '${row?.current_role || 'unknown'}'.`);
  }
}

function requireM4Context(context?: StageFencingContext | null): Required<StageFencingContext> {
  const required = [
    'decisionCycleId', 'stageExecutionId', 'fencingToken', 'leaseOwner', 'runId',
    'cycleEpoch', 'stageName', 'canonicalInputHash', 'idempotencyKey',
  ] as const;
  for (const field of required) {
    if (context?.[field] === undefined || context[field] === null || context[field] === '') {
      fail('M4_FENCING_CONTEXT_INCOMPLETE', `M4 canonical commit requires '${field}'.`);
    }
  }
  if (!M4_CONTENT_RUNTIME_STAGES.includes(context!.stageName as M4ContentRuntimeStage)) {
    fail('M4_STAGE_NOT_ALLOWED', `Stage '${context!.stageName}' is not an allowed M4 stage.`);
  }
  assertContentRuntimeSlot(context!.stageName!, context!.slot);
  return context as Required<StageFencingContext>;
}

async function verifyM4StageFencing(sqlTx: any, params: VerifyParams): Promise<VerifiedStageFencing> {
  if (params.writeMode !== 'DECISION_CYCLE') {
    fail('M4_STANDALONE_WRITE_FORBIDDEN', 'M4 canonical writes require DECISION_CYCLE mode.');
  }
  const context = requireM4Context(params.fencingContext);
  const [run] = await sqlTx`
    SELECT run_id, tenant_id, workspace_id, status, current_decision_cycle_id
    FROM runs WHERE run_id = ${context.runId} FOR UPDATE
  `;
  if (!run) fail('RUN_NOT_FOUND', `Run '${context.runId}' does not exist.`);
  if (run.tenant_id !== params.tenantId) fail('TENANT_ISOLATION_VIOLATION', 'Run tenant mismatch.');
  if (!sameWorkspace(run.workspace_id, params.workspaceId)) fail('WORKSPACE_ISOLATION_VIOLATION', 'Run workspace mismatch.');
  if (run.status !== 'RUNNING') fail('STALE_WORKER_COMMIT_REJECTED', `Run '${context.runId}' is '${run.status}', not RUNNING.`);
  if (run.current_decision_cycle_id !== context.decisionCycleId) {
    fail('DECISION_CYCLE_NOT_CURRENT', 'Supplied DecisionCycle is not the Run current cycle.');
  }

  const [cycle] = await sqlTx`
    SELECT decision_cycle_id, tenant_id, workspace_id, run_id, status,
           fencing_epoch, superseded_by_cycle_id
    FROM decision_cycles WHERE decision_cycle_id = ${context.decisionCycleId} FOR UPDATE
  `;
  if (!cycle) fail('DECISION_CYCLE_NOT_FOUND', `DecisionCycle '${context.decisionCycleId}' does not exist.`);
  if (cycle.tenant_id !== params.tenantId) fail('TENANT_ISOLATION_VIOLATION', 'DecisionCycle tenant mismatch.');
  if (!sameWorkspace(cycle.workspace_id, params.workspaceId)) fail('WORKSPACE_ISOLATION_VIOLATION', 'DecisionCycle workspace mismatch.');
  if (cycle.run_id !== context.runId) fail('DECISION_CYCLE_RUN_MISMATCH', 'DecisionCycle run binding mismatch.');
  if (cycle.status !== 'OPEN' || cycle.superseded_by_cycle_id) {
    const code = cycle.status === 'FREEZING' || cycle.status === 'FROZEN'
      ? 'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING' : 'STALE_WORKER_COMMIT_REJECTED';
    fail(code, `DecisionCycle '${context.decisionCycleId}' is not writable.`);
  }
  if (cycle.fencing_epoch !== context.cycleEpoch) {
    fail('STALE_CYCLE_EPOCH', `Cycle epoch ${context.cycleEpoch} is stale; current epoch is ${cycle.fencing_epoch}.`);
  }

  const [stage] = await sqlTx`
    SELECT stage_execution_id, tenant_id, workspace_id, run_id, decision_cycle_id,
           stage_name, status, lease_owner, lease_expires_at, fencing_token,
           canonical_input_hash, idempotency_key
    FROM stage_executions WHERE stage_execution_id = ${context.stageExecutionId} FOR UPDATE
  `;
  if (!stage) fail('STAGE_EXECUTION_NOT_FOUND', `StageExecution '${context.stageExecutionId}' does not exist.`);
  const bindings = [
    [stage.tenant_id, params.tenantId, 'TENANT_ISOLATION_VIOLATION'],
    [stage.run_id, context.runId, 'STAGE_RUN_MISMATCH'],
    [stage.decision_cycle_id, context.decisionCycleId, 'STAGE_CYCLE_MISMATCH'],
    [stage.stage_name, context.stageName, 'STAGE_NAME_MISMATCH'],
    [stage.idempotency_key, context.idempotencyKey, 'IDEMPOTENCY_KEY_MISMATCH'],
    [stage.canonical_input_hash, context.canonicalInputHash, 'IDEMPOTENCY_CONFLICT'],
  ] as const;
  for (const [actual, expected, code] of bindings) {
    if (actual !== expected) fail(code, `StageExecution exact binding failed for '${code}'.`);
  }
  if (!sameWorkspace(stage.workspace_id, params.workspaceId)) fail('WORKSPACE_ISOLATION_VIOLATION', 'StageExecution workspace mismatch.');
  const isReplay = stage.status === 'COMPLETED' && params.allowCompletedReplay;
  if (stage.status !== 'RUNNING' && !isReplay) fail('STAGE_EXECUTION_NOT_RUNNING', `StageExecution status '${stage.status}' cannot commit.`);
  if (stage.fencing_token !== context.fencingToken) fail('STALE_FENCING_TOKEN', 'Stage fencing token mismatch.');
  if (stage.lease_owner !== context.leaseOwner) fail('LEASE_OWNER_MISMATCH', 'Stage lease owner mismatch.');
  if (!isReplay && (!stage.lease_expires_at || new Date(stage.lease_expires_at) <= new Date())) {
    fail('LEASE_EXPIRED', `StageExecution '${context.stageExecutionId}' lease is absent or expired.`);
  }
  return { mode: 'DECISION_CYCLE', stageStatus: isReplay ? 'COMPLETED' : 'RUNNING' };
}

async function verifyGenericStageFencing(sqlTx: any, params: VerifyParams): Promise<VerifiedStageFencing> {
  const context = params.fencingContext;
  const [cycle] = await sqlTx`
    SELECT decision_cycle_id, tenant_id, workspace_id, status, fencing_epoch, superseded_by_cycle_id
    FROM decision_cycles WHERE decision_cycle_id = ${context!.decisionCycleId}
  `;
  if (!cycle) fail('DECISION_CYCLE_NOT_FOUND', `DecisionCycle '${context!.decisionCycleId}' does not exist.`);
  if (cycle.tenant_id !== params.tenantId) fail('TENANT_ISOLATION_VIOLATION', 'DecisionCycle tenant mismatch.');
  if (cycle.workspace_id && cycle.workspace_id !== params.workspaceId) fail('WORKSPACE_ISOLATION_VIOLATION', 'DecisionCycle workspace mismatch.');
  if (cycle.status === 'FREEZING' || cycle.status === 'FROZEN') {
    fail('KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING', 'Canonical writes are prohibited after FREEZING begins.');
  }
  if (['CANCELLED', 'SUPERSEDED', 'FAILED'].includes(cycle.status) || cycle.superseded_by_cycle_id) {
    fail('STALE_WORKER_COMMIT_REJECTED', 'DecisionCycle is terminal or superseded.');
  }
  if (!context?.stageExecutionId) fail('STAGE_EXECUTION_CONTEXT_REQUIRED', 'stageExecutionId is required.');
  if (context.fencingToken === undefined || context.fencingToken === null) fail('FENCING_TOKEN_REQUIRED', 'fencingToken is required.');
  const [stage] = await sqlTx`
    SELECT stage_execution_id, tenant_id, workspace_id, status, lease_owner, lease_expires_at, fencing_token
    FROM stage_executions WHERE stage_execution_id = ${context.stageExecutionId}
  `;
  if (!stage) fail('STAGE_EXECUTION_NOT_FOUND', `StageExecution '${context.stageExecutionId}' does not exist.`);
  if (stage.tenant_id !== params.tenantId) fail('TENANT_ISOLATION_VIOLATION', 'StageExecution tenant mismatch.');
  if (stage.workspace_id && stage.workspace_id !== params.workspaceId) fail('WORKSPACE_ISOLATION_VIOLATION', 'StageExecution workspace mismatch.');
  if (stage.status !== 'RUNNING') fail('STAGE_EXECUTION_NOT_RUNNING', 'StageExecution is not RUNNING.');
  if (stage.lease_expires_at && new Date(stage.lease_expires_at) < new Date()) fail('LEASE_EXPIRED', 'Lease expired.');
  if (context.leaseOwner && stage.lease_owner && stage.lease_owner !== context.leaseOwner) fail('LEASE_OWNER_MISMATCH', 'Lease owner mismatch.');
  if (stage.fencing_token !== context.fencingToken) fail('STALE_FENCING_TOKEN', 'Fencing token mismatch.');
  return { mode: 'DECISION_CYCLE', stageStatus: 'RUNNING' };
}

export async function verifyStageFencing(sqlTx: any, params: VerifyParams): Promise<VerifiedStageFencing> {
  if (params.authorityScope === 'M4_CONTENT_RUNTIME') return verifyM4StageFencing(sqlTx, params);
  const hasCycleContext = !!params.fencingContext?.decisionCycleId;
  const cycleMode = params.writeMode === 'DECISION_CYCLE' || params.requireCycleContext || hasCycleContext;
  if (params.writeMode === 'STANDALONE' && hasCycleContext) fail('DECISION_CYCLE_CONTEXT_INVALID', 'Standalone mode cannot attach to a DecisionCycle.');
  if (cycleMode && !hasCycleContext) fail('DECISION_CYCLE_CONTEXT_REQUIRED', 'Decision-cycle commit requires explicit cycle context.');
  if (!cycleMode) {
    await verifyStandaloneDatabaseAuthority(sqlTx);
    return { mode: 'STANDALONE' };
  }
  return verifyGenericStageFencing(sqlTx, params);
}
