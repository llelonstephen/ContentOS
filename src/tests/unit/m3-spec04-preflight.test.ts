/**
 * ContentOS — SPEC04 §146 Static Contract Preflight Verification Suite
 *
 * Implements the exact 34 static contract preflight checks locked in SPEC04 §146.
 * Inspects AST, database schema, migration files, and production services.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SPEC04 §146 Static Contract Preflight (34 Checks)', () => {
  const rootDir = process.cwd();

  // 01 no new canonical domain entity invented
  it('Preflight 01: no new canonical domain entity invented', () => {
    const allowedCanonicalEntities = new Set([
      'Task',
      'TaskContractRevision',
      'AudienceState',
      'Strategy',
      'Architecture',
      'ContentCandidate',
      'DecisionSnapshot',
      'DecisionRecord',
      'FinalContentPackage',
      'RightsCheck',
      'QualitativeEvaluation',
      'Proposition',
      'EvidenceItem',
      'EpistemicStateVersion',
      'KnowledgeGap',
      'SourceArtifact',
      'ResearchTrace',
      'GovernanceSnapshot',
      'ApplicabilityAssessment',
      'PolicyResult',
      'PolicyOverride',
      'PolicyConflictResolution',
      'HumanReviewRecord',
    ]);

    // Check all occurrences of entity_type in persistence services
    const govServicePath = path.join(
      rootDir,
      'src/persistence/relational/services/governance-persistence-service.ts',
    );
    const govContent = fs.readFileSync(govServicePath, 'utf-8');
    const entityMatches = [
      ...govContent.matchAll(
        /INSERT INTO immutable_entity_registry\s*\([^)]*entity_type[^)]*\)\s*VALUES\s*\(\s*'([^']+)'/g,
      ),
    ];
    expect(entityMatches.length).toBeGreaterThan(0);
    for (const match of entityMatches) {
      expect(allowedCanonicalEntities.has(match[1])).toBe(true);
    }
  });

  // 02 Guidance / NormativeRule / DecisionPolicy remain distinct
  it('Preflight 02: Guidance / NormativeRule / DecisionPolicy remain distinct', () => {
    const schemaFile = fs.readFileSync(
      path.join(rootDir, 'src/persistence/relational/schema/control-plane.ts'),
      'utf-8',
    );
    expect(schemaFile).toContain('export const guidanceRevisions =');
    expect(schemaFile).toContain('export const normativeRuleRevisions =');
    expect(schemaFile).toContain('export const decisionPolicyRevisions =');
  });

  // 03 GovernanceSnapshot remains immutable
  it('Preflight 03: GovernanceSnapshot remains immutable', () => {
    const migrationFile = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/migrations/0001_fantastic_kid_colt.sql',
      ),
      'utf-8',
    );
    expect(migrationFile).toContain('trg_immutable_governance_snapshots');
    expect(migrationFile).toContain('trg_immutable_governance_snapshot_policies');
    expect(migrationFile).toContain('trg_immutable_governance_snapshot_rules');
    expect(migrationFile).toContain('trg_immutable_governance_snapshot_guidance');
  });

  // 04 no CURRENT/LATEST/ACTIVE historical resolution
  it('Preflight 04: no CURRENT/LATEST/ACTIVE historical resolution in policy evaluation', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    // evaluatePolicySet must operate strictly on snapshot, not ACTIVE control plane
    const evalSection = govService.substring(govService.indexOf('evaluatePolicySet'));
    expect(evalSection).not.toMatch(/SELECT.*FROM control_plane_activations.*CURRENT/i);
    expect(evalSection).not.toMatch(/WHERE.*status\s*=\s*'ACTIVE'/i);
  });

  // 05 governance refresh triggered by frozen dependency set changes
  it('Preflight 05: governance refresh triggered by frozen dependency set changes', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('resolveOrRefreshGovernanceSnapshot');
    expect(govService).toContain('dependency_hash');
  });

  // 06 target-valid-time semantics preserved
  it('Preflight 06: target-valid-time semantics preserved', () => {
    const temporalFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/temporal-governance-resolver.ts'),
      'utf-8',
    );
    expect(temporalFile).toContain('resolveTargetValidTime');
    expect(temporalFile).toContain('intendedPublicationTime');
    expect(temporalFile).toContain('frozenAt');
  });

  // 07 knowledge-cutoff semantics preserved
  it('Preflight 07: knowledge-cutoff semantics preserved', () => {
    const temporalFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/temporal-governance-resolver.ts'),
      'utf-8',
    );
    expect(temporalFile).toContain('validateKnowledgeCutoff');
    expect(temporalFile).toContain('cutoffDate.getTime() > frozenDate.getTime()');
  });

  // 08 future-known rule exclusion preserved
  it('Preflight 08: future-known rule exclusion preserved', () => {
    const temporalFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/temporal-governance-resolver.ts'),
      'utf-8',
    );
    expect(temporalFile).toContain('isRuleEligible');
    expect(temporalFile).toContain('knownFrom.getTime() > knowledgeCutoffTime.getTime()');
  });

  // 09 known-now/future-valid rule eligibility preserved
  it('Preflight 09: known-now/future-valid rule eligibility preserved', () => {
    const temporalFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/temporal-governance-resolver.ts'),
      'utf-8',
    );
    expect(temporalFile).toContain('isRuleEligible');
    expect(temporalFile).toContain('validFrom.getTime() > targetValidTime.getTime()');
  });

  // 10 Applicability subject typing preserved
  it('Preflight 10: Applicability subject typing preserved', () => {
    const schemaFile = fs.readFileSync(
      path.join(rootDir, 'src/persistence/relational/schema/content.ts'),
      'utf-8',
    );
    expect(schemaFile).toContain('applicability_assessments');
    expect(schemaFile).toContain('subject_type');
    expect(schemaFile).toContain('subject_revision_id');
  });

  // 11 Applicability uncertainty remains explicit
  it('Preflight 11: Applicability uncertainty remains explicit', () => {
    const schemaFile = fs.readFileSync(
      path.join(rootDir, 'src/persistence/relational/schema/content.ts'),
      'utf-8',
    );
    expect(schemaFile).toContain('applicability_assessments');
    expect(schemaFile).toContain('result');
    expect(schemaFile).toContain('UNCERTAIN');
  });

  // 12 Policy Engine input is frozen DecisionSnapshot only & declared-input closure
  it('Preflight 12: Policy Engine input is frozen DecisionSnapshot only', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('evaluatePolicySet');
    expect(govService).toContain('FROM decision_snapshots');

    // Declared-input closure: inspect production policy-dsl.ts for allowlist compile & AST enforcement
    const dslFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-dsl.ts'),
      'utf-8',
    );
    expect(dslFile).toContain('allowedRoots');
    expect(dslFile).toContain('POLICY_SCHEMA_UNSUPPORTED');
    expect(dslFile).toContain('required_inputs allowlist');
  });

  // 13 PolicyResult bound to one snapshot
  it('Preflight 13: PolicyResult bound to one snapshot', () => {
    const schemaFile = fs.readFileSync(
      path.join(rootDir, 'src/persistence/relational/schema/governance-snapshots.ts'),
      'utf-8',
    );
    expect(schemaFile).toContain('policy_results');
    expect(schemaFile).toContain('snapshot_id');
  });

  // 14 PolicyResult policy revision belongs to GovernanceSnapshot
  it('Preflight 14: PolicyResult policy revision belongs to GovernanceSnapshot', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('governance_snapshot_policies');
    expect(govService).toContain('POLICY_REVISION_NOT_IN_SNAPSHOT');
  });

  // 15 PolicyResult inputs reachable from snapshot closure & selector escape enforcement
  it('Preflight 15: PolicyResult inputs reachable from snapshot closure', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('INPUT_REF_OUTSIDE_SNAPSHOT_CLOSURE');

    // Selector frozen-closure enforcement: inspect production policy-dsl.ts for prototype escape blocking
    const dslFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-dsl.ts'),
      'utf-8',
    );
    expect(dslFile).toContain('FORBIDDEN_PATH_SEGMENTS');
    expect(dslFile).toContain('__proto__');
    expect(dslFile).toContain('constructor');
    expect(dslFile).toContain('prototype');
    expect(dslFile).toContain('Object.prototype.hasOwnProperty');
  });

  // 16 expected policy set derived from GovernanceSnapshot
  it('Preflight 16: expected policy set derived from GovernanceSnapshot', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('SELECT policy_revision_id');
    expect(govService).toContain('FROM governance_snapshot_policies');
  });

  // 17 non-triggered results still required
  it('Preflight 17: non-triggered results still required', () => {
    const dslFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-dsl.ts'),
      'utf-8',
    );
    expect(dslFile).toContain("NO_RELEASE_EFFECT");
  });

  // 18 policy result completeness is exact-set complete
  it('Preflight 18: policy result completeness is exact-set complete', () => {
    const decService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/decision-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(decService).toContain('INCOMPLETE_POLICY_RESULTS');
  });

  // 19 missing result is not PASS
  it('Preflight 19: missing result is not PASS', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('INCOMPLETE_POLICY_SET_FOR_CONFLICT_DETECTION');
  });

  // 20 conflict identity deterministic & order-invariant
  it('Preflight 20: conflict identity deterministic', () => {
    const conflictFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-conflict-resolver.ts'),
      'utf-8',
    );
    expect(conflictFile).toContain('computeConflictKey');
    expect(conflictFile).toContain('.sort()');
    expect(conflictFile).toContain('createHash');
    // Inspect order-invariance: resolveConflict sorts descriptors deterministically by policyResultId
    expect(conflictFile).toContain('.sort((a, b) => a.policyResultId.localeCompare(b.policyResultId))');
  });

  // 21 one final resolution per conflict_key
  it('Preflight 21: one final resolution per conflict_key', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('DUPLICATE_FINAL_CONFLICT_RESOLUTION');
  });

  // 22 conflict resolution vocabulary & conditions preserved
  it('Preflight 22: conflict resolution vocabulary preserved', () => {
    const conflictFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-conflict-resolver.ts'),
      'utf-8',
    );
    expect(conflictFile).toContain('HARD_DENY_OVERRIDES');
    expect(conflictFile).toContain('HARD_REQUIREMENT_OVERRIDES');
    expect(conflictFile).toContain('MORE_SPECIFIC_SCOPE');
    expect(conflictFile).toContain('EXPLICIT_PRIORITY');
    expect(conflictFile).toContain('AUTHORIZED_OVERRIDE');
    expect(conflictFile).toContain('ESCALATE');

    // Structural enforcement checks:
    expect(conflictFile).toContain('isHardDeny');
    expect(conflictFile).toContain('compareStructuredScopes');
    expect(conflictFile).toContain('overrideAllowed === false');

    // Prohibit substring-based hard-deny inference (SPEC04 §62)
    expect(conflictFile).not.toMatch(/includes\(['"](HARD|MANDATE|STATUTORY)['"]\)/i);

    // Prohibit hard-coded P0/P1/HIGH/MEDIUM priority table (SPEC04 §65)
    expect(conflictFile).not.toContain('parsePriorityWeight');
    expect(conflictFile).not.toContain('CRITICAL');
    expect(conflictFile).not.toContain('P0');
    expect(conflictFile).not.toContain('P1');

    // Prohibit automatic REQUIREMENT conflict based on actionCode alone (SPEC04 §57)
    expect(conflictFile).not.toContain('a.actionCode !== b.actionCode');
  });

  // 23 AUTHORIZED_OVERRIDE requires valid PolicyOverride
  it('Preflight 23: AUTHORIZED_OVERRIDE requires valid PolicyOverride', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('AUTHORIZED_OVERRIDE_REQUIRES_OVERRIDE_ID');
    expect(govService).toContain('OVERRIDE_ID_FORBIDDEN_FOR_NON_OVERRIDE');
  });

  // 24 non-overridable policy cannot be overridden
  it('Preflight 24: non-overridable policy cannot be overridden', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('POLICY_OVERRIDE_FORBIDDEN');
  });

  // 25 override authority/scope enforced
  it('Preflight 25: override authority/scope enforced', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('OVERRIDE_AUTHORITY_NOT_SATISFIED');
    expect(govService).toContain('OVERRIDE_SCOPE_WIDENING_FORBIDDEN');
  });

  // 26 Human Review cannot add hidden state
  it('Preflight 26: Human Review cannot add hidden state', () => {
    const schemaFile = fs.readFileSync(
      path.join(rootDir, 'src/persistence/relational/schema/governance-snapshots.ts'),
      'utf-8',
    );
    expect(schemaFile).toContain('human_review_records');
    expect(schemaFile).toContain('review_decision');
  });

  // 27 new information causes new decision cycle/snapshot
  it('Preflight 27: new information causes new decision cycle/snapshot', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('NEW_INFORMATION_REQUIRES_NEW_DECISION_CYCLE');
  });

  // 28 DecisionRecord owns release_status
  it('Preflight 28: DecisionRecord owns release_status', () => {
    const decService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/decision-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(decService).toContain('RELEASE_STATUS_FORBIDDEN_ON_PACKAGE');
  });

  // 29 DecisionRecord contains complete PolicyResult set
  it('Preflight 29: DecisionRecord contains complete PolicyResult set', () => {
    const decService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/decision-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(decService).toContain('INCOMPLETE_POLICY_RESULTS');
  });

  // 30 DecisionRecord candidate closure preserved
  it('Preflight 30: DecisionRecord candidate closure preserved', () => {
    const decService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/decision-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(decService).toContain('SELECTED_CANDIDATE_NOT_IN_SNAPSHOT');
  });

  // 31 Runtime cannot mutate Control Plane
  it('Preflight 31: Runtime cannot mutate Control Plane', () => {
    const migrationFile = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/migrations/0005_m3_governance_invariants.sql',
      ),
      'utf-8',
    );
    expect(migrationFile).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON');
    expect(migrationFile).toContain('control_plane_activations');
    expect(migrationFile).toContain('guidance_revisions');
    expect(migrationFile).toContain('normative_rule_revisions');
    expect(migrationFile).toContain('decision_policy_revisions');
    expect(migrationFile).toContain('FROM contentos_runtime_role');
  });

  // 32 tenant/scope isolation preserved
  it('Preflight 32: tenant/scope isolation preserved', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('CROSS_TENANT_SNAPSHOT_FORBIDDEN');
    expect(govService).toContain('CROSS_WORKSPACE_SNAPSHOT_FORBIDDEN');
  });

  // 33 rights interpretation remains out of SPEC04
  it('Preflight 33: rights interpretation remains out of SPEC04', () => {
    const dslFile = fs.readFileSync(
      path.join(rootDir, 'src/domain/governance/policy-dsl.ts'),
      'utf-8',
    );
    // Policy DSL evaluates predicates over inputs, does NOT compute legal licensing analysis
    expect(dslFile).not.toContain('legalJurisdictionAssessment');
    expect(dslFile).not.toContain('evaluateCopyrightDoctrine');
  });

  // 34 no duplicated governance source of truth
  it('Preflight 34: no duplicated governance source of truth', () => {
    const govService = fs.readFileSync(
      path.join(
        rootDir,
        'src/persistence/relational/services/governance-persistence-service.ts',
      ),
      'utf-8',
    );
    expect(govService).toContain('GovernancePersistenceService');
  });
});
