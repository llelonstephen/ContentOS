import { describe, expect, it } from 'vitest';
import { CanonicalSupplementalPropositionResolver } from '../../persistence/relational/services/canonical-supplemental-proposition-resolver.js';

const authority = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
  decision_cycle_id: 'cycle-1', stage_execution_id: 'stage-1', fencing_token: 1,
  lease_owner: 'worker-1', cycle_epoch: 1, stage_name: 'ARCHITECTURE_GENERATE' as const,
  idempotency_key: 'key-1', run_config_id: 'config-1', canonical_input_hash: 'hash-1',
};
const audience = { audience_state_id: 'aud-1', task_revision_id: 'task-1', state_stage: 'FINAL_FOR_DECISION' as const,
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {}, brand_state: {}, intent_state: {}, desired_outcome: {},
  objections: [], decision_criteria: [], prior_exposure: {}, origin: [], uncertainty: [], created_at: 'x' };
const strategy = { strategy_id: 'strategy-1', task_revision_id: 'task-1', audience_state_id: 'aud-1', core_message: 'm', behavioral_objective: 'b',
  persuasion_mechanism: 'p', proof_strategy: 'p', required_proposition_ids: [], assumptions: [], unknowns: [], failure_modes: [], risk_hypotheses: [], created_at: 'x' };

function fakeSql(proof: any, lineage: any = { task_revision_id: 'task-1', initialization_cutoff: '2026-09-01T00:00:00Z' }) {
  let calls = 0;
  return async () => (++calls === 1 ? [lineage] : [proof]);
}

describe('M4 canonical supplemental factual proofs', () => {
  it('derives proof time only from Run/DecisionCycle lineage', async () => {
    const result = await new CanonicalSupplementalPropositionResolver(fakeSql({ epistemic_state_id: 'epi-1', support_status: 'SUPPORTED' }))
      .resolve({ authority, task_revision_id: 'task-1', audience, strategy, proposition_ids: ['prop-1'] });
    expect(result).toMatchObject([{ proposition_id: 'prop-1', epistemic_state_id: 'epi-1', used_as_factual_proof: true }]);
  });

  it.each(['CONTRADICTED', 'INSUFFICIENT'] as const)('fails closed for %s proof', async (support_status) => {
    await expect(new CanonicalSupplementalPropositionResolver(fakeSql({ epistemic_state_id: 'epi-1', support_status }))
      .resolve({ authority, task_revision_id: 'task-1', audience, strategy, proposition_ids: ['prop-1'] }))
      .rejects.toThrow(/insufficient factual proof/);
  });

  it('rejects a caller task that differs from canonical Run lineage', async () => {
    await expect(new CanonicalSupplementalPropositionResolver(fakeSql({ epistemic_state_id: 'epi-1', support_status: 'SUPPORTED' }))
      .resolve({ authority, task_revision_id: 'other-task', audience: { ...audience, task_revision_id: 'other-task' },
        strategy: { ...strategy, task_revision_id: 'other-task' }, proposition_ids: ['prop-1'] }))
      .rejects.toThrow(/canonical Run\/DecisionCycle\/Task lineage/);
  });
});
