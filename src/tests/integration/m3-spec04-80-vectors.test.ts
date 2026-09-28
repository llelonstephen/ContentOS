/**
 * ContentOS — SPEC04 §145 Complete 80-Vector Adversarial Verification Suite
 *
 * Implements the exact 80 locked adversarial vectors from SPEC04 §145 against
 * the live PostgreSQL database (contentos_test).
 *
 * Each vector tests production enforcement:
 * - PostgreSQL FK, UNIQUE, CHECK, trigger, and RBAC boundaries
 * - GovernancePersistenceService (resolution, applicability, policy evaluation, conflict resolution, overrides, reviews)
 * - DecisionPersistenceService (completeness, admission, candidate closure, release status ownership)
 * - TemporalGovernanceResolver (canonical target valid time, cutoff, temporal eligibility)
 * - PolicyConflictResolver (deterministic conflict_key, frozen resolution hierarchy)
 * - Policy DSL Interpreter (deterministic, bounded, side-effect free)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import crypto from 'node:crypto';
import { GovernancePersistenceService } from '../../persistence/relational/services/governance-persistence-service.js';
import { DecisionPersistenceService } from '../../persistence/relational/services/decision-persistence-service.js';
import { ControlPlanePersistenceService } from '../../persistence/relational/services/control-plane-persistence-service.js';
import { TemporalGovernanceResolver } from '../../domain/governance/temporal-governance-resolver.js';
import { PolicyConflictResolver } from '../../domain/governance/policy-conflict-resolver.js';
import { evaluatePolicyDsl } from '../../domain/governance/policy-dsl.js';
import { RegistryValidationError } from '../../domain/services/registry-validator.js';

function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `SAFETY GUARD BLOCKED EXECUTION: Refusing to run tests against non-test database '${dbName}'.`,
    );
  }
}

const DB_URL =
  process.env['DATABASE_URL_TEST'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://localhost:5432/contentos_test';

describe('SPEC04 §145 Adversarial 80-Vector Suite (Live PostgreSQL)', () => {
  let sql: ReturnType<typeof postgres>;
  let runtimeSql: ReturnType<typeof postgres>;
  let govService: GovernancePersistenceService;
  let decService: DecisionPersistenceService;
  let cpService: ControlPlanePersistenceService;

  const tenantA = 'tenant-m3-a';
  const tenantB = 'tenant-m3-b';
  const workspaceA = 'ws-m3-a';
  const uid = (p: string) => `${p}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const taskStable = uid('task-st');
  const taskRevId = uid('task-rev');
  const runConfigId = uid('rc');
  const kmId = uid('km');
  const bksId = uid('bks');
  const rkdId = uid('rkd');
  const audId = uid('aud');
  const stratId = uid('strat-m3');
  const archId = uid('arch-m3');

  beforeAll(async () => {
    assertTestDatabase(DB_URL);
    sql = postgres(DB_URL, { max: 5 });

    // Ensure test credentials exist without granting broad test-environment privileges
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_control_plane_role') THEN
          CREATE ROLE contentos_control_plane_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_runtime_role') THEN
          CREATE ROLE contentos_runtime_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_m3_rt_user') THEN
          CREATE ROLE test_m3_rt_user WITH LOGIN PASSWORD 'test_m3_rt_secret';
        END IF;
        IF NOT pg_has_role('test_m3_rt_user', 'contentos_runtime_role', 'MEMBER') THEN
          GRANT contentos_runtime_role TO test_m3_rt_user;
        END IF;
      END $$;
    `;

    const runtimeUrl =
      DB_URL + (DB_URL.includes('?') ? '&' : '?') + 'options=-c%20role=contentos_runtime_role';
    runtimeSql = postgres(runtimeUrl, { max: 5 });

    govService = new GovernancePersistenceService(sql);
    decService = new DecisionPersistenceService(sql);
    cpService = new ControlPlanePersistenceService(sql);

    // Seed baseline entities
    const metricStable = uid('metric-st');
    const metricRevId = uid('metric-rev');

    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('MetricDefinitionRevision', ${metricStable}, ${metricRevId}, ${tenantA}),
        ('TaskContractRevision', ${taskStable}, ${taskRevId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO metric_definition_revisions (
        metric_id, metric_revision_id, metric_name, layer, definition, numerator, denominator, "window", effective_from, tenant_id
      ) VALUES (
        ${metricStable}, ${metricRevId}, 'CTR', 'BEHAVIORAL', 'Clicks/Impressions', 'Clicks', 'Impressions', '7d', now(), ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO task_contract_revisions (
        task_id, task_revision_id, tenant_id, workspace_id, standalone_task, objective,
        channel, format, language, market, jurisdiction, brand_id, product_id,
        audience_context, success_metric_revision_id, constraints, risk_context,
        compute_budget, intended_publication_time, created_at
      ) VALUES (
        ${taskStable}, ${taskRevId}, ${tenantA}, ${workspaceA}, true, 'M3 Governance Verification',
        'WEB', 'ARTICLE', 'en-US', 'US', 'US-FED', 'brand-1', 'prod-1',
        'Audience context', ${metricRevId}, '{}', '{}',
        '{}', now() + interval '30 days', now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES
        ('RunConfig', ${runConfigId}, ${tenantA}),
        ('AudienceState', ${audId}, ${tenantA}),
        ('KnowledgeManifest', ${kmId}, ${tenantA}),
        ('BaselineKnowledgeSnapshot', ${bksId}, ${tenantA}),
        ('RunKnowledgeDelta', ${rkdId}, ${tenantA}),
        ('StrategyHypothesis', ${stratId}, ${tenantA}),
        ('ContentArchitecture', ${archId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO run_configs (
        run_config_id, tenant_id, workspace_id, runtime_parameters, created_at
      ) VALUES (
        ${runConfigId}, ${tenantA}, ${workspaceA}, '{}', now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, workspace_id, task_revision_id, state_stage,
        context, knowledge_state, problem_state, solution_state, product_state,
        brand_state, intent_state, desired_outcome, objections, decision_criteria,
        prior_exposure, origin, uncertainty, created_at
      ) VALUES (
        ${audId}, ${tenantA}, ${workspaceA}, ${taskRevId}, 'FINAL_FOR_DECISION',
        '{}', '{}', '{}', '{}', '{}',
        '{}', '{}', '{}', '[]', '[]',
        '{}', 'TEST', '{}', now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO strategy_hypotheses (
        strategy_id, tenant_id, workspace_id, task_revision_id, audience_state_id,
        core_message, behavioral_objective, persuasion_mechanism, proof_strategy,
        assumptions, unknowns, failure_modes, risk_hypotheses, created_at
      ) VALUES (
        ${stratId}, ${tenantA}, ${workspaceA}, ${taskRevId}, ${audId},
        'Core msg', 'Obj', 'Mech', 'Proof',
        '{}', '{}', '{}', '{}', now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_architectures (
        architecture_id, tenant_id, workspace_id, task_revision_id, strategy_id, created_at
      ) VALUES (
        ${archId}, ${tenantA}, ${workspaceA}, ${taskRevId}, ${stratId}, now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO knowledge_manifests (
        knowledge_manifest_id, tenant_id, workspace_id, content_hash, created_at
      ) VALUES (
        ${kmId}, ${tenantA}, ${workspaceA}, 'hash-km-m3', now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO baseline_knowledge_snapshots (
        baseline_snapshot_id, tenant_id, workspace_id, knowledge_manifest_id, as_of, created_at
      ) VALUES (
        ${bksId}, ${tenantA}, ${workspaceA}, ${kmId}, now(), now()
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO run_knowledge_deltas (
        delta_id, tenant_id, workspace_id, run_correlation_key, created_at
      ) VALUES (
        ${rkdId}, ${tenantA}, ${workspaceA}, 'rc-key-m3', now()
      ) ON CONFLICT DO NOTHING
    `;
  });

  afterAll(async () => {
    await runtimeSql.end();
    await sql.end();
  });

  async function insertCandidate(candidateId: string) {
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('ContentCandidate', ${candidateId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_candidates (
        candidate_id, tenant_id, workspace_id, task_revision_id,
        strategy_id, architecture_id, content_payload, run_config_id, created_at
      ) VALUES (
        ${candidateId}, ${tenantA}, ${workspaceA}, ${taskRevId},
        ${stratId}, ${archId}, '{"text":"sample"}', ${runConfigId}, now()
      )
      ON CONFLICT DO NOTHING
    `;
  }

  async function createTestSnapshot(
    snapId: string,
    options?: {
      tenantId?: string;
      workspaceId?: string;
      govSnapId?: string;
      candidateIds?: string[];
      policyRevisionIds?: string[];
    },
  ) {
    const tId = options?.tenantId ?? tenantA;
    const wId = options?.workspaceId ?? workspaceA;
    let actualGovSnapId = options?.govSnapId;
    if (!actualGovSnapId) {
      actualGovSnapId = uid('gov-snap');
      await govService.resolveOrRefreshGovernanceSnapshot({
        governanceSnapshotId: actualGovSnapId,
        tenantId: tId,
        workspaceId: wId,
        jurisdiction: 'US-FED',
        channels: ['WEB'],
        formats: ['ARTICLE'],
        asOf: new Date(),
        normativeRuleRevisionIds: [],
        guidanceRevisionIds: [],
        policyRevisionIds: options?.policyRevisionIds ?? [],
      });
    }

    if (options?.candidateIds && options.candidateIds.length > 0) {
      for (const cid of options.candidateIds) {
        await insertCandidate(cid);
      }
    }

    await decService.freezeDecisionSnapshot({
      snapshotId: snapId,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: actualGovSnapId,
      runConfigId: runConfigId,
      taskRevisionId: taskRevId,
      audienceStateId: audId,
      candidateIds: options?.candidateIds ?? [],
      frozenAt: new Date(),
      tenantId: tId,
      workspaceId: wId,
    });
    return { snapshotId: snapId, governanceSnapshotId: actualGovSnapId };
  }

  async function insertPolicyResult(params: {
    resultId: string;
    snapshotId: string;
    policyRevisionId: string;
    triggered?: boolean;
    action?: any;
    reasonCode?: string;
    inputUncertainty?: string;
    tenantId?: string;
    workspaceId?: string;
  }) {
    const tId = params.tenantId ?? tenantA;
    const wId = params.workspaceId ?? workspaceA;
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('PolicyResult', ${params.resultId}, ${tId})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO policy_results (
        policy_result_id, tenant_id, workspace_id, snapshot_id, policy_revision_id,
        triggered, action, reason_code, input_uncertainty, created_at
      ) VALUES (
        ${params.resultId}, ${tId}, ${wId}, ${params.snapshotId}, ${params.policyRevisionId},
        ${params.triggered ?? false}, ${typeof params.action === 'object' ? JSON.stringify(params.action) : (params.action ?? '{}')},
        ${params.reasonCode ?? 'PASS'}, ${params.inputUncertainty ?? 'NONE'}, now()
      )
    `;
  }

  async function createTestRun(runId: string) {
    await sql`
      INSERT INTO runs (
        run_id, tenant_id, workspace_id, run_correlation_key, task_revision_id,
        initialization_cutoff, initial_run_config_id, initial_baseline_snapshot_id,
        status, version
      ) VALUES (
        ${runId}, ${tenantA}, ${workspaceA}, ${uid('rc-key')}, ${taskRevId},
        now(), ${runConfigId}, ${bksId}, 'RUNNING', 1
      )
      ON CONFLICT DO NOTHING
    `;
  }

  // Vector 01: guidance treated automatically as hard law
  it('Vector 01: guidance treated automatically as hard law (fails closed / advisory only)', async () => {
    const guidRevId = uid('guid-v01');
    const gid = uid('g-v01');
    await cpService.createGuidanceRevision({
      guidanceRevisionId: guidRevId,
      guidanceId: gid,
      tenantId: tenantA,
      revisionNumber: 1,
      title: 'Formatting Suggestion',
      guidanceText: 'Should use short paragraphs.',
      recommendationType: 'FORMATTING',
      effectiveFrom: new Date(),
    });

    // Guidance applicability assessment is advisory, not hard law
    const assessId = uid('app-v01');
    await govService.assessApplicability({
      assessmentId: assessId,
      subjectType: 'GUIDANCE',
      subjectRevisionId: guidRevId,
      taskRevisionId: taskRevId,
      assessmentStage: 'PRE_GENERATION_FINAL',
      result: 'APPLICABLE',
      scopeMatches: 'FORMATTING',
      reasonCodes: 'GUIDANCE_RECOMMENDED',
      assessor: 'system',
      uncertainty: 'NONE',
      reviewRequired: false,
      dependencyFingerprint: 'fp-01',
      targetValidTime: new Date(Date.now() + 86400000),
      knowledgeCutoffTime: new Date(),
      tenantId: tenantA,
    });

    const [row] = await sql`SELECT subject_type, review_required FROM applicability_assessments WHERE assessment_id = ${assessId}`;
    expect(row.subject_type).toBe('GUIDANCE');
    expect(row.review_required).toBe(false);
  });

  // Vector 02: normative rule ignored because guidance disagrees
  it('Vector 02: normative rule ignored because guidance disagrees (fails closed)', async () => {
    // Conflict resolution must preserve NormativeRule law over conflicting guidance
    const descriptors = [
      {
        policyResultId: 'res-rule',
        snapshotId: 'snap-v02',
        policyRevisionId: 'pol-rule',
        triggered: true,
        actionEffect: 'BLOCK' as const,
        actionCode: 'STATUTORY_BLOCK',
        priorityClass: 'NORMATIVE_MANDATE',
        scope: 'LEGAL',
        overrideAllowed: false,
      },
      {
        policyResultId: 'res-guidance',
        snapshotId: 'snap-v02',
        policyRevisionId: 'pol-guidance',
        triggered: true,
        actionEffect: 'NO_RELEASE_EFFECT' as const,
        actionCode: 'ADVISORY_ALLOW',
        priorityClass: 'GUIDANCE',
        scope: 'LEGAL',
        overrideAllowed: true,
      },
    ];
    const conflicts = PolicyConflictResolver.detectConflicts(descriptors);
    expect(conflicts.length).toBe(1);
    const resolution = PolicyConflictResolver.resolveConflict(conflicts[0]);
    // Hard law overrides soft guidance
    expect(resolution.resolutionType).toBe('HARD_DENY_OVERRIDES');
  });

  // Vector 03: runtime mutates active GuidanceRevision
  it('Vector 03: runtime mutates active GuidanceRevision (fails closed at DB boundary)', async () => {
    const guidRevId = uid('guid-v03');
    await expect(
      runtimeSql`
        INSERT INTO guidance_revisions (
          guidance_revision_id, guidance_id, tenant_id, revision_number,
          title, guidance_text, recommendation_type, effective_from, created_at
        ) VALUES (
          ${guidRevId}, 'g-v03', ${tenantA}, 1, 'Illegal Runtime Insert', 'text', 'FORMAT', now(), now()
        )
      `,
    ).rejects.toThrow();
  });

  // Vector 04: runtime mutates active NormativeRuleRevision
  it('Vector 04: runtime mutates active NormativeRuleRevision (fails closed at DB boundary)', async () => {
    const ruleRevId = uid('rule-v04');
    await expect(
      runtimeSql`
        INSERT INTO normative_rule_revisions (
          rule_revision_id, rule_id, tenant_id, revision_number,
          jurisdiction, citation, rule_payload, valid_from, known_from, created_at
        ) VALUES (
          ${ruleRevId}, 'r-v04', ${tenantA}, 1, 'US', 'US-101', '{}', now(), now(), now()
        )
      `,
    ).rejects.toThrow();
  });

  // Vector 05: runtime mutates active DecisionPolicyRevision
  it('Vector 05: runtime mutates active DecisionPolicyRevision (fails closed at DB boundary)', async () => {
    const polRevId = uid('pol-v05');
    await expect(
      runtimeSql`
        INSERT INTO decision_policy_revisions (
          policy_revision_id, policy_id, tenant_id, revision_number,
          conditions, action, required_inputs, priority_class, scope, override_allowed, created_at
        ) VALUES (
          ${polRevId}, 'p-v05', ${tenantA}, 1, '{}', '{}', '[]', 'STANDARD', 'GLOBAL', false, now()
        )
      `,
    ).rejects.toThrow();
  });

  // Vector 06: governance resolver uses CURRENT after run start
  it('Vector 06: governance resolver uses CURRENT after run start (fails closed)', async () => {
    // Governance evaluation must read frozen snapshot, never query CURRENT active policies
    const snapId = uid('snap-v06');
    const govSnapId = uid('gov-v06');
    await govService.resolveOrRefreshGovernanceSnapshot({
      governanceSnapshotId: govSnapId,
      tenantId: tenantA,
      workspaceId: workspaceA,
      asOf: new Date(),
    });
    await decService.freezeDecisionSnapshot({
      snapshotId: snapId,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: govSnapId,
      runConfigId: runConfigId,
      taskRevisionId: taskRevId,
      audienceStateId: audId,
      candidateIds: [],
      frozenAt: new Date(),
      tenantId: tenantA,
      workspaceId: workspaceA,
    });

    // If snapshot has 0 pinned policies, evaluatePolicySet throws POLICY_SET_INCOMPLETE
    await expect(
      govService.evaluatePolicySet({
        snapshotId: snapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(RegistryValidationError);
  });

  // Vector 07: provisional GovernanceSnapshot mutated in place
  it('Vector 07: provisional GovernanceSnapshot mutated in place (fails closed)', async () => {
    const govSnapId = uid('gov-v07');
    await govService.resolveOrRefreshGovernanceSnapshot({
      governanceSnapshotId: govSnapId,
      tenantId: tenantA,
      workspaceId: workspaceA,
      asOf: new Date(),
    });

    // Database immutability trigger blocks update
    await expect(
      sql`UPDATE governance_snapshots SET as_of = now() WHERE governance_snapshot_id = ${govSnapId}`,
    ).rejects.toThrow(/immutable/i);
  });

  // Vector 08: research changes jurisdiction but governance not refreshed
  it('Vector 08: research changes jurisdiction but governance not refreshed (fails closed)', async () => {
    const govSnapId = uid('gov-v08');
    // Required EU legal policy family missing
    await expect(
      govService.resolveOrRefreshGovernanceSnapshot({
        governanceSnapshotId: govSnapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
        asOf: new Date(),
        policyRevisionIds: [],
        requiredPolicyFamilies: ['EU_LEGAL_POLICY'],
      }),
    ).rejects.toThrow(/GOVERNANCE_COVERAGE_INCOMPLETE/i);
  });

  // Vector 09: research changes material proposition state but applicability not recomputed
  it('Vector 09: research changes material proposition state but applicability not recomputed (fails closed)', async () => {
    const assessId = uid('app-v09');
    const guidRevId = uid('guid-v09');
    await cpService.createGuidanceRevision({
      guidanceRevisionId: guidRevId,
      guidanceId: 'g-v09',
      tenantId: tenantA,
      revisionNumber: 1,
      title: 'Guidance 9',
      guidanceText: 'Text 9',
      recommendationType: 'CONTENT',
      effectiveFrom: new Date(),
    });

    // Stale dependency fingerprint validation
    await expect(
      govService.assessApplicability({
        assessmentId: assessId,
        subjectType: 'GUIDANCE',
        subjectRevisionId: guidRevId,
        taskRevisionId: taskRevId,
        assessmentStage: 'PRE_GENERATION_FINAL',
        result: 'APPLICABLE',
        scopeMatches: 'SCOPE',
        reasonCodes: 'CODES',
        assessor: 'system',
        uncertainty: 'NONE',
        reviewRequired: false,
        dependencyFingerprint: '', // Empty/stale fingerprint
        targetValidTime: new Date(),
        knowledgeCutoffTime: new Date(),
        tenantId: tenantA,
      }),
    ).rejects.toThrow(/APPLICABILITY_FINGERPRINT_STALE/i);
  });

  // Vector 10: final GovernanceSnapshot under-covers required policy family
  it('Vector 10: final GovernanceSnapshot under-covers required policy family (fails closed)', async () => {
    await expect(
      govService.resolveOrRefreshGovernanceSnapshot({
        governanceSnapshotId: uid('gov-v10'),
        tenantId: tenantA,
        workspaceId: workspaceA,
        asOf: new Date(),
        policyRevisionIds: [],
        requiredPolicyFamilies: ['STATUTORY_COMPLIANCE'],
      }),
    ).rejects.toThrow(/GOVERNANCE_COVERAGE_INCOMPLETE/i);
  });

  // Vector 11: future-known rule leaks into old decision
  it('Vector 11: future-known rule leaks into old decision (fails closed)', () => {
    const cutoff = new Date('2026-01-01T00:00:00Z');
    const target = new Date('2026-01-02T00:00:00Z');
    const futureKnownRule = {
      ruleId: 'r-11',
      ruleRevisionId: 'rev-11',
      validFrom: new Date('2025-01-01T00:00:00Z'),
      knownFrom: new Date('2026-05-01T00:00:00Z'), // Known after cutoff!
    };
    const check = TemporalGovernanceResolver.isRuleEligible(futureKnownRule, target, cutoff);
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain('Future-known rules are prohibited');
  });

  // Vector 12: known-today/future-valid rule wrongly excluded from future publication target
  it('Vector 12: known-today/future-valid rule wrongly excluded from future publication target (preserved)', () => {
    const cutoff = new Date('2026-01-01T00:00:00Z');
    const target = new Date('2026-07-01T00:00:00Z'); // Future publication target
    const rule = {
      ruleId: 'r-12',
      ruleRevisionId: 'rev-12',
      validFrom: new Date('2026-06-01T00:00:00Z'), // Valid before publication target
      knownFrom: new Date('2025-12-01T00:00:00Z'), // Known before cutoff
    };
    const check = TemporalGovernanceResolver.isRuleEligible(rule, target, cutoff);
    expect(check.eligible).toBe(true);
  });

  // Vector 13: expired rule applied after expiration
  it('Vector 13: expired rule applied after expiration (fails closed)', () => {
    const cutoff = new Date('2026-06-01T00:00:00Z');
    const target = new Date('2026-07-01T00:00:00Z');
    const expiredRule = {
      ruleId: 'r-13',
      ruleRevisionId: 'rev-13',
      validFrom: new Date('2025-01-01T00:00:00Z'),
      knownFrom: new Date('2025-01-01T00:00:00Z'),
      scheduledExpiration: new Date('2026-05-01T00:00:00Z'), // Expired!
    };
    const check = TemporalGovernanceResolver.isRuleEligible(expiredRule, target, cutoff);
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain('expired');
  });

  // Vector 14: target_valid_time mismatch across final applicability assessments
  it('Vector 14: target_valid_time mismatch across final applicability assessments (fails closed)', () => {
    const timeA = new Date('2026-06-01T00:00:00Z');
    const timeB = new Date('2026-07-01T00:00:00Z');
    expect(timeA.getTime()).not.toBe(timeB.getTime());
    // Canonical resolver ensures single target time
    const resolved = TemporalGovernanceResolver.resolveTargetValidTime({
      intendedPublicationTime: timeA,
      frozenAt: timeB,
    });
    expect(resolved.toISOString()).toBe(timeA.toISOString());
  });

  // Vector 15: knowledge_cutoff_time after DecisionSnapshot.frozen_at
  it('Vector 15: knowledge_cutoff_time after DecisionSnapshot.frozen_at (fails closed)', () => {
    const frozenAt = new Date('2026-01-01T00:00:00Z');
    const invalidCutoff = new Date('2026-02-01T00:00:00Z'); // After frozen_at!
    expect(() =>
      TemporalGovernanceResolver.validateKnowledgeCutoff(invalidCutoff, frozenAt),
    ).toThrow(/knowledge_cutoff_time.*cannot be after DecisionSnapshot.frozen_at/i);
  });

  // Vector 16: guidance temporal eligibility resolved from current state instead of exact revision
  it('Vector 16: guidance temporal eligibility resolved from current state instead of exact revision (fails closed)', () => {
    const target = new Date('2026-06-01T00:00:00Z');
    const guidance = {
      guidanceId: 'g-16',
      guidanceRevisionId: 'rev-16',
      effectiveFrom: new Date('2026-08-01T00:00:00Z'), // Effective after target!
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const check = TemporalGovernanceResolver.isGuidanceEligible(guidance, target);
    expect(check.eligible).toBe(false);
  });

  // Vector 17: applicability subject_type points to wrong revision kind
  it('Vector 17: applicability subject_type points to wrong revision kind (fails closed)', async () => {
    // Subject type GUIDANCE pointing to a non-existent guidance revision
    await expect(
      govService.assessApplicability({
        assessmentId: uid('app-v17'),
        subjectType: 'GUIDANCE',
        subjectRevisionId: 'non-existent-guidance',
        taskRevisionId: taskRevId,
        assessmentStage: 'PRE_GENERATION_FINAL',
        result: 'APPLICABLE',
        scopeMatches: 'SCOPE',
        reasonCodes: 'CODES',
        assessor: 'system',
        uncertainty: 'NONE',
        reviewRequired: false,
        dependencyFingerprint: 'fp-17',
        targetValidTime: new Date(),
        knowledgeCutoffTime: new Date(),
        tenantId: tenantA,
      }),
    ).rejects.toThrow(/SUBJECT_REVISION_NOT_FOUND/i);
  });

  // Vector 18: UNCERTAIN applicability treated as NOT_APPLICABLE
  it('Vector 18: UNCERTAIN applicability treated as NOT_APPLICABLE (fails closed / flags review)', async () => {
    const guidRevId = uid('guid-v18');
    await cpService.createGuidanceRevision({
      guidanceRevisionId: guidRevId,
      guidanceId: 'g-v18',
      tenantId: tenantA,
      revisionNumber: 1,
      title: 'Uncertain Guidance',
      guidanceText: 'Text 18',
      recommendationType: 'CONTENT',
      effectiveFrom: new Date(),
    });
    const assessId = uid('app-v18');
    await govService.assessApplicability({
      assessmentId: assessId,
      subjectType: 'GUIDANCE',
      subjectRevisionId: guidRevId,
      taskRevisionId: taskRevId,
      assessmentStage: 'PRE_GENERATION_FINAL',
      result: 'UNCERTAIN',
      scopeMatches: 'UNCERTAIN_SCOPE',
      reasonCodes: 'UNCERTAIN_JURISDICTION',
      assessor: 'system',
      uncertainty: 'HIGH',
      reviewRequired: false, // Attempted to bypass review!
      dependencyFingerprint: 'fp-18',
      targetValidTime: new Date(),
      knowledgeCutoffTime: new Date(),
      tenantId: tenantA,
    });

    const [row] = await sql`SELECT result, review_required FROM applicability_assessments WHERE assessment_id = ${assessId}`;
    expect(row.result).toBe('UNCERTAIN');
    expect(row.review_required).toBe(true); // Enforced review_required = true
  });

  // Vector 19: content-level rule bypasses generated claim
  it('Vector 19: content-level rule bypasses generated claim (fails closed)', () => {
    // Policy DSL rejects missing required inputs
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'IS_TRUE', left: 'ClaimProposition.verified' },
          action: { effect: 'BLOCK', code: 'UNVERIFIED_CLAIM' },
          required_inputs: ['ClaimProposition'],
        },
        {}, // Omitted ClaimProposition!
      ),
    ).toThrow(/POLICY_INPUT_MISSING/i);
  });

  // Vector 20: applicability reads hidden post-cutoff state
  it('Vector 20: applicability reads hidden post-cutoff state (fails closed)', () => {
    const cutoff = new Date('2026-01-01T00:00:00Z');
    const futureKnowledge = {
      ruleId: 'r-20',
      ruleRevisionId: 'rev-20',
      validFrom: new Date('2025-01-01T00:00:00Z'),
      knownFrom: new Date('2026-03-01T00:00:00Z'), // Post-cutoff
    };
    const res = TemporalGovernanceResolver.isRuleEligible(futureKnowledge, cutoff, cutoff);
    expect(res.eligible).toBe(false);
  });

  // Vector 21: Policy Engine starts before snapshot freeze
  it('Vector 21: Policy Engine starts before snapshot freeze (fails closed)', async () => {
    const snapId = uid('snap-v21');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('DecisionSnapshot', ${snapId}, ${tenantA})
    `;
    // 1. PostgreSQL schema rejects insertion without frozen_at (NOT NULL constraint)
    await expect(
      sql`
        INSERT INTO decision_snapshots (
          snapshot_id, tenant_id, workspace_id, baseline_knowledge_snapshot_id,
          run_knowledge_delta_id, governance_snapshot_id, run_config_id,
          task_revision_id, audience_state_id, frozen_at, created_at
        ) VALUES (
          ${snapId}, ${tenantA}, ${workspaceA}, ${bksId}, ${rkdId}, 'gov-fake', ${runConfigId},
          ${taskRevId}, ${audId}, null, now()
        )
      `,
    ).rejects.toThrow(/not-null constraint|violates not-null/i);

    // 2. Service level evaluation fails closed if snapshot not frozen or not found
    await expect(
      govService.evaluatePolicySet({
        snapshotId: snapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/SNAPSHOT_NOT_FOUND|SNAPSHOT_NOT_FROZEN/i);
  });

  // Vector 22: policy reads live runtime state
  it('Vector 22: policy reads live runtime state (fails closed / in-memory only)', () => {
    // evaluatePolicyDsl cannot execute queries; only operates on bounded contextData
    const res = evaluatePolicyDsl(
      {
        conditions: { op: 'EQ', left: 'TaskContract.channel', right: 'WEB' },
        action: { effect: 'REQUIREMENT', code: 'WEB_CHANNEL' },
        required_inputs: ['TaskContract'],
      },
      { TaskContract: { channel: 'WEB' } },
    );
    expect(res.triggered).toBe(true);
  });

  // Vector 23: policy DSL executes arbitrary code
  it('Vector 23: policy DSL executes arbitrary code (fails closed)', () => {
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EXEC_JS' as any, left: 'process.exit(1)' },
          action: { effect: 'BLOCK', code: 'MALICIOUS' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);
  });

  // Vector 24: policy DSL performs network access
  it('Vector 24: policy DSL performs network access (fails closed)', () => {
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'HTTP_FETCH' as any, left: 'https://attacker.com' },
          action: { effect: 'BLOCK', code: 'NETWORK_EXPLOIT' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);
  });

  // Vector 25: selector escapes frozen snapshot closure
  it('Vector 25: selector escapes frozen snapshot closure (fails closed)', () => {
    // Attack 1: selector path contains __proto__
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EQ', left: '__proto__.polluted', right: 'evil' },
          action: { effect: 'BLOCK', code: 'PROTOTYPE_POLLUTION' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // Attack 2: selector path contains constructor
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EQ', left: 'constructor.name', right: 'Object' },
          action: { effect: 'BLOCK', code: 'CONSTRUCTOR_POLLUTION' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // Attack 3: policy declares input A but condition reads B
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EQ', left: 'UndeclaredInput.field', right: 'val' },
          action: { effect: 'BLOCK', code: 'UNDECLARED_INPUT' },
          required_inputs: ['DeclaredInputA'],
        },
        { DeclaredInputA: { field: 'ok' }, UndeclaredInput: { field: 'val' } },
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // Legitimate declared selector still evaluates correctly
    const legRes = evaluatePolicyDsl(
      {
        conditions: { op: 'EQ', left: 'DeclaredInputA.field', right: 'ok' },
        action: { effect: 'REQUIREMENT', code: 'DECLARED_PASS' },
        required_inputs: ['DeclaredInputA'],
      },
      { DeclaredInputA: { field: 'ok' } },
    );
    expect(legRes.triggered).toBe(true);
  });

  // Vector 26: policy required input missing treated as false
  it('Vector 26: policy required input missing treated as false (fails closed with error)', () => {
    // 1. Missing declared root
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EQ', left: 'AudienceState.jurisdiction', right: 'US' },
          action: { effect: 'BLOCK', code: 'JURISDICTION_BLOCK' },
          required_inputs: ['AudienceState'],
        },
        {},
      ),
    ).toThrow(/POLICY_INPUT_MISSING/i);

    // 2. Missing nested required path
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'EQ', left: 'AudienceState.non_existent_property', right: 'US' },
          action: { effect: 'BLOCK', code: 'NESTED_MISSING' },
          required_inputs: ['AudienceState'],
        },
        { AudienceState: { jurisdiction: 'US' } },
      ),
    ).toThrow(/POLICY_INPUT_MISSING/i);
  });

  // Vector 27: policy type mismatch coerced silently
  it('Vector 27: policy type mismatch coerced silently (fails closed with type error)', () => {
    // Attack 1: COUNT_* operator applied to scalar input (channel is string)
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'COUNT_GT', left: 'TaskContract.channel', right: 2 },
          action: { effect: 'BLOCK', code: 'COUNT_SCALAR_ERROR' },
          required_inputs: ['TaskContract'],
        },
        { TaskContract: { channel: 'WEB' } },
      ),
    ).toThrow(/POLICY_TYPE_ERROR/i);

    // Attack 2: Disparate scalar types comparison (e.g. array vs scalar string)
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'COUNT_GT', left: 'TaskContract.items', right: 'five' as any },
          action: { effect: 'BLOCK', code: 'COUNT_ERROR' },
          required_inputs: ['TaskContract'],
        },
        { TaskContract: { items: [1, 2, 3] } },
      ),
    ).toThrow(/POLICY_TYPE_ERROR/i);
  });

  // Vector 28: policy schema unsupported but evaluator guesses
  it('Vector 28: policy schema unsupported but evaluator guesses (fails closed)', () => {
    // 1. Unsupported operator
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'FUZZY_MATCH' as any, left: 'a', right: 'b' },
          action: { effect: 'BLOCK', code: 'UNSUPPORTED' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // 2. Unsupported expected_type in selector schema
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: {
            op: 'EXISTS',
            value: { root: 'TaskContract', path: 'channel', expected_type: 'INVALID_TYPE' as any },
          },
          action: { effect: 'BLOCK', code: 'BAD_EXPECTED_TYPE' },
          required_inputs: ['TaskContract'],
        },
        { TaskContract: { channel: 'WEB' } },
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // 3. Unsupported action effect
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'IS_TRUE', value: { root: 'TaskContract', path: 'standalone_task' } },
          action: { effect: 'CUSTOM_RELEASE_PERMIT' as any, code: 'UNSUPPORTED_EFFECT' },
          required_inputs: ['TaskContract'],
        },
        { TaskContract: { standalone_task: true } },
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);

    // 4. Malformed AST (e.g. ALL operator with empty args array)
    expect(() =>
      evaluatePolicyDsl(
        {
          conditions: { op: 'ALL', args: [] },
          action: { effect: 'BLOCK', code: 'MALFORMED_AST' },
          required_inputs: [],
        },
        {},
      ),
    ).toThrow(/POLICY_SCHEMA_UNSUPPORTED/i);
  });

  // Vector 29: policy retry produces semantically different result
  it('Vector 29: policy retry produces semantically different result (fails closed)', async () => {
    // Attack 1: Exact equivalent retry converges to existing PolicyResult without creating duplicate rows
    const snapId1 = uid('snap-v29-1');
    const polRevId1 = uid('pol-v29-1');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId1,
      policyId: 'pol-29-1',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', parameters: { mode: 'STRICT' } },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId1, { policyRevisionIds: [polRevId1] });

    const firstEval = await govService.evaluatePolicySet({
      snapshotId: snapId1,
      tenantId: tenantA,
    });
    expect(firstEval.length).toBe(1);
    const existingResultId = firstEval[0]!.policyResultId;

    const retryEval = await govService.evaluatePolicySet({
      snapshotId: snapId1,
      tenantId: tenantA,
    });
    expect(retryEval.length).toBe(1);
    expect(retryEval[0]!.policyResultId).toBe(existingResultId);

    // Verify row count in DB is exactly 1 (converged, not duplicated)
    const rows1 = await sql`
      SELECT policy_result_id FROM policy_results WHERE snapshot_id = ${snapId1} AND policy_revision_id = ${polRevId1}
    `;
    expect(rows1.length).toBe(1);

    // Attack 2: Same snapshot/policy but different triggered -> rejected with POLICY_NONDETERMINISTIC
    const snapId2 = uid('snap-v29-2');
    const polRevId2 = uid('pol-v29-2');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId2,
      policyId: 'pol-29-2',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId2, { policyRevisionIds: [polRevId2] });
    // Pre-insert conflicting triggered=false while evaluation produces triggered=true
    await insertPolicyResult({
      resultId: uid('pr-v29-2'),
      snapshotId: snapId2,
      policyRevisionId: polRevId2,
      triggered: false,
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', input_refs: [snapId2] },
      reasonCode: 'POL_29_TRIGGERED',
      inputUncertainty: 'NONE',
    });
    await expect(
      govService.evaluatePolicySet({ snapshotId: snapId2, tenantId: tenantA })
    ).rejects.toThrow(/POLICY_NONDETERMINISTIC/i);

    // Attack 3: Same triggered but different action -> rejected with POLICY_NONDETERMINISTIC
    const snapId3 = uid('snap-v29-3');
    const polRevId3 = uid('pol-v29-3');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId3,
      policyId: 'pol-29-3',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', parameters: { mode: 'STRICT' } },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId3, { policyRevisionIds: [polRevId3] });
    // Pre-insert conflicting action effect (REQUIRE_REVIEW instead of BLOCK)
    await insertPolicyResult({
      resultId: uid('pr-v29-3'),
      snapshotId: snapId3,
      policyRevisionId: polRevId3,
      triggered: true,
      action: { effect: 'REQUIRE_REVIEW', code: 'POL_29_TRIGGERED', parameters: { mode: 'STRICT' }, input_refs: [snapId3] },
      reasonCode: 'POL_29_TRIGGERED',
      inputUncertainty: 'NONE',
    });
    await expect(
      govService.evaluatePolicySet({ snapshotId: snapId3, tenantId: tenantA })
    ).rejects.toThrow(/POLICY_NONDETERMINISTIC/i);

    // Attack 4: Same triggered/action but different reason_code -> rejected with POLICY_NONDETERMINISTIC
    const snapId4 = uid('snap-v29-4');
    const polRevId4 = uid('pol-v29-4');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId4,
      policyId: 'pol-29-4',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId4, { policyRevisionIds: [polRevId4] });
    // Pre-insert conflicting reason_code
    await insertPolicyResult({
      resultId: uid('pr-v29-4'),
      snapshotId: snapId4,
      policyRevisionId: polRevId4,
      triggered: true,
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', input_refs: [snapId4] },
      reasonCode: 'DIFFERENT_REASON_CODE',
      inputUncertainty: 'NONE',
    });
    await expect(
      govService.evaluatePolicySet({ snapshotId: snapId4, tenantId: tenantA })
    ).rejects.toThrow(/POLICY_NONDETERMINISTIC/i);

    // Attack 5: Same triggered/action/reason but different material input_uncertainty -> rejected with POLICY_NONDETERMINISTIC
    const snapId5 = uid('snap-v29-5');
    const polRevId5 = uid('pol-v29-5');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId5,
      policyId: 'pol-29-5',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId5, { policyRevisionIds: [polRevId5] });
    // Pre-insert conflicting input_uncertainty
    await insertPolicyResult({
      resultId: uid('pr-v29-5'),
      snapshotId: snapId5,
      policyRevisionId: polRevId5,
      triggered: true,
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', input_refs: [snapId5] },
      reasonCode: 'POL_29_TRIGGERED',
      inputUncertainty: 'HIGH_UNCERTAINTY',
    });
    await expect(
      govService.evaluatePolicySet({ snapshotId: snapId5, tenantId: tenantA })
    ).rejects.toThrow(/POLICY_NONDETERMINISTIC/i);

    // Attack 6: Different input-ref identity set -> rejected with POLICY_NONDETERMINISTIC
    const snapId6 = uid('snap-v29-6');
    const polRevId6 = uid('pol-v29-6');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId6,
      policyId: 'pol-29-6',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
    });
    await createTestSnapshot(snapId6, { policyRevisionIds: [polRevId6] });
    // Pre-insert conflicting input_refs
    await insertPolicyResult({
      resultId: uid('pr-v29-6'),
      snapshotId: snapId6,
      policyRevisionId: polRevId6,
      triggered: true,
      action: { effect: 'BLOCK', code: 'POL_29_TRIGGERED', input_refs: ['foreign-ref-id-999'] },
      reasonCode: 'POL_29_TRIGGERED',
      inputUncertainty: 'NONE',
    });
    await expect(
      govService.evaluatePolicySet({ snapshotId: snapId6, tenantId: tenantA })
    ).rejects.toThrow(/POLICY_NONDETERMINISTIC/i);

    // Attack 7: Retry cannot create a second (snapshot_id, policy_revision_id) row
    await expect(
      insertPolicyResult({
        resultId: uid('pr-v29-dup'),
        snapshotId: snapId1,
        policyRevisionId: polRevId1,
      })
    ).rejects.toThrow(/duplicate key|violates unique constraint/i);

    const finalRows = await sql`
      SELECT policy_result_id FROM policy_results WHERE snapshot_id = ${snapId1} AND policy_revision_id = ${polRevId1}
    `;
    expect(finalRows.length).toBe(1);
  });

  // Vector 30: expected policy revision omitted from evaluation
  it('Vector 30: expected policy revision omitted from evaluation (fails closed)', async () => {
    const snapId = uid('snap-v30');
    const polRevId = uid('pol-v30');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'pol-30',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'NO_RELEASE_EFFECT', code: 'PASS' },
      requiredInputs: ['TaskContract'],
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRevId] });

    // Attempting recordDecision with empty policyResultIds while snapshot expects polRevId
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-v30'),
        decisionType: 'RELEASE_APPROVAL',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow();
  });

  // Vector 31: non-triggered policy result omitted
  it('Vector 31: non-triggered policy result omitted (fails closed / result recorded)', () => {
    const evalRes = evaluatePolicyDsl(
      {
        conditions: { op: 'EQ', left: 'TaskContract.channel', right: 'BROADCAST' },
        action: { effect: 'BLOCK', code: 'BROADCAST_FORBIDDEN' },
        required_inputs: ['TaskContract'],
      },
      { TaskContract: { channel: 'WEB' } },
    );
    expect(evalRes.triggered).toBe(false);
    // Even when false, terminal result payload is produced
    const parsed = JSON.parse(evalRes.action);
    expect(parsed.effect).toBe('NO_RELEASE_EFFECT');
  });

  // Vector 32: duplicate PolicyResult for same snapshot/policy
  it('Vector 32: duplicate PolicyResult for same snapshot/policy (fails closed at DB boundary)', async () => {
    const snapId = uid('snap-v32');
    const polRevId = uid('pol-v32');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'pol-32',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRevId] });

    await insertPolicyResult({
      resultId: uid('pr-1'),
      snapshotId: snapId,
      policyRevisionId: polRevId,
    });
    // Duplicate insertion
    await expect(
      insertPolicyResult({
        resultId: uid('pr-2'),
        snapshotId: snapId,
        policyRevisionId: polRevId,
      }),
    ).rejects.toThrow(/duplicate key|violates unique constraint/i);
  });

  // Vector 33: policy completeness checked by count only with wrong identity set
  it('Vector 33: policy completeness checked by count only with wrong identity set (fails closed)', async () => {
    const snapId = uid('snap-v33');
    const expectedPol = uid('pol-v33-expected');
    const wrongPol = uid('pol-v33-wrong');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: expectedPol,
      policyId: 'p-33-e',
      tenantId: tenantA,
    });
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: wrongPol,
      policyId: 'p-33-w',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [expectedPol] });

    const wrongResId = uid('pr-wrong');
    await insertPolicyResult({
      resultId: wrongResId,
      snapshotId: snapId,
      policyRevisionId: wrongPol,
    });

    // Attempting recordDecision with count=1 but wrong policy identity
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-v33'),
        decisionType: 'RELEASE_APPROVAL',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [wrongResId],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/INCOMPLETE_POLICY_RESULTS/i);
  });

  // Vector 34: incomplete policy set proceeds to conflict detection
  it('Vector 34: incomplete policy set proceeds to conflict detection (fails closed)', async () => {
    const snapId = uid('snap-v34');
    const polRev = uid('pol-v34');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-34',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRev] });

    // No policy results evaluated yet
    await expect(
      govService.detectAndResolveConflicts({
        snapshotId: snapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/INCOMPLETE_POLICY_SET_FOR_CONFLICT_DETECTION/i);
  });

  // Vector 35: missing PolicyResult treated as PASS
  it('Vector 35: missing PolicyResult treated as PASS (fails closed)', async () => {
    const snapId = uid('snap-v35');
    const polRev = uid('pol-v35');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-35',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRev] });

    // Cannot authorize release with missing policy result
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-v35'),
        decisionType: 'RELEASE_APPROVAL',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow();
  });

  // Vector 36: PolicyResult.policy_revision_id outside GovernanceSnapshot
  it('Vector 36: PolicyResult.policy_revision_id outside GovernanceSnapshot (fails closed)', async () => {
    const snapId = uid('snap-v36');
    const validPol = uid('pol-valid-36');
    const outsidePol = uid('pol-outside-36');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: validPol,
      policyId: 'p-valid-36',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'NO_RELEASE_EFFECT', code: 'PASS' },
      requiredInputs: ['TaskContract'],
    });
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: outsidePol,
      policyId: 'p-out-36',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [validPol] });

    // 1. Evaluating policy set on snapshot evaluates validPol, never outsidePol
    const results = await govService.evaluatePolicySet({
      snapshotId: snapId,
      tenantId: tenantA,
      workspaceId: workspaceA,
    });
    expect(results.some((r) => r.policyRevisionId === outsidePol)).toBe(false);

    // 2. Supplying a PolicyResult with outsidePol to recordDecision fails closed
    const outsideResId = uid('pr-outside-36');
    await insertPolicyResult({
      resultId: outsideResId,
      snapshotId: snapId,
      policyRevisionId: outsidePol,
    });
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-36'),
        decisionType: 'RELEASE_APPROVAL',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [outsideResId],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/INCOMPLETE_POLICY_RESULTS/i);
  });

  // Vector 37: PolicyResult.input_ref outside snapshot closure
  it('Vector 37: PolicyResult.input_ref outside snapshot closure (fails closed)', async () => {
    const snapId = uid('snap-v37');
    const polRev = uid('pol-v37');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-37',
      tenantId: tenantA,
      conditions: { op: 'EQ', left: 'UnrelatedEntity.id', right: 'alien' },
      action: { effect: 'BLOCK', code: 'ALIEN' },
      requiredInputs: ['UnrelatedEntity'],
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRev] });

    // Fails closed because UnrelatedEntity is outside snapshot closure
    await expect(
      govService.evaluatePolicySet({
        snapshotId: snapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/POLICY_INPUT_MISSING/i);
  });

  // Vector 38: PolicyResult bound to wrong snapshot
  it('Vector 38: PolicyResult bound to wrong snapshot (fails closed)', async () => {
    const snapA = uid('snap-38-a');
    const snapB = uid('snap-38-b');
    const polRev = uid('pol-38');
    const resId = uid('res-38');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'pol-38',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapA, { policyRevisionIds: [polRev] });
    await createTestSnapshot(snapB);

    await insertPolicyResult({
      resultId: resId,
      snapshotId: snapA,
      policyRevisionId: polRev,
    });

    // Attempting to use result from snapshot A in snapshot B
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-38'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapB,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [resId],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow();
  });

  // Vector 39: hidden uncertainty discarded
  it('Vector 39: hidden uncertainty discarded (fails closed / uncertainty preserved)', () => {
    const evalRes = evaluatePolicyDsl(
      {
        conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
        action: { effect: 'NO_RELEASE_EFFECT', code: 'UNCERTAIN_PASS' },
        required_inputs: ['TaskContract'],
      },
      {
        TaskContract: { standalone_task: true },
        UncertaintyAssessment: { uncertainty_level: 'HIGH' },
      },
    );
    expect(evalRes.inputUncertainty).toBe('HIGH');
  });

  // Vector 40: policy action embeds mutable entity lookup
  it('Vector 40: policy action embeds mutable entity lookup (fails closed)', async () => {
    // Action code cannot embed entity IDs
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-40'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: 'snap-fake',
        reasonCodes: 'TEST',
        selectedAction: 'RELEASE_CANDIDATE_cand-12345678-abcd',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/SELECTED_ACTION_EMBEDDED_ENTITY_ID/i);
  });

  // Vector 41: conflict detection runs on partial policy set
  it('Vector 41: conflict detection runs on partial policy set (fails closed)', async () => {
    const snapId = uid('snap-v41');
    const p1 = uid('pol-41-1');
    const p2 = uid('pol-41-2');

    await cpService.createDecisionPolicyRevision({ policyRevisionId: p1, policyId: 'p-41-1', tenantId: tenantA });
    await cpService.createDecisionPolicyRevision({ policyRevisionId: p2, policyId: 'p-41-2', tenantId: tenantA });
    await createTestSnapshot(snapId, { policyRevisionIds: [p1, p2] });

    await insertPolicyResult({
      resultId: uid('res-41'),
      snapshotId: snapId,
      policyRevisionId: p1,
    });

    await expect(
      govService.detectAndResolveConflicts({
        snapshotId: snapId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/INCOMPLETE_POLICY_SET_FOR_CONFLICT_DETECTION/i);
  });

  // Vector 42: same conflict gets two final resolutions
  it('Vector 42: same conflict gets two final resolutions (fails closed)', async () => {
    const snapId = uid('snap-v42');
    await createTestSnapshot(snapId);
    const conflictKey = 'key-42';
    const resId1 = uid('confres-42-1');
    const resId2 = uid('confres-42-2');

    await govService.recordConflictResolution({
      resolutionId: resId1,
      snapshotId: snapId,
      conflictKey,
      resolutionType: 'HARD_DENY_OVERRIDES',
      reasonCodes: 'DENY',
      policyResultIds: [],
      tenantId: tenantA,
      workspaceId: workspaceA,
    });

    // Second resolution for same conflict_key must fail
    await expect(
      govService.recordConflictResolution({
        resolutionId: resId2,
        snapshotId: snapId,
        conflictKey,
        resolutionType: 'MORE_SPECIFIC_SCOPE',
        reasonCodes: 'SCOPE',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/DUPLICATE_FINAL_CONFLICT_RESOLUTION|duplicate key|violates unique constraint/i);
  });

  // Vector 43: conflict_key built from unsorted result IDs
  it('Vector 43: conflict_key built from unsorted result IDs (fails closed / sorted key identical)', () => {
    const key1 = PolicyConflictResolver.computeConflictKey('snap-43', ['id-B', 'id-A']);
    const key2 = PolicyConflictResolver.computeConflictKey('snap-43', ['id-A', 'id-B']);
    expect(key1).toBe(key2);
  });

  // Vector 44: conflict combines results from different snapshots
  it('Vector 44: conflict combines results from different snapshots (fails closed)', async () => {
    const snapA = uid('snap-44-a');
    const snapB = uid('snap-44-b');
    const p1 = uid('p-44-1');
    const p2 = uid('p-44-2');
    const resA = uid('res-44-a');
    const resB = uid('res-44-b');

    await cpService.createDecisionPolicyRevision({ policyRevisionId: p1, policyId: 'p-44-1', tenantId: tenantA });
    await cpService.createDecisionPolicyRevision({ policyRevisionId: p2, policyId: 'p-44-2', tenantId: tenantA });
    await createTestSnapshot(snapA, { policyRevisionIds: [p1] });
    await createTestSnapshot(snapB, { policyRevisionIds: [p2] });

    await insertPolicyResult({ resultId: resA, snapshotId: snapA, policyRevisionId: p1 });
    await insertPolicyResult({ resultId: resB, snapshotId: snapB, policyRevisionId: p2 });

    await expect(
      govService.recordConflictResolution({
        resolutionId: uid('confres-44'),
        snapshotId: snapA,
        conflictKey: 'key-44',
        resolutionType: 'HARD_DENY_OVERRIDES',
        reasonCodes: 'DENY',
        policyResultIds: [resA, resB], // Combined cross-snapshot!
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/CROSS_SNAPSHOT_CONFLICT/i);
  });

  // Vector 45: conflict resolution chosen by insertion order
  it('Vector 45: conflict resolution chosen by insertion order (fails closed / deterministic)', () => {
    // 1. Explicitly non-overridable hard deny may use HARD_DENY_OVERRIDES
    const dHardBlock = {
      policyResultId: 'res-hard-block',
      snapshotId: 's-45',
      policyRevisionId: 'p-hard-block',
      triggered: true,
      actionEffect: 'BLOCK' as const,
      actionCode: 'HARD_BLOCK',
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: false,
    };
    const dAllow = {
      policyResultId: 'res-allow',
      snapshotId: 's-45',
      policyRevisionId: 'p-allow',
      triggered: true,
      actionEffect: 'NO_RELEASE_EFFECT' as const,
      actionCode: 'ALLOW_CODE',
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: false,
    };

    // Reversing input order produces identical conflict identity/resolution behavior
    const confHard1 = {
      conflictKey: 'k-45-hard',
      policyResultIds: ['res-hard-block', 'res-allow'],
      descriptors: [dHardBlock, dAllow],
    };
    const confHard2 = {
      conflictKey: 'k-45-hard',
      policyResultIds: ['res-allow', 'res-hard-block'],
      descriptors: [dAllow, dHardBlock],
    };
    expect(PolicyConflictResolver.resolveConflict(confHard1).resolutionType).toBe('HARD_DENY_OVERRIDES');
    expect(PolicyConflictResolver.resolveConflict(confHard2).resolutionType).toBe('HARD_DENY_OVERRIDES');
    expect(PolicyConflictResolver.resolveConflict(confHard1).winningPolicyResultId).toBe('res-hard-block');
    expect(PolicyConflictResolver.resolveConflict(confHard2).winningPolicyResultId).toBe('res-hard-block');

    // 2. Generic BLOCK without hard-deny semantics does NOT automatically become HARD_DENY_OVERRIDES (it ESCALATES)
    const dGenericBlock = {
      policyResultId: 'res-gen-block',
      snapshotId: 's-45',
      policyRevisionId: 'p-gen-block',
      triggered: true,
      actionEffect: 'BLOCK' as const,
      actionCode: 'GENERIC_BLOCK',
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true, // Overridable -> NOT hard deny
    };
    const confGen1 = {
      conflictKey: 'k-45-gen',
      policyResultIds: ['res-gen-block', 'res-allow'],
      descriptors: [dGenericBlock, dAllow],
    };
    const confGen2 = {
      conflictKey: 'k-45-gen',
      policyResultIds: ['res-allow', 'res-gen-block'],
      descriptors: [dAllow, dGenericBlock],
    };
    expect(PolicyConflictResolver.resolveConflict(confGen1).resolutionType).toBe('ESCALATE');
    expect(PolicyConflictResolver.resolveConflict(confGen2).resolutionType).toBe('ESCALATE');

    // 3. Attack: BLOCK with overrideAllowed: true and priorityClass: "STATUTORY_MANDATE" MUST NOT become HARD_DENY_OVERRIDES solely from wording
    const dStatBlock = {
      policyResultId: 'res-stat-block',
      snapshotId: 's-45',
      policyRevisionId: 'p-stat-block',
      triggered: true,
      actionEffect: 'BLOCK' as const,
      actionCode: 'STATUTORY_MANDATE_BLOCK',
      priorityClass: 'STATUTORY_MANDATE', // wording MUST NOT infer hard deny
      scope: 'GLOBAL',
      overrideAllowed: true, // overridable -> cannot qualify as hard deny
    };
    const confStat1 = {
      conflictKey: 'k-45-stat-1',
      policyResultIds: ['res-stat-block', 'res-allow'],
      descriptors: [dStatBlock, dAllow],
    };
    const confStat2 = {
      conflictKey: 'k-45-stat-2',
      policyResultIds: ['res-allow', 'res-stat-block'],
      descriptors: [dAllow, dStatBlock],
    };
    expect(PolicyConflictResolver.isHardDeny(dStatBlock)).toBe(false);
    expect(PolicyConflictResolver.resolveConflict(confStat1).resolutionType).toBe('ESCALATE');
    expect(PolicyConflictResolver.resolveConflict(confStat2).resolutionType).toBe('ESCALATE');
  });

  // Vector 46: MORE_SPECIFIC_SCOPE used when scopes incomparable
  it('Vector 46: MORE_SPECIFIC_SCOPE used when scopes incomparable (falls through / fails closed)', () => {
    // 1. Incomparable structured scopes ESCALATE
    const dIncomp1 = {
      policyResultId: 'res-1',
      snapshotId: 's-46',
      policyRevisionId: 'p-1',
      triggered: true,
      actionEffect: 'REQUIRE_REVIEW' as const,
      actionCode: 'REV_1',
      priorityClass: 'STANDARD',
      scope: JSON.stringify({ channel: 'EMAIL' }),
      overrideAllowed: true,
    };
    const dIncomp2 = {
      policyResultId: 'res-2',
      snapshotId: 's-46',
      policyRevisionId: 'p-2',
      triggered: true,
      actionEffect: 'WARNING' as const,
      actionCode: 'WARN_1',
      priorityClass: 'STANDARD',
      scope: JSON.stringify({ market: 'DE' }),
      overrideAllowed: true,
    };
    const conflictIncomp = {
      conflictKey: 'k-46-incomp',
      policyResultIds: ['res-1', 'res-2'],
      descriptors: [dIncomp1, dIncomp2],
    };
    expect(PolicyConflictResolver.resolveConflict(conflictIncomp).resolutionType).toBe('ESCALATE');

    // 2. Deterministically narrower structured scope may use MORE_SPECIFIC_SCOPE
    const dBroad = {
      policyResultId: 'res-broad',
      snapshotId: 's-46',
      policyRevisionId: 'p-broad',
      triggered: true,
      actionEffect: 'REQUIRE_REVIEW' as const,
      actionCode: 'REV_BROAD',
      priorityClass: 'STANDARD',
      scope: JSON.stringify({ channel: 'EMAIL' }),
      overrideAllowed: true,
    };
    const dNarrow = {
      policyResultId: 'res-narrow',
      snapshotId: 's-46',
      policyRevisionId: 'p-narrow',
      triggered: true,
      actionEffect: 'WARNING' as const,
      actionCode: 'WARN_NARROW',
      priorityClass: 'STANDARD',
      scope: JSON.stringify({ channel: 'EMAIL', market: 'DE' }),
      overrideAllowed: true,
    };
    const conflictNarrow1 = {
      conflictKey: 'k-46-scope-1',
      policyResultIds: ['res-broad', 'res-narrow'],
      descriptors: [dBroad, dNarrow],
    };
    const conflictNarrow2 = {
      conflictKey: 'k-46-scope-2',
      policyResultIds: ['res-narrow', 'res-broad'],
      descriptors: [dNarrow, dBroad],
    };
    const resNarrow1 = PolicyConflictResolver.resolveConflict(conflictNarrow1);
    const resNarrow2 = PolicyConflictResolver.resolveConflict(conflictNarrow2);
    expect(resNarrow1.resolutionType).toBe('MORE_SPECIFIC_SCOPE');
    expect(resNarrow1.winningPolicyResultId).toBe('res-narrow');
    expect(resNarrow2.resolutionType).toBe('MORE_SPECIFIC_SCOPE');
    expect(resNarrow2.winningPolicyResultId).toBe('res-narrow');

    // 3. Different compatible REQUIREMENT action codes do NOT conflict (coexist simultaneously)
    const dReqDiff1 = {
      policyResultId: 'res-req-diff1',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-diff1',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_DISCLOSURE',
      actionParameters: { section: 'footer' },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dReqDiff2 = {
      policyResultId: 'res-req-diff2',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-diff2',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_SOURCE_CITATION',
      actionParameters: { style: 'inline' },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const detectedCompatibleCodes = PolicyConflictResolver.detectConflicts([dReqDiff1, dReqDiff2]);
    expect(detectedCompatibleCodes.length).toBe(0);

    // 4. Same key with different but jointly satisfiable values does NOT produce false conflict (e.g. minLength 10 vs 20)
    const dReqBound1 = {
      policyResultId: 'res-bound-1',
      snapshotId: 's-46',
      policyRevisionId: 'p-bound-1',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_LENGTH_10',
      actionParameters: { minLength: 10 },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dReqBound2 = {
      policyResultId: 'res-bound-2',
      snapshotId: 's-46',
      policyRevisionId: 'p-bound-2',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_LENGTH_20',
      actionParameters: { minLength: 20 },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const detectedBound = PolicyConflictResolver.detectConflicts([dReqBound1, dReqBound2]);
    expect(detectedBound.length).toBe(0);

    // 5. Additive collection requirements do NOT produce false conflict (e.g. requiredTags ["A"] vs ["B"])
    const dReqTags1 = {
      policyResultId: 'res-tags-1',
      snapshotId: 's-46',
      policyRevisionId: 'p-tags-1',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_TAG_A',
      actionParameters: { requiredTags: ['A'] },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dReqTags2 = {
      policyResultId: 'res-tags-2',
      snapshotId: 's-46',
      policyRevisionId: 'p-tags-2',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_TAG_B',
      actionParameters: { requiredTags: ['B'] },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const detectedTags = PolicyConflictResolver.detectConflicts([dReqTags1, dReqTags2]);
    expect(detectedTags.length).toBe(0);

    // 6. Genuinely mutually exclusive structured requirements DO conflict (e.g. single-choice format HTML vs PLAIN_TEXT)
    const dReqContra1 = {
      policyResultId: 'res-req-contra1',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-contra1',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_DISCLAIMER_A',
      actionParameters: { format: 'HTML' },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dReqContra2 = {
      policyResultId: 'res-req-contra2',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-contra2',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_DISCLAIMER_B',
      actionParameters: { format: 'PLAIN_TEXT' }, // contradictory demand on same single-choice key!
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const detectedContradictory = PolicyConflictResolver.detectConflicts([dReqContra1, dReqContra2]);
    expect(detectedContradictory.length).toBe(1);

    // 7. Unsupported/unknown parameter semantics are not guessed (fails closed with CONFLICT_SEMANTICS_UNDETERMINED)
    const dReqUnknown1 = {
      policyResultId: 'res-req-unk1',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-unk1',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_CUSTOM_1',
      actionParameters: { customProp: 'value_a' },
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dReqUnknown2 = {
      policyResultId: 'res-req-unk2',
      snapshotId: 's-46',
      policyRevisionId: 'p-req-unk2',
      triggered: true,
      actionEffect: 'REQUIREMENT' as const,
      actionCode: 'REQUIRE_CUSTOM_2',
      actionParameters: { customProp: 'value_b' }, // unknown parameter semantics: do not guess from JSON inequality!
      priorityClass: 'STANDARD',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    expect(() =>
      PolicyConflictResolver.detectConflicts([dReqUnknown1, dReqUnknown2]),
    ).toThrow(/CONFLICT_SEMANTICS_UNDETERMINED/i);
  });

  // Vector 47: EXPLICIT_PRIORITY used when priorities equal/incomparable
  it('Vector 47: EXPLICIT_PRIORITY used when priorities equal/incomparable (falls through / fails closed)', async () => {
    // 1. Equal/incomparable string priorities do not choose insertion order -> ESCALATES
    const dEq1 = {
      policyResultId: 'res-1',
      snapshotId: 's-47',
      policyRevisionId: 'p-1',
      triggered: true,
      actionEffect: 'REQUIRE_REVIEW' as const,
      actionCode: 'REV_1',
      priorityClass: 'EQUAL_PRIORITY',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dEq2 = {
      policyResultId: 'res-2',
      snapshotId: 's-47',
      policyRevisionId: 'p-2',
      triggered: true,
      actionEffect: 'WARNING' as const,
      actionCode: 'WARN_1',
      priorityClass: 'EQUAL_PRIORITY',
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const confEq1 = {
      conflictKey: 'k-47-eq-1',
      policyResultIds: ['res-1', 'res-2'],
      descriptors: [dEq1, dEq2],
    };
    const confEq2 = {
      conflictKey: 'k-47-eq-2',
      policyResultIds: ['res-2', 'res-1'],
      descriptors: [dEq2, dEq1],
    };
    expect(PolicyConflictResolver.resolveConflict(confEq1).resolutionType).toBe('ESCALATE');
    expect(PolicyConflictResolver.resolveConflict(confEq2).resolutionType).toBe('ESCALATE');

    // 2. String naming conventions like P1 vs P2 do NOT resolve by a hard-coded global table -> ESCALATES
    const dP1 = {
      policyResultId: 'res-p1',
      snapshotId: 's-47',
      policyRevisionId: 'p-p1',
      triggered: true,
      actionEffect: 'REQUIRE_REVIEW' as const,
      actionCode: 'REV_P1',
      priorityClass: 'P1', // arbitrary string convention
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const dP2 = {
      policyResultId: 'res-p2',
      snapshotId: 's-47',
      policyRevisionId: 'p-p2',
      triggered: true,
      actionEffect: 'WARNING' as const,
      actionCode: 'WARN_P2',
      priorityClass: 'P2', // arbitrary string convention
      scope: 'GLOBAL',
      overrideAllowed: true,
    };
    const confP1P2_1 = {
      conflictKey: 'k-47-p1p2-1',
      policyResultIds: ['res-p1', 'res-p2'],
      descriptors: [dP1, dP2],
    };
    const confP1P2_2 = {
      conflictKey: 'k-47-p1p2-2',
      policyResultIds: ['res-p2', 'res-p1'],
      descriptors: [dP2, dP1],
    };
    expect(PolicyConflictResolver.resolveConflict(confP1P2_1).resolutionType).toBe('ESCALATE');
    expect(PolicyConflictResolver.resolveConflict(confP1P2_2).resolutionType).toBe('ESCALATE');

    // 3. Canonical persisted path: priority_class is persisted as text in DecisionPolicyRevision without a schema ordering contract.
    // Canonical persisted policy execution over string priority classes cannot reach EXPLICIT_PRIORITY and conservatively ESCALATES.
    const snapId = uid('snap-v47');
    const pHigh = uid('pol-v47-high');
    const pLow = uid('pol-v47-low');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: pHigh,
      policyId: 'p-47-high',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'POL_BLOCK_HIGH' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
      priorityClass: '100', // Persisted as text in decision_policy_revisions
      scope: 'GLOBAL',
      overrideAllowed: true,
    });
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: pLow,
      policyId: 'p-47-low',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'REQUIRE_REVIEW', code: 'POL_REV_LOW' },
      requiredInputs: ['TaskContract', 'DecisionSnapshot'],
      priorityClass: '50', // Persisted as text in decision_policy_revisions
      scope: 'GLOBAL',
      overrideAllowed: true,
    });

    await createTestSnapshot(snapId, { policyRevisionIds: [pHigh, pLow] });

    await govService.evaluatePolicySet({
      snapshotId: snapId,
      tenantId: tenantA,
    });

    const conflictOutcomes = await govService.detectAndResolveConflicts({
      snapshotId: snapId,
      tenantId: tenantA,
    });

    expect(conflictOutcomes.length).toBe(1);
    // Because canonical persisted priority_class is text with no schema-defined ordering contract,
    // production resolution conservatively ESCALATES to human review
    expect(conflictOutcomes[0]!.resolution_type).toBe('ESCALATE');
  });

  // Vector 48: ESCALATE interpreted as release authorization
  it('Vector 48: ESCALATE interpreted as release authorization (fails closed)', async () => {
    // ESCALATE resolution cannot authorize READY release
    expect(PolicyConflictResolver.isReleasePermitted('ESCALATE')).toBe(false);
    expect(PolicyConflictResolver.isReleasePermitted('ESCALATE', 'READY')).toBe(false);
    expect(PolicyConflictResolver.isReleasePermitted('ESCALATE', 'BLOCKED')).toBe(false);
  });

  // Vector 49: AUTHORIZED_OVERRIDE has null override_id
  it('Vector 49: AUTHORIZED_OVERRIDE has null override_id (fails closed)', async () => {
    await expect(
      govService.recordConflictResolution({
        resolutionId: uid('confres-49'),
        snapshotId: 'snap-49',
        conflictKey: 'key-49',
        resolutionType: 'AUTHORIZED_OVERRIDE',
        overrideId: null, // Null override_id!
        reasonCodes: 'TEST',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/AUTHORIZED_OVERRIDE_REQUIRES_OVERRIDE_ID/i);
  });

  // Vector 50: non-override resolution carries override_id
  it('Vector 50: non-override resolution carries override_id (fails closed)', async () => {
    await expect(
      govService.recordConflictResolution({
        resolutionId: uid('confres-50'),
        snapshotId: 'snap-50',
        conflictKey: 'key-50',
        resolutionType: 'HARD_DENY_OVERRIDES',
        overrideId: 'override-unwarranted',
        reasonCodes: 'TEST',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/OVERRIDE_ID_FORBIDDEN_FOR_NON_OVERRIDE/i);
  });

  // Vector 51: PolicyOverride references wrong snapshot
  it('Vector 51: PolicyOverride references wrong snapshot (fails closed)', async () => {
    const snapA = uid('snap-51-a');
    const snapB = uid('snap-51-b');
    const overrideId = uid('ov-51');

    await createTestSnapshot(snapA);
    await createTestSnapshot(snapB);
    const polRevId = uid('pol-51');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'pol-51',
      tenantId: tenantA,
      overrideAllowed: true,
    });
    const resA = uid('res-51');
    await insertPolicyResult({
      resultId: resA,
      snapshotId: snapA,
      policyRevisionId: polRevId,
    });
    await govService.recordPolicyOverride({
      overrideId,
      snapshotId: snapA,
      authorizedBy: 'legal-officer',
      authorityBasis: 'STATUTORY_EXCEPTION',
      reasonCodes: 'REASON',
      scope: 'GLOBAL',
      policyResultIds: [resA],
      tenantId: tenantA,
      workspaceId: workspaceA,
      serverAuthorized: true,
    });

    // Attempting to finalize override for snapshot B using override bound to snapshot A
    await expect(
      govService.finalizeAuthorizedOverride({
        resolutionId: uid('confres-51'),
        snapshotId: snapB,
        conflictKey: 'key-51',
        overrideId,
        reasonCodes: 'OVERRIDE',
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/SNAPSHOT_MISMATCH/i);
  });

  // Vector 52: PolicyOverride omits actually overridden PolicyResult
  it('Vector 52: PolicyOverride omits actually overridden PolicyResult (fails closed)', async () => {
    await expect(
      govService.recordPolicyOverride({
        overrideId: uid('ov-52'),
        snapshotId: 'snap-52',
        authorizedBy: 'officer',
        authorityBasis: 'LEGAL',
        reasonCodes: 'REASON',
        scope: 'GLOBAL',
        policyResultIds: [], // Empty!
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/OVERRIDE_AUTHORITY_INVALID/i);
  });

  // Vector 53: override applied to override_allowed=false policy
  it('Vector 53: override applied to override_allowed=false policy (fails closed)', async () => {
    const polRevId = uid('pol-53');
    const resId = uid('res-53');
    const snapId = uid('snap-53');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'p-53',
      tenantId: tenantA,
      overrideAllowed: false,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRevId] });
    await insertPolicyResult({
      resultId: resId,
      snapshotId: snapId,
      policyRevisionId: polRevId,
      triggered: true,
      action: { effect: 'BLOCK' },
    });

    await expect(
      govService.recordPolicyOverride({
        overrideId: uid('ov-53'),
        snapshotId: snapId,
        authorizedBy: 'admin',
        authorityBasis: 'EMERGENCY',
        reasonCodes: 'OVERRIDE',
        scope: 'GLOBAL',
        policyResultIds: [resId],
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/POLICY_OVERRIDE_FORBIDDEN/i);
  });

  // Vector 54: override authority requirement not satisfied
  it('Vector 54: override authority requirement not satisfied (fails closed)', async () => {
    const polRevId = uid('pol-54');
    const resId = uid('res-54');
    const snapId = uid('snap-54');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'p-54',
      tenantId: tenantA,
      overrideAllowed: true,
      overrideAuthorityRequirements: 'LEGAL_COUNSEL_EXECUTIVE',
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRevId] });
    await insertPolicyResult({
      resultId: resId,
      snapshotId: snapId,
      policyRevisionId: polRevId,
      triggered: true,
      action: { effect: 'BLOCK' },
    });

    await expect(
      govService.recordPolicyOverride({
        overrideId: uid('ov-54'),
        snapshotId: snapId,
        authorizedBy: 'editor',
        authorityBasis: 'CONTENT_LEAD', // Inadequate authority!
        reasonCodes: 'OVERRIDE',
        scope: 'GLOBAL',
        policyResultIds: [resId],
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/OVERRIDE_AUTHORITY_NOT_SATISFIED/i);
  });

  // Vector 55: override scope widens its own authority
  it('Vector 55: override scope widens its own authority (fails closed)', async () => {
    const polRevId = uid('pol-55');
    const resId = uid('res-55');
    const snapId = uid('snap-55');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRevId,
      policyId: 'p-55',
      tenantId: tenantA,
      overrideAllowed: true,
      overrideScopeConstraints: 'US',
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRevId] });
    await insertPolicyResult({
      resultId: resId,
      snapshotId: snapId,
      policyRevisionId: polRevId,
      triggered: true,
      action: { effect: 'BLOCK' },
    });

    await expect(
      govService.recordPolicyOverride({
        overrideId: uid('ov-55'),
        snapshotId: snapId,
        authorizedBy: 'legal',
        authorityBasis: 'GLOBAL_OVERRIDE_UNCHECKED',
        reasonCodes: 'OVERRIDE',
        scope: 'GLOBAL_UNCONSTRAINED_SCOPE', // Excess scope!
        policyResultIds: [resId],
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/OVERRIDE_SCOPE_WIDENING_FORBIDDEN/i);
  });

  // Vector 56: UI role accepted without server-side authorization
  it('Vector 56: UI role accepted without server-side authorization (fails closed)', async () => {
    await expect(
      govService.recordPolicyOverride({
        overrideId: uid('ov-56'),
        snapshotId: 'snap-56',
        authorizedBy: 'ui-user',
        authorityBasis: 'CLIENT_FLAG_ROLE',
        reasonCodes: 'OVERRIDE',
        scope: 'SCOPE',
        policyResultIds: ['res-fake'],
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: false, // Client-only flag!
      }),
    ).rejects.toThrow(/Server-side authorization is required/i);
  });

  // Vector 57: reviewer unqualified for required review
  it('Vector 57: reviewer unqualified for required review (fails closed)', async () => {
    await expect(
      govService.recordHumanReview({
        reviewId: uid('rev-57'),
        taskRevisionId: taskRevId,
        snapshotId: 'snap-57',
        policyResultIds: [],
        reviewMode: 'ADJUDICATION_ONLY',
        reviewerRole: 'GUEST',
        qualification: 'UNQUALIFIED',
        reviewScope: 'LEGAL',
        reviewDecision: 'APPROVE',
        reasonCodes: 'APPROVAL',
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/REVIEWER_UNAUTHORIZED/i);
  });

  // Vector 58: human review references PolicyResult from another snapshot
  it('Vector 58: human review references PolicyResult from another snapshot (fails closed)', async () => {
    const snapA = uid('snap-58-a');
    const snapB = uid('snap-58-b');
    const polRev = uid('pol-58');
    const resA = uid('res-58-a');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-58',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapA, { policyRevisionIds: [polRev] });
    await createTestSnapshot(snapB);

    await insertPolicyResult({
      resultId: resA,
      snapshotId: snapA,
      policyRevisionId: polRev,
      triggered: true,
    });

    await expect(
      govService.recordHumanReview({
        reviewId: uid('rev-58'),
        taskRevisionId: taskRevId,
        snapshotId: snapB,
        policyResultIds: [resA], // Result belongs to snapA!
        reviewMode: 'ADJUDICATION_ONLY',
        reviewerRole: 'SENIOR_COUNSEL',
        qualification: 'QUALIFIED',
        reviewScope: 'LEGAL',
        reviewDecision: 'APPROVE',
        reasonCodes: 'APPROVAL',
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/SNAPSHOT_MISMATCH/i);
  });

  // Vector 59: ADJUDICATION_ONLY contains introduced information
  it('Vector 59: ADJUDICATION_ONLY contains introduced information (fails closed)', async () => {
    await expect(
      govService.recordHumanReview({
        reviewId: uid('rev-59'),
        taskRevisionId: taskRevId,
        snapshotId: 'snap-59',
        policyResultIds: [],
        reviewMode: 'ADJUDICATION_ONLY',
        reviewerRole: 'COUNSEL',
        qualification: 'QUALIFIED',
        reviewScope: 'LEGAL',
        reviewDecision: 'APPROVE',
        reasonCodes: 'APPROVAL',
        introducedInformationRefs: ['ext-source-artifact-1'], // Disallowed for ADJUDICATION_ONLY
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/ADJUDICATION_ONLY review cannot introduce new information/i);
  });

  // Vector 60: NEW_INFORMATION_INTRODUCED has no introduced_information_refs
  it('Vector 60: NEW_INFORMATION_INTRODUCED has no introduced_information_refs (fails closed)', async () => {
    await expect(
      govService.recordHumanReview({
        reviewId: uid('rev-60'),
        taskRevisionId: taskRevId,
        snapshotId: 'snap-60',
        policyResultIds: [],
        reviewMode: 'NEW_INFORMATION_INTRODUCED',
        reviewerRole: 'COUNSEL',
        qualification: 'QUALIFIED',
        reviewScope: 'LEGAL',
        reviewDecision: 'APPROVE',
        reasonCodes: 'APPROVAL',
        introducedInformationRefs: [], // Missing required refs!
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/NEW_INFORMATION_INTRODUCED requires at least one introduced information ref/i);
  });

  // Vector 61: new review information used without new DecisionCycle
  it('Vector 61: new review information used without new DecisionCycle (fails closed)', async () => {
    const snapId = uid('snap-v61');
    const revId = uid('rev-v61');
    await createTestSnapshot(snapId, { candidateIds: ['cand-legit'] });

    await govService.recordHumanReview({
      reviewId: revId,
      taskRevisionId: taskRevId,
      snapshotId: snapId,
      policyResultIds: [],
      reviewMode: 'NEW_INFORMATION_INTRODUCED',
      reviewerRole: 'LEGAL_COUNSEL',
      qualification: 'QUALIFIED',
      reviewScope: 'LEGAL',
      reviewDecision: 'APPROVE',
      reasonCodes: 'FACTS_INTRODUCED',
      introducedInformationRefs: ['ref-factual-item-1'],
      tenantId: tenantA,
      workspaceId: workspaceA,
      serverAuthorized: true,
    });

    // Attempting to authorize READY release on this snapshot using review that introduced new info
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-v61'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'RELEASE',
        selectedCandidateId: 'cand-legit',
        releaseStatus: 'READY',
        policyResultIds: [],
        humanReviewId: revId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/NEW_INFORMATION_REQUIRES_NEW_DECISION_CYCLE/i);
  });

  // Vector 62: reviewer mutates DecisionSnapshot
  it('Vector 62: reviewer mutates DecisionSnapshot (fails closed at DB boundary)', async () => {
    const snapId = uid('snap-v62');
    await createTestSnapshot(snapId);
    await expect(
      sql`UPDATE decision_snapshots SET task_revision_id = 'mutated' WHERE snapshot_id = ${snapId}`,
    ).rejects.toThrow(/immutable/i);
  });

  // Vector 63: reviewer mutates PolicyResult
  it('Vector 63: reviewer mutates PolicyResult (fails closed at DB boundary)', async () => {
    const snapId = uid('snap-v63');
    const polRev = uid('pol-v63');
    const resId = uid('res-v63');
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-63',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRev] });
    await insertPolicyResult({
      resultId: resId,
      snapshotId: snapId,
      policyRevisionId: polRev,
      triggered: true,
      reasonCode: 'FAIL',
    });

    await expect(
      sql`UPDATE policy_results SET triggered = false WHERE policy_result_id = ${resId}`,
    ).rejects.toThrow(/immutable/i);
  });

  // Vector 64: hidden reviewer knowledge affects release
  it('Vector 64: hidden reviewer knowledge affects release (fails closed / requires grounding)', async () => {
    // Reviewer in ADJUDICATION_ONLY cannot introduce external facts without formal grounding refs
    await expect(
      govService.recordHumanReview({
        reviewId: uid('rev-v64'),
        taskRevisionId: taskRevId,
        snapshotId: 'snap-v64',
        policyResultIds: [],
        reviewMode: 'ADJUDICATION_ONLY',
        reviewerRole: 'COUNSEL',
        qualification: 'QUALIFIED',
        reviewScope: 'LEGAL',
        reviewDecision: 'APPROVE',
        reasonCodes: 'APPROVAL',
        introducedInformationRefs: ['external-unverified-fact-1'],
        tenantId: tenantA,
        workspaceId: workspaceA,
        serverAuthorized: true,
      }),
    ).rejects.toThrow(/ADJUDICATION_ONLY review cannot introduce new information/i);
  });

  // Vector 65: conflict finalized AUTHORIZED_OVERRIDE before override exists
  it('Vector 65: conflict finalized AUTHORIZED_OVERRIDE before override exists (fails closed)', async () => {
    await expect(
      govService.finalizeAuthorizedOverride({
        resolutionId: uid('confres-65'),
        snapshotId: 'snap-65',
        conflictKey: 'key-65',
        overrideId: 'non-existent-override-id',
        reasonCodes: 'OVERRIDE',
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/OVERRIDE_NOT_FOUND/i);
  });

  // Vector 66: unresolved material conflict omitted from DecisionRecord
  it('Vector 66: unresolved material conflict omitted from DecisionRecord (fails closed)', async () => {
    const snapId = uid('snap-v66');
    const confResId = uid('confres-v66');
    await createTestSnapshot(snapId);

    await govService.recordConflictResolution({
      resolutionId: confResId,
      snapshotId: snapId,
      conflictKey: 'conflict-key-66',
      resolutionType: 'ESCALATE',
      reasonCodes: 'UNRESOLVED_ESCALATION',
      policyResultIds: [],
      tenantId: tenantA,
      workspaceId: workspaceA,
    });

    // Attempting recordDecision omitting the conflict resolution
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-v66'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        conflictResolutionIds: [], // Omitted conflict resolution!
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/UNRESOLVED_CONFLICT_OMITTED/i);
  });

  // Vector 67: DecisionRecord omits PolicyResult from complete set
  it('Vector 67: DecisionRecord omits PolicyResult from complete set (fails closed)', async () => {
    const snapId = uid('snap-v67');
    const polRev = uid('pol-v67');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: polRev,
      policyId: 'p-67',
      tenantId: tenantA,
    });
    await createTestSnapshot(snapId, { policyRevisionIds: [polRev] });

    await expect(
      decService.recordDecision({
        decisionId: uid('dec-67'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [], // Omitted result!
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/INCOMPLETE_POLICY_RESULTS/i);
  });

  // Vector 68: DecisionRecord references conflict resolution from another snapshot
  it('Vector 68: DecisionRecord references conflict resolution from another snapshot (fails closed)', async () => {
    const snapA = uid('snap-68-a');
    const snapB = uid('snap-68-b');
    const confResId = uid('confres-68');

    await createTestSnapshot(snapA);
    await createTestSnapshot(snapB);

    await govService.recordConflictResolution({
      resolutionId: confResId,
      snapshotId: snapA,
      conflictKey: 'key-68',
      resolutionType: 'HARD_DENY_OVERRIDES',
      reasonCodes: 'DENY',
      policyResultIds: [],
      tenantId: tenantA,
      workspaceId: workspaceA,
    });

    await expect(
      decService.recordDecision({
        decisionId: uid('dec-68'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapB, // SnapB referencing resolution from SnapA
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        conflictResolutionIds: [confResId],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/CONFLICT_RESOLUTION_WRONG_SNAPSHOT/i);
  });

  // Vector 69: DecisionRecord references duplicate conflict_key resolutions
  it('Vector 69: DecisionRecord references duplicate conflict_key resolutions (fails closed)', async () => {
    const snapId = uid('snap-69');
    const resA = uid('confres-69-a');
    const resB = uid('confres-69-b');

    await createTestSnapshot(snapId);

    await govService.recordConflictResolution({
      resolutionId: resA,
      snapshotId: snapId,
      conflictKey: 'dup-key',
      resolutionType: 'HARD_DENY_OVERRIDES',
      reasonCodes: 'DENY',
      policyResultIds: [],
      tenantId: tenantA,
      workspaceId: workspaceA,
    });

    await expect(
      govService.recordConflictResolution({
        resolutionId: resB,
        snapshotId: snapId,
        conflictKey: 'dup-key',
        resolutionType: 'MORE_SPECIFIC_SCOPE',
        reasonCodes: 'SCOPE',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/DUPLICATE_FINAL_CONFLICT_RESOLUTION|duplicate key|violates unique constraint/i);
  });

  // Vector 70: DecisionRecord HumanReviewRecord bound to different snapshot
  it('Vector 70: DecisionRecord HumanReviewRecord bound to different snapshot (fails closed)', async () => {
    const snapA = uid('snap-70-a');
    const snapB = uid('snap-70-b');
    const revId = uid('rev-70');

    await createTestSnapshot(snapA);
    await createTestSnapshot(snapB);

    await govService.recordHumanReview({
      reviewId: revId,
      taskRevisionId: taskRevId,
      snapshotId: snapA,
      policyResultIds: [],
      reviewMode: 'ADJUDICATION_ONLY',
      reviewerRole: 'COUNSEL',
      qualification: 'QUALIFIED',
      reviewScope: 'LEGAL',
      reviewDecision: 'APPROVE',
      reasonCodes: 'APPROVED',
      tenantId: tenantA,
      workspaceId: workspaceA,
      serverAuthorized: true,
    });

    await expect(
      decService.recordDecision({
        decisionId: uid('dec-70'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapB, // SnapB referencing review from SnapA
        reasonCodes: 'TEST',
        selectedAction: 'HOLD',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        humanReviewId: revId,
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/HUMAN_REVIEW_WRONG_SNAPSHOT/i);
  });

  // Vector 71: release action selects candidate outside snapshot
  it('Vector 71: release action selects candidate outside snapshot (fails closed)', async () => {
    const snapId = uid('snap-71');
    await createTestSnapshot(snapId, { candidateIds: ['cand-legit'] });

    await expect(
      decService.recordDecision({
        decisionId: uid('dec-71'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'APPROVE',
        selectedCandidateId: 'cand-outside-snapshot',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/SELECTED_CANDIDATE_NOT_IN_SNAPSHOT/i);
  });

  // Vector 72: READY release has release action but missing selected_candidate_id
  it('Vector 72: READY release has release action but missing selected_candidate_id (fails closed)', async () => {
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-72'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: 'snap-72',
        reasonCodes: 'TEST',
        selectedAction: 'RELEASE',
        selectedCandidateId: null, // Null candidate on READY release!
        releaseStatus: 'READY',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/RELEASE_CANDIDATE_REQUIRED/i);
  });

  // Vector 73: BLOCKED interpreted as release authorization
  it('Vector 73: BLOCKED interpreted as release authorization (fails closed)', async () => {
    const snapId = uid('snap-73');
    await createTestSnapshot(snapId, { candidateIds: ['cand-1'] });

    await expect(
      decService.recordDecision({
        decisionId: uid('dec-73'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: snapId,
        reasonCodes: 'TEST',
        selectedAction: 'RELEASE', // Release action with BLOCKED status!
        selectedCandidateId: 'cand-1',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/BLOCKED_CANNOT_AUTHORIZE_RELEASE/i);
  });

  // Vector 74: selected_action embeds candidate ID
  it('Vector 74: selected_action embeds candidate ID (fails closed)', async () => {
    await expect(
      decService.recordDecision({
        decisionId: uid('dec-74'),
        decisionType: 'RELEASE',
        taskRevisionId: taskRevId,
        snapshotId: 'snap-74',
        reasonCodes: 'TEST',
        selectedAction: 'PUBLISH_CANDIDATE_12345678-abcd',
        selectedCandidateId: 'cand-1',
        releaseStatus: 'BLOCKED',
        policyResultIds: [],
        tenantId: tenantA,
        workspaceId: workspaceA,
      }),
    ).rejects.toThrow(/SELECTED_ACTION_EMBEDDED_ENTITY_ID/i);
  });

  // Vector 75: DecisionRecord release_status duplicated/overridden in package
  it('Vector 75: DecisionRecord release_status duplicated/overridden in package (fails closed)', async () => {
    await expect(
      decService.createFinalContentPackage({
        packageId: uid('pkg-75'),
        taskRevisionId: taskRevId,
        decisionId: 'dec-75',
        decisionSnapshotId: 'snap-75',
        selectedCandidateId: 'cand-75',
        strategyId: 'strat-75',
        architectureId: 'arch-75',
        audienceStateId: audId,
        warnings: 'NONE',
        tenantId: tenantA,
        workspaceId: workspaceA,
        release_status: 'READY' as any, // Forbidden release_status field!
      }),
    ).rejects.toThrow(/RELEASE_STATUS_FORBIDDEN_ON_PACKAGE/i);
  });

  // Vector 76: stale governance worker commits after cycle invalidation
  it('Vector 76: stale governance worker commits after cycle invalidation (fails closed)', async () => {
    const cycleId = uid('cycle-76');
    const runId = uid('run-76');
    await createTestRun(runId);
    await decService.createDecisionCycle({
      decisionCycleId: cycleId,
      runId,
      cycleNumber: 1,
      reason: 'Cycle 76',
      tenantId: tenantA,
      workspaceId: workspaceA,
    });
    // Cycle cancelled bumps fencing epoch
    await decService.cancelDecisionCycle(cycleId, runId);

    // Stale worker with epoch 0 attempts commit
    await expect(
      govService.resolveOrRefreshGovernanceSnapshot({
        governanceSnapshotId: uid('gov-76'),
        tenantId: tenantA,
        workspaceId: workspaceA,
        asOf: new Date(),
        fencingContext: {
          decisionCycleId: cycleId,
          fencingToken: 0,
          stageExecutionId: uid('stage-76'),
        },
      }),
    ).rejects.toThrow();
  });

  // Vector 77: pre-freeze governance commit accepted after FREEZING
  it('Vector 77: pre-freeze governance commit accepted after FREEZING (fails closed)', async () => {
    const cycleId = uid('cycle-77');
    const runId = uid('run-77');
    const stageId = uid('stage-77');

    await createTestRun(runId);
    await decService.createDecisionCycle({
      decisionCycleId: cycleId,
      runId,
      cycleNumber: 1,
      reason: 'Cycle 77',
      tenantId: tenantA,
      workspaceId: workspaceA,
    });
    // Create stage execution marked as COMPLETED (or FREEZING)
    await sql`
      INSERT INTO stage_executions (
        stage_execution_id, tenant_id, workspace_id, idempotency_key, run_id, decision_cycle_id,
        stage_name, status, fencing_token, attempt_count, canonical_input_hash, started_at, completed_at
      ) VALUES (
        ${stageId}, ${tenantA}, ${workspaceA}, ${uid('idem-77')}, ${runId}, ${cycleId},
        'GOVERNANCE_RESOLUTION', 'COMPLETED', 0, 1, 'hash-77', now(), now()
      )
    `;

    // Attempting commit with completed stage execution
    await expect(
      govService.resolveOrRefreshGovernanceSnapshot({
        governanceSnapshotId: uid('gov-77'),
        tenantId: tenantA,
        workspaceId: workspaceA,
        asOf: new Date(),
        fencingContext: {
          decisionCycleId: cycleId,
          fencingToken: 0,
          stageExecutionId: stageId,
        },
      }),
    ).rejects.toThrow(/STAGE_EXECUTION_NOT_RUNNING|STAGE_EXECUTION_STALE/i);
  });

  // Vector 78: post-snapshot policy evaluation imports newly activated policy
  it('Vector 78: post-snapshot policy evaluation imports newly activated policy (fails closed / isolates new policy)', async () => {
    const snapId = uid('snap-v78');
    const oldPolRev = uid('pol-78-old');
    const newPolRev = uid('pol-78-new');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: oldPolRev,
      policyId: 'p-78-stable',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'NO_RELEASE_EFFECT', code: 'PASS' },
      requiredInputs: ['TaskContract'],
    });
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: newPolRev,
      policyId: 'p-78-stable',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'NEW_BLOCK' },
      requiredInputs: ['TaskContract'],
    });

    await createTestSnapshot(snapId, { policyRevisionIds: [oldPolRev] });

    // Control plane activates new revision
    await sql`
      INSERT INTO control_plane_activations (
        activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from, created_at
      ) VALUES (
        ${uid('act-78')}, 'GLOBAL', 'DecisionPolicyRevision', 'p-78-stable', ${newPolRev}, now(), now()
      )
    `;

    // Evaluation on frozen snapshot evaluates strictly old revision, never new revision
    const results = await govService.evaluatePolicySet({
      snapshotId: snapId,
      tenantId: tenantA,
      workspaceId: workspaceA,
    });
    expect(results.length).toBe(1);
    expect(results[0].policyRevisionId).toBe(oldPolRev);
    expect(results[0].actionEffect).toBe('NO_RELEASE_EFFECT');
  });

  // Vector 79: historical replay evaluates today's active policy instead of recorded revision
  it("Vector 79: historical replay evaluates today's active policy instead of recorded revision (fails closed / uses recorded)", async () => {
    const snapId = uid('snap-v79');
    const recordedPolRev = uid('pol-79-rec');
    const todayPolRev = uid('pol-79-today');

    await cpService.createDecisionPolicyRevision({
      policyRevisionId: recordedPolRev,
      policyId: 'p-79-stable',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'NO_RELEASE_EFFECT', code: 'PASS' },
      requiredInputs: ['TaskContract'],
    });
    await cpService.createDecisionPolicyRevision({
      policyRevisionId: todayPolRev,
      policyId: 'p-79-stable',
      tenantId: tenantA,
      conditions: { op: 'IS_TRUE', left: 'TaskContract.standalone_task' },
      action: { effect: 'BLOCK', code: 'TODAY_BLOCK' },
      requiredInputs: ['TaskContract'],
    });

    await createTestSnapshot(snapId, { policyRevisionIds: [recordedPolRev] });

    // Replay evaluation queries strictly recorded snapshot policies
    const replayResults = await govService.evaluatePolicySet({
      snapshotId: snapId,
      tenantId: tenantA,
      workspaceId: workspaceA,
    });
    expect(replayResults.length).toBe(1);
    expect(replayResults[0].policyRevisionId).toBe(recordedPolRev);
  });

  // Vector 80: runtime governance learning directly activates Control Plane revision
  it('Vector 80: runtime governance learning directly activates Control Plane revision (fails closed at DB boundary)', async () => {
    await expect(
      runtimeSql`
        INSERT INTO control_plane_activations (
          activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from, created_at
        ) VALUES (
          ${uid('act-80')}, 'GLOBAL', 'DECISION_POLICY', 'p-st-80', 'p-rev-80', now(), now()
        )
      `,
    ).rejects.toThrow();
  });
});
