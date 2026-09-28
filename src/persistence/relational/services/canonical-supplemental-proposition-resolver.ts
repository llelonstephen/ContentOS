import type {
  AudienceStateView,
  StrategyHypothesisView,
  SupplementalPropositionUse,
} from '../../../domain/content/index.js';

export interface SupplementalProofResolutionInput {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly task_revision_id: string;
  readonly decision_boundary: Date;
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
    const ids = [...new Set(input.proposition_ids)];
    const resolved: SupplementalPropositionUse[] = [];
    for (const propositionId of ids) {
      const [row] = await this.sql`
        SELECT state.epistemic_state_id, state.support_status
        FROM propositions proposition
        JOIN epistemic_state_versions state ON state.proposition_id = proposition.proposition_id
        WHERE proposition.proposition_id = ${propositionId}
          AND proposition.tenant_id = ${input.tenant_id}
          AND proposition.workspace_id IS NOT DISTINCT FROM ${input.workspace_id}
          AND state.tenant_id = ${input.tenant_id}
          AND state.workspace_id IS NOT DISTINCT FROM ${input.workspace_id}
          AND state.known_from <= ${input.decision_boundary}
          AND state.valid_from <= ${input.decision_boundary}
          AND (state.valid_until_if_known IS NULL OR state.valid_until_if_known > ${input.decision_boundary})
        ORDER BY state.known_from DESC, state.created_at DESC
        LIMIT 1
      `;
      if (!row) throw new Error(`Supplemental Proposition '${propositionId}' lacks exact decision-time EpistemicState`);
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
