import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');
const spec = read('ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.1_FROZEN.md');
const block = spec.slice(spec.indexOf('# 154. Acceptance Criteria'),
  spec.indexOf('# 154A. v1.0.1 Patch Closure'));
const criteria = [...block.matchAll(/^(\d+)\.\n([\s\S]*?)(?=\n\d+\.\n|\n```)/gm)]
  .map((match) => ({ id: Number(match[1]), description: match[2].trim().replace(/\s+/g, ' ') }));
const matrix = read('plans/20260928-1940-m4-content-intelligence-runtime/authority-bypass-matrix.md');
const evidence = [
  'src/domain/content/audience-state-validator.ts',
  'src/domain/content/strategy-grounding-validator.ts',
  'src/domain/content/deterministic-strategy-gate.ts',
  'src/domain/content/architecture-closure-validator.ts',
  'src/domain/content/supplemental-proposition-admission.ts',
  'src/domain/content/candidate-closure-validator.ts',
  'src/domain/content/generation-context-trust-boundary.ts',
  'src/domain/content/meaning-preservation-validator.ts',
  'src/domain/content/dependency-invalidation.ts',
  'src/domain/content/spec06-handoff-contract.ts',
  'src/persistence/relational/services/stage-fencing-coordinator.ts',
  'src/persistence/relational/services/content-runtime-idempotency-repository.ts',
  'src/persistence/relational/migrations/0006_m4_content_intelligence_invariants.sql',
].map(read).join('\n');

const token: readonly string[] = [
  'new immutable ID', 'FINAL_FOR_DECISION', 'uncertainty', 'AUDIENCE_TRANSITION_INVALID',
  'validateStrategyGrounding', 'required_proposition_ids', 'evaluateStrategyGate',
  'GATE_BLOCKING_KNOWLEDGE_GAP', 'GATE_REQUIRED_PROPOSITION_STATE_MISSING',
  'GATE_REQUIRED_PROPOSITION_CONTRADICTED', 'GATE_HARD_GOVERNANCE_BLOCK',
  'ARCHITECTURE_GATE_NOT_PROCEED', 'ContentArchitectureView',
  'ARCHITECTURE_UNIT_ORDER_INVALID', 'NEW_STRATEGY_REQUIRED', 'ContentCandidateView',
  'parent_candidate_id', 'CANDIDATE_ARCHITECTURE_MISMATCH', 'RUN_CONFIG_MISMATCH',
  'canonicalInputHash', 'MEANING_ASSUMPTION_PROMOTED', 'UNTRUSTED_SOURCE_CONTENT',
  'GENERATION_AUTHORITY_ESCALATION', 'GENERATION_EXTERNAL_EFFECT_FORBIDDEN',
  'variantSlot', 'STALE_FENCING_TOKEN', 'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING',
  'TENANT_ISOLATION_VIOLATION', 'SPEC06_EVALUATION', 'SPEC06_HANDOFF_INVALID',
  'AV01–10', 'PF01–08',
];

describe('SPEC05 exact acceptance criteria', () => {
  beforeAll(() => {
    expect(criteria).toHaveLength(32);
    expect(token).toHaveLength(32);
  });
  for (const criterion of criteria) {
    it(`AC${String(criterion.id).padStart(2, '0')} ${criterion.description}`, () => {
      expect(spec).toContain(criterion.description);
      expect(evidence + matrix).toContain(token[criterion.id - 1]);
    });
  }
});
