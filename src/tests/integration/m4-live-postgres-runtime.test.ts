import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyStageFencing } from '../../persistence/relational/services/stage-fencing-coordinator.js';
import { createContentRuntimeIdempotencyIdentity } from '../../persistence/relational/services/content-runtime-idempotency-repository.js';

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ??
  'postgresql://localhost:5432/contentos_test';
const databaseName = new URL(url).pathname.slice(1);
if (!databaseName.includes('test')) throw new Error('M4 live suite refuses non-test database');
const sql = postgres(url, { max: 4 });
const migration = ['0006_m4_content_intelligence_invariants.sql', '0007_m4_audit_authority_remediation.sql',
  '0008_m4_completion_and_generation_authority.sql', '0009_spec05_v104_audience_authority.sql']
  .flatMap((file) => readFileSync(path.resolve(
    process.cwd(), `src/persistence/relational/migrations/${file}`,
  ), 'utf8').split('--> statement-breakpoint'))
  .map((statement) => statement.trim()).filter(Boolean);

async function applyM4Migration(): Promise<void> {
  for (const statement of migration) await sql.unsafe(statement);
}

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

async function createCompletionFixture(tx: any) {
  const [dependency] = await tx`SELECT task_revision_id,
    (SELECT run_config_id FROM run_configs LIMIT 1) AS run_config_id,
    (SELECT baseline_snapshot_id FROM baseline_knowledge_snapshots LIMIT 1) AS baseline_snapshot_id,
    tenant_id, workspace_id FROM task_contract_revisions LIMIT 1`;
  const suffix = randomUUID();
  const runId = `m4-run-${suffix}`;
  const cycleId = `m4-cycle-${suffix}`;
  const stageId = `m4-stage-${suffix}`;
  const identity = createContentRuntimeIdempotencyIdentity({
    tenantId: dependency.tenant_id, workspaceId: dependency.workspace_id,
    runId, decisionCycleId: cycleId, cycleEpoch: 1, stageName: 'CANDIDATE_GENERATE',
    slot: { kind: 'variantSlot', value: 'primary' },
    canonicalInput: { taskRevisionId: dependency.task_revision_id },
  });
  await tx`INSERT INTO runs (run_id, tenant_id, workspace_id, run_correlation_key,
    task_revision_id, initialization_cutoff, initial_run_config_id,
    initial_baseline_snapshot_id, status, version)
    VALUES (${runId}, ${dependency.tenant_id}, ${dependency.workspace_id}, ${`corr-${suffix}`},
      ${dependency.task_revision_id}, now(), ${dependency.run_config_id},
      ${dependency.baseline_snapshot_id}, 'RUNNING', 0)`;
  await tx`INSERT INTO decision_cycles (decision_cycle_id, tenant_id, workspace_id,
    run_id, cycle_number, reason, status, fencing_epoch)
    VALUES (${cycleId}, ${dependency.tenant_id}, ${dependency.workspace_id},
      ${runId}, 1, 'M4_TEST', 'OPEN', 1)`;
  await tx`UPDATE runs SET current_decision_cycle_id = ${cycleId} WHERE run_id = ${runId}`;
  await tx`INSERT INTO stage_executions (stage_execution_id, tenant_id, workspace_id,
    idempotency_key, run_id, decision_cycle_id, stage_name, status, lease_owner,
    lease_expires_at, fencing_token, attempt_count, canonical_input_hash)
    VALUES (${stageId}, ${dependency.tenant_id}, ${dependency.workspace_id},
      ${identity.idempotencyKey}, ${runId}, ${cycleId}, 'CANDIDATE_GENERATE', 'RUNNING',
      'm4-live-worker', now() + interval '5 minutes', 2, 1, ${identity.canonicalInputHash})`;
  return { dependency, runId, cycleId, stageId, identity };
}

async function invokeCompletionAsRuntime(tx: any, fixture: Awaited<ReturnType<typeof createCompletionFixture>>, overrides: Partial<{
  stageId: string; tenantId: string; workspaceId: string | null; runId: string; cycleId: string;
  epoch: number; stageName: string; leaseOwner: string; token: number; key: string; hash: string;
}> = {}): Promise<boolean> {
  await tx`SET LOCAL ROLE contentos_runtime_role`;
  const [result] = await tx`SELECT public.complete_m4_stage_execution(
    ${overrides.stageId ?? fixture.stageId}, ${overrides.tenantId ?? fixture.dependency.tenant_id},
    ${overrides.workspaceId ?? fixture.dependency.workspace_id}, ${overrides.runId ?? fixture.runId},
    ${overrides.cycleId ?? fixture.cycleId}, ${overrides.epoch ?? 1},
    ${overrides.stageName ?? 'CANDIDATE_GENERATE'}, ${overrides.leaseOwner ?? 'm4-live-worker'},
    ${overrides.token ?? 2}, ${overrides.key ?? fixture.identity.idempotencyKey},
    ${overrides.hash ?? fixture.identity.canonicalInputHash}
  ) AS completed`;
  await tx`RESET ROLE`;
  return result.completed;
}

describe('M4 live PostgreSQL runtime invariants', () => {
  beforeAll(async () => {
    const [row] = await sql`SELECT to_regclass('public.content_architectures') AS relation`;
    expect(row.relation).toBe('content_architectures');
  });
  beforeAll(applyM4Migration);
  afterAll(async () => sql.end());

  it('requires exact immutable registry identity for Architecture inserts', async () => {
    const [strategy] = await sql`SELECT strategy_id, task_revision_id, tenant_id, workspace_id
      FROM strategy_hypotheses LIMIT 1`;
    expect(strategy).toBeTruthy();
    await expect(sql`INSERT INTO content_architectures (
      architecture_id, tenant_id, workspace_id, task_revision_id, strategy_id, created_at
    ) VALUES (${`arch-no-reg-${randomUUID()}`}, ${strategy.tenant_id}, ${strategy.workspace_id},
      ${strategy.task_revision_id}, ${strategy.strategy_id}, now())`).rejects.toThrow(/REGISTRY_IDENTITY_REQUIRED/);
  });

  it('enforces immutable Architecture and Candidate lineage self references', async () => {
    const names = await sql`SELECT conname FROM pg_constraint
      WHERE conname IN ('fk_content_arch_supersedes', 'fk_content_candidate_parent') ORDER BY conname`;
    expect(names.map(({ conname }) => conname)).toEqual([
      'fk_content_arch_supersedes', 'fk_content_candidate_parent',
    ]);
  });

  it('denies runtime UPDATE/DELETE authority on immutable M4 tables', async () => {
    const [row] = await sql`SELECT
      has_table_privilege('contentos_runtime_role', 'content_candidates', 'UPDATE') AS can_update,
      has_table_privilege('contentos_runtime_role', 'content_candidates', 'DELETE') AS can_delete,
      has_table_privilege('contentos_runtime_role', 'content_candidates', 'INSERT') AS can_insert,
      has_table_privilege('contentos_runtime_role', 'outbox_events', 'UPDATE') AS can_mutate_outbox`;
    expect(row).toEqual({
      can_update: false, can_delete: false, can_insert: true, can_mutate_outbox: false,
    });
  });

  it.each([
    ['wrong stage execution id', async (tx: any, f: any) => invokeCompletionAsRuntime(tx, f, { stageId: 'stale-stage' })],
    ['wrong stage name', async (tx: any, f: any) => invokeCompletionAsRuntime(tx, f, { stageName: 'STRATEGY_GATE' })],
    ['non-running stage', async (tx: any, f: any) => { await tx`UPDATE stage_executions SET status = 'FAILED' WHERE stage_execution_id = ${f.stageId}`; return invokeCompletionAsRuntime(tx, f); }],
    ['stale lease owner', async (tx: any, f: any) => invokeCompletionAsRuntime(tx, f, { leaseOwner: 'stale-worker' })],
    ['expired lease', async (tx: any, f: any) => { await tx`UPDATE stage_executions SET lease_expires_at = now() - interval '1 second' WHERE stage_execution_id = ${f.stageId}`; return invokeCompletionAsRuntime(tx, f); }],
    ['stale fencing token', async (tx: any, f: any) => invokeCompletionAsRuntime(tx, f, { token: 99 })],
    ['wrong idempotency key or input hash', async (tx: any, f: any) => invokeCompletionAsRuntime(tx, f, { key: 'forged', hash: 'forged' })],
    ['non-current run cycle', async (tx: any, f: any) => {
      const replacement = `${f.cycleId}-replacement`;
      await tx`INSERT INTO decision_cycles (decision_cycle_id, tenant_id, workspace_id, run_id,
        cycle_number, reason, status, fencing_epoch) VALUES (${replacement}, ${f.dependency.tenant_id},
        ${f.dependency.workspace_id}, ${f.runId}, 2, 'M4_REPLACEMENT', 'OPEN', 1)`;
      await tx`UPDATE runs SET current_decision_cycle_id = ${replacement} WHERE run_id = ${f.runId}`;
      return invokeCompletionAsRuntime(tx, f);
    }],
    ['non-open or superseded cycle', async (tx: any, f: any) => { await tx`UPDATE decision_cycles SET status = 'FREEZING' WHERE decision_cycle_id = ${f.cycleId}`; return invokeCompletionAsRuntime(tx, f); }],
    ['stale cycle epoch', async (tx: any, f: any) => { await tx`UPDATE decision_cycles SET fencing_epoch = 2 WHERE decision_cycle_id = ${f.cycleId}`; return invokeCompletionAsRuntime(tx, f); }],
  ])('runtime role atomically rejects %s', async (_name, attack) => {
    await withRollback(async (tx) => {
      const fixture = await createCompletionFixture(tx);
      await expect(attack(tx, fixture)).resolves.toBe(false);
    });
  });

  it.each([
    'fencing_token = 999', 'lease_owner = \'attacker\'',
    'canonical_input_hash = \'forged\'', 'idempotency_key = \'forged\'',
    'stage_name = \'CANDIDATE_GENERATE\'', 'run_id = \'forged-run\'',
    'decision_cycle_id = \'forged-cycle\'', 'status = \'COMPLETED\'',
  ])('runtime role cannot directly forge StageExecution %s', async (mutation) => {
    await expect(sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE contentos_runtime_role`;
      await tx.unsafe(`UPDATE public.stage_executions SET ${mutation} WHERE false`);
    })).rejects.toThrow(/permission denied/i);
  });

  it('rejects cross-tenant references even when ordinary foreign keys resolve', async () => {
    await withRollback(async (tx) => {
      const [dependency] = await tx`SELECT strategy.task_revision_id, strategy.strategy_id,
        strategy.tenant_id, strategy.workspace_id, config.run_config_id
        FROM strategy_hypotheses strategy
        JOIN run_configs config ON config.tenant_id = strategy.tenant_id
          AND config.workspace_id IS NOT DISTINCT FROM strategy.workspace_id
        LIMIT 1`;
      expect(dependency).toBeTruthy();
      const architectureId = `scope-source-${randomUUID()}`;
      await tx`INSERT INTO immutable_entity_registry (
        entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
      ) VALUES ('ContentArchitecture', ${architectureId}, ${dependency.tenant_id},
        ${dependency.workspace_id}, 'AVAILABLE', now())`;
      await tx`INSERT INTO content_architectures (
        architecture_id, tenant_id, workspace_id, task_revision_id, strategy_id, created_at
      ) VALUES (${architectureId}, ${dependency.tenant_id}, ${dependency.workspace_id},
        ${dependency.task_revision_id}, ${dependency.strategy_id}, now())`;
      const candidateId = `cross-scope-${randomUUID()}`;
      await tx`INSERT INTO immutable_entity_registry (
        entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
      ) VALUES ('ContentCandidate', ${candidateId}, 'attacker-tenant', NULL, 'AVAILABLE', now())`;
      await expect(tx`INSERT INTO content_candidates (
        candidate_id, tenant_id, workspace_id, task_revision_id, strategy_id,
        architecture_id, content_payload, run_config_id, created_at
      ) VALUES (${candidateId}, 'attacker-tenant', NULL, ${dependency.task_revision_id},
        ${dependency.strategy_id}, ${architectureId}, '{}',
        ${dependency.run_config_id}, now())`).rejects.toThrow(/M4_REFERENCE_SCOPE_VIOLATION/);
    });
  });

  it('binds live writes to run/current-cycle/epoch/stage/hash/token and rejects FREEZING', async () => {
    await withRollback(async (tx) => {
      const [dependency] = await tx`SELECT task_revision_id,
        (SELECT run_config_id FROM run_configs LIMIT 1) AS run_config_id,
        (SELECT baseline_snapshot_id FROM baseline_knowledge_snapshots LIMIT 1) AS baseline_snapshot_id,
        tenant_id, workspace_id FROM task_contract_revisions LIMIT 1`;
      const suffix = randomUUID();
      const runId = `m4-run-${suffix}`;
      const cycleId = `m4-cycle-${suffix}`;
      const stageId = `m4-stage-${suffix}`;
      const identity = createContentRuntimeIdempotencyIdentity({
        tenantId: dependency.tenant_id, workspaceId: dependency.workspace_id,
        runId, decisionCycleId: cycleId, cycleEpoch: 1,
        stageName: 'CANDIDATE_GENERATE',
        slot: { kind: 'variantSlot', value: 'primary' },
        canonicalInput: { taskRevisionId: dependency.task_revision_id },
      });
      await tx`INSERT INTO runs (run_id, tenant_id, workspace_id, run_correlation_key,
        task_revision_id, initialization_cutoff, initial_run_config_id,
        initial_baseline_snapshot_id, status, version)
        VALUES (${runId}, ${dependency.tenant_id}, ${dependency.workspace_id}, ${`corr-${suffix}`},
          ${dependency.task_revision_id}, now(), ${dependency.run_config_id},
          ${dependency.baseline_snapshot_id}, 'RUNNING', 0)`;
      await tx`INSERT INTO decision_cycles (decision_cycle_id, tenant_id, workspace_id,
        run_id, cycle_number, reason, status, fencing_epoch)
        VALUES (${cycleId}, ${dependency.tenant_id}, ${dependency.workspace_id},
          ${runId}, 1, 'M4_TEST', 'OPEN', 1)`;
      await tx`UPDATE runs SET current_decision_cycle_id = ${cycleId} WHERE run_id = ${runId}`;
      await tx`INSERT INTO stage_executions (stage_execution_id, tenant_id, workspace_id,
        idempotency_key, run_id, decision_cycle_id, stage_name, status, lease_owner,
        lease_expires_at, fencing_token, attempt_count, canonical_input_hash)
        VALUES (${stageId}, ${dependency.tenant_id}, ${dependency.workspace_id},
          ${identity.idempotencyKey}, ${runId}, ${cycleId}, 'CANDIDATE_GENERATE', 'RUNNING',
          'm4-live-worker', now() + interval '5 minutes', 2, 1, ${identity.canonicalInputHash})`;
      const context = { decisionCycleId: cycleId, stageExecutionId: stageId, runId,
        cycleEpoch: 1, stageName: 'CANDIDATE_GENERATE', leaseOwner: 'm4-live-worker',
        fencingToken: 2, canonicalInputHash: identity.canonicalInputHash,
        idempotencyKey: identity.idempotencyKey,
        slot: { kind: 'variantSlot' as const, value: 'primary' } };
      await expect(verifyStageFencing(tx, { fencingContext: context,
        tenantId: dependency.tenant_id, workspaceId: dependency.workspace_id,
        writeMode: 'DECISION_CYCLE', authorityScope: 'M4_CONTENT_RUNTIME' }))
        .resolves.toMatchObject({ stageStatus: 'RUNNING' });
      await tx`SET LOCAL ROLE contentos_runtime_role`;
      const [completed] = await tx`SELECT public.complete_m4_stage_execution(
        ${stageId}, ${dependency.tenant_id}, ${dependency.workspace_id}, ${runId}, ${cycleId},
        1, 'CANDIDATE_GENERATE', 'm4-live-worker', 2, ${identity.idempotencyKey},
        ${identity.canonicalInputHash}
      ) AS completed`;
      expect(completed.completed).toBe(true);
      await tx`RESET ROLE`;
      await tx`UPDATE decision_cycles SET status = 'FREEZING' WHERE decision_cycle_id = ${cycleId}`;
      await expect(verifyStageFencing(tx, { fencingContext: context,
        tenantId: dependency.tenant_id, workspaceId: dependency.workspace_id,
        writeMode: 'DECISION_CYCLE', authorityScope: 'M4_CONTENT_RUNTIME' }))
        .rejects.toMatchObject({ code: 'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING' });
    });
  });
});
