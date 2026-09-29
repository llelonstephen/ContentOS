import { describe, expect, it, vi } from 'vitest';
import {
  admitSupplementalPropositions,
  createSpec06Handoff,
  validateGenerationContext,
  type ContentArchitectureView,
  type ContentCandidateView,
  type ContentUnitView,
  type AudienceStateView,
  type GenerationContextAdmission,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';
import { ContentIntelligenceStageExecutor } from '../../workflow/stages/content-intelligence/stage-executor.js';
import { ContentRuntimeReplayService } from '../../persistence/relational/services/content-runtime-replay-service.js';
import { createContentIntelligencePersistence } from '../../bootstrap/composition-root.js';
import { AudienceStatePersistenceService } from '../../persistence/relational/services/audience-state-persistence-service.js';
import { StrategyHypothesisPersistenceService } from '../../persistence/relational/services/strategy-hypothesis-persistence-service.js';
import { ContentStrategyGatePersistenceService } from '../../persistence/relational/services/content-strategy-gate-persistence-service.js';
import { ContentArchitecturePersistenceService } from '../../persistence/relational/services/content-architecture-persistence-service.js';
import { ContentCandidatePersistenceService } from '../../persistence/relational/services/content-candidate-persistence-service.js';
import { GenerateContentArchitecture } from '../../application/content-intelligence/generate-content-architecture.js';

const strategy: StrategyHypothesisView = {
  strategy_id: 'strategy-1', task_revision_id: 'task-1', audience_state_id: 'aud-1',
  core_message: 'Verified message', behavioral_objective: 'Act',
  persuasion_mechanism: 'Proof', proof_strategy: 'Use proposition',
  required_proposition_ids: ['prop-1'], assumptions: [], unknowns: [],
  failure_modes: [], risk_hypotheses: [], created_at: '2026-09-29T00:00:00Z',
};
const audience: AudienceStateView = {
  audience_state_id: 'aud-1', task_revision_id: 'task-1', state_stage: 'FINAL_FOR_DECISION',
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {},
  brand_state: {}, intent_state: {}, desired_outcome: {}, objections: [], decision_criteria: [],
  prior_exposure: {}, origin: [], uncertainty: [], created_at: '2026-09-29T00:00:00Z',
};
const unit: ContentUnitView = {
  unit_id: 'unit-1', position: 1, purpose: 'Open', audience_state_before: {},
  audience_question: 'Why?', information_to_deliver: {}, proposition_ids: ['prop-1'],
  copy_goal: 'Explain', visual_goal: 'Show', audio_goal: 'Narrate', payoff: 'Understand',
  transition: 'Next', audience_state_after: {}, created_at: '2026-09-29T00:00:00Z',
};
const architecture: ContentArchitectureView = {
  architecture_id: 'arch-1', task_revision_id: 'task-1', strategy_id: 'strategy-1',
  unit_ids: ['unit-1'], created_at: '2026-09-29T00:00:00Z',
};
const candidate: ContentCandidateView = {
  candidate_id: 'cand-1', task_revision_id: 'task-1', strategy_id: 'strategy-1',
  architecture_id: 'arch-1', content_payload: { copy: 'Verified' },
  run_config_id: 'config-1', created_at: '2026-09-29T00:00:00Z',
};

function context(overrides: Partial<GenerationContextAdmission['items'][number]> = {}): GenerationContextAdmission {
  return {
    tenant_id: 'tenant-1', workspace_id: 'workspace-1', authorized_tool_ids: ['tool-1'],
    items: [{
      context_item_id: 'ctx-1', layer: 'CANONICAL_DECISION_DATA', tenant_id: 'tenant-1',
      workspace_id: 'workspace-1', data_scope: 'TENANT_PRIVATE', scope_authorized: true,
      attribution: { entity_type: 'StrategyHypothesis', entity_id: 'strategy-1' },
      decision_relevant: true, generation_allowed: true, contains_secret: false,
      stale: false, provides_unrestricted_datastore: false, authority_requests: [],
      requested_tool_ids: ['tool-1'], ...overrides,
    }],
  };
}

describe('M4 architecture and candidate boundaries', () => {
  it('admits supplemental factual proof only with exact supported decision-time state', () => {
    expect(admitSupplementalPropositions(['prop-1'], [{
      proposition_id: 'prop-2', used_as_factual_proof: true,
      epistemic_state_id: 'epi-2', support_status: 'SUPPORTED',
      compatible_with_task: true, compatible_with_audience: true,
      compatible_with_governance: true, compatible_with_strategy: true,
      changes_core_message: false, changes_proof_strategy: false,
      changes_behavioral_logic: false, changes_risk: false,
      changes_governance_dependency: false,
    }])).toEqual({ disposition: 'ADMITTED', admitted_proposition_ids: ['prop-2'] });
  });

  it.each(['CONTRADICTED', 'INSUFFICIENT'] as const)(
    'rejects %s supplemental factual proof', (support_status) => {
      expect(() => admitSupplementalPropositions([], [{
        proposition_id: 'prop-2', used_as_factual_proof: true,
        epistemic_state_id: 'epi-2', support_status,
        compatible_with_task: true, compatible_with_audience: true,
        compatible_with_governance: true, compatible_with_strategy: true,
        changes_core_message: false, changes_proof_strategy: false,
        changes_behavioral_logic: false, changes_risk: false,
        changes_governance_dependency: false,
      }])).toThrow(/lacks admissible decision-time proof/);
    },
  );

  it('requires a new strategy for material architecture-level meaning changes', () => {
    expect(admitSupplementalPropositions([], [{
      proposition_id: 'prop-2', used_as_factual_proof: false,
      compatible_with_task: true, compatible_with_audience: true,
      compatible_with_governance: true, compatible_with_strategy: true,
      changes_core_message: true, changes_proof_strategy: false,
      changes_behavioral_logic: false, changes_risk: false,
      changes_governance_dependency: false,
    }]).disposition).toBe('NEW_STRATEGY_REQUIRED');
  });

  it('rejects unrestricted datastore and untrusted instruction authority', () => {
    expect(() => validateGenerationContext(context({ provides_unrestricted_datastore: true })))
      .toThrow(/not admitted for minimized generation use/);
    expect(() => validateGenerationContext(context({
      layer: 'UNTRUSTED_SOURCE_CONTENT', authority_requests: ['TOOL_ESCALATION'],
    }))).toThrow(/cannot supply instructions or tool authority/);
  });

  it('creates only a validated SPEC06 handoff DTO', () => {
    const dto = createSpec06Handoff(candidate, strategy, architecture, {
      candidate_persisted: true, payload_parsed: true, decision_path_writable: true,
      expected_run_config_id: 'config-1',
      relevant_pinned_context_refs: [{ entity_type: 'ContentUnit', entity_id: unit.unit_id }],
    });
    expect(dto).toMatchObject({ candidate_id: 'cand-1', run_config_id: 'config-1' });
    expect(dto).not.toHaveProperty('release_status');
    expect(dto).not.toHaveProperty('validation_result');
  });

  it('stage executor preserves provider-before-short-commit ordering and slots', async () => {
    const order: string[] = [];
    const result = await new ContentIntelligenceStageExecutor().execute({
      stage: 'CANDIDATE_GENERATE', output_kind: 'CONTENT_CANDIDATE',
      slot: { name: 'variantSlot', value: 'v1' },
      run_provider_phase: async () => { order.push('provider'); return candidate; },
      commit_phase: async (value) => { order.push('commit'); return value.candidate_id; },
    });
    expect(result).toBe('cand-1');
    expect(order).toEqual(['provider', 'commit']);
  });

  it('historical replay reads immutable payload without provider access', async () => {
    const reader = { loadCandidate: vi.fn().mockResolvedValue(candidate) };
    const replayed = await new ContentRuntimeReplayService(reader)
      .replay('cand-1', 'tenant-1', 'workspace-1');
    expect(replayed).toEqual(candidate);
    expect(reader.loadCandidate).toHaveBeenCalledOnce();
  });

  it('composition root exposes the complete persistence-only M4 runtime bundle', () => {
    const runtime = createContentIntelligencePersistence({} as any);
    expect(runtime.audience).toBeInstanceOf(AudienceStatePersistenceService);
    expect(runtime.strategy).toBeInstanceOf(StrategyHypothesisPersistenceService);
    expect(runtime.gate).toBeInstanceOf(ContentStrategyGatePersistenceService);
    expect(runtime.architecture).toBeInstanceOf(ContentArchitecturePersistenceService);
    expect(runtime.candidate).toBeInstanceOf(ContentCandidatePersistenceService);
  });

  it('does not let the Architecture provider self-assert supplemental factual proof', async () => {
    const commitPort = { commitContentArchitecture: vi.fn() };
    const generator = new GenerateContentArchitecture(
      { resolveAuthorizedInputs: vi.fn().mockResolvedValue({
        audience,
        strategy,
        gate_result: {
          strategy_id: 'strategy-1', audience_state_id: 'aud-1', outcome: 'PROCEED',
          reason_codes: [], gate_config_revision: 'gate-v1',
        },
        channel: { format: 'article', supported_formats: ['article'], permits_nonlinear_units: false },
        context: { admission: context(), values: [{}] },
      }) },
      { generateArchitectureProposal: vi.fn().mockResolvedValue({
        units: [{ ...unit, proposition_ids: ['prop-1', 'prop-2'] }],
        supplemental_propositions: [{ proposition_id: 'prop-2', support_status: 'SUPPORTED' }],
      }) },
      new ContentArchitecturePersistenceService(commitPort),
      { nextArchitectureId: () => 'arch-new', nextUnitId: () => 'unit-new',
        now: () => new Date('2026-09-29T00:00:00Z') },
      { resolve: vi.fn().mockResolvedValue([{
        proposition_id: 'prop-2', used_as_factual_proof: true,
        epistemic_state_id: 'epi-2', support_status: 'CONTRADICTED',
        compatible_with_task: true, compatible_with_audience: true,
        compatible_with_governance: true, compatible_with_strategy: true,
        changes_core_message: false, changes_proof_strategy: false,
        changes_behavioral_logic: false, changes_risk: false,
        changes_governance_dependency: false,
      }]) } as any,
      { resolve: vi.fn().mockResolvedValue({ prompt_revision_id: 'prompt-1',
        model_revision_id: 'model-1', schema_revision_id: 'schema-1', tool_revision_ids: ['tool-1'] }) } as any,
    );
    await expect(generator.execute({
      authority: {
        tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
        decision_cycle_id: 'cycle-1', stage_execution_id: 'stage-1', fencing_token: 1,
        lease_owner: 'worker-1', cycle_epoch: 1, stage_name: 'ARCHITECTURE_GENERATE',
        idempotency_key: 'request-1', run_config_id: 'config-1', canonical_input_hash: 'hash-1',
        slot: { kind: 'architectureSlot', value: 'primary' },
      },
      request_identity: 'request-1', architecture_slot: 'primary',
      task_revision_id: 'task-1', strategy_id: 'strategy-1',
    })).rejects.toThrow(/lacks admissible decision-time proof/);
    expect(commitPort.commitContentArchitecture).not.toHaveBeenCalled();
  });
});
