import { describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createContentRuntimeIdempotencyIdentity,
} from '../../persistence/relational/services/content-runtime-idempotency-repository.js';
import {
  verifyStageFencing,
  type StageFencingContext,
} from '../../persistence/relational/services/stage-fencing-coordinator.js';
import {
  executeContentRuntimeCommit,
} from '../../persistence/relational/services/content-runtime-transaction-context.js';

interface FakeRows {
  run: Record<string, unknown>;
  cycle: Record<string, unknown>;
  stage: Record<string, unknown>;
  outputs?: Record<string, unknown>[];
}

function createFakeSql(rows: FakeRows) {
  const queries: string[] = [];
  const tag = async (strings: TemplateStringsArray): Promise<any[]> => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    queries.push(query);
    if (query.includes('JOIN run_configs config')) return [{
      initial_run_config_id: 'config-1', run_config_id: 'config-1',
      runtime_parameters: JSON.stringify({ prompt_revision_id: 'prompt-1', model_revision_id: 'model-1',
        tool_revision_ids: ['tool-1'], schema_revision_id: 'schema-1' }),
    }];
    if (query.includes('FROM runs')) return [rows.run];
    if (query.includes('FROM decision_cycles')) return [rows.cycle];
    if (query.includes('FROM stage_executions')) return [rows.stage];
    if (query.includes('FROM stage_execution_output_refs')) return rows.outputs ?? [];
    if (query.includes('FROM immutable_entity_registry')) {
      return [{
        entity_type: 'AudienceState', entity_id: 'aud-1', tenant_id: 'tenant-1',
        workspace_id: 'workspace-1', payload_state: 'AVAILABLE',
      }];
    }
    if (query.includes('complete_m4_stage_execution')) return [{ completed: true }];
    if (query.includes('INSERT INTO outbox_events')) return [{ event_id: '11111111-1111-4111-8111-111111111111' }];
    return [];
  };
  const sql = Object.assign(tag, {
    begin: async <T>(callback: (sqlTx: typeof tag) => Promise<T>): Promise<T> => callback(tag),
  });
  return { sql, queries };
}

function baseFixture(status = 'RUNNING'): {
  rows: FakeRows;
  context: StageFencingContext;
} {
  const identity = createContentRuntimeIdempotencyIdentity({
    tenantId: 'tenant-1', workspaceId: 'workspace-1', runId: 'run-1',
    decisionCycleId: 'cycle-1', cycleEpoch: 3, stageName: 'AUDIENCE_FINALIZE',
    canonicalInput: { taskRevisionId: 'task-1' },
  });
  const context: StageFencingContext = {
    decisionCycleId: 'cycle-1', stageExecutionId: 'stage-1', runId: 'run-1',
    cycleEpoch: 3, stageName: 'AUDIENCE_FINALIZE', fencingToken: 7,
    leaseOwner: 'worker-1', ...identity,
  };
  return {
    context,
    rows: {
      run: {
        run_id: 'run-1', tenant_id: 'tenant-1', workspace_id: 'workspace-1',
        status: 'RUNNING', current_decision_cycle_id: 'cycle-1',
      },
      cycle: {
        decision_cycle_id: 'cycle-1', tenant_id: 'tenant-1', workspace_id: 'workspace-1',
        run_id: 'run-1', status: 'OPEN', fencing_epoch: 3, superseded_by_cycle_id: null,
      },
      stage: {
        stage_execution_id: 'stage-1', tenant_id: 'tenant-1', workspace_id: 'workspace-1',
        run_id: 'run-1', decision_cycle_id: 'cycle-1', stage_name: 'AUDIENCE_FINALIZE',
        status, lease_owner: 'worker-1', lease_expires_at: new Date(Date.now() + 60_000),
        fencing_token: 7, canonical_input_hash: identity.canonicalInputHash,
        idempotency_key: identity.idempotencyKey,
      },
    },
  };
}

describe('M4 persistence fencing and atomicity', () => {
  it('binds slots into both exact idempotency and canonical hash identity', () => {
    const common = {
      tenantId: 'tenant-1', runId: 'run-1', decisionCycleId: 'cycle-1',
      cycleEpoch: 2, stageName: 'STRATEGY_GENERATE', canonicalInput: { audience: 'aud-1' },
    };
    const first = createContentRuntimeIdempotencyIdentity({
      ...common, slot: { kind: 'strategySlot', value: 'slot-a' },
    });
    const retry = createContentRuntimeIdempotencyIdentity({
      ...common, slot: { kind: 'strategySlot', value: 'slot-a' },
    });
    const distinct = createContentRuntimeIdempotencyIdentity({
      ...common, slot: { kind: 'strategySlot', value: 'slot-b' },
    });
    const changed = createContentRuntimeIdempotencyIdentity({
      ...common, slot: { kind: 'strategySlot', value: 'slot-a' },
      canonicalInput: { audience: 'aud-2' },
    });
    expect(retry).toEqual(first);
    expect(distinct.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(distinct.canonicalInputHash).not.toBe(first.canonicalInputHash);
    expect(changed.idempotencyKey).toBe(first.idempotencyKey);
    expect(changed.canonicalInputHash).not.toBe(first.canonicalInputHash);
  });

  it('locks and validates run, current cycle, then exact stage', async () => {
    const fixture = baseFixture();
    const { sql, queries } = createFakeSql(fixture.rows);
    const result = await verifyStageFencing(sql, {
      fencingContext: fixture.context, tenantId: 'tenant-1', workspaceId: 'workspace-1',
      writeMode: 'DECISION_CYCLE', authorityScope: 'M4_CONTENT_RUNTIME',
    });
    expect(result.stageStatus).toBe('RUNNING');
    expect(queries.slice(0, 3).map((query) => query.match(/FROM (\w+)/)?.[1]))
      .toEqual(['runs', 'decision_cycles', 'stage_executions']);
    expect(queries.slice(0, 3).every((query) => query.includes('FOR UPDATE'))).toBe(true);
  });

  it.each([
    ['old epoch', (fixture: ReturnType<typeof baseFixture>) => { fixture.context.cycleEpoch = 2; }, 'STALE_CYCLE_EPOCH'],
    ['non-current cycle', (fixture: ReturnType<typeof baseFixture>) => { fixture.rows.run.current_decision_cycle_id = 'cycle-2'; }, 'DECISION_CYCLE_NOT_CURRENT'],
    ['changed hash', (fixture: ReturnType<typeof baseFixture>) => { fixture.context.canonicalInputHash = 'changed'; }, 'IDEMPOTENCY_CONFLICT'],
    ['wrong stage', (fixture: ReturnType<typeof baseFixture>) => { fixture.context.stageName = 'STRATEGY_GATE'; }, 'STAGE_NAME_MISMATCH'],
    ['stale token', (fixture: ReturnType<typeof baseFixture>) => { fixture.context.fencingToken = 6; }, 'STALE_FENCING_TOKEN'],
    ['freezing cycle', (fixture: ReturnType<typeof baseFixture>) => { fixture.rows.cycle.status = 'FREEZING'; }, 'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING'],
  ])('rejects %s', async (_label, mutate, code) => {
    const fixture = baseFixture();
    mutate(fixture);
    const { sql } = createFakeSql(fixture.rows);
    await expect(verifyStageFencing(sql, {
      fencingContext: fixture.context, tenantId: 'tenant-1', workspaceId: 'workspace-1',
      writeMode: 'DECISION_CYCLE', authorityScope: 'M4_CONTENT_RUNTIME',
    })).rejects.toMatchObject({ code });
  });

  it('forbids M4 standalone while retaining generic standalone authority', async () => {
    const fixture = baseFixture();
    const { sql } = createFakeSql(fixture.rows);
    await expect(verifyStageFencing(sql, {
      fencingContext: fixture.context, tenantId: 'tenant-1', workspaceId: 'workspace-1',
      writeMode: 'STANDALONE', authorityScope: 'M4_CONTENT_RUNTIME',
    })).rejects.toMatchObject({ code: 'M4_STANDALONE_WRITE_FORBIDDEN' });

    const standalone = async (strings: TemplateStringsArray): Promise<any[]> =>
      strings.join('').includes('CURRENT_USER')
        ? [{ current_role: 'contentos_standalone_role' }] : [];
    await expect(verifyStageFencing(standalone, {
      tenantId: 'tenant-1', writeMode: 'STANDALONE',
    })).resolves.toMatchObject({ mode: 'STANDALONE' });
  });

  it('converges an exact completed retry from stored output refs without writing', async () => {
    const fixture = baseFixture('COMPLETED');
    fixture.rows.outputs = [{
      ordinal: 0, ref_kind: 'IMMUTABLE_ENTITY', entity_type: 'AudienceState',
      entity_id: 'aud-1', stable_id: null, revision_id: null,
    }];
    const { sql, queries } = createFakeSql(fixture.rows);
    const insertGraph = vi.fn();
    const result = await executeContentRuntimeCommit(sql, {
      tenantId: 'tenant-1', workspaceId: 'workspace-1', runConfigId: 'config-1', fencingContext: fixture.context,
      generationAuthority: { kind: 'PROVIDER', generationConfig: {
        prompt_revision_id: 'prompt-1', model_revision_id: 'model-1',
        schema_revision_id: 'schema-1', tool_revision_ids: ['tool-1'],
      } },
      registryEntries: [],
      auditEvent: {
        auditEventId: 'audit-retry', tenantId: 'tenant-1', workspaceId: 'workspace-1',
        eventType: 'M4_RETRY', principalRef: 'worker-1', runId: 'run-1', reasonCodes: [],
      },
      outboxEvents: [{ aggregateType: 'Run', aggregateId: 'run-1', eventType: 'M4_RETRY', payload: {} }],
    }, insertGraph);
    expect(result.replayed).toBe(true);
    expect(result.outputRefs).toEqual([{
      ordinal: 0, refKind: 'IMMUTABLE_ENTITY', entityType: 'AudienceState', entityId: 'aud-1',
    }]);
    expect(insertGraph).not.toHaveBeenCalled();
    expect(queries.some((query) => query.startsWith('INSERT'))).toBe(false);
  });

  it('writes registry, graph, output, completion, audit, and outbox in one transaction', async () => {
    const fixture = baseFixture();
    const { sql, queries } = createFakeSql(fixture.rows);
    const result = await executeContentRuntimeCommit(sql, {
      tenantId: 'tenant-1', workspaceId: 'workspace-1', runConfigId: 'config-1', fencingContext: fixture.context,
      generationAuthority: { kind: 'PROVIDER', generationConfig: {
        prompt_revision_id: 'prompt-1', model_revision_id: 'model-1',
        schema_revision_id: 'schema-1', tool_revision_ids: ['tool-1'],
      } },
      registryEntries: [{
        entityType: 'AudienceState', entityId: 'aud-1', tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
      }],
      auditEvent: {
        auditEventId: 'audit-1', tenantId: 'tenant-1', workspaceId: 'workspace-1',
        eventType: 'AUDIENCE_FINALIZED', principalRef: 'worker-1', resourceRef: 'aud-1',
        runId: 'run-1', reasonCodes: ['FINAL_FOR_DECISION'],
      },
      outboxEvents: [{
        aggregateType: 'AudienceState', aggregateId: 'aud-1',
        eventType: 'AudienceStateFinalized', payload: { audienceStateId: 'aud-1' },
      }],
    }, async (sqlTx) => {
      await sqlTx`INSERT INTO audience_states (audience_state_id) VALUES ('aud-1')`;
      return {
        value: 'aud-1',
        outputRefs: [{
          ordinal: 0, refKind: 'IMMUTABLE_ENTITY', entityType: 'AudienceState', entityId: 'aud-1',
        }],
      };
    });
    expect(result).toMatchObject({ replayed: false, value: 'aud-1' });
    const orderedFragments = [
      'INSERT INTO immutable_entity_registry', 'INSERT INTO audience_states',
      'INSERT INTO stage_execution_output_refs', 'complete_m4_stage_execution',
      'INSERT INTO audit_events', 'INSERT INTO outbox_events',
    ];
    const positions = orderedFragments.map((fragment) => queries.findIndex((query) => query.includes(fragment)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('keeps migration idempotent and frozen-schema additive only', async () => {
    const migration = await fs.readFile(path.resolve(
      process.cwd(), 'src/persistence/relational/migrations/0006_m4_content_intelligence_invariants.sql',
    ), 'utf8');
    expect(migration).not.toMatch(/CREATE\s+TABLE/i);
    expect(migration).not.toMatch(/ADD\s+COLUMN/i);
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS');
    expect(migration).toContain('IF NOT EXISTS (SELECT 1 FROM pg_constraint');
    expect(migration).toContain('SET search_path = pg_catalog, pg_temp');
    expect(migration).toContain('ContentArchitecture');
    expect(migration).toContain('ContentUnit');
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER trg_content_architecture_unit_position');
    expect(migration.split('--> statement-breakpoint').length).toBeGreaterThan(10);
  });
});
