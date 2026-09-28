import { randomUUID } from 'node:crypto';
import type { ContentCandidateView } from '../../../domain/content/index.js';
import type {
  ContentCandidateAtomicCommitPort,
  ContentCandidateCommitRequest,
} from './content-candidate-persistence-service.js';
import { toStageFencingContext } from './content-runtime-authority.js';
import { executeContentRuntimeCommit } from './content-runtime-transaction-context.js';

function parseCandidate(row: any): ContentCandidateView {
  return { ...row, content_payload: JSON.parse(row.content_payload) };
}

export class PostgresContentCandidateCommitPort implements ContentCandidateAtomicCommitPort {
  constructor(private readonly sql: any) {}

  async commitContentCandidate(request: ContentCandidateCommitRequest): Promise<ContentCandidateView> {
    const { authority, candidate } = request;
    const result = await executeContentRuntimeCommit(this.sql, {
      tenantId: authority.tenant_id, workspaceId: authority.workspace_id, runConfigId: authority.run_config_id,
      ...(request.generation_config ? { generationConfig: request.generation_config } : {}),
      fencingContext: toStageFencingContext(authority),
      registryEntries: [{ entityType: 'ContentCandidate', entityId: candidate.candidate_id,
        tenantId: authority.tenant_id, workspaceId: authority.workspace_id }],
      auditEvent: { auditEventId: randomUUID(), tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id, eventType: 'M4_CANDIDATE_COMMITTED',
        principalRef: authority.lease_owner, resourceRef: candidate.candidate_id,
        runId: authority.run_id, reasonCodes: [candidate.parent_candidate_id ? 'REWRITE' : 'GENERATED'] },
      outboxEvents: [{ aggregateType: 'ContentCandidate', aggregateId: candidate.candidate_id,
        eventType: 'ContentCandidateCommitted', payload: { candidateId: candidate.candidate_id,
          architectureId: candidate.architecture_id, strategyId: candidate.strategy_id,
          runConfigId: candidate.run_config_id, parentCandidateId: candidate.parent_candidate_id ?? null } }],
    }, async (sqlTx) => {
      await sqlTx`INSERT INTO content_candidates (
        candidate_id, tenant_id, workspace_id, task_revision_id, strategy_id,
        architecture_id, content_payload, run_config_id, parent_candidate_id, created_at
      ) VALUES (${candidate.candidate_id}, ${authority.tenant_id}, ${authority.workspace_id},
        ${candidate.task_revision_id}, ${candidate.strategy_id}, ${candidate.architecture_id},
        ${JSON.stringify(candidate.content_payload)}, ${candidate.run_config_id},
        ${candidate.parent_candidate_id ?? null}, ${new Date(candidate.created_at)})`;
      return { value: candidate, outputRefs: [{ ordinal: 0, refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: 'ContentCandidate', entityId: candidate.candidate_id }] };
    });
    if (!result.replayed) return result.value!;
    const ref = result.outputRefs[0];
    if (!ref || ref.refKind !== 'IMMUTABLE_ENTITY') throw new Error('Candidate retry output is invalid');
    const [row] = await this.sql`SELECT * FROM content_candidates WHERE candidate_id = ${ref.entityId}`;
    if (!row) throw new Error('Candidate retry output no longer resolves');
    return parseCandidate(row);
  }
}
