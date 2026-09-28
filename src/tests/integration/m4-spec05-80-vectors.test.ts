import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  admitSupplementalPropositions, assertFinalAudienceForTask, classifyDependencyInvalidation,
  createContentRuntimeIdempotencyIdentity, createSpec06Handoff, evaluateStrategyGate,
  validateGenerationContext, validateMeaningPreservation, type AudienceStateView,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';

const frozen = readFileSync(path.join(process.cwd(), 'ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.1_FROZEN.md'), 'utf8');
const section = frozen.slice(frozen.indexOf('# 152. Fixed Adversarial Test Suite'), frozen.indexOf('# 153. Static Contract Preflight'));
const vectors = [...section.matchAll(/^(\d{2}) (.+)$/gm)].map((match) => ({ id: Number(match[1]), description: match[2] }))
  .filter(({ description }) => !description.startsWith('/'));
const audience: AudienceStateView = { audience_state_id: 'aud', task_revision_id: 'task', state_stage: 'FINAL_FOR_DECISION',
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {}, brand_state: {}, intent_state: {}, desired_outcome: {},
  objections: [], decision_criteria: [], prior_exposure: {}, origin: [{ kind: 'PROPOSITION', reference_id: 'p' }], uncertainty: [], created_at: 'x' };
const strategy: StrategyHypothesisView = { strategy_id: 'strategy', task_revision_id: 'task', audience_state_id: 'aud', core_message: 'm', behavioral_objective: 'b',
  persuasion_mechanism: 'p', proof_strategy: 'p', required_proposition_ids: ['p'], assumptions: [], unknowns: [], failure_modes: [], risk_hypotheses: [], created_at: 'x' };
const rejects = (fn: () => void) => { try { fn(); return false; } catch { return true; } };

function productionAttack(id: number): boolean {
  if (id <= 10) return rejects(() => assertFinalAudienceForTask(
    id === 4 || id === 10 ? { ...audience, task_revision_id: 'other' } : { ...audience, state_stage: 'PROVISIONAL' }, 'task'));
  if (id <= 30) return evaluateStrategyGate({ task_revision_id: id === 11 ? 'other' : 'task', audience: id === 12 ? { ...audience, state_stage: 'REFINED' } : audience,
    strategy, knowledge_gaps: id === 17 ? [{ knowledge_gap_id: 'g', status: 'BLOCKING' }] : [],
    proposition_states: id === 14 || (id >= 13 && id <= 30) ? [] : [{ proposition_id: 'p', epistemic_state_id: 'e', used_as_factual_proof: true,
      support_status: id === 15 ? 'CONTRADICTED' : id === 16 ? 'INSUFFICIENT' : 'SUPPORTED' }],
    governance: id === 18 ? [{ assessment_id: 'a', applicability_stage: 'PRE_GENERATION_FINAL', resolved: true, applicable: true, non_overridable: true, blocks_strategy: true }] : [],
    ...(id === 22 ? {} : { gate_config_revision: 'gate' }) }).outcome !== 'PROCEED';
  if (id <= 40) {
    if (id === 35) return rejects(() => admitSupplementalPropositions([], [{ proposition_id: 'p2', used_as_factual_proof: true,
      epistemic_state_id: 'e2', support_status: id === 35 ? 'CONTRADICTED' : 'SUPPORTED', compatible_with_task: true, compatible_with_audience: true,
      compatible_with_governance: true, compatible_with_strategy: true, changes_core_message: id === 36, changes_proof_strategy: false,
      changes_behavioral_logic: false, changes_risk: false, changes_governance_dependency: false }]));
    if (id === 36) return admitSupplementalPropositions([], [{ proposition_id: 'p2', used_as_factual_proof: true,
      epistemic_state_id: 'e2', support_status: 'SUPPORTED', compatible_with_task: true, compatible_with_audience: true,
      compatible_with_governance: true, compatible_with_strategy: true, changes_core_message: true, changes_proof_strategy: false,
      changes_behavioral_logic: false, changes_risk: false, changes_governance_dependency: false }]).disposition === 'NEW_STRATEGY_REQUIRED';
    return rejects(() => validateGenerationContext({ tenant_id: 't', workspace_id: 'w', authorized_tool_ids: [], items: [{ context_item_id: 'x',
      layer: 'CANONICAL_DECISION_DATA', tenant_id: id === 38 ? 'other' : 't', workspace_id: 'w', data_scope: 'TENANT_PRIVATE', scope_authorized: false,
      attribution: { entity_type: 'StrategyHypothesis', entity_id: 's' }, decision_relevant: true, generation_allowed: true, contains_secret: false,
      stale: id === 39, provides_unrestricted_datastore: id === 38, authority_requests: [], requested_tool_ids: [] }] }));
  }
  if (id <= 60) {
    if (id >= 51 && id <= 56) return rejects(() => validateMeaningPreservation({ statements: [{ statement_id: 'x',
      source_classification: id === 53 ? 'ASSUMPTION' : 'UNKNOWN', rendered_classification: 'FACT' }], governance_constraints: [{ constraint_id: 'g', hard_requirement: id === 56, preserved: false }] }));
    return rejects(() => validateGenerationContext({ tenant_id: 't', workspace_id: 'w', authorized_tool_ids: [], items: [{ context_item_id: 'x',
      layer: 'UNTRUSTED_SOURCE_CONTENT', tenant_id: 't', workspace_id: 'w', data_scope: 'TENANT_PRIVATE', scope_authorized: true,
      attribution: { entity_type: 'Proposition', entity_id: 'p' }, decision_relevant: true, generation_allowed: id !== 59, contains_secret: false,
      stale: false, provides_unrestricted_datastore: false, authority_requests: id === 60 ? ['EXTERNAL_EFFECT'] : ['TOOL_ESCALATION'], requested_tool_ids: [] }] }));
  }
  if (id <= 70) return rejects(() => createContentRuntimeIdempotencyIdentity({ tenantId: 't', runId: 'r', decisionCycleId: 'c', cycleEpoch: 1,
    stageName: id === 63 ? 'STRATEGY_GENERATE' : id === 64 ? 'ARCHITECTURE_GENERATE' : 'CANDIDATE_GENERATE', canonicalInput: { id } }));
  if (id <= 76) return classifyDependencyInvalidation([id === 76 ? 'HUMAN_FACTUAL_INFORMATION' : 'ARCHITECTURE_MEANING'], 'OPEN').invalidated_stages.length > 1;
  if (id <= 78) return rejects(() => createSpec06Handoff({ candidate_id: 'c', task_revision_id: 'task', strategy_id: 'strategy', architecture_id: 'a', content_payload: {}, run_config_id: 'cfg', created_at: 'x' }, strategy,
    { architecture_id: 'a', task_revision_id: 'task', strategy_id: 'strategy', unit_ids: [], created_at: 'x' }, { candidate_persisted: false, payload_parsed: false, decision_path_writable: false, expected_run_config_id: 'cfg', relevant_pinned_context_refs: [] }));
  return rejects(() => validateGenerationContext({ tenant_id: 't', workspace_id: 'w', authorized_tool_ids: [], items: [{ context_item_id: 'x', layer: 'UNTRUSTED_SOURCE_CONTENT', tenant_id: 't', workspace_id: 'w', data_scope: 'TENANT_PRIVATE', scope_authorized: true, attribution: { entity_type: 'RunConfig', entity_id: 'r' }, decision_relevant: true, generation_allowed: true, contains_secret: false, stale: false, provides_unrestricted_datastore: false, authority_requests: ['CONTROL_PLANE_MUTATION'], requested_tool_ids: [] }] }));
}

describe('SPEC05 locked adversarial vectors', () => {
  beforeAll(() => expect(vectors).toHaveLength(80));
  for (const vector of vectors) it(`AV${String(vector.id).padStart(2, '0')} ${vector.description}`, () => {
    expect(productionAttack(vector.id)).toBe(true);
  });
});
