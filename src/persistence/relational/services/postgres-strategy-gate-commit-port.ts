import { randomUUID } from 'node:crypto';
import type {
  StrategyGateAtomicCommitPort,
  StrategyGateAtomicCommitRequest,
  StrategyGateExecutionReceipt,
} from './content-strategy-gate-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';

/** Persists only operational gate outcome metadata; it creates no gate entity. */
export class PostgresStrategyGateCommitPort implements StrategyGateAtomicCommitPort {
  constructor(private readonly sql: any) {}

  async commitStrategyGateExecution(
    request: StrategyGateAtomicCommitRequest,
  ): Promise<StrategyGateExecutionReceipt> {
    const { authority, result } = request;
    await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      fencingContext: toStageFencingContext(authority), registryEntries: [],
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_STRATEGY_GATE_COMPLETED',
        principalRef: authority.lease_owner, resourceRef: result.strategy_id ?? null,
        runId: authority.run_id, reasonCodes: [result.outcome, ...result.reason_codes] },
      outboxEvents: [{ aggregateType: 'StageExecution', aggregateId: authority.stage_execution_id,
        eventType: 'StrategyGateCompleted', payload: { strategyId: result.strategy_id,
          audienceStateId: result.audience_state_id, outcome: result.outcome,
          reasonCodes: result.reason_codes, inputHash: request.reason_metadata.input_hash } }],
    }, async () => ({
      value: result,
      outputRefs: result.strategy_id ? [{ ordinal: 0, refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: 'StrategyHypothesis', entityId: result.strategy_id }] : [],
    }));
    return {
      stage_execution_id: authority.stage_execution_id,
      output_ref_id: authority.stage_execution_id,
      result,
    };
  }
}
