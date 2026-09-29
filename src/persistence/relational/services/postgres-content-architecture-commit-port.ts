import { randomUUID } from 'node:crypto';
import type { ContentArchitectureView, ContentUnitView } from '../../../domain/content/index.js';
import type {
  ContentArchitectureAtomicCommitPort,
  ContentArchitectureCommitRequest,
} from './content-architecture-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';

const encode = (value: unknown): string => JSON.stringify(value);
const decode = <T>(value: string): T => JSON.parse(value) as T;

async function loadArchitecture(sql: any, architectureId: string): Promise<{
  architecture: ContentArchitectureView;
  units: readonly ContentUnitView[];
}> {
  const [row] = await sql`SELECT * FROM content_architectures
    WHERE architecture_id = ${architectureId}`;
  if (!row) throw new Error('Architecture retry output no longer resolves');
  const unitRows = await sql`SELECT unit.* FROM content_architecture_units link
    JOIN content_units unit ON unit.unit_id = link.unit_id
    WHERE link.architecture_id = ${architectureId} ORDER BY unit.position, unit.unit_id`;
  const units: ContentUnitView[] = [];
  for (const unit of unitRows) {
    const propositionRows = await sql`SELECT proposition_id FROM content_unit_propositions
      WHERE unit_id = ${unit.unit_id} ORDER BY proposition_id`;
    units.push({ ...unit, audience_state_before: decode(unit.audience_state_before),
      information_to_deliver: decode(unit.information_to_deliver),
      audience_state_after: decode(unit.audience_state_after),
      proposition_ids: propositionRows.map((item: any) => item.proposition_id) });
  }
  return { architecture: { ...row, unit_ids: units.map(({ unit_id }) => unit_id) }, units };
}

export class PostgresContentArchitectureCommitPort implements ContentArchitectureAtomicCommitPort {
  constructor(private readonly sql: any) {}

  async commitContentArchitecture(request: ContentArchitectureCommitRequest): Promise<{
    readonly architecture: ContentArchitectureView;
    readonly units: readonly ContentUnitView[];
  }> {
    const { authority, architecture, units } = request;
    const entries = [
      { entityType: 'ContentArchitecture', entityId: architecture.architecture_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id },
      ...units.map((unit) => ({ entityType: 'ContentUnit', entityId: unit.unit_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id })),
    ];
    const result = await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      generationAuthority: { kind: 'PROVIDER', generationConfig: request.generation_config },
      fencingContext: toStageFencingContext(authority), registryEntries: entries,
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_ARCHITECTURE_COMMITTED',
        principalRef: authority.lease_owner, resourceRef: architecture.architecture_id,
        runId: authority.run_id, reasonCodes: ['STRATEGY_GATE_PROCEED'] },
      outboxEvents: [{ aggregateType: 'ContentArchitecture', aggregateId: architecture.architecture_id,
        eventType: 'ContentArchitectureCommitted', payload: {
          architectureId: architecture.architecture_id, strategyId: architecture.strategy_id,
          unitIds: architecture.unit_ids, runConfigId: authority.run_config_id,
        } }],
    }, async (sqlTx) => {
      for (const unit of units) {
        await sqlTx`INSERT INTO content_units (
          unit_id, tenant_id, workspace_id, position, purpose, audience_state_before,
          audience_question, information_to_deliver, copy_goal, visual_goal, audio_goal,
          payoff, transition, audience_state_after, created_at
        ) VALUES (${unit.unit_id}, ${authority.tenant_id}, ${authority.workspace_id},
          ${unit.position}, ${unit.purpose}, ${encode(unit.audience_state_before)},
          ${unit.audience_question}, ${encode(unit.information_to_deliver)}, ${unit.copy_goal},
          ${unit.visual_goal}, ${unit.audio_goal}, ${unit.payoff}, ${unit.transition},
          ${encode(unit.audience_state_after)}, ${new Date(unit.created_at)})`;
        for (const propositionId of unit.proposition_ids) {
          await sqlTx`INSERT INTO content_unit_propositions (unit_id, proposition_id)
            VALUES (${unit.unit_id}, ${propositionId})`;
        }
      }
      await sqlTx`INSERT INTO content_architectures (
        architecture_id, tenant_id, workspace_id, supersedes_architecture_id,
        task_revision_id, strategy_id, created_at
      ) VALUES (${architecture.architecture_id}, ${authority.tenant_id}, ${authority.workspace_id},
        ${architecture.supersedes_architecture_id ?? null}, ${architecture.task_revision_id},
        ${architecture.strategy_id}, ${new Date(architecture.created_at)})`;
      for (const unitId of architecture.unit_ids) {
        await sqlTx`INSERT INTO content_architecture_units (architecture_id, unit_id)
          VALUES (${architecture.architecture_id}, ${unitId})`;
      }
      return { value: { architecture, units }, outputRefs: [
        { ordinal: 0, refKind: 'IMMUTABLE_ENTITY' as const,
          entityType: 'ContentArchitecture', entityId: architecture.architecture_id },
        ...units.map((unit, index) => ({ ordinal: index + 1,
          refKind: 'IMMUTABLE_ENTITY' as const, entityType: 'ContentUnit', entityId: unit.unit_id })),
      ] };
    });
    if (!result.replayed) return result.value!;
    const ref = result.outputRefs.find((item) =>
      item.refKind === 'IMMUTABLE_ENTITY' && item.entityType === 'ContentArchitecture');
    if (!ref || ref.refKind !== 'IMMUTABLE_ENTITY') throw new Error('Architecture retry output is invalid');
    return loadArchitecture(this.sql, ref.entityId);
  }
}
