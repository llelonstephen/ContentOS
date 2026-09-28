import { failContent } from './content-error-codes.js';
import type {
  ContentArchitectureView,
  ContentCandidateView,
  StrategyHypothesisView,
} from './types.js';

export interface CandidateClosureContext {
  readonly expected_task_revision_id: string;
  readonly expected_run_config_id: string;
  readonly admitted_strategy_id: string;
  readonly payload_is_valid: (candidate: ContentCandidateView) => boolean;
  readonly parent_candidate?: ContentCandidateView;
  /** Evaluation, release, readiness, and publication authority can never be inherited. */
  readonly inherited_authority_kinds?: readonly string[];
}

export function validateCandidateClosure(
  candidate: ContentCandidateView,
  strategy: StrategyHypothesisView,
  architecture: ContentArchitectureView,
  context: CandidateClosureContext,
): void {
  if (
    candidate.task_revision_id !== context.expected_task_revision_id ||
    strategy.task_revision_id !== context.expected_task_revision_id ||
    architecture.task_revision_id !== context.expected_task_revision_id
  ) {
    failContent('CANDIDATE_TASK_MISMATCH', 'Candidate closure does not share one exact Task');
  }
  if (
    candidate.strategy_id !== strategy.strategy_id ||
    architecture.strategy_id !== strategy.strategy_id ||
    context.admitted_strategy_id !== strategy.strategy_id
  ) {
    failContent('CANDIDATE_STRATEGY_MISMATCH', 'Candidate does not use the admitted Strategy path');
  }
  if (candidate.architecture_id !== architecture.architecture_id) {
    failContent('CANDIDATE_ARCHITECTURE_MISMATCH', 'Candidate references a different Architecture');
  }
  if (candidate.run_config_id !== context.expected_run_config_id) {
    failContent('RUN_CONFIG_MISMATCH', 'Candidate does not use the exact pinned RunConfig');
  }
  if (!context.payload_is_valid(candidate)) {
    failContent('GENERATION_OUTPUT_MALFORMED', 'Candidate content payload failed its pinned schema');
  }
  const hasParentId = candidate.parent_candidate_id !== undefined &&
    candidate.parent_candidate_id !== null;
  if (hasParentId !== Boolean(context.parent_candidate)) {
    failContent('CANDIDATE_PARENT_INVALID', 'Candidate parent identity and resolved parent must agree');
  }
  if (hasParentId) {
    if (
      !context.parent_candidate ||
      candidate.parent_candidate_id !== context.parent_candidate.candidate_id ||
      candidate.candidate_id === context.parent_candidate.candidate_id ||
      context.parent_candidate.task_revision_id !== candidate.task_revision_id ||
      context.parent_candidate.strategy_id !== candidate.strategy_id ||
      context.parent_candidate.architecture_id !== candidate.architecture_id ||
      context.parent_candidate.run_config_id !== candidate.run_config_id
    ) {
      failContent(
        'CANDIDATE_PARENT_INVALID',
        'Rewrite parent must be distinct and share exact Task, Strategy, Architecture, and RunConfig',
      );
    }
  }
  if ((context.inherited_authority_kinds?.length ?? 0) > 0) {
    failContent(
      'CANDIDATE_INHERITED_AUTHORITY',
      'A new Candidate cannot inherit evaluation, readiness, release, or publication authority',
    );
  }
}
