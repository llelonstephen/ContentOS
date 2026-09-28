import { assertFinalAudienceForTask } from './audience-state-validator.js';
import { failContent } from './content-error-codes.js';
import type { AudienceStateView, StrategyHypothesisView } from './types.js';

export type FactualBasisRepresentation =
  | 'REQUIRED_PROPOSITION'
  | 'ASSUMPTION'
  | 'UNKNOWN';

export interface StrategyFactualBasis {
  readonly basis_id: string;
  readonly representation: FactualBasisRepresentation;
  /** Proposition ID for proof, or exact assumption/unknown text for a declared limit. */
  readonly reference: string;
}

export interface StrategyGroundingContext {
  readonly task_revision_id: string;
  readonly audience: AudienceStateView;
  readonly available_proposition_ids: readonly string[];
  readonly factual_bases: readonly StrategyFactualBasis[];
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateStrategyGrounding(
  strategy: StrategyHypothesisView,
  context: StrategyGroundingContext,
): void {
  assertFinalAudienceForTask(context.audience, context.task_revision_id);
  if (strategy.task_revision_id !== context.task_revision_id) {
    failContent('STRATEGY_TASK_MISMATCH', 'Strategy belongs to a different Task revision');
  }
  if (strategy.audience_state_id !== context.audience.audience_state_id) {
    failContent('STRATEGY_AUDIENCE_MISMATCH', 'Strategy does not reference the final AudienceState');
  }
  const requiredText = [
    strategy.core_message,
    strategy.behavioral_objective,
    strategy.persuasion_mechanism,
    strategy.proof_strategy,
  ];
  if (requiredText.some((value) => value.trim().length === 0)) {
    failContent('STRATEGY_SCHEMA_INVALID', 'Strategy material fields must be non-empty');
  }
  if (!unique(strategy.required_proposition_ids)) {
    failContent('STRATEGY_SCHEMA_INVALID', 'Required proposition IDs must be unique');
  }

  const available = new Set(context.available_proposition_ids);
  if (strategy.required_proposition_ids.some((id) => !available.has(id))) {
    failContent('STRATEGY_GROUNDING_FAILED', 'A required Proposition is not in admitted knowledge');
  }

  const required = new Set(strategy.required_proposition_ids);
  const assumptions = new Set(strategy.assumptions);
  const unknowns = new Set(strategy.unknowns);
  for (const basis of context.factual_bases) {
    const represented =
      (basis.representation === 'REQUIRED_PROPOSITION' && required.has(basis.reference)) ||
      (basis.representation === 'ASSUMPTION' && assumptions.has(basis.reference)) ||
      (basis.representation === 'UNKNOWN' && unknowns.has(basis.reference));
    if (!basis.basis_id || !basis.reference || !represented) {
      failContent(
        'STRATEGY_GROUNDING_FAILED',
        `Material factual basis '${basis.basis_id}' lacks its declared canonical representation`,
      );
    }
  }
}
