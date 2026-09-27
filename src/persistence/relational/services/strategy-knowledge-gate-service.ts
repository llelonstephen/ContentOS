/**
 * ContentOS — Decision-Time Strategy Knowledge Gate Service
 *
 * Implements SPEC03 §101, §102, §121:
 *   - For every StrategyHypothesis required Proposition, requires an exact decision-time
 *     EpistemicStateVersion resolved within the pinned knowledge boundary and valid-time target.
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
  requiredPropositionIds: string[];
  knowledgeBoundaryTime: Date; // e.g. decision_snapshot_time or cycle freeze time
  targetValidTime: Date;
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
      workspaceId: _workspaceId,
      strategyId,
      requiredPropositionIds,
      knowledgeBoundaryTime,
      targetValidTime,
      activeKnowledgeGaps = [],
    } = params;

    // 1. Unknown-Preservation Gate (SPEC03 §19–§21, §102)
    // Check if any active gaps on the required propositions or cycle block execution
    if (activeKnowledgeGaps.length > 0) {
      assertUnknownPreservationGate(
        activeKnowledgeGaps.map((g) => ({
          gapId: g.gapId,
          taskRevisionId: 'task-contract',
          question: 'Knowledge gap relevance',
          blocking: g.blocking,
          assumptionAllowed: g.assumptionAllowed,
          status: g.status,
        })),
      );
    }

    if (requiredPropositionIds.length === 0) {
      return { canProceed: true, resolvedEpistemicStates: {} };
    }

    const resolvedEpistemicStates: Record<string, string> = {};

    // 2. Resolve exact decision-time EpistemicStateVersion for each required proposition
    for (const propId of requiredPropositionIds) {
      // Must exist in caller's tenant
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

      // Query state strictly within pinned knowledge boundary and valid-time target
      const [state] = await this.sql`
        SELECT epistemic_state_id, known_from, valid_from, valid_until_if_known, support_status
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

      resolvedEpistemicStates[propId] = state.epistemic_state_id as string;
    }

    return {
      canProceed: true,
      resolvedEpistemicStates,
    };
  }
}
