import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');
const spec = read('ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.4_FROZEN.md');
const block = spec.slice(spec.indexOf('# 153. Static Contract Preflight'),
  spec.indexOf('# 154. Acceptance Criteria'));
const checks = [...block.matchAll(/^(\d{2}) (.+)$/gm)].map((match) => ({
  id: Number(match[1]), description: match[2],
})).filter(({ description }) => !description.startsWith('/'));
const allProduction = [
  ...['architecture-closure-validator', 'audience-state-validator', 'candidate-closure-validator',
    'deterministic-strategy-gate', 'generation-context-trust-boundary',
    'runtime-stage-contracts', 'spec06-handoff-contract', 'strategy-grounding-validator',
    'supplemental-proposition-admission'].map((name) => `src/domain/content/${name}.ts`),
  'src/domain/content/types.ts',
  'src/persistence/relational/services/stage-fencing-coordinator.ts',
  'src/persistence/relational/services/content-runtime-transaction-context.ts',
  'src/persistence/relational/migrations/0006_m4_content_intelligence_invariants.sql',
  'src/application/content-intelligence/generate-content-candidate.ts',
  'src/providers/models/content-intelligence-provider.ts',
].map(read).join('\n');

const required: readonly (readonly string[])[] = [
  ['Strategy Gate', 'StrategyGateResult'], ['deterministic', 'StrategyGateResult'],
  ['PROVISIONAL', 'REFINED', 'FINAL_FOR_DECISION'], ['new immutable ID'],
  ['FINAL_FOR_DECISION'], ['AUDIENCE_TASK_MISMATCH'], ['StrategyHypothesisView'],
  ['required_proposition_ids', 'assumptions', 'unknowns'],
  ['GATE_BLOCKING_KNOWLEDGE_GAP'], ['GATE_REQUIRED_PROPOSITION_STATE_MISSING'],
  ['GATE_REQUIRED_PROPOSITION_CONTRADICTED', 'GATE_REQUIRED_PROPOSITION_INSUFFICIENT'],
  ['GATE_HARD_GOVERNANCE_BLOCK'], ['GATE_INPUT_INCOMPLETE'],
  ['ContentArchitectureView'], ['ARCHITECTURE_TASK_MISMATCH', 'ARCHITECTURE_STRATEGY_MISMATCH'],
  ['proposition_ids'], ['ARCHITECTURE_UNIT_ORDER_INVALID'], ['NEW_STRATEGY_REQUIRED'],
  ['ContentCandidateView'], ['parent_candidate_id'],
  ['CANDIDATE_TASK_MISMATCH', 'CANDIDATE_STRATEGY_MISMATCH', 'CANDIDATE_ARCHITECTURE_MISMATCH'],
  ['RUN_CONFIG_MISMATCH'], ['canonicalInputHash'], ['model_revision_id', 'tool_revision_ids'],
  ['UNTRUSTED_SOURCE_CONTENT'], ['GENERATION_EXTERNAL_EFFECT_FORBIDDEN'],
  ['KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING'], ['STALE_FENCING_TOKEN'],
  ['TENANT_ISOLATION_VIOLATION'], ['SPEC06_HANDOFF_INVALID'],
  ['Spec06HandoffDto'], ['Spec06HandoffDto'],
];

describe('SPEC05 exact static preflight', () => {
  beforeAll(() => {
    expect(checks).toHaveLength(32);
    expect(required).toHaveLength(32);
    expect(allProduction).not.toMatch(/CREATE\s+TABLE\s+strategy_gate/i);
  });
  for (const check of checks) {
    it(`PF${String(check.id).padStart(2, '0')} ${check.description}`, () => {
      for (const token of required[check.id - 1]!) expect(allProduction).toContain(token);
    });
  }
});
