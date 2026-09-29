import {
  validateStrategyGrounding,
  type AudienceStateView,
  type StrategyFactualBasis,
  type StrategyHypothesisView,
} from '../../../domain/content/index.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';

export interface StrategyCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface StrategyHypothesisCommitRequest {
  readonly authority: StrategyCommitAuthority;
  readonly request_identity: string;
  readonly strategy_slot: string;
  readonly strategy: StrategyHypothesisView;
  readonly generation_config: PinnedGenerationConfig;
  readonly audience: AudienceStateView;
  readonly available_proposition_ids: readonly string[];
  readonly factual_bases: readonly StrategyFactualBasis[];
}

/**
 * Adapter must fence and atomically converge request_identity + strategy_slot,
 * the immutable hypothesis, exact proposition links, output ref, audit, and outbox.
 */
export interface StrategyHypothesisAtomicCommitPort {
  commitStrategyHypothesis(
    request: StrategyHypothesisCommitRequest,
  ): Promise<StrategyHypothesisView>;
}

function requireText(value: string, name: string): void {
  if (value.trim().length === 0) throw new Error(`Strategy commit requires ${name}`);
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function sameStrategyEffect(
  left: StrategyHypothesisView,
  right: StrategyHypothesisView,
): boolean {
  return left.task_revision_id === right.task_revision_id &&
    left.audience_state_id === right.audience_state_id &&
    left.core_message === right.core_message &&
    left.behavioral_objective === right.behavioral_objective &&
    left.persuasion_mechanism === right.persuasion_mechanism &&
    left.proof_strategy === right.proof_strategy &&
    sameValues(left.required_proposition_ids, right.required_proposition_ids) &&
    sameValues(left.assumptions, right.assumptions) &&
    sameValues(left.unknowns, right.unknowns) &&
    sameValues(left.failure_modes, right.failure_modes) &&
    sameValues(left.risk_hypotheses, right.risk_hypotheses);
}

export class StrategyHypothesisPersistenceService {
  constructor(private readonly commitPort: StrategyHypothesisAtomicCommitPort) {}

  async commit(
    request: StrategyHypothesisCommitRequest,
  ): Promise<StrategyHypothesisView> {
    const { authority, strategy } = request;
    assertContentRuntimeCommitAuthority(authority, 'STRATEGY_GENERATE');
    if (!request.generation_config) throw new Error('Strategy provider commit requires exact generation_config');
    for (const [name, value] of Object.entries({
      tenant_id: authority.tenant_id,
      workspace_id: authority.workspace_id,
      run_id: authority.run_id,
      decision_cycle_id: authority.decision_cycle_id,
      stage_execution_id: authority.stage_execution_id,
      run_config_id: authority.run_config_id,
      canonical_input_hash: authority.canonical_input_hash,
      request_identity: request.request_identity,
      strategy_slot: request.strategy_slot,
    })) requireText(value, name);
    validateStrategyGrounding(strategy, {
      task_revision_id: strategy.task_revision_id,
      audience: request.audience,
      available_proposition_ids: request.available_proposition_ids,
      factual_bases: request.factual_bases,
    });

    const committed = await this.commitPort.commitStrategyHypothesis(request);
    if (
      committed.task_revision_id !== strategy.task_revision_id ||
      committed.audience_state_id !== strategy.audience_state_id ||
      !sameStrategyEffect(committed, strategy)
    ) {
      throw new Error('Strategy atomic commit returned a different canonical hypothesis');
    }
    if (
      !sameValues(committed.required_proposition_ids, strategy.required_proposition_ids)
    ) {
      throw new Error('Strategy atomic commit returned different required proposition links');
    }
    return committed;
  }
}
