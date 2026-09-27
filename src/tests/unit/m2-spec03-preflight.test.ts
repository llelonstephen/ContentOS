/**
 * ContentOS — SPEC03 §146 Static Contract Preflight Suite
 *
 * Implements the locked 28-check static preflight matrix defined in SPEC03 §146:
 * 01 no new canonical domain entity invented
 * 02 all canonical enums preserved
 * 03 Evidence origin types limited to V1-supported origins
 * 04 Proposition remains immutable semantic identity
 * 05 EvidencePropositionLink remains unique per pair
 * 06 compatibility and relationship remain separate
 * 07 EvidenceAssessment remains immutable
 * 08 reassessment never mutates old record
 * 09 EpistemicState uses exact assessment IDs
 * 10 support_status vocabulary preserved
 * 11 causal_status closed and causal guard enforced
 * 12 Epistemic chain single-root
 * 13 Epistemic chain non-branching
 * 14 Epistemic chain same-Proposition
 * 15 Epistemic known_from monotonic
 * 16 Epistemic chain acyclic
 * 17 valid time distinct from known time
 * 18 unknown-preservation gate intact
 * 19 research failure not falsity
 * 20 performance evidence firewall intact
 * 21 attribution/causation separation intact
 * 22 RunKnowledgeDelta lifecycle consistent with SPEC01
 * 23 FREEZING boundary consistent with SPEC01
 * 24 deletion/replay consistent with SPEC02
 * 25 tenant/data-scope isolation intact
 * 26 no CURRENT/LATEST/ACTIVE historical substitution
 * 27 Runtime cannot mutate Control Plane
 * 28 no duplicate source of epistemic truth
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVIDENCE_DOMAINS,
  DATA_SCOPES,
  PROPOSITION_TYPES,
  EVIDENCE_COMPATIBILITY_STATUSES,
  EVIDENCE_RELATIONSHIPS,
  EPISTEMIC_SUPPORT_STATUSES,
  CAUSAL_STATUSES,
  KNOWLEDGE_GAP_STATUSES,
  RESEARCH_OUTCOMES,
  EVIDENCE_ORIGIN_TYPES,
} from '../../domain/knowledge/types.js';
import { validateCausalSupportGuard } from '../../domain/knowledge/epistemic-derivation.js';
import {
  enforceUnknownPreservationGate,
  validateResearchGapResolution,
} from '../../domain/knowledge/unknown-preservation-gate.js';
import {
  validatePerformanceEvidenceFirewall,
  validateAttributionFirewall,
} from '../../domain/knowledge/performance-evidence-firewall.js';
import { RegistryValidationError } from '../../domain/services/registry-validator.js';

describe('SPEC03 §146 Static Contract Preflight Suite (28 Checks)', () => {
  it('Check 01: no new canonical domain entity invented', () => {
    // Read schema files and inspect exported tables
    const schemaDir = path.resolve(import.meta.dirname, '../../persistence/relational/schema');
    const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    const canonicalTables = new Set<string>();
    for (const file of files) {
      const content = fs.readFileSync(path.join(schemaDir, file), 'utf-8');
      const tableMatches = content.matchAll(/pgTable\(\s*'([^']+)'/g);
      for (const m of tableMatches) {
        canonicalTables.add(m[1]);
      }
    }

    // Verify against M0 + M1 migrations: exactly 144 tables, no new tables created in M2
    const m0MigrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0000_chemical_iron_man.sql',
    );
    const m1MigrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0001_fantastic_kid_colt.sql',
    );
    const m0Sql = fs.readFileSync(m0MigrationPath, 'utf-8');
    const m1Sql = fs.readFileSync(m1MigrationPath, 'utf-8');
    const existingTables = new Set<string>();
    for (const m of (m0Sql + m1Sql).matchAll(/CREATE TABLE "(?:public"\.")?([^"]+)"/g)) {
      existingTables.add(m[1]);
    }

    // Ensure all tables in schema were already present in frozen M0/M1 migrations
    expect(canonicalTables.size).toBe(144);
    for (const table of canonicalTables) {
      expect(existingTables.has(table)).toBe(true);
    }

    // Verify M2 migration added only triggers, zero CREATE TABLE statements
    const m2MigrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0002_m2_immutable_triggers.sql',
    );
    const m2Sql = fs.readFileSync(m2MigrationPath, 'utf-8');
    expect(m2Sql).not.toContain('CREATE TABLE');
  });

  it('Check 02: all canonical enums preserved', () => {
    expect(EVIDENCE_DOMAINS.length).toBe(12);
    expect(DATA_SCOPES.length).toBe(4);
    expect(PROPOSITION_TYPES.length).toBe(8);
    expect(EVIDENCE_COMPATIBILITY_STATUSES.length).toBe(4);
    expect(EVIDENCE_RELATIONSHIPS.length).toBe(5);
    expect(EPISTEMIC_SUPPORT_STATUSES.length).toBe(6);
    expect(CAUSAL_STATUSES.length).toBe(7);
    expect(KNOWLEDGE_GAP_STATUSES.length).toBe(6);
    expect(RESEARCH_OUTCOMES.length).toBe(4);
    expect(EVIDENCE_ORIGIN_TYPES.length).toBe(2);
  });

  it('Check 03: Evidence origin types limited to V1-supported origins', () => {
    expect(EVIDENCE_ORIGIN_TYPES).toEqual(['SOURCE_ARTIFACT', 'PERFORMANCE_OBSERVATION']);
  });

  it('Check 04: Proposition remains immutable semantic identity', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain('supersedes_proposition_id');
    expect(schemaContent).not.toContain("updated_at: timestamp('updated_at')");
  });

  it('Check 05: EvidencePropositionLink remains unique per pair', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain(
      "uniqueIndex('uq_evidence_proposition_link').on(table.evidence_id, table.proposition_id)",
    );
  });

  it('Check 06: compatibility and relationship remain separate', () => {
    expect(EVIDENCE_COMPATIBILITY_STATUSES as readonly string[]).not.toEqual(
      EVIDENCE_RELATIONSHIPS as readonly string[],
    );
    expect(EVIDENCE_COMPATIBILITY_STATUSES).toContain('COMPATIBLE');
    expect(EVIDENCE_COMPATIBILITY_STATUSES).toContain('INCOMPATIBLE');
    expect(EVIDENCE_RELATIONSHIPS).toContain('SUPPORTS');
    expect(EVIDENCE_RELATIONSHIPS).toContain('CONTRADICTS');
  });

  it('Check 07: EvidenceAssessment remains immutable', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain('supersedes_assessment_id');
  });

  it('Check 08: reassessment never mutates old record', () => {
    const triggersSql = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/migrations/0002_m2_immutable_triggers.sql'),
      'utf-8',
    );
    expect(triggersSql).toContain('trg_immutable_evidence_assessments');
    expect(triggersSql).toContain('BEFORE UPDATE OR DELETE ON "evidence_assessments"');
    expect(triggersSql).toContain('prevent_immutable_mutation()');
  });

  it('Check 09: EpistemicState uses exact assessment IDs', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/reference-sets.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain('epistemic_state_assessments');
  });

  it('Check 10: support_status vocabulary preserved', () => {
    expect(EPISTEMIC_SUPPORT_STATUSES).toEqual([
      'SUPPORTED',
      'PARTIALLY_SUPPORTED',
      'CONFLICTING',
      'CONTRADICTED',
      'INSUFFICIENT',
      'UNKNOWN',
    ]);
  });

  it('Check 11: causal_status closed and causal guard enforced', () => {
    expect(CAUSAL_STATUSES).toContain('NOT_APPLICABLE');
    expect(() => {
      validateCausalSupportGuard('FACTUAL', 'SUPPORTED');
    }).toThrowError(RegistryValidationError);
    expect(() => {
      validateCausalSupportGuard('FACTUAL', 'NOT_APPLICABLE');
    }).not.toThrow();
  });

  it('Check 12: Epistemic chain single-root', () => {
    const serviceContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/epistemic-persistence-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('SECOND_EPISTEMIC_ROOT_FORBIDDEN');
    expect(serviceContent).toContain('supersedes_epistemic_state_id IS NULL');
  });

  it('Check 13: Epistemic chain non-branching', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain("uniqueIndex('uq_epistemic_state_predecessor')");
  });

  it('Check 14: Epistemic chain same-Proposition', () => {
    const serviceContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/epistemic-persistence-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('EPISTEMIC_PROPOSITION_MISMATCH');
    expect(serviceContent).toContain('predecessor.proposition_id !== propositionId');
  });

  it('Check 15: Epistemic known_from monotonic', () => {
    const serviceContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/epistemic-persistence-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('EPISTEMIC_KNOWN_FROM_NON_INCREASING');
    expect(serviceContent).toContain('succKnownFrom <= predKnownFrom');
  });

  it('Check 16: Epistemic chain acyclic', () => {
    const serviceContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/epistemic-persistence-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('EPISTEMIC_CYCLE');
    expect(serviceContent).toContain('visited.has(currentAncestorId)');
  });

  it('Check 17: valid time distinct from known time', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain('valid_from');
    expect(schemaContent).toContain('known_from');
  });

  it('Check 18: unknown-preservation gate intact', () => {
    const res = enforceUnknownPreservationGate([
      {
        gapId: 'gap-1',
        taskRevisionId: 'task-1',
        question: 'What is X?',
        blocking: true,
        assumptionAllowed: false,
        status: 'OPEN',
      },
    ]);
    expect(res.canProceedToStrategy).toBe(false);
    expect(res.gateStatus).toBe('BLOCKED');
  });

  it('Check 19: research failure not falsity', () => {
    expect(() => {
      validateResearchGapResolution('NO_EVIDENCE_FOUND', { blocking: true, status: 'OPEN' });
    }).toThrowError(RegistryValidationError);
    expect(() => {
      validateResearchGapResolution('SEARCH_FAILED', { blocking: true, status: 'OPEN' });
    }).toThrowError(RegistryValidationError);
  });

  it('Check 20: performance evidence firewall intact', () => {
    expect(() => {
      validatePerformanceEvidenceFirewall({
        originType: 'PERFORMANCE_OBSERVATION',
        evidenceDomain: 'OBSERVATIONAL_PERFORMANCE',
        targetPropositionType: 'FACTUAL',
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Check 21: attribution/causation separation intact', () => {
    expect(() => {
      validateAttributionFirewall(true, true);
    }).toThrowError(RegistryValidationError);
  });

  it('Check 22: RunKnowledgeDelta lifecycle consistent with SPEC01', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/governance-snapshots.ts'),
      'utf-8',
    );
    expect(schemaContent).toContain('run_knowledge_deltas');
    expect(schemaContent).toContain('delta_id');
    expect(schemaContent).toContain('run_correlation_key');

    // Immutable triggers attach to run_knowledge_deltas
    const triggersSql = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/migrations/0001_fantastic_kid_colt.sql'),
      'utf-8',
    );
    expect(triggersSql).toContain('trg_immutable_run_knowledge_deltas');
    expect(triggersSql).toContain('BEFORE UPDATE OR DELETE ON "run_knowledge_deltas"');
  });

  it('Check 23: FREEZING boundary consistent with SPEC01', () => {
    const coordinatorContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/stage-fencing-coordinator.ts'),
      'utf-8',
    );
    expect(coordinatorContent).toContain('KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING');
    expect(coordinatorContent).toContain("cycle.status === 'FREEZING' || cycle.status === 'FROZEN'");
  });

  it('Check 24: deletion/replay consistent with SPEC02', () => {
    const serviceContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/epistemic-persistence-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('UNAVAILABLE_DUE_TO_RETENTION');
    expect(serviceContent).toContain("obr.state as payload_state");
  });

  it('Check 25: tenant/data-scope isolation intact', () => {
    const propService = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/proposition-persistence-service.ts'),
      'utf-8',
    );
    const evService = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/evidence-persistence-service.ts'),
      'utf-8',
    );
    expect(propService).toContain('WORKSPACE_ISOLATION_VIOLATION');
    expect(evService).toContain('TENANT_ISOLATION_VIOLATION');
    expect(evService).toContain('WORKSPACE_ISOLATION_VIOLATION');
  });

  it('Check 26: no CURRENT/LATEST/ACTIVE historical substitution', () => {
    const gateContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/strategy-knowledge-gate-service.ts'),
      'utf-8',
    );
    expect(gateContent).toContain('STRATEGY_KNOWLEDGE_GATE_BLOCKED');
    expect(gateContent).toContain('known_from <= ${knowledgeBoundaryTime}');
    expect(gateContent).toContain('Generic CURRENT/LATEST substitution is prohibited');
  });

  it('Check 27: Runtime cannot mutate Control Plane', () => {
    const migrationContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/migrations/0001_fantastic_kid_colt.sql'),
      'utf-8',
    );
    expect(migrationContent).toContain(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON control_plane_activations FROM contentos_runtime_role',
    );
  });

  it('Check 28: no duplicate source of epistemic truth', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).not.toContain('current_support_status');
    expect(schemaContent).not.toContain('latest_epistemic_state_id');
  });
});
