import { describe, expect, it } from 'vitest';
import { ExecuteDeterministicStrategyGate } from '../../application/content-intelligence/execute-deterministic-strategy-gate.js';
import type { AudienceStateView, StrategyHypothesisView } from '../../domain/content/index.js';
import {
  ContentStrategyGateInputResolver,
  type CanonicalStrategyGateSourcePort,
  type StrategyGateResolutionRequest,
} from '../../persistence/relational/services/content-strategy-gate-input-resolver.js';
import {
  ContentStrategyGatePersistenceService,
  type StrategyGateAtomicCommitPort,
} from '../../persistence/relational/services/content-strategy-gate-persistence-service.js';

const audience: AudienceStateView = {
  audience_state_id: 'aud-1', task_revision_id: 'task-1', state_stage: 'FINAL_FOR_DECISION',
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {},
  brand_state: {}, intent_state: {}, desired_outcome: {}, objections: [], decision_criteria: [],
  prior_exposure: {}, origin: [{ kind: 'PROPOSITION', reference_id: 'prop-1' }],
  uncertainty: [], created_at: '2026-09-28T00:00:00Z',
};

const strategy: StrategyHypothesisView = {
  strategy_id: 'strategy-1', task_revision_id: 'task-1', audience_state_id: 'aud-1',
  core_message: 'Message', behavioral_objective: 'Act', persuasion_mechanism: 'Proof',
  proof_strategy: 'Cite evidence', required_proposition_ids: ['prop-1', 'prop-2'],
  assumptions: [], unknowns: ['Residual uncertainty'], failure_modes: [], risk_hypotheses: [],
  created_at: '2026-09-28T00:00:00Z',
};

const resolution: StrategyGateResolutionRequest = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
  decision_cycle_id: 'cycle-1', task_revision_id: 'task-1', audience_state_id: 'aud-1',
  strategy_id: 'strategy-1', run_config_id: 'config-1', gate_config_revision: 'gate-v1',
};

function canonicalSource(): CanonicalStrategyGateSourcePort {
  return {
    async loadCanonicalGateSource() {
      return {
        audience,
        strategy,
        terminal_knowledge_gaps: [{ knowledge_gap_id: 'gap-1', status: 'BLOCKING' }],
        proposition_states: [{
          proposition_id: 'prop-1', epistemic_state_id: 'state-1',
          support_status: 'CONTRADICTED' as const, used_as_factual_proof: false,
        }],
        pre_generation_final_governance: [{
          assessment_id: 'assessment-1', applicability_stage: 'PRE_GENERATION_FINAL' as const,
          resolved: true, applicable: true, non_overridable: true, blocks_strategy: true,
        }],
        pinned_entity_refs: [{ entity_type: 'Channel', entity_id: 'channel-1' }],
        pinned_revision_refs: [{
          entity_type: 'TaskContract', stable_id: 'task', revision_id: 'task-1',
        }],
      };
    },
  };
}

describe('M4 deterministic Strategy Gate runtime', () => {
  it('persists stable fail-closed reasons without creating a gate entity', async () => {
    const resolver = new ContentStrategyGateInputResolver(canonicalSource());
    const firstResolution = await resolver.resolve(resolution);
    const commits: unknown[] = [];
    const port: StrategyGateAtomicCommitPort = {
      async commitStrategyGateExecution(request) {
        commits.push(request);
        return {
          stage_execution_id: request.authority.stage_execution_id,
          output_ref_id: 'logical-output-1',
          result: request.result,
        };
      },
    };
    const service = new ExecuteDeterministicStrategyGate(
      resolver,
      new ContentStrategyGatePersistenceService(port),
    );
    const authority = {
      tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
      decision_cycle_id: 'cycle-1', stage_execution_id: 'stage-gate-1', fencing_token: 3,
      lease_owner: 'worker-1', cycle_epoch: 1, stage_name: 'STRATEGY_GATE' as const,
      idempotency_key: 'gate-request-1', run_config_id: 'config-1',
      canonical_input_hash: firstResolution.input_hash,
    };
    const executed = await service.execute({ authority, resolution });
    expect(executed.result).toEqual({
      strategy_id: 'strategy-1', audience_state_id: 'aud-1', outcome: 'BLOCKED',
      reason_codes: [
        'GATE_BLOCKING_KNOWLEDGE_GAP',
        'GATE_REQUIRED_PROPOSITION_STATE_MISSING',
        'GATE_REQUIRED_PROPOSITION_CONTRADICTED',
        'GATE_HARD_GOVERNANCE_BLOCK',
      ],
      gate_config_revision: 'gate-v1',
    });
    expect(commits).toHaveLength(1);
    expect(executed.receipt.output_ref_id).toBe('logical-output-1');
  });

  it('fails closed when canonical hard governance remains unresolved', async () => {
    const resolver = new ContentStrategyGateInputResolver({
      async loadCanonicalGateSource() {
        return {
          audience, strategy, terminal_knowledge_gaps: [], proposition_states: [
            { proposition_id: 'prop-1', epistemic_state_id: 'state-1', support_status: 'SUPPORTED', used_as_factual_proof: true },
            { proposition_id: 'prop-2', epistemic_state_id: 'state-2', support_status: 'SUPPORTED', used_as_factual_proof: true },
          ],
          pre_generation_final_governance: [{
            assessment_id: 'hard-unresolved', applicability_stage: 'PRE_GENERATION_FINAL',
            resolved: false, applicable: false, non_overridable: true, blocks_strategy: false,
          }],
          pinned_entity_refs: [], pinned_revision_refs: [],
        };
      },
    });
    const resolved = await resolver.resolve(resolution);
    const { evaluateStrategyGate } = await import('../../domain/content/index.js');
    expect(evaluateStrategyGate(resolved.gate_input)).toMatchObject({
      outcome: 'BLOCKED', reason_codes: ['GATE_INPUT_INCOMPLETE'],
    });
  });

  it('rejects all caller-supplied gate facts, including facts for missing IDs', async () => {
    const resolver = new ContentStrategyGateInputResolver(canonicalSource());
    await expect(resolver.resolve({
      ...resolution,
      additional_proposition_states: [{
        proposition_id: 'prop-2', epistemic_state_id: 'state-2',
        support_status: 'SUPPORTED', used_as_factual_proof: true,
      }],
    })).rejects.toThrow(/Caller-supplied Strategy Gate facts are forbidden/);
  });
});
