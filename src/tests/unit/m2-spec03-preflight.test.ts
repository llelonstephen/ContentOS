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
import ts from 'typescript';
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

  it('Check 23: FREEZING boundary consistent with SPEC01 and all decision-cycle writes wire to mandatory fencing', () => {
    const coordinatorPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/services/stage-fencing-coordinator.ts',
    );
    const coordinatorContent = fs.readFileSync(coordinatorPath, 'utf-8');
    expect(coordinatorContent).toContain('KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING');
    expect(coordinatorContent).toContain("cycle.status === 'FREEZING' || cycle.status === 'FROZEN'");
    expect(coordinatorContent).toContain('DECISION_CYCLE_CONTEXT_REQUIRED');
    expect(coordinatorContent).toContain('STAGE_EXECUTION_CONTEXT_REQUIRED');
    expect(coordinatorContent).toContain('FENCING_TOKEN_REQUIRED');
    expect(coordinatorContent).toContain('STALE_WORKER_COMMIT_REJECTED');
    expect(coordinatorContent).toContain('WRITE_AUTHORITY_REQUIRED');

    // 1. Structural check: Standalone branch calls a production DB-role verifier
    expect(coordinatorContent).toContain('verifyStandaloneDatabaseAuthority(sqlTx)');
    expect(coordinatorContent).toContain("CURRENT_USER AS current_role");
    expect(coordinatorContent).toContain("row?.current_role !== 'contentos_standalone_role'");

    // 1b. Structural check: No call-stack authorization exists across codebase
    const projectSrcDir = path.resolve(import.meta.dirname, '../..');
    const allSrcFiles: string[] = [];
    function collectFiles(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'tests') {
            collectFiles(full);
          }
        } else if (entry.name.endsWith('.ts')) {
          allSrcFiles.push(full);
        }
      }
    }
    collectFiles(projectSrcDir);

    for (const file of allSrcFiles) {
      const code = fs.readFileSync(file, 'utf-8');
      expect(code).not.toContain('assertTrustedBootstrapCaller');
      expect(code).not.toContain('new Error().stack');
      expect(code).not.toMatch(/caller.*stack/i);
    }

    // 1c. Structural check: No Symbol or in-process token is used as final standalone authority
    expect(coordinatorContent).not.toContain('STANDALONE_AUTHORITY');
    expect(coordinatorContent).not.toContain('isStandaloneAuthority');
    expect(coordinatorContent).not.toContain('Symbol(');
    const compRootPath = path.resolve(import.meta.dirname, '../../bootstrap/composition-root.ts');
    const compRootContent = fs.readFileSync(compRootPath, 'utf-8');
    expect(compRootContent).not.toContain('STANDALONE_AUTHORITY');
    expect(compRootContent).not.toContain('Symbol(');
    expect(compRootContent).not.toContain('assertTrustedBootstrapCaller');

    // 1d. Structural check: Migration contains standalone role setup and runtime isolation
    const migrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0001_fantastic_kid_colt.sql',
    );
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    expect(migrationContent).toContain("CREATE ROLE contentos_standalone_role NOLOGIN");
    expect(migrationContent).toContain("REVOKE contentos_standalone_role FROM contentos_runtime_role");
    expect(migrationContent).not.toContain("GRANT contentos_standalone_role TO contentos_runtime_role");

    // 1d-ii. Forward migrations exist and enforce least-privilege closure without broad grants
    const forwardMigrationPath0003 = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0003_m2_standalone_privilege_closure.sql',
    );
    expect(fs.existsSync(forwardMigrationPath0003)).toBe(true);
    const forwardMigrationContent0003 = fs.readFileSync(forwardMigrationPath0003, 'utf-8');

    const forwardMigrationPath0004 = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0004_m2_standalone_lock_authority_closure.sql',
    );
    expect(fs.existsSync(forwardMigrationPath0004)).toBe(true);
    const forwardMigrationContent0004 = fs.readFileSync(forwardMigrationPath0004, 'utf-8');

    // No standalone production migration contains broad table grants
    const migrationsDir = path.resolve(import.meta.dirname, '../../persistence/relational/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const mFile of migrationFiles) {
      const mContent = fs.readFileSync(path.join(migrationsDir, mFile), 'utf-8');
      expect(mContent).not.toMatch(/GRANT\s+ALL\s+ON\s+ALL\s+TABLES.*TO\s+contentos_standalone_role/i);
      expect(mContent).not.toMatch(/GRANT\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+TABLES.*TO\s+contentos_standalone_role/i);
      expect(mContent).not.toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES.*TO\s+contentos_standalone_role/i);
    }

    // Exact required privilege statements exist for the access matrix in 0003
    expect(forwardMigrationContent0003).toContain('CREATE ROLE contentos_standalone_role NOLOGIN');
    expect(forwardMigrationContent0003).toContain('REVOKE contentos_standalone_role FROM contentos_runtime_role');
    expect(forwardMigrationContent0003).toContain('"rights_policies"');
    expect(forwardMigrationContent0003).toContain('"object_references"');
    expect(forwardMigrationContent0003).toContain('"epistemic_state_assessments"');
    expect(forwardMigrationContent0003).toContain('"object_registry"');
    expect(forwardMigrationContent0003).toMatch(/GRANT\s+SELECT,\s*INSERT\s+ON[\s\S]*"object_references"[\s\S]*TO\s+contentos_standalone_role/);
    expect(forwardMigrationContent0003).toMatch(/GRANT\s+SELECT,\s*INSERT\s+ON[\s\S]*"epistemic_state_assessments"[\s\S]*TO\s+contentos_standalone_role/);
    expect(forwardMigrationContent0003).toMatch(/GRANT\s+SELECT\s+ON[\s\S]*"rights_policies"[\s\S]*TO\s+contentos_standalone_role/);

    // Migration 0004 revokes UPDATE on object_registry from contentos_standalone_role
    expect(forwardMigrationContent0004).toMatch(/REVOKE\s+UPDATE\s+ON\s+object_registry\s+FROM\s+contentos_standalone_role/i);

    // Migration 0004 creates the restricted SECURITY DEFINER lock function
    expect(forwardMigrationContent0004).toContain('CREATE OR REPLACE FUNCTION contentos_lock_object_registry_row');
    expect(forwardMigrationContent0004).toContain('SECURITY DEFINER');
    expect(forwardMigrationContent0004).toContain('FOR UPDATE');
    expect(forwardMigrationContent0004).toContain('SET search_path = public, pg_temp');
    expect(forwardMigrationContent0004).toContain('REVOKE ALL ON FUNCTION contentos_lock_object_registry_row(text, text) FROM PUBLIC');
    expect(forwardMigrationContent0004).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+contentos_lock_object_registry_row\(text,\s*text\)\s+TO\s+contentos_standalone_role/i);

    // EvidencePersistenceService calls this lock function in both standalone-relevant paths
    const evServicePath = path.resolve(import.meta.dirname, '../../persistence/relational/services/evidence-persistence-service.ts');
    const evServiceContent = fs.readFileSync(evServicePath, 'utf-8');
    expect(evServiceContent).toContain('contentos_lock_object_registry_row');
    const lockCalls = evServiceContent.match(/contentos_lock_object_registry_row/g);
    expect(lockCalls).toHaveLength(2); // ingestSourceArtifact and extractEvidenceItem

    // Standalone role is not granted direct ObjectRegistry UPDATE in final effective migration state
    const idx0004 = migrationFiles.indexOf('0004_m2_standalone_lock_authority_closure.sql');
    expect(idx0004).toBeGreaterThanOrEqual(0);
    for (let i = idx0004 + 1; i < migrationFiles.length; i++) {
      const laterContent = fs.readFileSync(path.join(migrationsDir, migrationFiles[i]), 'utf-8');
      expect(laterContent).not.toMatch(/GRANT.*UPDATE.*ON.*object_registry.*TO.*contentos_standalone_role/i);
      expect(laterContent).not.toMatch(/GRANT.*ALL.*ON.*SEQUENCES.*TO.*contentos_standalone_role/i);
    }

    // Migration 0004 revokes historical ALL sequence privileges
    expect(forwardMigrationContent0004).toMatch(/REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+SEQUENCES\s+IN\s+SCHEMA\s+public\s+FROM\s+contentos_standalone_role/i);

    // 1e. AST check: Persistence public surface does NOT export any privilege-minting standalone factory or constructor
    const persistenceDir = path.resolve(import.meta.dirname, '../../persistence/relational/services');
    for (const pFile of fs.readdirSync(persistenceDir)) {
      if (!pFile.endsWith('.ts')) continue;
      const pPath = path.join(persistenceDir, pFile);
      const pCode = fs.readFileSync(pPath, 'utf-8');
      const pSf = ts.createSourceFile(pPath, pCode, ts.ScriptTarget.Latest, true);
      ts.forEachChild(pSf, (node) => {
        // Check exported functions
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          const fnName = node.name?.getText(pSf) ?? '';
          expect(fnName).not.toMatch(/create.*standalone/i);
          expect(fnName).not.toMatch(/mint.*authority/i);
          expect(fnName).not.toMatch(/standalone.*adapter/i);
          expect(fnName).not.toBe('createStandaloneIngestionAdapter');
        }
        // Check exported variables / arrow functions
        if (ts.isVariableStatement(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const decl of node.declarationList.declarations) {
            const varName = decl.name.getText(pSf);
            expect(varName).not.toMatch(/create.*standalone/i);
            expect(varName).not.toMatch(/standalone.*adapter/i);
            expect(varName).not.toBe('createStandaloneIngestionAdapter');
          }
        }
        // Check exported classes: StandaloneIngestionAdapter cannot have public static factory minting authority
        if (ts.isClassDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const member of node.members) {
            if (ts.isMethodDeclaration(member) && member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) {
              const methodName = member.name.getText(pSf);
              expect(methodName).not.toMatch(/create/i);
              expect(methodName).not.toMatch(/mint/i);
            }
          }
        }
      });
    }

    // 2. AST check: Base canonical persistence interfaces do NOT expose public authority parameters
    const persistenceServiceFiles = [
      'evidence-persistence-service.ts',
      'proposition-persistence-service.ts',
      'epistemic-persistence-service.ts',
      'knowledge-gap-persistence-service.ts',
    ];
    for (const serviceFile of persistenceServiceFiles) {
      const fullPath = path.resolve(import.meta.dirname, '../../persistence/relational/services', serviceFile);
      const code = fs.readFileSync(fullPath, 'utf-8');
      const sf = ts.createSourceFile(fullPath, code, ts.ScriptTarget.Latest, true);
      ts.forEachChild(sf, (node) => {
        if (ts.isInterfaceDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.name) {
              const propName = member.name.getText(sf);
              expect(propName).not.toBe('trustedCapability');
              expect(propName).not.toBe('standaloneCapability');
              expect(propName).not.toBe('trustedStandaloneCapability');
              expect(propName).not.toBe('_standaloneAuthority');
            }
          }
        }
      });
    }

    // 3. Import-graph analysis: Detect namespace imports, dynamic imports, re-exports, and privileged adapter imports
    const srcDir = path.resolve(import.meta.dirname, '../..');
    const allFiles: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'tests' && entry.name !== 'node_modules') {
            walk(full);
          }
        } else if (entry.name.endsWith('.ts')) {
          allFiles.push(full);
        }
      }
    }
    walk(srcDir);

    for (const file of allFiles) {
      // Exclude standalone adapter itself, the coordinator definition, and the trusted bootstrap composition root
      if (
        file.endsWith('standalone-ingestion-adapter.ts') ||
        file.endsWith('stage-fencing-coordinator.ts') ||
        file.includes('/bootstrap/')
      ) {
        continue;
      }
      const code = fs.readFileSync(file, 'utf-8');
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

      const checkNode = (node: ts.Node) => {
        // Detect static imports
        if (ts.isImportDeclaration(node)) {
          const modSpecifier = node.moduleSpecifier.getText(sf);
          if (
            modSpecifier.includes('standalone-ingestion-adapter') ||
            modSpecifier.includes('stage-fencing-coordinator') ||
            modSpecifier.includes('composition-root')
          ) {
            const namedBindings = node.importClause?.namedBindings;
            if (namedBindings && ts.isNamespaceImport(namedBindings)) {
              throw new Error(`Namespace import of privileged module detected in ${file}`);
            }
            if (namedBindings && ts.isNamedImports(namedBindings)) {
              for (const spec of namedBindings.elements) {
                const name = spec.name.text;
                expect(name).not.toBe('StandaloneIngestionAdapter');
                expect(name).not.toBe('TRUSTED_STANDALONE_CAPABILITY');
                expect(name).not.toBe('createStandaloneIngestionAdapter');
              }
            }
          }
        }
        // Detect dynamic imports
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const arg = node.arguments[0]?.getText(sf) ?? '';
          if (arg.includes('standalone-ingestion-adapter') || arg.includes('stage-fencing-coordinator')) {
            throw new Error(`Dynamic import of privileged module detected in ${file}`);
          }
        }
        // Detect re-exports
        if (ts.isExportDeclaration(node)) {
          const modSpecifier = node.moduleSpecifier?.getText(sf) ?? '';
          if (modSpecifier.includes('standalone-ingestion-adapter')) {
            throw new Error(`Re-export of StandaloneIngestionAdapter detected in ${file}`);
          }
        }
        ts.forEachChild(node, checkNode);
      };
      checkNode(sf);
    }

    // 4. AST analysis: DecisionCycleKnowledgeAdapter requires StageExecution/fencing on all methods
    const adapterPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/services/decision-cycle-knowledge-adapter.ts',
    );
    const adapterCode = fs.readFileSync(adapterPath, 'utf-8');
    const adapterSf = ts.createSourceFile(adapterPath, adapterCode, ts.ScriptTarget.Latest, true);
    let classFound = false;
    ts.forEachChild(adapterSf, (node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === 'DecisionCycleKnowledgeAdapter') {
        classFound = true;
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const methodName = member.name.text;
            if (methodName !== 'validateFencingContext') {
              const methodBody = member.body?.getText(adapterSf) ?? '';
              expect(methodBody).toContain('this.validateFencingContext');
              expect(methodBody).toContain("writeMode: 'DECISION_CYCLE'");
            }
          }
        }
      }
    });
    expect(classFound).toBe(true);
  });

  it('Check 24: deletion/replay consistent with SPEC02', () => {
    const servicePath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/services/epistemic-persistence-service.ts',
    );
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    const sf = ts.createSourceFile(servicePath, serviceContent, ts.ScriptTarget.Latest, true);

    // Replayability outcomes
    expect(serviceContent).toContain("'FULL'");
    expect(serviceContent).toContain("'PARTIAL_REDACTED'");
    expect(serviceContent).toContain("'UNAVAILABLE_DUE_TO_RETENTION'");
    expect(serviceContent).toContain("'INVALIDATED_BY_DELETION'");

    // Canonical resolution semantics: checks object_registry, tombstones, and payload state
    expect(serviceContent).toContain('object_registry');
    expect(serviceContent).toContain('deleted_target_tombstones');
    expect(serviceContent).toContain("ier.payload_state === 'REDACTED'");
    expect(serviceContent).toContain("source.payload_state === 'DELETED'");
    expect(serviceContent).toContain("source.payload_state === 'GC_CLAIMED'");
    expect(serviceContent).toContain("tombstone?.deletion_reason_code === 'USER_REQUESTED_DELETION'");

    // AST check: verify getEpistemicStateReplay contains conditional branches mapping each state
    let replayMethodFound = false;
    let appendMethodFound = false;
    ts.forEachChild(sf, (node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === 'EpistemicPersistenceService') {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            if (member.name.text === 'getEpistemicStateReplay') {
              replayMethodFound = true;
              const body = member.body?.getText(sf) ?? '';
              expect(body).toContain("replayability = 'INVALIDATED_BY_DELETION'");
              expect(body).toContain("replayability = 'UNAVAILABLE_DUE_TO_RETENTION'");
              expect(body).toContain("replayability = 'PARTIAL_REDACTED'");
              expect(body).toContain("replayability: ReplayabilityStatus = 'FULL'");
            }
            if (member.name.text === 'appendEpistemicState') {
              appendMethodFound = true;
              const body = member.body?.getText(sf) ?? '';
              // Verify future derivation checks SourceArtifact immutable_entity_registry and tombstones
              expect(body).toContain('UNAVAILABLE_EVIDENCE_IN_DERIVATION');
              expect(body).toContain('immutable_entity_registry');
              expect(body).toContain('deleted_target_tombstones');
            }
          }
        }
      }
    });
    expect(replayMethodFound).toBe(true);
    expect(appendMethodFound).toBe(true);
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
    const epiServicePath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/services/epistemic-persistence-service.ts',
    );
    const epiService = fs.readFileSync(epiServicePath, 'utf-8');
    const gateService = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/services/strategy-knowledge-gate-service.ts'),
      'utf-8',
    );

    // Fail-closed workspace pattern: target.workspace_id exists -> requires matching caller workspaceId
    expect(propService).toContain('prior.workspace_id && (!workspaceId || prior.workspace_id !== workspaceId)');
    expect(evService).toContain('source.workspace_id && (!workspaceId || source.workspace_id !== workspaceId)');
    expect(evService).toContain('ev.workspace_id && (!workspaceId || ev.workspace_id !== workspaceId)');
    expect(evService).toContain('prop.workspace_id && (!workspaceId || prop.workspace_id !== workspaceId)');
    expect(epiService).toContain('prop.workspace_id && (!workspaceId || prop.workspace_id !== workspaceId)');
    expect(epiService).toContain('row.assessment_workspace && (!workspaceId || row.assessment_workspace !== workspaceId)');
    expect(gateService).toContain('strategy.workspace_id && (!workspaceId || strategy.workspace_id !== workspaceId)');
    expect(gateService).toContain('state.workspace_id && (!workspaceId || state.workspace_id !== workspaceId)');

    // DataScope enforcement in Evidence Link
    expect(evService).toContain('Cannot link EvidenceItem scoped to workspace');
    expect(evService).toContain("data_scope === 'TENANT_PRIVATE'");
    expect(evService).toContain('TENANT_ISOLATION_VIOLATION');

    // AST check: getEpistemicStateReplay requires mandatory EpistemicReplayAuthContext and enforces tenant/workspace isolation
    const sf = ts.createSourceFile(epiServicePath, epiService, ts.ScriptTarget.Latest, true);
    let replayAuthVerified = false;
    ts.forEachChild(sf, (node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === 'EpistemicPersistenceService') {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name) && member.name.text === 'getEpistemicStateReplay') {
            const body = member.body?.getText(sf) ?? '';
            expect(body).toContain('AUTHORIZATION_REQUIRED');
            expect(body).toContain('TENANT_ISOLATION_VIOLATION');
            expect(body).toContain('WORKSPACE_ISOLATION_VIOLATION');
            expect(body).toContain('assessment_workspace');
            replayAuthVerified = true;
          }
        }
      }
    });
    expect(replayAuthVerified).toBe(true);
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

  it('Check 28: no duplicate source of epistemic truth, mechanical derivation, exact registered revision, and RunConfig pin', () => {
    const schemaContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../persistence/relational/schema/epistemic.ts'),
      'utf-8',
    );
    expect(schemaContent).not.toContain('current_support_status');
    expect(schemaContent).not.toContain('latest_epistemic_state_id');

    const domainTypesPath = path.resolve(import.meta.dirname, '../../domain/knowledge/types.ts');
    const domainTypes = fs.readFileSync(domainTypesPath, 'utf-8');
    // Frozen SPEC03 vocabularies only: STRONGLY_SUPPORTED and DIRECT_OBSERVATION must NOT be present
    expect(domainTypes).not.toContain("'STRONGLY_SUPPORTED'");
    expect(domainTypes).not.toContain("'DIRECT_OBSERVATION'");

    const epiServicePath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/services/epistemic-persistence-service.ts',
    );
    const epiService = fs.readFileSync(epiServicePath, 'utf-8');
    const sf = ts.createSourceFile(epiServicePath, epiService, ts.ScriptTarget.Latest, true);

    // Mechanical derivation validation for all derivation methods
    expect(epiService).toContain('UNKNOWN_DERIVATION_METHOD');
    expect(epiService).toContain('DERIVED_STATE_MISMATCH');
    expect(epiService).toContain('DERIVATION_REVISION_NOT_PINNED');
    expect(epiService).toContain('RUN_CONFIG_NOT_FOUND');
    expect(epiService).toContain('deriveEpistemicState');
    expect(epiService).toContain('INVALID_EPISTEMIC_STATUS');
    expect(epiService).toContain('INVALID_CAUSAL_STATUS');
    expect(epiService).toContain('RESEARCH_TRACE_CANNOT_BE_DERIVATION_REVISION');
    expect(epiService).toContain('RESEARCH_TRACE_NOT_FOUND');
    expect(epiService).toContain('TENANT_ISOLATION_VIOLATION');
    expect(epiService).toContain('WORKSPACE_ISOLATION_VIOLATION');

    // AST check: verify EpistemicPersistenceService strictly enforces mechanical derivation,
    // exact registered revision, RunConfig pin, rejects ResearchTrace as revision, and allows no caller-controlled truth path
    let appendMethodFound = false;
    ts.forEachChild(sf, (node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === 'EpistemicPersistenceService') {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name) && member.name.text === 'appendEpistemicState') {
            appendMethodFound = true;
            const body = member.body?.getText(sf) ?? '';
            // 1. Mechanical derivation enforced
            expect(body).toContain('deriveEpistemicState');
            expect(body).toContain('DERIVED_STATE_MISMATCH');
            // 2. Exact registered derivation revision verified
            expect(body).toContain('FROM revision_registry');
            expect(body).toContain('DERIVATION_REVISION_NOT_FOUND');
            // 3. Valid RunConfig / stage pin
            expect(body).toContain('DERIVATION_REVISION_NOT_PINNED');
            // 4. No ResearchTrace-as-revision branch
            expect(body).toContain("derivationEntityType === 'ResearchTrace'");
            expect(body).toContain('RESEARCH_TRACE_CANNOT_BE_DERIVATION_REVISION');
            // 5. No caller-controlled truth path for EXPERIMENTAL
            expect(body).toContain("derivationMethod === 'EXPERIMENTAL'");
            expect(body).toContain("researchTrace.outcome === 'NO_EVIDENCE_FOUND'");
            // 6. Fail-closed workspace isolation for ResearchTrace:
            // trace.workspace_id != null requires matching caller workspaceId; omitting workspaceId throws WORKSPACE_ISOLATION_VIOLATION
            expect(body).toContain('trace.workspace_id != null && (!workspaceId || trace.workspace_id !== workspaceId)');
            expect(body).toContain('WORKSPACE_ISOLATION_VIOLATION');
          }
        }
      }
    });
    expect(appendMethodFound).toBe(true);
  });
});

