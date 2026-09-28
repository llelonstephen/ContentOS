import { failContent } from './content-error-codes.js';
import type { GateSupportStatus } from './deterministic-strategy-gate.js';

export interface SupplementalPropositionUse {
  readonly proposition_id: string;
  readonly used_as_factual_proof: boolean;
  readonly epistemic_state_id?: string;
  readonly support_status?: GateSupportStatus;
  readonly compatible_with_task: boolean;
  readonly compatible_with_audience: boolean;
  readonly compatible_with_governance: boolean;
  readonly compatible_with_strategy: boolean;
  readonly changes_core_message: boolean;
  readonly changes_proof_strategy: boolean;
  readonly changes_behavioral_logic: boolean;
  readonly changes_risk: boolean;
  readonly changes_governance_dependency: boolean;
}

export interface SupplementalAdmissionResult {
  readonly disposition: 'ADMITTED' | 'NEW_STRATEGY_REQUIRED';
  readonly admitted_proposition_ids: readonly string[];
}

function changesStrategyMeaning(use: SupplementalPropositionUse): boolean {
  return use.changes_core_message ||
    use.changes_proof_strategy ||
    use.changes_behavioral_logic ||
    use.changes_risk ||
    use.changes_governance_dependency;
}

export function admitSupplementalPropositions(
  strategyPropositionIds: readonly string[],
  uses: readonly SupplementalPropositionUse[],
): SupplementalAdmissionResult {
  const strategyIds = new Set(strategyPropositionIds);
  const supplemental = uses.filter(({ proposition_id }) => !strategyIds.has(proposition_id));

  for (const use of supplemental) {
    if (
      !use.compatible_with_task || !use.compatible_with_audience ||
      !use.compatible_with_governance || !use.compatible_with_strategy
    ) {
      failContent(
        'ARCHITECTURE_PROPOSITION_UNGROUNDED',
        `Supplemental Proposition '${use.proposition_id}' is context-incompatible`,
      );
    }
    if (
      use.used_as_factual_proof &&
      (!use.epistemic_state_id || !use.support_status ||
        use.support_status === 'CONTRADICTED' || use.support_status === 'INSUFFICIENT' ||
        use.support_status === 'UNKNOWN' || use.support_status === 'CONFLICTING')
    ) {
      failContent(
        'ARCHITECTURE_PROPOSITION_UNGROUNDED',
        `Supplemental factual Proposition '${use.proposition_id}' lacks admissible decision-time proof`,
      );
    }
  }

  return {
    disposition: supplemental.some(changesStrategyMeaning)
      ? 'NEW_STRATEGY_REQUIRED'
      : 'ADMITTED',
    admitted_proposition_ids: [...new Set(supplemental.map(({ proposition_id }) => proposition_id))].sort(),
  };
}
