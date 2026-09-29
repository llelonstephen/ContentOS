import { describe, expect, it } from 'vitest';
import { GenerateStrategyHypothesis } from '../../application/content-intelligence/generate-strategy-hypothesis.js';
import type { AudienceStateView, StrategyHypothesisView } from '../../domain/content/index.js';
import {
  StrategyHypothesisPersistenceService,
  type StrategyHypothesisAtomicCommitPort,
} from '../../persistence/relational/services/strategy-hypothesis-persistence-service.js';

const audience: AudienceStateView = {
  audience_state_id: 'aud-final', task_revision_id: 'task-1', state_stage: 'FINAL_FOR_DECISION',
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {},
  brand_state: {}, intent_state: {}, desired_outcome: {}, objections: [], decision_criteria: [],
  prior_exposure: {}, origin: [{ kind: 'PROPOSITION', reference_id: 'prop-1' }],
  uncertainty: [], created_at: '2026-09-28T00:00:00Z',
};

const authority = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
  decision_cycle_id: 'cycle-1', stage_execution_id: 'stage-2', fencing_token: 2,
  lease_owner: 'worker-1', cycle_epoch: 1, stage_name: 'STRATEGY_GENERATE' as const,
  idempotency_key: 'strategy-request-1',
  slot: { kind: 'strategySlot' as const, value: 'primary' },
  run_config_id: 'config-1', canonical_input_hash: 'hash-2',
};

const proposal = {
  core_message: 'Use verified proof', behavioral_objective: 'Choose deliberately',
  persuasion_mechanism: 'Evidence', proof_strategy: 'Show the admitted proposition',
  required_proposition_ids: ['prop-1'], assumptions: [], unknowns: ['Long-term effect'],
  failure_modes: ['Proof ignored'], risk_hypotheses: ['Message fatigue'],
};
const pins = { prompt_revision_id: 'prompt-1', model_revision_id: 'model-1',
  schema_revision_id: 'schema-1', tool_revision_ids: ['tool-1'] };

describe('M4 strategy runtime', () => {
  it('grounds provider output before atomic slot commit', async () => {
    const order: string[] = [];
    const port: StrategyHypothesisAtomicCommitPort = {
      async commitStrategyHypothesis(request) {
        order.push('commit');
        expect(request.strategy_slot).toBe('primary');
        expect(request.strategy.required_proposition_ids).toEqual(['prop-1']);
        return request.strategy;
      },
    };
    const service = new GenerateStrategyHypothesis(
      { async resolveAuthorizedInputs() {
        order.push('resolve');
        return { audience, available_proposition_ids: ['prop-1'], provider_context: {} };
      } },
      { async generateStrategyProposal() {
        order.push('provider');
        return { strategy: proposal, factual_bases: [{
          basis_id: 'basis-1', representation: 'REQUIRED_PROPOSITION', reference: 'prop-1',
        }] };
      } },
      new StrategyHypothesisPersistenceService(port),
      { nextStrategyId: () => 'strategy-1', now: () => new Date('2026-09-28T01:00:00Z') },
      { async resolve() { order.push('pins'); return pins; } },
    );
    const result = await service.execute({
      authority, request_identity: 'strategy-request-1', task_revision_id: 'task-1',
      audience_state_id: 'aud-final', strategy_slot: 'primary',
    });
    expect(result.strategy_id).toBe('strategy-1');
    expect(order).toEqual(['resolve', 'pins', 'provider', 'commit']);
  });

  it('allows exact slot retry to converge on the previously committed identity', async () => {
    const prior: StrategyHypothesisView = {
      ...proposal, strategy_id: 'strategy-existing', task_revision_id: 'task-1',
      audience_state_id: 'aud-final', created_at: '2026-09-28T00:30:00Z',
    };
    const persistence = new StrategyHypothesisPersistenceService({
      async commitStrategyHypothesis() { return prior; },
    });
    const result = await persistence.commit({
      authority, request_identity: 'strategy-request-1', strategy_slot: 'primary',
      audience, available_proposition_ids: ['prop-1'],
      factual_bases: [{ basis_id: 'b', representation: 'REQUIRED_PROPOSITION', reference: 'prop-1' }],
      strategy: { ...prior, strategy_id: 'strategy-retry', created_at: new Date() },
      generation_config: pins,
    });
    expect(result.strategy_id).toBe('strategy-existing');
  });

  it('rejects an unrepresented material factual basis', async () => {
    const persistence = new StrategyHypothesisPersistenceService({
      async commitStrategyHypothesis(request) { return request.strategy; },
    });
    await expect(persistence.commit({
      authority, request_identity: 'strategy-request-2', strategy_slot: 'secondary',
      audience, available_proposition_ids: ['prop-1'],
      strategy: { ...proposal, strategy_id: 'strategy-2', task_revision_id: 'task-1',
        audience_state_id: 'aud-final', created_at: new Date() },
      factual_bases: [{ basis_id: 'hidden', representation: 'ASSUMPTION', reference: 'omitted' }],
      generation_config: pins,
    })).rejects.toThrow(/lacks its declared canonical representation/);
  });
});
