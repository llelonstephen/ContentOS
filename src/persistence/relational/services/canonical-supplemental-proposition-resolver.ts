import type {
  AudienceStateView,
  StrategyHypothesisView,
  SupplementalPropositionUse,
} from '../../../domain/content/index.js';
import type { ArchitectureCommitAuthority } from './content-architecture-persistence-service.js';

export interface SupplementalProofResolutionInput {
  readonly task_revision_id: string;
  readonly authority: ArchitectureCommitAuthority;
  readonly audience: AudienceStateView;
  readonly strategy: StrategyHypothesisView;
  readonly proposition_ids: readonly string[];
}

/** Derives proof facts from scoped immutable state; callers cannot provide truth booleans. */
export class CanonicalSupplementalPropositionResolver {
  constructor(private readonly sql: any) {}

  async resolve(input: SupplementalProofResolutionInput): Promise<readonly SupplementalPropositionUse[]> {
    if (input.audience.task_revision_id !== input.task_revision_id ||
        input.strategy.task_revision_id !== input.task_revision_id) {
      throw new Error('Supplemental proof path is not bound to the exact Task');
    }
    if (input.authority.stage_name !== 'ARCHITECTURE_GENERATE') {
      throw new Error('Supplemental proof resolution is restricted to Architecture authority');
    }
    const [lineage] = await this.sql`
      SELECT run.task_revision_id, run.initialization_cutoff
      FROM runs run
      JOIN decision_cycles cycle ON cycle.decision_cycle_id = ${input.authority.decision_cycle_id}
        AND cycle.run_id = run.run_id
      WHERE run.run_id = ${input.authority.run_id}
        AND run.tenant_id = ${input.authority.tenant_id}
        AND run.workspace_id IS NOT DISTINCT FROM ${input.authority.workspace_id}
        AND run.current_decision_cycle_id = ${input.authority.decision_cycle_id}
        AND cycle.tenant_id = ${input.authority.tenant_id}
        AND cycle.workspace_id IS NOT DISTINCT FROM ${input.authority.workspace_id}
        AND cycle.status IN ('OPEN', 'FREEZING', 'FROZEN')
    `;
    if (!lineage || lineage.task_revision_id !== input.task_revision_id || !lineage.initialization_cutoff) {
      throw new Error('Supplemental proof path lacks exact canonical Run/DecisionCycle/Task lineage');
    }
    const decisionBoundary = new Date(lineage.initialization_cutoff);
    if (Number.isNaN(decisionBoundary.getTime())) {
      throw new Error('Supplemental proof path has no valid frozen knowledge boundary');
    }
    const ids = [...new Set(input.proposition_ids)];
    const resolved: SupplementalPropositionUse[] = [];
    for (const propositionId of ids) {
      const [row] = await this.sql`
        SELECT state.epistemic_state_id, state.support_status
        FROM propositions proposition
        JOIN epistemic_state_versions state ON state.proposition_id = proposition.proposition_id
        WHERE proposition.proposition_id = ${propositionId}
          AND proposition.tenant_id = ${input.authority.tenant_id}
          AND proposition.workspace_id IS NOT DISTINCT FROM ${input.authority.workspace_id}
          AND state.tenant_id = ${input.authority.tenant_id}
          AND state.workspace_id IS NOT DISTINCT FROM ${input.authority.workspace_id}
          AND state.known_from <= ${decisionBoundary}
          AND state.valid_from <= ${decisionBoundary}
          AND (state.valid_until_if_known IS NULL OR state.valid_until_if_known > ${decisionBoundary})
        ORDER BY state.known_from DESC, state.created_at DESC
        LIMIT 1
      `;
      if (!row) throw new Error(`Supplemental Proposition '${propositionId}' lacks exact decision-time EpistemicState`);
      if (row.support_status !== 'SUPPORTED') {
        throw new Error(`Supplemental Proposition '${propositionId}' has insufficient factual proof`);
      }
      resolved.push({
        proposition_id: propositionId,
        used_as_factual_proof: true,
        epistemic_state_id: String(row.epistemic_state_id),
        support_status: row.support_status,
        compatible_with_task: true,
        compatible_with_audience: true,
        compatible_with_governance: true,
        compatible_with_strategy: true,
        // Conservative trusted classification: supplemental factual proof requires a new Strategy.
        changes_core_message: true,
        changes_proof_strategy: false,
        changes_behavioral_logic: false,
        changes_risk: false,
        changes_governance_dependency: false,
      });
    }
    return resolved;
  }
}
