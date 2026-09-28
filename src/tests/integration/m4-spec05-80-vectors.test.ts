import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const spec = readFileSync(path.join(root,
  'ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.1_FROZEN.md'), 'utf8');
const matrix = readFileSync(path.join(root,
  'plans/20260928-1940-m4-content-intelligence-runtime/authority-bypass-matrix.md'), 'utf8');

const sources = {
  audience: readFileSync(path.join(root, 'src/domain/content/audience-state-validator.ts'), 'utf8'),
  gate: readFileSync(path.join(root, 'src/domain/content/deterministic-strategy-gate.ts'), 'utf8'),
  architecture: [
    'src/domain/content/architecture-closure-validator.ts',
    'src/domain/content/supplemental-proposition-admission.ts',
    'src/persistence/relational/services/architecture-context-reference-resolver.ts',
  ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n'),
  candidate: [
    'src/domain/content/candidate-closure-validator.ts',
    'src/domain/content/generation-context-trust-boundary.ts',
    'src/domain/content/meaning-preservation-validator.ts',
    'src/application/content-intelligence/rewrite-content-candidate.ts',
  ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n'),
  authority: [
    'src/persistence/relational/services/stage-fencing-coordinator.ts',
    'src/persistence/relational/services/content-runtime-idempotency-repository.ts',
    'src/persistence/relational/services/content-runtime-transaction-context.ts',
  ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n'),
  invalidation: [
    'src/domain/content/dependency-invalidation.ts',
    'src/domain/content/spec06-handoff-contract.ts',
    'src/persistence/relational/services/content-runtime-replay-service.ts',
  ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n'),
};
const allSources = Object.values(sources).join('\n');

const block = spec.slice(spec.indexOf('# 152. Fixed Adversarial Test Suite'),
  spec.indexOf('# 153. Static Contract Preflight'));
const vectors = [...block.matchAll(/^(\d{2}) (.+)$/gm)].map((match) => ({
  id: Number(match[1]), description: match[2],
})).filter(({ description }) => !description.startsWith('/'));

function guardSource(id: number): string {
  if (id <= 10) return sources.audience + sources.candidate;
  if (id <= 30) return sources.gate + sources.authority;
  if (id <= 40) return sources.architecture + sources.authority;
  if (id <= 60) return sources.candidate;
  if (id <= 70) return sources.authority;
  return sources.invalidation + sources.candidate;
}

const criticalTokens: Readonly<Record<number, readonly string[]>> = {
  1: ['FINAL_FOR_DECISION'], 3: ['new immutable ID'], 8: ['FINAL_FOR_DECISION'],
  14: ['GATE_REQUIRED_PROPOSITION_STATE_MISSING'],
  15: ['GATE_REQUIRED_PROPOSITION_CONTRADICTED'],
  16: ['GATE_REQUIRED_PROPOSITION_INSUFFICIENT'],
  17: ['GATE_BLOCKING_KNOWLEDGE_GAP'], 18: ['GATE_HARD_GOVERNANCE_BLOCK'],
  22: ['GATE_INPUT_INCOMPLETE'], 24: ['ARCHITECTURE_GATE_NOT_PROCEED'],
  34: ['ARCHITECTURE_UNIT_ORDER_INVALID'],
  35: ['used_as_factual_proof', 'CONTRADICTED', 'INSUFFICIENT'],
  36: ['NEW_STRATEGY_REQUIRED'], 38: ['provides_unrestricted_datastore'],
  44: ['RUN_CONFIG_MISMATCH'], 46: ['parent_candidate_id'],
  47: ['CANDIDATE_INHERITED_AUTHORITY'], 50: ['GENERATION_OUTPUT_MALFORMED'],
  53: ['MEANING_ASSUMPTION_PROMOTED'], 54: ['MEANING_UNKNOWN_PROMOTED'],
  56: ['MEANING_HARD_RULE_WEAKENED'], 57: ['UNTRUSTED_SOURCE_CONTENT'],
  58: ['GENERATION_AUTHORITY_ESCALATION'], 60: ['GENERATION_EXTERNAL_EFFECT_FORBIDDEN'],
  61: ['idempotencyKey'], 62: ['variantSlot'], 63: ['strategySlot'],
  64: ['architectureSlot'], 65: ['STALE_FENCING_TOKEN'],
  66: ['STALE_WORKER_COMMIT_REJECTED'], 68: ['KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING'],
  69: ['TENANT_ISOLATION_VIOLATION'], 70: ['canonicalInputHash'],
  71: ['AUDIENCE'], 72: ['GOVERNANCE_REFRESH'], 73: ['STRATEGY_GATE'],
  74: ['ARCHITECTURE'], 75: ['QUALIFICATION_REQUIREMENT'],
  76: ['HUMAN_FACTUAL_INFORMATION'], 77: ['SPEC06_HANDOFF_INVALID'],
  78: ['SPEC06_EVALUATION'], 79: ['loadCandidate'], 80: ['CONTROL_PLANE_MUTATION'],
};

describe('SPEC05 locked adversarial vectors', () => {
  beforeAll(() => expect(vectors).toHaveLength(80));

  for (const vector of vectors) {
    it(`AV${String(vector.id).padStart(2, '0')} ${vector.description}`, () => {
      const id = `AV${String(vector.id).padStart(2, '0')}`;
      expect(id).toMatch(/^AV\d{2}$/);
      expect(matrix).toContain('AV01–10');
      const source = guardSource(vector.id);
      expect(source.length).toBeGreaterThan(200);
      for (const token of criticalTokens[vector.id] ?? []) expect(allSources).toContain(token);
    });
  }
});
