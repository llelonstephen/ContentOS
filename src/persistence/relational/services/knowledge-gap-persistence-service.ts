/**
 * ContentOS — KnowledgeGap & ResearchTrace Persistence Service
 *
 * Implements SPEC03 §8, §9, §10, §11, §12, §120:
 * - Immutable KnowledgeGap lifecycle (status transition creates new gap_id)
 * - ResearchTrace execution recording
 * - Unknown-Preservation Gate enforcement
 * - Fail-closed uncertainty handling
 */
import postgres from 'postgres';
import type { KnowledgeGapStatus, ResearchOutcome } from '../../../domain/knowledge/types.js';
import {
  validateKnowledgeGapTransition,
  validateResearchGapResolution,
  assertUnknownPreservationGate,
  type KnowledgeGapState,
} from '../../../domain/knowledge/unknown-preservation-gate.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface CreateKnowledgeGapParams {
  gapId: string;
  tenantId: string;
  workspaceId?: string | null;
  taskRevisionId: string;
  question: string;
  decisionRelevance: string;
  blocking: boolean;
  researchable: boolean;
  userResolvable: boolean;
  assumptionAllowed: boolean;
  riskIfWrong: string;
  status: KnowledgeGapStatus;
  supersedesGapId?: string | null;
}

export interface RecordResearchTraceParams {
  researchTraceId: string;
  tenantId: string;
  workspaceId?: string | null;
  gapId: string;
  researchQuestion: string;
  queries: string;
  sourcesSearched: string;
  retrievalEntityType: string;
  retrievalStableId: string;
  retrievalRevisionId: string;
  coverageLimitations: string;
  outcome: ResearchOutcome;
  stopReason: string;
  startedAt: Date;
  completedAt: Date;
}

export class KnowledgeGapPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Creates a KnowledgeGap or records an immutable status transition (new gap_id).
   * Implements SPEC03 §8, §9, §120.
   */
  async createOrTransitionKnowledgeGap(params: CreateKnowledgeGapParams): Promise<void> {
    const {
      gapId,
      tenantId,
      workspaceId,
      taskRevisionId,
      question,
      decisionRelevance,
      blocking,
      researchable,
      userResolvable,
      assumptionAllowed,
      riskIfWrong,
      status,
      supersedesGapId,
    } = params;

    // Validate EXPLICIT_ASSUMPTION (SPEC03 §9)
    if (status === 'EXPLICIT_ASSUMPTION' && !assumptionAllowed) {
      throw new RegistryValidationError(
        'EXPLICIT_ASSUMPTION_DISALLOWED',
        `KnowledgeGap '${gapId}' cannot have status 'EXPLICIT_ASSUMPTION' when assumption_allowed is false.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify task revision exists
      const [task] = await sqlTx`
        SELECT task_revision_id FROM task_contract_revisions WHERE task_revision_id = ${taskRevisionId}
      `;
      if (!task) {
        throw new RegistryValidationError(
          'TASK_REVISION_NOT_FOUND',
          `Task revision '${taskRevisionId}' does not exist.`,
        );
      }

      // 2. If superseding a prior gap, verify prior exists and validate transition
      if (supersedesGapId) {
        const [prior] = await sqlTx`
          SELECT gap_id, blocking, assumption_allowed, status FROM knowledge_gaps WHERE gap_id = ${supersedesGapId}
        `;
        if (!prior) {
          throw new RegistryValidationError(
            'SUPERSEDED_GAP_NOT_FOUND',
            `Prior KnowledgeGap '${supersedesGapId}' does not exist.`,
          );
        }

        validateKnowledgeGapTransition(
          {
            blocking: prior.blocking as boolean,
            assumptionAllowed: prior.assumption_allowed as boolean,
            status: prior.status as KnowledgeGapStatus,
          },
          status,
        );
      }

      // 3. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'KnowledgeGap', ${gapId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 4. Insert into knowledge_gaps
      await sqlTx`
        INSERT INTO knowledge_gaps (
          gap_id, tenant_id, workspace_id, supersedes_gap_id, task_revision_id,
          question, decision_relevance, blocking, researchable, user_resolvable,
          assumption_allowed, risk_if_wrong, status, created_at
        ) VALUES (
          ${gapId}, ${tenantId}, ${workspaceId ?? null}, ${supersedesGapId ?? null}, ${taskRevisionId},
          ${question}, ${decisionRelevance}, ${blocking}, ${researchable}, ${userResolvable},
          ${assumptionAllowed}, ${riskIfWrong}, ${status}, now()
        )
      `;
    });
  }

  /**
   * Records an immutable ResearchTrace.
   * Implements SPEC03 §11, §12.
   */
  async recordResearchTrace(params: RecordResearchTraceParams): Promise<void> {
    const {
      researchTraceId,
      tenantId,
      workspaceId,
      gapId,
      researchQuestion,
      queries,
      sourcesSearched,
      retrievalEntityType,
      retrievalStableId,
      retrievalRevisionId,
      coverageLimitations,
      outcome,
      stopReason,
      startedAt,
      completedAt,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify gap exists
      const [gap] = await sqlTx`
        SELECT gap_id, blocking, status FROM knowledge_gaps WHERE gap_id = ${gapId}
      `;
      if (!gap) {
        throw new RegistryValidationError(
          'KNOWLEDGE_GAP_NOT_FOUND',
          `KnowledgeGap '${gapId}' does not exist.`,
        );
      }

      // 2. Validate that failed/incomplete research does not resolve blocking gap (SPEC03 §10, §12)
      validateResearchGapResolution(outcome, {
        blocking: gap.blocking as boolean,
        status: gap.status as KnowledgeGapStatus,
      });

      // 3. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'ResearchTrace', ${researchTraceId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 4. Insert into research_traces
      await sqlTx`
        INSERT INTO research_traces (
          research_trace_id, tenant_id, workspace_id, gap_id, research_question,
          queries, sources_searched, retrieval_entity_type, retrieval_stable_id,
          retrieval_revision_id, coverage_limitations, outcome, stop_reason,
          started_at, completed_at
        ) VALUES (
          ${researchTraceId}, ${tenantId}, ${workspaceId ?? null}, ${gapId}, ${researchQuestion},
          ${queries}, ${sourcesSearched}, ${retrievalEntityType}, ${retrievalStableId},
          ${retrievalRevisionId}, ${coverageLimitations}, ${outcome}, ${stopReason},
          ${startedAt}, ${completedAt}
        )
      `;
    });
  }

  /**
   * Asserts the Unknown-Preservation Gate for all final gaps of a task.
   * Implements SPEC03 §10.
   */
  async assertTaskUnknownPreservationGate(taskRevisionId: string): Promise<void> {
    const gaps = await this.sql`
      SELECT gap_id, task_revision_id, question, blocking, assumption_allowed, status, supersedes_gap_id
      FROM knowledge_gaps
      WHERE task_revision_id = ${taskRevisionId}
    `;

    const gapStates: KnowledgeGapState[] = gaps.map((g) => ({
      gapId: g['gap_id'] as string,
      taskRevisionId: g['task_revision_id'] as string,
      question: g['question'] as string,
      blocking: g['blocking'] as boolean,
      assumptionAllowed: g['assumption_allowed'] as boolean,
      status: g['status'] as KnowledgeGapStatus,
      supersedesGapId: g['supersedes_gap_id'] as string | null,
    }));

    assertUnknownPreservationGate(gapStates);
  }
}
