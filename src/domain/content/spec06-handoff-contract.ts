import { failContent } from './content-error-codes.js';
import type {
  ContentArchitectureView,
  ContentCandidateView,
  ExactEntityRef,
  ExactRevisionRef,
  JsonValue,
  StrategyHypothesisView,
} from './types.js';

export interface Spec06HandoffDto {
  readonly candidate_id: string;
  readonly task_revision_id: string;
  readonly strategy_id: string;
  readonly architecture_id: string;
  readonly run_config_id: string;
  readonly content_payload: JsonValue;
  readonly relevant_pinned_context_refs: readonly (ExactEntityRef | ExactRevisionRef)[];
}

export interface Spec06HandoffContext {
  readonly candidate_persisted: boolean;
  readonly payload_parsed: boolean;
  readonly decision_path_writable: boolean;
  readonly expected_run_config_id: string;
  readonly relevant_pinned_context_refs: readonly (ExactEntityRef | ExactRevisionRef)[];
}

export function createSpec06Handoff(
  candidate: ContentCandidateView,
  strategy: StrategyHypothesisView,
  architecture: ContentArchitectureView,
  context: Spec06HandoffContext,
): Spec06HandoffDto {
  const closureValid =
    candidate.task_revision_id === strategy.task_revision_id &&
    candidate.task_revision_id === architecture.task_revision_id &&
    candidate.strategy_id === strategy.strategy_id &&
    candidate.strategy_id === architecture.strategy_id &&
    candidate.architecture_id === architecture.architecture_id &&
    candidate.run_config_id === context.expected_run_config_id;

  if (
    !context.candidate_persisted || !context.payload_parsed ||
    !context.decision_path_writable || !closureValid ||
    context.relevant_pinned_context_refs.length === 0
  ) {
    failContent(
      'SPEC06_HANDOFF_INVALID',
      'SPEC06 handoff requires a persisted, parsed Candidate with exact writable closure',
    );
  }

  return {
    candidate_id: candidate.candidate_id,
    task_revision_id: candidate.task_revision_id,
    strategy_id: candidate.strategy_id,
    architecture_id: candidate.architecture_id,
    run_config_id: candidate.run_config_id,
    content_payload: candidate.content_payload,
    relevant_pinned_context_refs: context.relevant_pinned_context_refs,
  };
}
