import type { AudienceStateView, StrategyHypothesisView } from './types.js';

export const STRATEGY_GATE_OUTCOMES = [
  'PROCEED',
  'BLOCKED',
  'HUMAN_REVIEW_REQUIRED',
] as const;
export type StrategyGateOutcome = (typeof STRATEGY_GATE_OUTCOMES)[number];

export const STRATEGY_GATE_REASON_ORDER = [
  'GATE_INPUT_INCOMPLETE',
  'GATE_TASK_MISMATCH',
  'GATE_AUDIENCE_NOT_FINAL',
  'GATE_AUDIENCE_MISMATCH',
  'GATE_BLOCKING_KNOWLEDGE_GAP',
  'GATE_REQUIRED_PROPOSITION_STATE_MISSING',
  'GATE_REQUIRED_PROPOSITION_CONTRADICTED',
  'GATE_REQUIRED_PROPOSITION_INSUFFICIENT',
  'GATE_REQUIRED_PROPOSITION_UNCERTAIN',
  'GATE_HARD_GOVERNANCE_BLOCK',
  'GATE_GOVERNANCE_STATE_UNRESOLVED',
  'GATE_EXPLICIT_LIMITS_OMITTED',
] as const;
export type StrategyGateReasonCode = (typeof STRATEGY_GATE_REASON_ORDER)[number];

export type GateSupportStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONFLICTING'
  | 'CONTRADICTED'
  | 'INSUFFICIENT'
  | 'UNKNOWN';

export interface GateKnowledgeGap {
  readonly knowledge_gap_id: string;
  readonly status: string;
}

export interface GatePropositionState {
  readonly proposition_id: string;
  readonly epistemic_state_id: string;
  readonly support_status: GateSupportStatus;
  readonly used_as_factual_proof: boolean;
}

export interface GateGovernanceState {
  readonly assessment_id: string;
  readonly applicability_stage: 'PRE_GENERATION_FINAL';
  readonly resolved: boolean;
  readonly applicable: boolean;
  readonly non_overridable: boolean;
  readonly blocks_strategy: boolean;
}

export interface StrategyGateInput {
  readonly task_revision_id?: string;
  readonly audience?: AudienceStateView;
  readonly strategy?: StrategyHypothesisView;
  readonly knowledge_gaps?: readonly GateKnowledgeGap[];
  readonly proposition_states?: readonly GatePropositionState[];
  readonly governance?: readonly GateGovernanceState[];
  readonly gate_config_revision?: string;
}

export interface StrategyGateResult {
  readonly strategy_id?: string;
  readonly audience_state_id?: string;
  readonly outcome: StrategyGateOutcome;
  readonly reason_codes: readonly StrategyGateReasonCode[];
  readonly gate_config_revision?: string;
}

function orderedReasons(reasons: ReadonlySet<StrategyGateReasonCode>): readonly StrategyGateReasonCode[] {
  return STRATEGY_GATE_REASON_ORDER.filter((reason) => reasons.has(reason));
}

export function evaluateStrategyGate(input: StrategyGateInput): StrategyGateResult {
  const blocked = new Set<StrategyGateReasonCode>();
  const review = new Set<StrategyGateReasonCode>();
  const { audience, strategy } = input;

  if (
    !input.task_revision_id || !audience || !strategy || !input.knowledge_gaps ||
    !input.proposition_states || !input.governance || !input.gate_config_revision
  ) {
    blocked.add('GATE_INPUT_INCOMPLETE');
  }
  if (audience && input.task_revision_id && audience.task_revision_id !== input.task_revision_id) {
    blocked.add('GATE_TASK_MISMATCH');
  }
  if (strategy && input.task_revision_id && strategy.task_revision_id !== input.task_revision_id) {
    blocked.add('GATE_TASK_MISMATCH');
  }
  if (audience && audience.state_stage !== 'FINAL_FOR_DECISION') {
    blocked.add('GATE_AUDIENCE_NOT_FINAL');
  }
  if (audience && strategy && strategy.audience_state_id !== audience.audience_state_id) {
    blocked.add('GATE_AUDIENCE_MISMATCH');
  }
  if (input.knowledge_gaps?.some(({ status }) => status === 'BLOCKING')) {
    blocked.add('GATE_BLOCKING_KNOWLEDGE_GAP');
  }

  const suppliedStates = [...(input.proposition_states ?? [])].sort((left, right) => {
    const leftKey = `${left.proposition_id}\u0000${left.epistemic_state_id}\u0000${left.support_status}`;
    const rightKey = `${right.proposition_id}\u0000${right.epistemic_state_id}\u0000${right.support_status}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  if (new Set(suppliedStates.map(({ proposition_id }) => proposition_id)).size !== suppliedStates.length) {
    blocked.add('GATE_INPUT_INCOMPLETE');
  }
  const states = new Map(suppliedStates.map((state) => [state.proposition_id, state]));
  for (const propositionId of strategy?.required_proposition_ids ?? []) {
    const state = states.get(propositionId);
    if (!state?.epistemic_state_id) {
      blocked.add('GATE_REQUIRED_PROPOSITION_STATE_MISSING');
    } else if (state.used_as_factual_proof && state.support_status === 'CONTRADICTED') {
      blocked.add('GATE_REQUIRED_PROPOSITION_CONTRADICTED');
    } else if (state.used_as_factual_proof && state.support_status === 'INSUFFICIENT') {
      blocked.add('GATE_REQUIRED_PROPOSITION_INSUFFICIENT');
    } else if (
      state.used_as_factual_proof &&
      (state.support_status === 'UNKNOWN' || state.support_status === 'CONFLICTING')
    ) {
      review.add('GATE_REQUIRED_PROPOSITION_UNCERTAIN');
    }
  }

  if (input.governance?.some((item) => !item.resolved)) {
    review.add('GATE_GOVERNANCE_STATE_UNRESOLVED');
  }
  if (input.governance?.some(
    (item) => item.resolved && item.applicable && item.non_overridable && item.blocks_strategy,
  )) {
    blocked.add('GATE_HARD_GOVERNANCE_BLOCK');
  }
  if (strategy && (!Array.isArray(strategy.assumptions) || !Array.isArray(strategy.unknowns))) {
    blocked.add('GATE_EXPLICIT_LIMITS_OMITTED');
  }

  const outcome: StrategyGateOutcome = blocked.size > 0
    ? 'BLOCKED'
    : review.size > 0
      ? 'HUMAN_REVIEW_REQUIRED'
      : 'PROCEED';
  const reason_codes = orderedReasons(new Set([...blocked, ...review]));
  return {
    ...(strategy ? { strategy_id: strategy.strategy_id } : {}),
    ...(audience ? { audience_state_id: audience.audience_state_id } : {}),
    ...(input.gate_config_revision ? { gate_config_revision: input.gate_config_revision } : {}),
    outcome,
    reason_codes,
  };
}
