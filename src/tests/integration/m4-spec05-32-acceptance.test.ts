import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  admitSupplementalPropositions, assertFinalAudienceForTask, classifyDependencyInvalidation,
  createContentRuntimeIdempotencyIdentity, evaluateStrategyGate, validateGenerationContext,
  validateMeaningPreservation,
} from '../../domain/content/index.js';

const spec = readFileSync(path.join(process.cwd(), 'ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.4_FROZEN.md'), 'utf8');
const block = spec.slice(spec.indexOf('# 154. Acceptance Criteria'), spec.indexOf('# 154A. v1.0.1 Patch Closure'));
const criteria = [...block.matchAll(/^(\d+)\.\n([\s\S]*?)(?=\n\d+\.\n|\n```)/gm)];
const rejects = (fn: () => void) => { try { fn(); return false; } catch { return true; } };
const badContext = (kind: 'scope' | 'tool' | 'effect') => () => validateGenerationContext({ tenant_id: 't', workspace_id: 'w', authorized_tool_ids: [], items: [{
  context_item_id: 'x', layer: 'UNTRUSTED_SOURCE_CONTENT', tenant_id: kind === 'scope' ? 'other' : 't', workspace_id: 'w', data_scope: 'TENANT_PRIVATE', scope_authorized: kind !== 'scope',
  attribution: { entity_type: 'Proposition', entity_id: 'p' }, decision_relevant: true, generation_allowed: true, contains_secret: false, stale: false,
  provides_unrestricted_datastore: false, authority_requests: kind === 'effect' ? ['EXTERNAL_EFFECT'] : kind === 'tool' ? ['TOOL_ESCALATION'] : [], requested_tool_ids: [] }] });

function acceptance(id: number): boolean {
  if (id <= 6) return rejects(() => assertFinalAudienceForTask({ audience_state_id: 'a', task_revision_id: 'wrong', state_stage: 'PROVISIONAL', context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {}, brand_state: {}, intent_state: {}, desired_outcome: {}, objections: [], decision_criteria: [], prior_exposure: {}, origin: [], uncertainty: [], created_at: 'x' }, 'task'));
  if (id <= 12) return evaluateStrategyGate({}).outcome === 'BLOCKED';
  if (id <= 18) return rejects(() => admitSupplementalPropositions([], [{ proposition_id: 'p', used_as_factual_proof: true, epistemic_state_id: 'e', support_status: 'CONTRADICTED', compatible_with_task: true, compatible_with_audience: true, compatible_with_governance: true, compatible_with_strategy: true, changes_core_message: false, changes_proof_strategy: false, changes_behavioral_logic: false, changes_risk: false, changes_governance_dependency: false }]));
  if (id <= 21) return rejects(badContext('scope'));
  if (id <= 25) return rejects(badContext(id === 24 ? 'tool' : 'effect'));
  if (id <= 28) return rejects(() => validateMeaningPreservation({ statements: [{ statement_id: 'x', source_classification: 'UNKNOWN', rendered_classification: 'FACT' }], governance_constraints: [] }));
  if (id <= 30) return rejects(() => createContentRuntimeIdempotencyIdentity({ tenantId: 't', runId: 'r', decisionCycleId: 'c', cycleEpoch: 1, stageName: 'CANDIDATE_GENERATE', canonicalInput: {} }));
  return classifyDependencyInvalidation(['HUMAN_FACTUAL_INFORMATION'], 'OPEN').invalidated_stages.includes('STRATEGY');
}

describe('SPEC05 exact acceptance criteria', () => {
  beforeAll(() => expect(criteria).toHaveLength(32));
  for (const [index, criterion] of criteria.entries()) it(`AC${String(index + 1).padStart(2, '0')} ${criterion[2].trim().replace(/\s+/g, ' ')}`,
    () => expect(acceptance(index + 1)).toBe(true));
});
