import { randomUUID } from 'node:crypto';
import type { StrategyHypothesisView } from '../../../domain/content/index.js';
import type {
  StrategyHypothesisAtomicCommitPort,
  StrategyHypothesisCommitRequest,
} from './strategy-hypothesis-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';

const encode = (value: unknown): string => JSON.stringify(value);
const decode = <T>(value: string): T => JSON.parse(value) as T;

async function loadStrategy(sql: any, strategyId: string): Promise<StrategyHypothesisView> {
  const [row] = await sql`SELECT * FROM strategy_hypotheses WHERE strategy_id = ${strategyId}`;
  if (!row) throw new Error('Strategy retry output no longer resolves');
  const links = await sql`SELECT proposition_id FROM strategy_required_propositions
    WHERE strategy_id = ${strategyId} ORDER BY proposition_id`;
  return { ...row, required_proposition_ids: links.map((item: any) => item.proposition_id),
    assumptions: decode(row.assumptions), unknowns: decode(row.unknowns),
    failure_modes: decode(row.failure_modes), risk_hypotheses: decode(row.risk_hypotheses) };
}

export class PostgresStrategyHypothesisCommitPort implements StrategyHypothesisAtomicCommitPort {
  constructor(private readonly sql: any) {}

  async commitStrategyHypothesis(request: StrategyHypothesisCommitRequest): Promise<StrategyHypothesisView> {
    const { authority, strategy } = request;
    const result = await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      generationAuthority: { kind: 'PROVIDER', generationConfig: request.generation_config },
      fencingContext: toStageFencingContext(authority),
      registryEntries: [{ entityType: 'StrategyHypothesis', entityId: strategy.strategy_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id }],
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_STRATEGY_COMMITTED',
        principalRef: authority.lease_owner, resourceRef: strategy.strategy_id,
        runId: authority.run_id, reasonCodes: ['GROUNDED'] },
      outboxEvents: [{ aggregateType: 'StrategyHypothesis', aggregateId: strategy.strategy_id,
        eventType: 'StrategyHypothesisCommitted', payload: { strategyId: strategy.strategy_id,
          audienceStateId: strategy.audience_state_id, runConfigId: authority.run_config_id } }],
    }, async (sqlTx) => {
      await sqlTx`INSERT INTO strategy_hypotheses (
        strategy_id, tenant_id, workspace_id, task_revision_id, audience_state_id,
        core_message, behavioral_objective, persuasion_mechanism, proof_strategy,
        assumptions, unknowns, failure_modes, risk_hypotheses, created_at
      ) VALUES (${strategy.strategy_id}, ${authority.tenant_id}, ${authority.workspace_id},
        ${strategy.task_revision_id}, ${strategy.audience_state_id}, ${strategy.core_message},
        ${strategy.behavioral_objective}, ${strategy.persuasion_mechanism},
        ${strategy.proof_strategy}, ${encode(strategy.assumptions)}, ${encode(strategy.unknowns)},
        ${encode(strategy.failure_modes)}, ${encode(strategy.risk_hypotheses)},
        ${new Date(strategy.created_at)})`;
      for (const propositionId of strategy.required_proposition_ids) {
        await sqlTx`INSERT INTO strategy_required_propositions (strategy_id, proposition_id)
          VALUES (${strategy.strategy_id}, ${propositionId})`;
      }
      return { value: strategy, outputRefs: [{ ordinal: 0, refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: 'StrategyHypothesis', entityId: strategy.strategy_id }] };
    });
    if (!result.replayed) return result.value!;
    const ref = result.outputRefs[0];
    if (!ref || ref.refKind !== 'IMMUTABLE_ENTITY') throw new Error('Strategy retry output is invalid');
    return loadStrategy(this.sql, ref.entityId);
  }
}
