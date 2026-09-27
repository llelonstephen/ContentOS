/**
 * ContentOS — KnowledgeGap & ResearchTrace Persistence Service
 *
 * Implements SPEC03 §8, §9, §10, §11, §12, §120:
 * - Immutable KnowledgeGap lifecycle (status transition creates new gap_id)
 * - ResearchTrace execution recording
 * - Unknown-Preservation Gate enforcement
 * - Fail-closed uncertainty handling
 * - StageExecution & DecisionCycle fencing boundary
 */
import postgres from 'postgres';
import type { KnowledgeGapStatus, ResearchOutcome } from '../../../domain/knowledge/types.js';
import {
  validateKnowledgeGapTransition,
  validateResearchGapResolution,
  assertUnknownPreservationGate,
  type KnowledgeGapState,
} from '../../../domain/knowledge/unknown-preservation-gate.js';
import {
  verifyStageFencing,
  type StageFencingContext,
  type WriteMode,
} from './stage-fencing-coordinator.js';
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
  fencingContext?: StageFencingContext | null;
  writeMode?: WriteMode;
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
  fencingContext?: StageFencingContext | null;
  writeMode?: WriteMode;
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
      fencingContext,
      writeMode,
    } = params;

    // Validate EXPLICIT_ASSUMPTION (SPEC03 §9)
    if (status === 'EXPLICIT_ASSUMPTION' && !assumptionAllowed) {
      throw new RegistryValidationError(
        'EXPLICIT_ASSUMPTION_DISALLOWED',
        `KnowledgeGap '${gapId}' cannot have status 'EXPLICIT_ASSUMPTION' when assumption_allowed is false.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if in cycle context
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: writeMode === 'DECISION_CYCLE' || !!fencingContext?.decisionCycleId,
        writeMode,
      });

      // 1. Verify task revision exists
      const [task] = await sqlTx`
        SELECT task_revision_id, tenant_id, workspace_id FROM task_contract_revisions WHERE task_revision_id = ${taskRevisionId}
      `;
      if (!task) {
        throw new RegistryValidationError(
          'TASK_REVISION_NOT_FOUND',
          `Task revision '${taskRevisionId}' does not exist.`,
        );
      }
      if (task.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `Task revision '${taskRevisionId}' belongs to tenant '${task.tenant_id}', not '${tenantId}'.`,
        );
      }
      if (task.workspace_id && task.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Task revision '${taskRevisionId}' belongs to workspace '${task.workspace_id}', not '${workspaceId || 'NONE'}'.`,
        );
      }

      // 2. If superseding a prior gap, verify prior exists and validate transition
      if (supersedesGapId) {
        const [prior] = await sqlTx`
          SELECT gap_id, tenant_id, blocking, assumption_allowed, status FROM knowledge_gaps WHERE gap_id = ${supersedesGapId}
        `;
        if (!prior) {
          throw new RegistryValidationError(
            'SUPERSEDED_GAP_NOT_FOUND',
            `Prior KnowledgeGap '${supersedesGapId}' does not exist.`,
          );
        }
        if (prior.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'TENANT_ISOLATION_VIOLATION',
            `Prior KnowledgeGap '${supersedesGapId}' belongs to tenant '${prior.tenant_id}', not '${tenantId}'.`,
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
      fencingContext,
      writeMode,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if in cycle context
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: writeMode === 'DECISION_CYCLE' || !!fencingContext?.decisionCycleId,
        writeMode,
      });

      // 1. Verify gap exists and matches tenant
      const [gap] = await sqlTx`
        SELECT gap_id, tenant_id, workspace_id, blocking, status FROM knowledge_gaps WHERE gap_id = ${gapId}
      `;
      if (!gap) {
        throw new RegistryValidationError(
          'KNOWLEDGE_GAP_NOT_FOUND',
          `KnowledgeGap '${gapId}' does not exist.`,
        );
      }
      if (gap.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `KnowledgeGap belongs to tenant '${gap.tenant_id}', not '${tenantId}'.`,
        );
      }
      if (gap.workspace_id && gap.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `KnowledgeGap is scoped to workspace '${gap.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
        );
      }

      // 2. Validate research outcome semantics (SPEC03 §11)
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
   * Explicit decision-cycle KnowledgeGap creation or transition. Requires valid stage fencing context.
   */
  async createOrTransitionKnowledgeGapForDecisionCycle(params: CreateKnowledgeGapParams): Promise<void> {
    return this.createOrTransitionKnowledgeGap({ ...params, writeMode: 'DECISION_CYCLE' });
  }

  /**
   * Explicit decision-cycle ResearchTrace recording. Requires valid stage fencing context.
   */
  async recordResearchTraceForDecisionCycle(params: RecordResearchTraceParams): Promise<void> {
    return this.recordResearchTrace({ ...params, writeMode: 'DECISION_CYCLE' });
  }

  /**
   * Asserts the Unknown-Preservation Gate for all active blocking KnowledgeGaps of a task.
   * Throws RegistryValidationError if any blocking gap is unresolved without an allowed assumption.
   * Implements SPEC03 §19–§21.
   */
  async assertTaskUnknownPreservationGate(taskRevisionId: string, tenantId?: string): Promise<void> {
    const gaps = await this.sql`
      SELECT gap_id, blocking, assumption_allowed, status
      FROM knowledge_gaps
      WHERE task_revision_id = ${taskRevisionId}
        ${tenantId ? this.sql`AND tenant_id = ${tenantId}` : this.sql``}
    `;

    const gapStates: KnowledgeGapState[] = gaps.map((g) => ({
      gapId: g.gap_id as string,
      taskRevisionId,
      question: 'Task blocking gap check',
      blocking: g.blocking as boolean,
      assumptionAllowed: g.assumption_allowed as boolean,
      status: g.status as KnowledgeGapStatus,
    }));

    assertUnknownPreservationGate(gapStates);
  }
}
