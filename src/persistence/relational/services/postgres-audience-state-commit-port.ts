import { randomUUID } from 'node:crypto';
import type { AudienceStateView } from '../../../domain/content/index.js';
import type {
  AudienceStateAtomicCommitPort,
  AudienceStateCommitRequest,
} from './audience-state-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';

const encode = (value: unknown): string => JSON.stringify(value);
const decode = <T>(value: string): T => JSON.parse(value) as T;

function toAudience(row: any): AudienceStateView {
  return {
    ...row,
    context: decode(row.context), knowledge_state: decode(row.knowledge_state),
    problem_state: decode(row.problem_state), solution_state: decode(row.solution_state),
    product_state: decode(row.product_state), brand_state: decode(row.brand_state),
    intent_state: decode(row.intent_state), desired_outcome: decode(row.desired_outcome),
    objections: decode(row.objections), decision_criteria: decode(row.decision_criteria),
    prior_exposure: decode(row.prior_exposure), origin: decode(row.origin),
    uncertainty: decode(row.uncertainty),
  };
}

export class PostgresAudienceStateCommitPort implements AudienceStateAtomicCommitPort {
  constructor(private readonly sql: any) {}

  async commitAudienceState(request: AudienceStateCommitRequest): Promise<AudienceStateView> {
    const { authority, state } = request;
    const result = await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      generationAuthority: { kind: 'PROVIDER', generationConfig: request.generation_config },
      fencingContext: toStageFencingContext(authority),
      registryEntries: [{ entityType: 'AudienceState', entityId: state.audience_state_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id }],
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_AUDIENCE_STATE_COMMITTED',
        principalRef: authority.lease_owner, resourceRef: state.audience_state_id,
        runId: authority.run_id, reasonCodes: [state.state_stage] },
      outboxEvents: [{ aggregateType: 'AudienceState', aggregateId: state.audience_state_id,
        eventType: 'AudienceStateCommitted', payload: { audienceStateId: state.audience_state_id,
          stage: state.state_stage, runConfigId: authority.run_config_id } }],
    }, async (sqlTx) => {
      await sqlTx`INSERT INTO audience_states (
        audience_state_id, tenant_id, workspace_id, task_revision_id, state_stage,
        context, knowledge_state, problem_state, solution_state, product_state,
        brand_state, intent_state, desired_outcome, objections, decision_criteria,
        prior_exposure, origin, uncertainty, created_at
      ) VALUES (${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
        ${state.task_revision_id}, ${state.state_stage}, ${encode(state.context)},
        ${encode(state.knowledge_state)}, ${encode(state.problem_state)},
        ${encode(state.solution_state)}, ${encode(state.product_state)}, ${encode(state.brand_state)},
        ${encode(state.intent_state)}, ${encode(state.desired_outcome)}, ${encode(state.objections)},
        ${encode(state.decision_criteria)}, ${encode(state.prior_exposure)}, ${encode(state.origin)},
        ${encode(state.uncertainty)}, ${new Date(state.created_at)})`;
      return { value: state, outputRefs: [{ ordinal: 0, refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: 'AudienceState', entityId: state.audience_state_id }] };
    });
    if (!result.replayed) return result.value!;
    const ref = result.outputRefs[0];
    if (!ref || ref.refKind !== 'IMMUTABLE_ENTITY') throw new Error('Audience retry output is invalid');
    const [row] = await this.sql`SELECT * FROM audience_states WHERE audience_state_id = ${ref.entityId}`;
    if (!row) throw new Error('Audience retry output no longer resolves');
    return toAudience(row);
  }
}
