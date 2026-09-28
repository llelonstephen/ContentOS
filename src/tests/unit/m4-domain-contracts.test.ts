import { describe, expect, it } from 'vitest';
import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  admitSupplementalPropositions,
  classifyDependencyInvalidation,
  deriveRequestIdentity,
  evaluateStrategyGate,
  serializeCanonicalInput,
  validateGenerationContext,
  type AudienceStateView,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';

const audience: AudienceStateView = {
  audience_state_id: 'aud-1',
  task_revision_id: 'task-1',
  state_stage: 'FINAL_FOR_DECISION',
  context: {},
  knowledge_state: {},
  problem_state: {},
  solution_state: {},
  product_state: {},
  brand_state: {},
  intent_state: {},
  desired_outcome: {},
  objections: [],
  decision_criteria: [],
  prior_exposure: {},
  origin: [{ kind: 'PROPOSITION', reference_id: 'prop-1' }],
  uncertainty: [{ kind: 'SPARSE_EVIDENCE', description: 'Small sample' }],
  created_at: '2026-09-28T00:00:00Z',
};

const strategy: StrategyHypothesisView = {
  strategy_id: 'strategy-1',
  task_revision_id: 'task-1',
  audience_state_id: 'aud-1',
  core_message: 'Message',
  behavioral_objective: 'Objective',
  persuasion_mechanism: 'Mechanism',
  proof_strategy: 'Proof',
  required_proposition_ids: ['prop-1', 'prop-2'],
  assumptions: [],
  unknowns: ['residual unknown'],
  failure_modes: [],
  risk_hypotheses: [],
  created_at: '2026-09-28T00:00:00Z',
};

describe('M4 pure content domain contracts', () => {
  it('sorts only semantic sets and preserves ordered lists', () => {
    const base = {
      serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
      fields: [
        { name: 'refs', kind: 'SEMANTIC_SET', value: ['b', 'a'] },
        { name: 'units', kind: 'ORDERED_LIST', value: ['u2', 'u1'] },
      ],
    } as const;
    const reorderedSet = {
      ...base,
      fields: [
        { name: 'refs', kind: 'SEMANTIC_SET', value: ['a', 'b'] },
        { name: 'units', kind: 'ORDERED_LIST', value: ['u2', 'u1'] },
      ],
    } as const;
    expect(serializeCanonicalInput(base)).toBe(serializeCanonicalInput(reorderedSet));
    expect(serializeCanonicalInput(base)).not.toBe(serializeCanonicalInput({
      ...base,
      fields: [
        { name: 'refs', kind: 'SEMANTIC_SET', value: ['a', 'b'] },
        { name: 'units', kind: 'ORDERED_LIST', value: ['u1', 'u2'] },
      ],
    }));
  });

  it('keeps intentional slots distinct in request identity', () => {
    const base = {
      tenant_id: 'tenant-1',
      workspace_id: 'workspace-1',
      run_id: 'run-1',
      decision_cycle_id: 'cycle-1',
      stage_name: 'STRATEGY_GENERATE',
      exact_entity_refs: [],
      exact_revision_refs: [],
      run_config_id: 'config-1',
      canonical_input_hash: 'hash-1',
    } as const;
    expect(deriveRequestIdentity({ ...base, slot: { name: 'strategySlot', value: 'a' } }))
      .not.toBe(deriveRequestIdentity({ ...base, slot: { name: 'strategySlot', value: 'b' } }));
  });

  it('returns stable, fail-closed Strategy Gate reasons', () => {
    const result = evaluateStrategyGate({
      task_revision_id: 'task-1',
      audience,
      strategy,
      knowledge_gaps: [{ knowledge_gap_id: 'gap-1', status: 'BLOCKING' }],
      proposition_states: [{
        proposition_id: 'prop-1',
        epistemic_state_id: 'state-1',
        support_status: 'CONTRADICTED',
        used_as_factual_proof: true,
      }],
      governance: [{
        assessment_id: 'gov-1',
        applicability_stage: 'PRE_GENERATION_FINAL',
        resolved: true,
        applicable: true,
        non_overridable: true,
        blocks_strategy: true,
      }],
      gate_config_revision: 'gate-config-1',
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.reason_codes).toEqual([
      'GATE_BLOCKING_KNOWLEDGE_GAP',
      'GATE_REQUIRED_PROPOSITION_STATE_MISSING',
      'GATE_REQUIRED_PROPOSITION_CONTRADICTED',
      'GATE_HARD_GOVERNANCE_BLOCK',
    ]);
  });

  it('denies authority requests from untrusted context', () => {
    expect(() => validateGenerationContext({
      tenant_id: 'tenant-1',
      workspace_id: 'workspace-1',
      authorized_tool_ids: [],
      items: [{
        context_item_id: 'source-1',
        layer: 'UNTRUSTED_SOURCE_CONTENT',
        tenant_id: 'tenant-1',
        workspace_id: 'workspace-1',
        data_scope: 'TENANT_PRIVATE',
        scope_authorized: true,
        attribution: { entity_type: 'SourceArtifact', entity_id: 'source-1' },
        decision_relevant: true,
        generation_allowed: true,
        contains_secret: false,
        stale: false,
        provides_unrestricted_datastore: false,
        authority_requests: ['TOOL_ESCALATION'],
        requested_tool_ids: [],
      }],
    })).toThrow(/GENERATION_AUTHORITY_ESCALATION/);
  });

  it('requires a new Strategy for material supplemental proof and invalidates downstream', () => {
    const result = admitSupplementalPropositions([], [{
      proposition_id: 'prop-new',
      used_as_factual_proof: true,
      epistemic_state_id: 'state-new',
      support_status: 'SUPPORTED',
      compatible_with_task: true,
      compatible_with_audience: true,
      compatible_with_governance: true,
      compatible_with_strategy: true,
      changes_core_message: true,
      changes_proof_strategy: false,
      changes_behavioral_logic: false,
      changes_risk: false,
      changes_governance_dependency: false,
    }]);
    expect(result.disposition).toBe('NEW_STRATEGY_REQUIRED');
    expect(classifyDependencyInvalidation(['STRATEGY_MEANING'], 'FREEZING')).toEqual({
      material: true,
      requires_successor_cycle: true,
      invalidated_stages: ['STRATEGY', 'STRATEGY_GATE', 'ARCHITECTURE', 'CANDIDATE', 'SPEC06_EVALUATION'],
    });
  });
});
