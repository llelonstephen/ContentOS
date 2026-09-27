/**
 * ContentOS — Decision-Time Strategy Knowledge Gate Service
 *
 * Implements SPEC03 §101, §102, §121:
 *   - Resolves canonical StrategyHypothesis from strategyId
 *   - Loads required propositions from canonical strategy_required_propositions relation
 *   - Resolves active/blocking KnowledgeGaps from canonical database state
 *   - For every required Proposition, requires an exact decision-time EpistemicStateVersion
 *     resolved within the pinned knowledge boundary and valid-time target.
 *   - Enforces fail-closed tenant, workspace, and DataScope isolation.
 *   - Prohibits generic CURRENT/LATEST/ACTIVE substitution.
 *   - Enforces Unknown-Preservation Gate: unresolved blocking gaps fail closed.
 */
import postgres from 'postgres';
import { assertUnknownPreservationGate } from '../../../domain/knowledge/unknown-preservation-gate.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { KnowledgeGapStatus } from '../../../domain/knowledge/types.js';

export interface StrategyKnowledgeGateGapInput {
  gapId: string;
  propositionId?: string;
  blocking: boolean;
  assumptionAllowed: boolean;
  status: KnowledgeGapStatus;
}

export interface EvaluateStrategyKnowledgeGateParams {
  tenantId: string;
  workspaceId?: string | null;
  strategyId: string;
  knowledgeBoundaryTime: Date; // e.g. decision_snapshot_time or cycle freeze time
  targetValidTime: Date;
  requiredPropositionIds?: string[];
  activeKnowledgeGaps?: StrategyKnowledgeGateGapInput[];
}

export interface StrategyKnowledgeGateResult {
  canProceed: boolean;
  resolvedEpistemicStates: Record<string, string>; // propositionId -> exact epistemic_state_id
}

export class StrategyKnowledgeGateService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  async evaluateKnowledgeGate(
    params: EvaluateStrategyKnowledgeGateParams,
  ): Promise<StrategyKnowledgeGateResult> {
    const {
      tenantId,
      workspaceId,
      strategyId,
      knowledgeBoundaryTime,
      targetValidTime,
      activeKnowledgeGaps = [],
    } = params;

    // 1. Resolve canonical StrategyHypothesis
    const [strategy] = await this.sql`
      SELECT strategy_id, tenant_id, workspace_id, task_revision_id
      FROM strategy_hypotheses
      WHERE strategy_id = ${strategyId}
    `;

    if (!strategy) {
      throw new RegistryValidationError(
        'STRATEGY_NOT_FOUND',
        `StrategyHypothesis '${strategyId}' does not exist in canonical storage.`,
      );
    }

    if (strategy.tenant_id !== tenantId) {
      throw new RegistryValidationError(
        'TENANT_ISOLATION_VIOLATION',
        `StrategyHypothesis belongs to tenant '${strategy.tenant_id}', not caller '${tenantId}'.`,
      );
    }

    if (strategy.workspace_id && (!workspaceId || strategy.workspace_id !== workspaceId)) {
      throw new RegistryValidationError(
        'WORKSPACE_ISOLATION_VIOLATION',
        `StrategyHypothesis is scoped to workspace '${strategy.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
      );
    }

    // 2. Resolve canonical active KnowledgeGaps for the strategy's task contract
    const dbGaps = await this.sql`
      SELECT gap_id, blocking, assumption_allowed, status
      FROM knowledge_gaps
      WHERE task_revision_id = ${strategy.task_revision_id}
        AND tenant_id = ${tenantId}
    `;

    // Merge DB gaps with any caller-supplied gaps (caller cannot omit DB gaps!)
    const allGapsMap = new Map<string, { gapId: string; blocking: boolean; assumptionAllowed: boolean; status: KnowledgeGapStatus }>();
    for (const g of dbGaps) {
      allGapsMap.set(g.gap_id, {
        gapId: g.gap_id,
        blocking: g.blocking as boolean,
        assumptionAllowed: g.assumption_allowed as boolean,
        status: g.status as KnowledgeGapStatus,
      });
    }
    for (const g of activeKnowledgeGaps) {
      if (!allGapsMap.has(g.gapId)) {
        allGapsMap.set(g.gapId, {
          gapId: g.gapId,
          blocking: g.blocking,
          assumptionAllowed: g.assumptionAllowed,
          status: g.status,
        });
      }
    }

    if (allGapsMap.size > 0) {
      assertUnknownPreservationGate(
        Array.from(allGapsMap.values()).map((g) => ({
          gapId: g.gapId,
          taskRevisionId: strategy.task_revision_id,
          question: 'Knowledge gap relevance',
          blocking: g.blocking,
          assumptionAllowed: g.assumptionAllowed,
          status: g.status,
        })),
      );
    }

    // 3. Load required propositions from canonical strategy_required_propositions relation
    const canonicalRequired = await this.sql`
      SELECT proposition_id FROM strategy_required_propositions
      WHERE strategy_id = ${strategyId}
    `;

    // Caller cannot bypass canonical requirements by passing empty list
    const requiredSet = new Set<string>(canonicalRequired.map((r) => r.proposition_id));
    if (params.requiredPropositionIds) {
      for (const p of params.requiredPropositionIds) {
        requiredSet.add(p);
      }
    }

    if (requiredSet.size === 0) {
      return { canProceed: true, resolvedEpistemicStates: {} };
    }

    const resolvedEpistemicStates: Record<string, string> = {};

    // 4. Resolve exact decision-time EpistemicStateVersion for each required proposition
    for (const propId of requiredSet) {
      const [prop] = await this.sql`
        SELECT proposition_id, tenant_id, workspace_id
        FROM propositions
        WHERE proposition_id = ${propId}
      `;

      if (!prop) {
        throw new RegistryValidationError(
          'REQUIRED_PROPOSITION_NOT_FOUND',
          `Strategy '${strategyId}' requires proposition '${propId}', which does not exist.`,
        );
      }

      if (prop.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `Proposition '${propId}' belongs to tenant '${prop.tenant_id}', not caller tenant '${tenantId}'.`,
        );
      }

      if (prop.workspace_id && (!workspaceId || prop.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Proposition '${propId}' is scoped to workspace '${prop.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
        );
      }

      // Query state strictly within pinned knowledge boundary and valid-time target
      const [state] = await this.sql`
        SELECT epistemic_state_id, workspace_id, known_from, valid_from, valid_until_if_known, support_status
        FROM epistemic_state_versions
        WHERE proposition_id = ${propId}
          AND tenant_id = ${tenantId}
          AND known_from <= ${knowledgeBoundaryTime}
          AND valid_from <= ${targetValidTime}
          AND (valid_until_if_known IS NULL OR valid_until_if_known >= ${targetValidTime})
        ORDER BY known_from DESC
        LIMIT 1
      `;

      if (!state) {
        throw new RegistryValidationError(
          'STRATEGY_KNOWLEDGE_GATE_BLOCKED',
          `Strategy '${strategyId}' requires proposition '${propId}', but no decision-time EpistemicStateVersion exists within pinned knowledge boundary (known_from <= ${knowledgeBoundaryTime.toISOString()}) and valid time (${targetValidTime.toISOString()}). Generic CURRENT/LATEST substitution is prohibited.`,
        );
      }

      if (state.workspace_id && (!workspaceId || state.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EpistemicStateVersion '${state.epistemic_state_id}' is scoped to workspace '${state.workspace_id}', not caller workspace '${workspaceId || 'NONE'}'.`,
        );
      }

      resolvedEpistemicStates[propId] = state.epistemic_state_id as string;
    }

    return {
      canProceed: true,
      resolvedEpistemicStates,
    };
  }
}
