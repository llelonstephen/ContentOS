import { randomUUID } from 'node:crypto';
import type { AudienceStateView } from '../../../domain/content/index.js';
import type {
  AudienceStateAtomicCommitPort,
  AudienceStateCommitRequest,
} from './audience-state-persistence-service.js';
import { requireAudienceDerivationAuthority } from './audience-state-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';
import { assertAudienceSchemaBindingUnchanged } from './audience-derivation-authority-resolver.js';

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
    const { derivationAuthority, factBasisLinks } = requireAudienceDerivationAuthority(request);
    const binding = derivationAuthority.schema_binding;
    const result = await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      generationAuthority: { kind: 'PROVIDER', generationConfig: request.generation_config },
      fencingContext: toStageFencingContext(authority),
      registryEntries: [{ entityType: 'AudienceState', entityId: state.audience_state_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id }],
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_AUDIENCE_STATE_COMMITTED',
        principalRef: authority.lease_owner, resourceRef: state.audience_state_id,
        runId: authority.run_id, reasonCodes: [
          state.state_stage, binding.role, `FACT_BASIS_COUNT:${factBasisLinks.length}`,
        ] },
      outboxEvents: [{ aggregateType: 'AudienceState', aggregateId: state.audience_state_id,
        eventType: 'AudienceStateCommitted', payload: { audienceStateId: state.audience_state_id,
          stage: state.state_stage, runConfigId: authority.run_config_id,
          audienceKnowledgeCutoffTime: derivationAuthority.audience_knowledge_cutoff_time,
          derivationManifestHash: derivationAuthority.derivation_manifest_hash,
          schemaRole: binding.role, schemaRevisionId: binding.schema_revision_id,
          factBasisCount: factBasisLinks.length } }],
    }, async (sqlTx) => {
      await assertAudienceSchemaBindingUnchanged(sqlTx, {
        tenant_id: authority.tenant_id,
        workspace_id: authority.workspace_id,
        run_config_id: authority.run_config_id,
      }, binding);
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
      await sqlTx`INSERT INTO audience_derivation_authorities (
        audience_state_id, tenant_id, workspace_id, stage_execution_id, run_config_id,
        schema_role, schema_entity_type, schema_stable_id, schema_revision_id,
        schema_object_id, schema_payload_hash, audience_knowledge_cutoff_time,
        derivation_manifest, derivation_manifest_hash, canonical_input_hash, created_at
      ) VALUES (
        ${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
        ${authority.stage_execution_id}, ${authority.run_config_id}, ${binding.role},
        ${binding.schema_entity_type}, ${binding.schema_stable_id},
        ${binding.schema_revision_id}, ${binding.schema_object_id},
        ${binding.schema_payload_hash}, ${new Date(derivationAuthority.audience_knowledge_cutoff_time)},
        ${encode(derivationAuthority.derivation_manifest)},
        ${derivationAuthority.derivation_manifest_hash}, ${authority.canonical_input_hash}, now()
      )`;
      for (const link of factBasisLinks) {
        const task = link.basis_kind === 'TASK_AUDIENCE_CONTEXT' ? link : null;
        const epistemic = link.basis_kind === 'AUDIENCE_EPISTEMIC_STATE' ? link : null;
        await sqlTx`INSERT INTO audience_fact_basis_links (
          audience_state_id, tenant_id, workspace_id, audience_field, fact_path,
          fact_value_hash, basis_kind, task_id, task_revision_id,
          task_audience_context_path, task_audience_context_value_hash,
          proposition_id, epistemic_state_id, ordinal
        ) VALUES (
          ${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
          ${link.audience_field}, ${link.fact_path}, ${link.fact_value_hash},
          ${link.basis_kind}, ${task?.task_id ?? null}, ${task?.task_revision_id ?? null},
          ${task?.task_audience_context_path ?? null},
          ${task?.task_audience_context_value_hash ?? null},
          ${epistemic?.proposition_id ?? null}, ${epistemic?.epistemic_state_id ?? null},
          ${link.ordinal}
        )`;
      }
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
