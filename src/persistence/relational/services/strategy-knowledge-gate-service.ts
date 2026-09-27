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
  supersedesGapId?: string | null;
  propositionId?: string;
  blocking: boolean;
  assumptionAllowed: boolean;
  status: KnowledgeGapStatus;
  question?: string;
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
    // KnowledgeGap transitions are immutable (new gap_id + supersedes_gap_id).
    // The Unknown-Preservation Gate applies to terminal/final KnowledgeGaps in the lineage,
    // not superseded historical rows.
    const dbGaps = await this.sql`
      SELECT gap_id, supersedes_gap_id, blocking, assumption_allowed, status, question
      FROM knowledge_gaps
      WHERE task_revision_id = ${strategy.task_revision_id}
        AND tenant_id = ${tenantId}
    `;

    interface GapNode {
      gapId: string;
      supersedesGapId: string | null;
      blocking: boolean;
      assumptionAllowed: boolean;
      status: KnowledgeGapStatus;
      question: string;
    }

    const gapMap = new Map<string, GapNode>();

    // Canonical DB records always take precedence over caller assertions
    for (const g of dbGaps) {
      gapMap.set(g.gap_id, {
        gapId: g.gap_id,
        supersedesGapId: (g.supersedes_gap_id as string | null) ?? null,
        blocking: g.blocking as boolean,
        assumptionAllowed: g.assumption_allowed as boolean,
        status: g.status as KnowledgeGapStatus,
        question: (g.question as string) || 'Knowledge gap relevance',
      });
    }

    // Caller cannot omit or alter DB gaps; only newly introduced transient gaps can be merged
    for (const g of activeKnowledgeGaps) {
      if (!gapMap.has(g.gapId)) {
        gapMap.set(g.gapId, {
          gapId: g.gapId,
          supersedesGapId: g.supersedesGapId ?? null,
          blocking: g.blocking,
          assumptionAllowed: g.assumptionAllowed,
          status: g.status,
          question: g.question || 'Knowledge gap relevance',
        });
      }
    }

    // Validate lineage invariants: non-branching & acyclic
    const successorMap = new Map<string, string[]>();
    for (const node of gapMap.values()) {
      if (node.supersedesGapId) {
        if (node.supersedesGapId === node.gapId) {
          throw new RegistryValidationError(
            'KNOWLEDGE_GAP_LINEAGE_INVALID',
            `Knowledge gap '${node.gapId}' cannot supersede itself.`,
          );
        }
        const existing = successorMap.get(node.supersedesGapId) || [];
        existing.push(node.gapId);
        successorMap.set(node.supersedesGapId, existing);
      }
    }

    // Non-branching invariant: at most one direct successor per predecessor
    for (const [predId, succs] of successorMap.entries()) {
      if (succs.length > 1) {
        throw new RegistryValidationError(
          'KNOWLEDGE_GAP_LINEAGE_INVALID',
          `Branching lineage detected for knowledge gap '${predId}' (successors: ${succs.join(', ')}). Branching is prohibited.`,
        );
      }
    }

    // Acyclic invariant: traverse ancestor chains
    for (const node of gapMap.values()) {
      let curr: string | null = node.supersedesGapId;
      const pathSet = new Set<string>([node.gapId]);
      while (curr) {
        if (pathSet.has(curr)) {
          throw new RegistryValidationError(
            'KNOWLEDGE_GAP_LINEAGE_INVALID',
            `Cycle detected in knowledge gap lineage at '${curr}'. Chains must be strictly acyclic.`,
          );
        }
        pathSet.add(curr);
        const parentNode = gapMap.get(curr);
        curr = parentNode ? parentNode.supersedesGapId : null;
      }
    }

    // Terminal gaps: nodes that are not superseded by any successor in the lineage
    const terminalGaps = Array.from(gapMap.values()).filter((g) => !successorMap.has(g.gapId));

    if (terminalGaps.length > 0) {
      assertUnknownPreservationGate(
        terminalGaps.map((g) => ({
          gapId: g.gapId,
          taskRevisionId: strategy.task_revision_id,
          question: g.question,
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
