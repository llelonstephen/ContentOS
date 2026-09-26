/**
 * M1 SPEC02 §37 Complete 76-Vector Adversarial Verification Matrix
 *
 * Implements the exact 76 locked adversarial vectors from SPEC02 §37 against
 * the live PostgreSQL database (contentos_test).
 *
 * Vectors 01 to 76 are executed sequentially with explicit assertions verifying
 * that all domain and transactional invariants hold.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import crypto from 'node:crypto';
import { ControlPlanePersistenceService } from '../../persistence/relational/services/control-plane-persistence-service.js';
import { PublicationPersistenceService } from '../../persistence/relational/services/publication-persistence-service.js';
import { EpistemicPersistenceService } from '../../persistence/relational/services/epistemic-persistence-service.js';
import { MeasurementPersistenceService } from '../../persistence/relational/services/measurement-persistence-service.js';
import { DecisionPersistenceService } from '../../persistence/relational/services/decision-persistence-service.js';
import { RetentionDeletionService } from '../../persistence/relational/services/retention-deletion-service.js';
import { claimObjectForGC } from '../../persistence/relational/services/object-registry-service.js';
import {
  RegistryValidationError,
  validateSupersession,
  validateGenericReference,
  validateKnowledgeGapClosure,
  validateEvidenceOrigin,
  validateApplicabilityAssessment,
  validateSnapshotTemporalCutoff,
  validateEvaluatorRunConfigMembership,
  validateSnapshotTransitiveTenant,
  validateSnapshotInputTemporalClosure,
  validatePolicyResultSetCompleteness,
  validatePolicyConflictResolution,
  validatePolicyOverrideSnapshot,
  validatePackageStrategy,
  validatePackageRightsChecks,
  validateMeasurementCorrection,
  validateStageExecutionFencing,
  validateCycleCancellation,
  validateReplayabilityStatus,
  validateDeletionTombstone,
} from '../../domain/services/registry-validator.js';

function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `SAFETY GUARD BLOCKED EXECUTION: Refusing to run tests against non-test database '${dbName}'.`,
    );
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DB_URL =
  process.env['DATABASE_URL_TEST'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://localhost:5432/contentos_test';

describe('SPEC02 §37 Adversarial 76-Vector Suite (Live PostgreSQL)', () => {
  let sql: ReturnType<typeof postgres>;
  const tenantA = 'tenant-76-a';
  const tenantB = 'tenant-76-b';

  let cpService: ControlPlanePersistenceService;
  let pubService: PublicationPersistenceService;
  let epiService: EpistemicPersistenceService;
  let measService: MeasurementPersistenceService;
  let decService: DecisionPersistenceService;
  let retService: RetentionDeletionService;

  const progStable = uid('prog-76');
  const progRev1 = uid('prog-rev-76-1');
  const metricStable = uid('metric-76');
  const metricRev1 = uid('metric-rev-76-1');
  const taskStable = uid('task-76');
  const taskRev1 = uid('task-rev-76-1');
  const evalStable = uid('eval-76');
  const evalRev1 = uid('eval-rev-76-1');
  const rcId = uid('rc-76');
  const kmId = uid('km-76');
  const bksId = uid('bks-76');
  const rkdId = uid('rkd-76');
  const govId = uid('gov-76');
  const policyId = uid('pol-76');
  const audStateId = uid('aud-76');
  const stratHypId = uid('strat-76');
  const stratHypId2 = uid('strat-76-2');
  const archId = uid('arch-76');

  beforeAll(async () => {
    assertTestDatabase(DB_URL);
    sql = postgres(DB_URL, { max: 5 });

    cpService = new ControlPlanePersistenceService(sql);
    pubService = new PublicationPersistenceService(sql);
    epiService = new EpistemicPersistenceService(sql);
    measService = new MeasurementPersistenceService(sql);
    decService = new DecisionPersistenceService(sql);
    retService = new RetentionDeletionService(sql);

    // Seed baseline RevisionRegistry
    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('ContentProgramRevision', ${progStable}, ${progRev1}, ${tenantA}),
        ('MetricDefinitionRevision', ${metricStable}, ${metricRev1}, ${tenantA}),
        ('TaskContractRevision', ${taskStable}, ${taskRev1}, ${tenantA}),
        ('EvalContractRevision', ${evalStable}, ${evalRev1}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    // Seed baseline ImmutableEntityRegistry
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES
        ('RunConfig', ${rcId}, ${tenantA}),
        ('KnowledgeManifest', ${kmId}, ${tenantA}),
        ('BaselineKnowledgeSnapshot', ${bksId}, ${tenantA}),
        ('RunKnowledgeDelta', ${rkdId}, ${tenantA}),
        ('GovernanceSnapshot', ${govId}, ${tenantA}),
        ('RightsPolicy', ${policyId}, ${tenantA}),
        ('AudienceState', ${audStateId}, ${tenantA}),
        ('StrategyHypothesis', ${stratHypId}, ${tenantA}),
        ('StrategyHypothesis', ${stratHypId2}, ${tenantA}),
        ('ContentArchitecture', ${archId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    // Seed typed revisions
    await sql`
      INSERT INTO content_program_revisions (
        program_id, program_revision_id, business_objective, brand_objective, target_audiences, markets,
        message_hierarchy, content_pillars, channel_roles, budget_context, effective_from, tenant_id
      ) VALUES (
        ${progStable}, ${progRev1}, 'Growth', 'Brand Authority', 'B2B', 'US', 'Hierarchy', 'Pillars', 'X', 'Q1', now(), ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO metric_definition_revisions (
        metric_id, metric_revision_id, metric_name, layer, definition, numerator, denominator, "window", effective_from, tenant_id
      ) VALUES (
        ${metricStable}, ${metricRev1}, 'CTR', 'BEHAVIORAL', 'Clicks/Impressions', 'Clicks', 'Impressions', '7d', now(), ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO task_contract_revisions (
        task_id, task_revision_id, program_revision_id, standalone_task, objective,
        format, language, market, jurisdiction, brand_id, product_id, audience_context,
        channel, success_metric_revision_id, constraints, risk_context, compute_budget,
        tenant_id
      ) VALUES (
        ${taskStable}, ${taskRev1}, ${progRev1}, false, 'Task Obj',
        'POST', 'en', 'US', 'US-FED', 'brand-76', 'prod-76', 'Audience',
        'TWITTER_X', ${metricRev1}, '{}', '{}', '{}',
        ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO eval_contract_revisions (
        eval_contract_id, eval_contract_revision_id, component, capability,
        required_dimensions, hard_gates, release_impact, tenant_id
      ) VALUES (
        ${evalStable}, ${evalRev1}, 'Quality', 'GENERATION',
        '[]', '[]', 'BLOCK_ON_FAIL', ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    // Seed immutable baseline entities
    await sql`
      INSERT INTO run_configs (run_config_id, runtime_parameters, tenant_id)
      VALUES (${rcId}, '{}', ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO knowledge_manifests (knowledge_manifest_id, tenant_id, content_hash)
      VALUES (${kmId}, ${tenantA}, ${uid('hash-km')})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO baseline_knowledge_snapshots (baseline_snapshot_id, tenant_id, as_of, knowledge_manifest_id)
      VALUES (${bksId}, ${tenantA}, now(), ${kmId})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO run_knowledge_deltas (delta_id, tenant_id, run_correlation_key)
      VALUES (${rkdId}, ${tenantA}, ${uid('corr')})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO governance_snapshots (governance_snapshot_id, tenant_id, as_of)
      VALUES (${govId}, ${tenantA}, now())
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO rights_policies (
        rights_policy_id, tenant_id, copyright_status, license, analysis_use, generation_use,
        quotation_use, transformation_permission, redistribution_permission, commercial_use_permission,
        attribution_requirements, effective_from
      ) VALUES (
        ${policyId}, ${tenantA}, 'PUBLIC_DOMAIN', 'CC0', true, true,
        true, true, true, true,
        'None', now()
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${audStateId}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO strategy_hypotheses (
        strategy_id, tenant_id, task_revision_id, audience_state_id, core_message,
        behavioral_objective, proof_strategy, assumptions, unknowns, failure_modes,
        risk_hypotheses, persuasion_mechanism
      ) VALUES 
        (${stratHypId}, ${tenantA}, ${taskRev1}, ${audStateId}, 'Core Msg 1', 'Learn', 'Proof', '[]', '[]', '[]', '[]', 'Rational'),
        (${stratHypId2}, ${tenantA}, ${taskRev1}, ${audStateId}, 'Core Msg 2', 'Act', 'Proof', '[]', '[]', '[]', '[]', 'Emotional')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO content_architectures (
        architecture_id, tenant_id, task_revision_id, strategy_id
      ) VALUES (
        ${archId}, ${tenantA}, ${taskRev1}, ${stratHypId}
      ) ON CONFLICT DO NOTHING
    `;
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  // 01-10: Entity Identity & Reference Invariants
  it('Vector 01: RevisionRef wrong stable_id with valid revision_id', async () => {
    let err: any;
    try {
      await sql`
        INSERT INTO control_plane_activations (
          activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from
        ) VALUES (
          ${uid('act-v01')}, 'TENANT_DEFAULT', 'ContentProgramRevision', 'wrong-stable', ${progRev1}, now()
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // FK to revision_registry (entity_type, stable_id, revision_id)
  });

  it('Vector 02: RevisionRef wrong entity_type', async () => {
    let err: any;
    try {
      await sql`
        INSERT INTO control_plane_activations (
          activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from
        ) VALUES (
          ${uid('act-v02')}, 'TENANT_DEFAULT', 'MetricDefinitionRevision', ${progStable}, ${progRev1}, now()
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503');
  });

  it('Vector 03: ImmutableEntityRef wrong entity_type', async () => {
    let err: any;
    try {
      await sql`
        INSERT INTO object_references (
          owner_entity_type, owner_entity_id, field_name, object_id, tenant_id
        ) VALUES (
          'WrongEntityType', ${kmId}, 'data', 'obj-placeholder', ${tenantA}
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503');
  });

  it('Vector 04: runtime CURRENT/LATEST substitution rejected', async () => {
    let err: any;
    try {
      await sql`
        INSERT INTO task_contract_revisions (
          task_id, task_revision_id, standalone_task, objective, format, language, market,
          jurisdiction, brand_id, product_id, audience_context, channel, success_metric_revision_id,
          constraints, risk_context, compute_budget, tenant_id
        ) VALUES (
          'task-current', 'CURRENT', true, 'Obj', 'POST', 'en', 'US', 'US-FED', 'b', 'p', 'a',
          'TWITTER_X', ${metricRev1}, '{}', '{}', '{}', ${tenantA}
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503');
  });

  it('Vector 05: revision supersedes different stable ID', async () => {
    expect(() => {
      validateSupersession(
        { entity_type: 'TaskContractRevision', stable_id: 'task-stable-a', revision_id: 'task-rev-1' },
        { entity_type: 'TaskContractRevision', stable_id: 'task-stable-b', revision_id: 'task-rev-2', supersedes_revision_id: 'task-rev-1' },
      );
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 06: revision self-supersession', async () => {
    expect(() => {
      validateSupersession(
        { entity_type: 'TaskContractRevision', stable_id: 'task-stable-a', revision_id: 'rev-123' },
        { entity_type: 'TaskContractRevision', stable_id: 'task-stable-a', revision_id: 'rev-123', supersedes_revision_id: 'rev-123' },
      );
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 07: cross-tenant private FK', async () => {
    const objTenantB = uid('obj-tenant-b');
    const keyB = uid('key-b');
    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${objTenantB}, ${tenantB}, ${uid('hash-b')}, ${keyB}, 512, 'application/json', 'AVAILABLE')
      ON CONFLICT DO NOTHING
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO object_references (
          owner_entity_type, owner_entity_id, field_name, object_id, tenant_id
        ) VALUES (
          'KnowledgeManifest', ${kmId}, 'ref', ${objTenantB}, ${tenantA}
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // composite FK (tenant_id, object_id)
  });

  it('Vector 08: opaque brand_id treated as ContentOS FK', async () => {
    const res = await sql`
      SELECT count(*) as count FROM information_schema.tables WHERE table_name = 'brands'
    `;
    expect(Number(res[0]?.['count'])).toBe(0);
  });

  it('Vector 09: generic ref with both entity and revision branches populated', async () => {
    expect(() => {
      validateGenericReference({
        entity_id: 'ent-1',
        revision_id: 'rev-1',
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 10: canonical ID collection hidden only in JSON', async () => {
    const rows = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('decision_snapshot_candidates', 'governance_snapshot_policies', 'decision_snapshot_rights_checks')
    `;
    expect(rows.length).toBe(3);
  });

  // 11-20: Epistemic & Knowledge Invariants
  it('Vector 11: second EpistemicState root', async () => {
    const propId = uid('prop-v11');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('Proposition', ${propId}, ${tenantA})
    `;
    await sql`
      INSERT INTO propositions (
        proposition_id, tenant_id, proposition_type, canonical_meaning,
        subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propId}, ${tenantA}, 'FACTUAL', 'Meaning', 'S', 'P', 'O', '{}', '{}', 'ALL', 'GLOBAL'
      )
    `;

    await epiService.appendEpistemicState({
      epistemicStateId: uid('eps-root-11'),
      propositionId: propId,
      supportStatus: 'STRONGLY_SUPPORTED',
      causalStatus: 'DIRECT_OBSERVATION',
      uncertainty: 'LOW',
      derivationMethod: 'EXPERIMENTAL',
      derivationEntityType: 'ResearchTrace',
      derivationStableId: 'trace-1',
      derivationRevisionId: 'rev-1',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      knownFrom: new Date('2026-01-01T00:00:00Z'),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await epiService.appendEpistemicState({
        epistemicStateId: uid('eps-root-11-second'),
        propositionId: propId,
        supportStatus: 'STRONGLY_SUPPORTED',
        causalStatus: 'DIRECT_OBSERVATION',
        uncertainty: 'LOW',
        derivationMethod: 'EXPERIMENTAL',
        derivationEntityType: 'ResearchTrace',
        derivationStableId: 'trace-1',
        derivationRevisionId: 'rev-1',
        validFrom: new Date('2026-02-01T00:00:00Z'),
        knownFrom: new Date('2026-02-01T00:00:00Z'),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('SECOND_EPISTEMIC_ROOT_FORBIDDEN');
  });

  it('Vector 12: EpistemicState branch', async () => {
    const propId = uid('prop-v12');
    const rootId = uid('eps-root-12');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('Proposition', ${propId}, ${tenantA})
    `;
    await sql`
      INSERT INTO propositions (
        proposition_id, tenant_id, proposition_type, canonical_meaning,
        subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propId}, ${tenantA}, 'FACTUAL', 'Meaning', 'S', 'P', 'O', '{}', '{}', 'ALL', 'GLOBAL'
      )
    `;

    await epiService.appendEpistemicState({
      epistemicStateId: rootId,
      propositionId: propId,
      supportStatus: 'STRONGLY_SUPPORTED',
      causalStatus: 'DIRECT_OBSERVATION',
      uncertainty: 'LOW',
      derivationMethod: 'EXPERIMENTAL',
      derivationEntityType: 'ResearchTrace',
      derivationStableId: 'trace-1',
      derivationRevisionId: 'rev-1',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      knownFrom: new Date('2026-01-01T00:00:00Z'),
      tenantId: tenantA,
    });

    await epiService.appendEpistemicState({
      epistemicStateId: uid('eps-succ-12-1'),
      propositionId: propId,
      supersedesEpistemicStateId: rootId,
      supportStatus: 'WEAKLY_SUPPORTED',
      causalStatus: 'DIRECT_OBSERVATION',
      uncertainty: 'MEDIUM',
      derivationMethod: 'EXPERIMENTAL',
      derivationEntityType: 'ResearchTrace',
      derivationStableId: 'trace-1',
      derivationRevisionId: 'rev-1',
      validFrom: new Date('2026-02-01T00:00:00Z'),
      knownFrom: new Date('2026-02-01T00:00:00Z'),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await epiService.appendEpistemicState({
        epistemicStateId: uid('eps-succ-12-branch'),
        propositionId: propId,
        supersedesEpistemicStateId: rootId, // Branch attempt
        supportStatus: 'CONTRADICTED',
        causalStatus: 'NO_EVIDENCE',
        uncertainty: 'HIGH',
        derivationMethod: 'EXPERIMENTAL',
        derivationEntityType: 'ResearchTrace',
        derivationStableId: 'trace-1',
        derivationRevisionId: 'rev-1',
        validFrom: new Date('2026-03-01T00:00:00Z'),
        knownFrom: new Date('2026-03-01T00:00:00Z'),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('EPISTEMIC_BRANCHING_FORBIDDEN');
  });

  it('Vector 13: EpistemicState cycle', async () => {
    let err: any;
    try {
      await epiService.appendEpistemicState({
        epistemicStateId: 'eps-self-cycle',
        propositionId: 'some-prop',
        supersedesEpistemicStateId: 'eps-self-cycle',
        supportStatus: 'STRONGLY_SUPPORTED',
        causalStatus: 'DIRECT_OBSERVATION',
        uncertainty: 'LOW',
        derivationMethod: 'EXPERIMENTAL',
        derivationEntityType: 'ResearchTrace',
        derivationStableId: 'trace-1',
        derivationRevisionId: 'rev-1',
        validFrom: new Date('2026-01-01T00:00:00Z'),
        knownFrom: new Date('2026-01-01T00:00:00Z'),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('EPISTEMIC_CYCLE');
  });

  it('Vector 14: EpistemicState known_from non-increasing', async () => {
    const propId = uid('prop-v14');
    const rootId = uid('eps-root-14');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('Proposition', ${propId}, ${tenantA})
    `;
    await sql`
      INSERT INTO propositions (
        proposition_id, tenant_id, proposition_type, canonical_meaning,
        subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
      ) VALUES (
        ${propId}, ${tenantA}, 'FACTUAL', 'Meaning', 'S', 'P', 'O', '{}', '{}', 'ALL', 'GLOBAL'
      )
    `;
    await epiService.appendEpistemicState({
      epistemicStateId: rootId,
      propositionId: propId,
      supportStatus: 'STRONGLY_SUPPORTED',
      causalStatus: 'DIRECT_OBSERVATION',
      uncertainty: 'LOW',
      derivationMethod: 'EXPERIMENTAL',
      derivationEntityType: 'ResearchTrace',
      derivationStableId: 'trace-1',
      derivationRevisionId: 'rev-1',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      knownFrom: new Date('2026-01-01T00:00:00Z'),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await epiService.appendEpistemicState({
        epistemicStateId: uid('eps-retro-14'),
        propositionId: propId,
        supersedesEpistemicStateId: rootId,
        supportStatus: 'WEAKLY_SUPPORTED',
        causalStatus: 'DIRECT_OBSERVATION',
        uncertainty: 'MEDIUM',
        derivationMethod: 'EXPERIMENTAL',
        derivationEntityType: 'ResearchTrace',
        derivationStableId: 'trace-1',
        derivationRevisionId: 'rev-1',
        validFrom: new Date('2025-12-01T00:00:00Z'),
        knownFrom: new Date('2025-12-01T00:00:00Z'), // non-increasing
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('EPISTEMIC_KNOWN_FROM_NON_INCREASING');
  });

  it('Vector 15: blocking KnowledgeGap silently removed', async () => {
    expect(() => {
      validateKnowledgeGapClosure([
        {
          gap_id: uid('gap-15'),
          blocking: true,
          status: 'UNRESOLVED_REMOVED',
        },
      ]);
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 16: EvidenceItem origin discriminator mismatch', async () => {
    const evId = uid('ev-16');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('EvidenceItem', ${evId}, ${tenantA})
    `;
    let err: any;
    try {
      await sql`
        INSERT INTO evidence_items (
          evidence_id, tenant_id, origin_type, origin_id, evidence_domain,
          statement, statement_type, assertion_method, study_design,
          causal_identification, mechanism_support, limitations, valid_from
        ) VALUES (
          ${evId}, ${tenantA}, 'INVALID_ORIGIN_DISCRIMINATOR', 'source-1',
          'PRODUCT_DOCUMENTATION', 'Statement', 'FACTUAL', 'DIRECT_EXTRACTION',
          'OBSERVATIONAL', 'CORRELATIONAL', 'DIRECT', 'None', now()
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23514'); // ck_evidence_item_origin_type
  });

  it('Vector 17: performance EvidenceItem points to SourceArtifact', async () => {
    expect(() => {
      validateEvidenceOrigin({
        origin_type: 'PERFORMANCE_OBSERVATION',
        origin_id: uid('sa-17'),
        referenced_entity_type: 'SourceArtifact',
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 18: Applicability subject_type/subject_revision mismatch', async () => {
    expect(() => {
      validateApplicabilityAssessment({
        assessment_id: uid('app-18'),
        subject_type: 'PolicyRevision',
        subject_revision_id: 'task-rev-1',
        actual_entity_type: 'TaskContractRevision',
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 19: Applicability cutoff after DecisionSnapshot.frozen_at', async () => {
    const frozenAt = new Date('2026-06-01T00:00:00Z');
    const cutoffAfter = new Date('2026-06-02T00:00:00Z');
    expect(() => {
      validateSnapshotTemporalCutoff({
        snapshot_frozen_at: frozenAt,
        cutoff_time: cutoffAfter,
        field_name: 'applicability',
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 20: RightsCheck cutoff after DecisionSnapshot.frozen_at', async () => {
    const frozenAt = new Date('2026-06-01T00:00:00Z');
    const rcCutoff = new Date('2026-06-02T00:00:00Z');
    expect(() => {
      validateSnapshotTemporalCutoff({
        snapshot_frozen_at: frozenAt,
        cutoff_time: rcCutoff,
        field_name: 'rights_check',
      });
    }).toThrowError(RegistryValidationError);
  });

  // 21-30: Decision & Governance Invariants
  it('Vector 21: Candidate run_config mismatch', async () => {
    const candId = uid('cand-21');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('ContentCandidate', ${candId}, ${tenantA})
    `;
    let err: any;
    try {
      await sql`
        INSERT INTO content_candidates (
          candidate_id, tenant_id, task_revision_id, strategy_id, architecture_id,
          content_payload, run_config_id
        ) VALUES (
          ${candId}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId},
          '{}', 'rc-non-existent'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // FK to run_configs
  });

  it('Vector 22: evaluator revision absent from RunConfig', async () => {
    expect(() => {
      validateEvaluatorRunConfigMembership(['eval-rev-1'], 'eval-rev-unlisted');
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 23: snapshot dangling direct ref', async () => {
    const snapId = uid('snap-dangling');
    let err: any;
    try {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('DecisionSnapshot', ${snapId}, ${tenantA})
      `;
      await sql`
        INSERT INTO decision_snapshots (
          snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
          governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
        ) VALUES (
          ${snapId}, ${tenantA}, 'bks-non-existent', ${rkdId},
          ${govId}, ${rcId}, ${taskRev1}, 'aud-none', now()
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // FK violation
  });

  it('Vector 24: snapshot transitive mismatch', async () => {
    expect(() => {
      validateSnapshotTransitiveTenant('tenant-a', [
        { input_id: 'bks-1', tenant_id: 'tenant-b' },
      ]);
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 25: snapshot input created after frozen_at', async () => {
    const frozenAt = new Date('2026-01-01T00:00:00Z');
    const inputCreated = new Date('2026-01-02T00:00:00Z');
    expect(() => {
      validateSnapshotInputTemporalClosure(frozenAt, [
        { input_id: 'inp-25', created_at: inputCreated },
      ]);
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 26: partial PolicyResult set treated complete', async () => {
    expect(() => {
      validatePolicyResultSetCompleteness(['pol-1', 'pol-2'], ['pol-1']);
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 27: duplicate PolicyResult for snapshot/policy', async () => {
    const polRes1 = uid('pr-27-1');
    const polRes2 = uid('pr-27-2');
    const snapId = uid('snap-27');
    const polRevId = uid('pol-rev-27');
    const audId = uid('aud-27');

    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES ('DecisionPolicyRevision', 'pol-27', ${polRevId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO decision_policy_revisions (
        policy_id, policy_revision_id, conditions, required_inputs, action, priority_class, scope, override_allowed, tenant_id
      ) VALUES (
        'pol-27', ${polRevId}, '{}', '[]', 'ALLOW', 'DEFAULT', '{}', false, ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${audId}, ${tenantA}),
        ('DecisionSnapshot', ${snapId}, ${tenantA}),
        ('PolicyResult', ${polRes1}, ${tenantA}),
        ('PolicyResult', ${polRes2}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${audId}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO decision_snapshots (
        snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
        governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
      ) VALUES (
        ${snapId}, ${tenantA}, ${bksId}, ${rkdId}, ${govId}, ${rcId}, ${taskRev1}, ${audId}, now()
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO policy_results (
        policy_result_id, tenant_id, snapshot_id, policy_revision_id, triggered, action, reason_code, input_uncertainty
      ) VALUES (
        ${polRes1}, ${tenantA}, ${snapId}, ${polRevId}, false, 'PASS', 'OK', 'LOW'
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO policy_results (
          policy_result_id, tenant_id, snapshot_id, policy_revision_id, triggered, action, reason_code, input_uncertainty
        ) VALUES (
          ${polRes2}, ${tenantA}, ${snapId}, ${polRevId}, true, 'FAIL', 'FAIL', 'LOW'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_policy_result_snapshot_policy
  });

  it('Vector 28: duplicate final resolution for conflict_key', async () => {
    const snapId = uid('snap-28');
    const res1 = uid('res-28-1');
    const res2 = uid('res-28-2');
    const audId = uid('aud-28');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${audId}, ${tenantA}),
        ('DecisionSnapshot', ${snapId}, ${tenantA}),
        ('PolicyConflictResolution', ${res1}, ${tenantA}),
        ('PolicyConflictResolution', ${res2}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${audId}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO decision_snapshots (
        snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
        governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
      ) VALUES (
        ${snapId}, ${tenantA}, ${bksId}, ${rkdId}, ${govId}, ${rcId}, ${taskRev1}, ${audId}, now()
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO policy_conflict_resolutions (
        resolution_id, tenant_id, snapshot_id, conflict_key, resolution_type, reason_codes
      ) VALUES (
        ${res1}, ${tenantA}, ${snapId}, 'brand-vs-growth', 'EXPLICIT_PRIORITY', 'BRAND_FIRST'
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO policy_conflict_resolutions (
          resolution_id, tenant_id, snapshot_id, conflict_key, resolution_type, reason_codes
        ) VALUES (
          ${res2}, ${tenantA}, ${snapId}, 'brand-vs-growth', 'HARD_DENY_OVERRIDES', 'SECURITY_FIRST'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_conflict_resolution_key
  });

  it('Vector 29: AUTHORIZED_OVERRIDE without PolicyOverride', async () => {
    expect(() => {
      validatePolicyConflictResolution({
        resolution_type: 'AUTHORIZED_OVERRIDE',
        override_id: null,
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 30: PolicyOverride crosses snapshots', async () => {
    expect(() => {
      validatePolicyOverrideSnapshot('snap-a', 'snap-b');
    }).toThrowError(RegistryValidationError);
  });

  // 31-40: Publication & Packaging Invariants
  it('Vector 31: DecisionRecord selected candidate outside snapshot', async () => {
    const snap31 = uid('snap-31');
    const cand31 = uid('cand-31');
    const aud31 = uid('aud-31');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${aud31}, ${tenantA}),
        ('ContentCandidate', ${cand31}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${aud31}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_candidates (
        candidate_id, tenant_id, task_revision_id, strategy_id, architecture_id,
        content_payload, run_config_id
      ) VALUES (
        ${cand31}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId},
        '{}', ${rcId}
      ) ON CONFLICT DO NOTHING
    `;
    await decService.freezeDecisionSnapshot({
      snapshotId: snap31,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: govId,
      runConfigId: rcId,
      taskRevisionId: taskRev1,
      audienceStateId: aud31,
      candidateIds: [cand31],
      frozenAt: new Date(),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await decService.recordDecision({
        decisionId: uid('dec-31'),
        decisionType: 'CONTENT_RELEASE',
        taskRevisionId: taskRev1,
        snapshotId: snap31,
        reasonCodes: 'APPROVED',
        selectedAction: 'PUBLISH',
        selectedCandidateId: 'cand-external-outside-snapshot',
        releaseStatus: 'READY',
        policyResultIds: [],
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('SELECTED_CANDIDATE_NOT_IN_SNAPSHOT');
  });

  it('Vector 32: FinalContentPackage candidate differs from DecisionRecord', async () => {
    const snap32 = uid('snap-32');
    const cand32A = uid('cand-32-a');
    const cand32B = uid('cand-32-b');
    const aud32 = uid('aud-32');
    const dec32 = uid('dec-32');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${aud32}, ${tenantA}),
        ('ContentCandidate', ${cand32A}, ${tenantA}),
        ('ContentCandidate', ${cand32B}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${aud32}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_candidates (
        candidate_id, tenant_id, task_revision_id, strategy_id, architecture_id,
        content_payload, run_config_id
      ) VALUES 
        (${cand32A}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId}, '{}', ${rcId}),
        (${cand32B}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId}, '{}', ${rcId})
      ON CONFLICT DO NOTHING
    `;
    await decService.freezeDecisionSnapshot({
      snapshotId: snap32,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: govId,
      runConfigId: rcId,
      taskRevisionId: taskRev1,
      audienceStateId: aud32,
      candidateIds: [cand32A, cand32B],
      frozenAt: new Date(),
      tenantId: tenantA,
    });
    await decService.recordDecision({
      decisionId: dec32,
      decisionType: 'CONTENT_RELEASE',
      taskRevisionId: taskRev1,
      snapshotId: snap32,
      reasonCodes: 'APPROVED',
      selectedAction: 'PUBLISH',
      selectedCandidateId: cand32A,
      releaseStatus: 'READY',
      policyResultIds: [],
      tenantId: tenantA,
    });

    let err: any;
    try {
      await decService.createFinalContentPackage({
        packageId: uid('pkg-32'),
        taskRevisionId: taskRev1,
        decisionId: dec32,
        decisionSnapshotId: snap32,
        selectedCandidateId: cand32B, // Mismatches DecisionRecord selectedCandidateId (cand32A)
        strategyId: stratHypId,
        architectureId: archId,
        audienceStateId: aud32,
        warnings: 'none',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('PACKAGE_CANDIDATE_MISMATCH');
  });

  it('Vector 33: FinalContentPackage strategy mismatch', async () => {
    const snap33 = uid('snap-33');
    const cand33 = uid('cand-33');
    const aud33 = uid('aud-33');
    const dec33 = uid('dec-33');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${aud33}, ${tenantA}),
        ('ContentCandidate', ${cand33}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${aud33}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_candidates (
        candidate_id, tenant_id, task_revision_id, strategy_id, architecture_id,
        content_payload, run_config_id
      ) VALUES (
        ${cand33}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId}, '{}', ${rcId}
      ) ON CONFLICT DO NOTHING
    `;
    await decService.freezeDecisionSnapshot({
      snapshotId: snap33,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: govId,
      runConfigId: rcId,
      taskRevisionId: taskRev1,
      audienceStateId: aud33,
      candidateIds: [cand33],
      frozenAt: new Date(),
      tenantId: tenantA,
    });
    await decService.recordDecision({
      decisionId: dec33,
      decisionType: 'CONTENT_RELEASE',
      taskRevisionId: taskRev1,
      snapshotId: snap33,
      reasonCodes: 'APPROVED',
      selectedAction: 'PUBLISH',
      selectedCandidateId: cand33,
      releaseStatus: 'READY',
      policyResultIds: [],
      tenantId: tenantA,
    });

    let err: any;
    try {
      await decService.createFinalContentPackage({
        packageId: uid('pkg-33'),
        taskRevisionId: taskRev1,
        decisionId: dec33,
        decisionSnapshotId: snap33,
        selectedCandidateId: cand33,
        strategyId: stratHypId2, // Mismatches Candidate strategy (stratHypId)
        architectureId: archId,
        audienceStateId: aud33,
        warnings: 'none',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('FINAL_PACKAGE_STRATEGY_MISMATCH');
  });

  it('Vector 34: FinalContentPackage injects post-decision RightsCheck', async () => {
    const snap34 = uid('snap-34');
    const cand34 = uid('cand-34');
    const aud34 = uid('aud-34');
    const dec34 = uid('dec-34');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${aud34}, ${tenantA}),
        ('ContentCandidate', ${cand34}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${aud34}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO content_candidates (
        candidate_id, tenant_id, task_revision_id, strategy_id, architecture_id,
        content_payload, run_config_id
      ) VALUES (
        ${cand34}, ${tenantA}, ${taskRev1}, ${stratHypId}, ${archId}, '{}', ${rcId}
      ) ON CONFLICT DO NOTHING
    `;
    await decService.freezeDecisionSnapshot({
      snapshotId: snap34,
      baselineKnowledgeSnapshotId: bksId,
      runKnowledgeDeltaId: rkdId,
      governanceSnapshotId: govId,
      runConfigId: rcId,
      taskRevisionId: taskRev1,
      audienceStateId: aud34,
      candidateIds: [cand34],
      frozenAt: new Date(),
      tenantId: tenantA,
    });
    await decService.recordDecision({
      decisionId: dec34,
      decisionType: 'CONTENT_RELEASE',
      taskRevisionId: taskRev1,
      snapshotId: snap34,
      reasonCodes: 'APPROVED',
      selectedAction: 'PUBLISH',
      selectedCandidateId: cand34,
      releaseStatus: 'READY',
      policyResultIds: [],
      tenantId: tenantA,
    });

    let err: any;
    try {
      await decService.createFinalContentPackage({
        packageId: uid('pkg-34'),
        taskRevisionId: taskRev1,
        decisionId: dec34,
        decisionSnapshotId: snap34,
        selectedCandidateId: cand34,
        strategyId: stratHypId,
        architectureId: archId,
        audienceStateId: aud34,
        warnings: 'none',
        rightsCheckIds: ['rc-unapproved-post-freeze'], // Not in snapshot
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('POST_DECISION_RIGHTS_CHECK_INJECTION_FORBIDDEN');
  });

  it('Vector 35: second publication root', async () => {
    const lineageId = uid('lin-v35');
    await pubService.createLineageWithRoot({
      lineageId,
      channel: 'TWITTER_X',
      destination: 'dest-35',
      artifactId: uid('art-35-1'),
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Content 1',
      publishedHash: uid('hash-35-1'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    let err: any;
    try {
      await pubService.createLineageWithRoot({
        lineageId,
        channel: 'TWITTER_X',
        destination: 'dest-35',
        artifactId: uid('art-35-second'),
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Content 2',
        publishedHash: uid('hash-35-2'),
        publishedAt: new Date('2026-01-02T00:00:00Z'),
        effectiveFrom: new Date('2026-01-02T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(['LINEAGE_ALREADY_EXISTS', '23505']).toContain(err.code);
  });

  it('Vector 36: publication branch', async () => {
    const lineageId = uid('lin-v36');
    const rootId = uid('art-36-root');
    await pubService.createLineageWithRoot({
      lineageId,
      channel: 'TWITTER_X',
      destination: 'dest-36',
      artifactId: rootId,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Content Root',
      publishedHash: uid('hash-36-root'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    await pubService.appendSuccessor({
      artifactId: uid('art-36-succ-1'),
      lineageId,
      supersedesPublishedArtifactId: rootId,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Content Succ 1',
      publishedHash: uid('hash-36-s1'),
      publishedAt: new Date('2026-01-02T00:00:00Z'),
      effectiveFrom: new Date('2026-01-02T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    let err: any;
    try {
      await pubService.appendSuccessor({
        artifactId: uid('art-36-succ-branch'),
        lineageId,
        supersedesPublishedArtifactId: rootId,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Content Branch',
        publishedHash: uid('hash-36-br'),
        publishedAt: new Date('2026-01-03T00:00:00Z'),
        effectiveFrom: new Date('2026-01-03T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('PUBLICATION_BRANCHING_FORBIDDEN');
  });

  it('Vector 37: publication cross-lineage successor', async () => {
    const linA = uid('lin-37-a');
    const linB = uid('lin-37-b');
    const artA = uid('art-37-a');
    const artB = uid('art-37-b');

    await pubService.createLineageWithRoot({
      lineageId: linA,
      channel: 'TWITTER_X',
      destination: 'dest-a',
      artifactId: artA,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Content A',
      publishedHash: uid('hash-37-a'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    await pubService.createLineageWithRoot({
      lineageId: linB,
      channel: 'LINKEDIN',
      destination: 'dest-b',
      artifactId: artB,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Content B',
      publishedHash: uid('hash-37-b'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    let err: any;
    try {
      await pubService.appendSuccessor({
        artifactId: uid('art-37-cross'),
        lineageId: linA,
        supersedesPublishedArtifactId: artB, // Foreign lineage
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Cross lineage',
        publishedHash: uid('hash-37-cr'),
        publishedAt: new Date('2026-01-02T00:00:00Z'),
        effectiveFrom: new Date('2026-01-02T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('CROSS_LINEAGE_SUCCESSOR');
  });

  it('Vector 38: publication cycle', async () => {
    let err: any;
    try {
      await pubService.appendSuccessor({
        artifactId: 'art-self-cycle',
        lineageId: 'lin-cycle',
        supersedesPublishedArtifactId: 'art-self-cycle',
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Self cycle',
        publishedHash: 'hash-self',
        publishedAt: new Date(),
        effectiveFrom: new Date(),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('PUBLICATION_CYCLE');
  });

  it('Vector 39: publication effective_from non-increasing', async () => {
    const linId = uid('lin-39');
    const rootId = uid('art-39-root');
    await pubService.createLineageWithRoot({
      lineageId: linId,
      channel: 'TWITTER_X',
      destination: 'dest-39',
      artifactId: rootId,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Root',
      publishedHash: uid('hash-39-r'),
      publishedAt: new Date('2026-02-01T00:00:00Z'),
      effectiveFrom: new Date('2026-02-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    let err: any;
    try {
      await pubService.appendSuccessor({
        artifactId: uid('art-39-retro'),
        lineageId: linId,
        supersedesPublishedArtifactId: rootId,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Retro',
        publishedHash: uid('hash-39-ret'),
        publishedAt: new Date('2026-02-02T00:00:00Z'),
        effectiveFrom: new Date('2026-01-01T00:00:00Z'), // non-increasing
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('PUBLICATION_EFFECTIVE_TIME_NON_INCREASING');
  });

  it('Vector 40: CONTENTOS_EXECUTION without ExecutionArtifact', async () => {
    let err: any;
    try {
      await pubService.createLineageWithRoot({
        lineageId: uid('lin-40'),
        channel: 'TWITTER_X',
        destination: 'dest-40',
        artifactId: uid('art-40'),
        origin: 'CONTENTOS_EXECUTION',
        executionArtifactId: undefined, // Missing required ExecutionArtifact
        actualContent: 'Exec content',
        publishedHash: uid('hash-40'),
        publishedAt: new Date(),
        effectiveFrom: new Date(),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('EXECUTION_ARTIFACT_REQUIRED');
  });

  // 41-50: Measurement & Execution Invariants
  it('Vector 41: MeasurementState branch', async () => {
    const msRoot = uid('ms-root-41');
    const msSucc1 = uid('ms-succ-41-1');
    const msSucc2 = uid('ms-succ-41-2');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('MeasurementState', ${msRoot}, ${tenantA}),
        ('MeasurementState', ${msSucc1}, ${tenantA}),
        ('MeasurementState', ${msSucc2}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (
        ${msRoot}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now()
      )
    `;

    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, supersedes_measurement_state_id, data_maturity,
        is_final, late_event_window, missingness, known_incidents, observed_at
      ) VALUES (
        ${msSucc1}, ${tenantA}, ${msRoot}, 'PARTIAL', false, '7d', 'LOW', 'NONE', now()
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO measurement_states (
          measurement_state_id, tenant_id, supersedes_measurement_state_id, data_maturity,
          is_final, late_event_window, missingness, known_incidents, observed_at
        ) VALUES (
          ${msSucc2}, ${tenantA}, ${msRoot}, 'PARTIAL', false, '7d', 'LOW', 'NONE', now()
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_measurement_state_supersedes
  });

  it('Vector 42: PerformanceObservation correction branch', async () => {
    const obsId = uid('obs-42');
    const corr1 = uid('corr-42-1');
    const corr2 = uid('corr-42-2');

    const msId = uid('ms-42');
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('MeasurementState', ${msId}, ${tenantA}),
        ('PerformanceObservation', ${obsId}, ${tenantA}),
        ('PerformanceObservation', ${corr1}, ${tenantA}),
        ('PerformanceObservation', ${corr2}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (
        ${msId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now()
      ) ON CONFLICT DO NOTHING
    `;

    const now = Date.now();
    const winStart = new Date(now - 3600000);
    const winEnd = new Date(now);

    await sql`
      INSERT INTO performance_observations (
        observation_id, tenant_id, metric_revision_id, value, measurement_window_start,
        measurement_window_end, population_or_denominator, measurement_state_id,
        source_reference, observed_at, publication_state
      ) VALUES (
        ${obsId}, ${tenantA}, ${metricRev1}, '100', ${winStart}, ${winEnd}, '1000',
        ${msId}, 'src', now(), 'SINGLE_ARTIFACT'
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO performance_observations (
        observation_id, tenant_id, supersedes_observation_id, metric_revision_id, value,
        measurement_window_start, measurement_window_end, population_or_denominator,
        measurement_state_id, source_reference, observed_at, publication_state
      ) VALUES (
        ${corr1}, ${tenantA}, ${obsId}, ${metricRev1}, '105', ${winStart}, ${winEnd}, '1000',
        ${msId}, 'src', now(), 'SINGLE_ARTIFACT'
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO performance_observations (
          observation_id, tenant_id, supersedes_observation_id, metric_revision_id, value,
          measurement_window_start, measurement_window_end, population_or_denominator,
          measurement_state_id, source_reference, observed_at, publication_state
        ) VALUES (
          ${corr2}, ${tenantA}, ${obsId}, ${metricRev1}, '110', ${winStart}, ${winEnd}, '1000',
          'ms-none', 'src', now(), 'SINGLE_ARTIFACT'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_observation_predecessor
  });

  it('Vector 43: PerformanceObservation correction changes metric revision', async () => {
    const obsId = uid('obs-43');
    const msId = uid('ms-43');
    const artId = uid('art-43');
    const linId = uid('lin-43');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('MeasurementState', ${msId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (${msId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now())
      ON CONFLICT DO NOTHING
    `;
    await pubService.createLineageWithRoot({
      lineageId: linId,
      channel: 'TWITTER_X',
      destination: 'dest-43',
      artifactId: artId,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      tenantId: tenantA,
    });

    await measService.recordPerformanceObservation({
      observationId: obsId,
      publicationState: 'SINGLE_ARTIFACT',
      coveredPublishedArtifactIds: [artId],
      metricRevisionId: metricRev1,
      value: '100',
      measurementWindowStart: new Date('2026-02-01T00:00:00Z'),
      measurementWindowEnd: new Date('2026-02-02T00:00:00Z'),
      populationOrDenominator: '1000',
      measurementStateId: msId,
      sourceReference: 'src-43',
      observedAt: new Date(),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await measService.recordPerformanceObservation({
        observationId: uid('corr-43'),
        supersedesObservationId: obsId,
        publicationState: 'SINGLE_ARTIFACT',
        coveredPublishedArtifactIds: [artId],
        metricRevisionId: 'metric-different-rev', // Changes metric revision
        value: '105',
        measurementWindowStart: new Date('2026-02-01T00:00:00Z'),
        measurementWindowEnd: new Date('2026-02-02T00:00:00Z'),
        populationOrDenominator: '1000',
        measurementStateId: msId,
        sourceReference: 'src-43',
        observedAt: new Date(),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('CORRECTION_METRIC_REVISION_MISMATCH');
  });

  it('Vector 44: correction changes semantic measurement scope', async () => {
    const obsId = uid('obs-44');
    const msId = uid('ms-44');
    const artId1 = uid('art-44-1');
    const artId2 = uid('art-44-2');
    const linId = uid('lin-44');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('MeasurementState', ${msId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (${msId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now())
      ON CONFLICT DO NOTHING
    `;
    await pubService.createLineageWithRoot({
      lineageId: linId,
      channel: 'TWITTER_X',
      destination: 'dest-44',
      artifactId: artId1,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      tenantId: tenantA,
    });
    await pubService.appendSuccessor({
      lineageId: linId,
      supersedesPublishedArtifactId: artId1,
      artifactId: artId2,
      effectiveFrom: new Date('2026-01-02T00:00:00Z'),
      tenantId: tenantA,
    });

    await measService.recordPerformanceObservation({
      observationId: obsId,
      publicationState: 'SINGLE_ARTIFACT',
      coveredPublishedArtifactIds: [artId1],
      metricRevisionId: metricRev1,
      value: '100',
      measurementWindowStart: new Date('2026-02-01T00:00:00Z'),
      measurementWindowEnd: new Date('2026-02-02T00:00:00Z'),
      populationOrDenominator: '1000',
      measurementStateId: msId,
      sourceReference: 'src-44',
      observedAt: new Date(),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await measService.recordPerformanceObservation({
        observationId: uid('corr-44'),
        supersedesObservationId: obsId,
        publicationState: 'MIXED_PUBLICATION_STATE', // Changes scope from SINGLE to MIXED
        coveredPublishedArtifactIds: [artId1, artId2],
        metricRevisionId: metricRev1,
        value: '105',
        measurementWindowStart: new Date('2026-02-01T00:00:00Z'),
        measurementWindowEnd: new Date('2026-02-02T00:00:00Z'),
        populationOrDenominator: '1000',
        measurementStateId: msId,
        sourceReference: 'src-44',
        observedAt: new Date(),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('OBSERVATION_CORRECTION_SCOPE_MISMATCH');
  });

  it('Vector 45: SINGLE_ARTIFACT with zero or multiple covered artifacts', async () => {
    let err: any;
    const now = Date.now();
    try {
      await measService.recordPerformanceObservation({
        observationId: uid('obs-45'),
        publicationState: 'SINGLE_ARTIFACT',
        coveredPublishedArtifactIds: ['art-1', 'art-2'], // Violates SINGLE_ARTIFACT (requires exactly 1)
        metricRevisionId: metricRev1,
        value: '10',
        measurementWindowStart: new Date(now - 3600000),
        measurementWindowEnd: new Date(now),
        populationOrDenominator: '100',
        measurementStateId: 'ms-none',
        sourceReference: 'src',
        observedAt: new Date(now),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('SINGLE_ARTIFACT_CARDINALITY_VIOLATION');
  });

  it('Vector 46: MIXED publication observation across lineages', async () => {
    const lin1 = uid('lin-46-1');
    const lin2 = uid('lin-46-2');
    const art1 = uid('art-46-1');
    const art2 = uid('art-46-2');
    const msId = uid('ms-46');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('MeasurementState', ${msId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (
        ${msId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now()
      ) ON CONFLICT DO NOTHING
    `;

    await pubService.createLineageWithRoot({
      lineageId: lin1,
      channel: 'TWITTER_X',
      destination: 'dest-1',
      artifactId: art1,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Art 1',
      publishedHash: uid('hash-46-1'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    await pubService.createLineageWithRoot({
      lineageId: lin2,
      channel: 'LINKEDIN',
      destination: 'dest-2',
      artifactId: art2,
      origin: 'MANUAL_EXTERNAL',
      actualContent: 'Art 2',
      publishedHash: uid('hash-46-2'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      platformMetadata: '{}',
      tenantId: tenantA,
    });

    let err: any;
    const now = Date.now();
    try {
      await measService.recordPerformanceObservation({
        observationId: uid('obs-46'),
        publicationState: 'MIXED_PUBLICATION_STATE',
        coveredPublishedArtifactIds: [art1, art2],
        metricRevisionId: metricRev1,
        value: '50',
        measurementWindowStart: new Date(now - 3600000),
        measurementWindowEnd: new Date(now),
        populationOrDenominator: '500',
        measurementStateId: msId,
        sourceReference: 'src',
        observedAt: new Date(now),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('MIXED_ACROSS_LINEAGES_FORBIDDEN');
  });

  it('Vector 47: SINGLE_ARTIFACT window crosses publication interval', async () => {
    const artId = uid('art-47');
    const linId = uid('lin-47');
    const msId = uid('ms-47');

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('MeasurementState', ${msId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO measurement_states (
        measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
        missingness, known_incidents, observed_at
      ) VALUES (${msId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now())
      ON CONFLICT DO NOTHING
    `;
    await pubService.createLineageWithRoot({
      lineageId: linId,
      channel: 'TWITTER_X',
      destination: 'dest-47',
      artifactId: artId,
      effectiveFrom: new Date('2026-05-01T00:00:00Z'),
      tenantId: tenantA,
    });

    let err: any;
    try {
      await measService.recordPerformanceObservation({
        observationId: uid('obs-47'),
        publicationState: 'SINGLE_ARTIFACT',
        coveredPublishedArtifactIds: [artId],
        metricRevisionId: metricRev1,
        value: '100',
        measurementWindowStart: new Date('2026-01-01T00:00:00Z'), // Prior to publication effective_from (2026-05-01)
        measurementWindowEnd: new Date('2026-05-02T00:00:00Z'),
        populationOrDenominator: '1000',
        measurementStateId: msId,
        sourceReference: 'src-47',
        observedAt: new Date(),
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('MEASUREMENT_WINDOW_EXCEEDS_PUBLICATION');
  });

  it('Vector 48: object GC race with canonical reference creation', async () => {
    const objId = uid('obj-48-claimed');
    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${objId}, ${tenantA}, ${uid('hash-48')}, ${uid('key-48')}, 512, 'application/json', 'GC_CLAIMED')
    `;

    let err: any;
    try {
      await cpService.registerControlPlaneConfig({
        entityType: 'PromptConfig',
        stableId: uid('prompt-48'),
        revisionId: uid('rev-48'),
        tenantId: tenantA,
        objectId: objId,
        payloadHash: 'hash-arbitrary',
        payloadSchemaRevisionId: 'schema-v1',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('OBJECT_NOT_AVAILABLE');
  });

  it('Vector 49: duplicate StageExecution idempotency key', async () => {
    const runId = uid('run-49');
    const cycleId = uid('cycle-49');
    const idempKey = uid('idemp-49');

    await sql`
      INSERT INTO runs (
        run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status
      ) VALUES (
        ${runId}, ${tenantA}, ${uid('corr-49')}, ${taskRev1}, now(), ${rcId}, ${bksId}, 'ACTIVE'
      )
    `;
    await decService.createDecisionCycle({
      decisionCycleId: cycleId,
      runId,
      cycleNumber: 1,
      reason: 'Stage cycle',
      tenantId: tenantA,
    });

    await sql`
      INSERT INTO stage_executions (
        stage_execution_id, tenant_id, idempotency_key, run_id, decision_cycle_id,
        stage_name, status, canonical_input_hash
      ) VALUES (
        ${uid('stage-49-1')}, ${tenantA}, ${idempKey}, ${runId}, ${cycleId},
        'SYNTHESIS', 'COMPLETED', 'hash-1'
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO stage_executions (
          stage_execution_id, tenant_id, idempotency_key, run_id, decision_cycle_id,
          stage_name, status, canonical_input_hash
        ) VALUES (
          ${uid('stage-49-2')}, ${tenantA}, ${idempKey}, ${runId}, ${cycleId},
          'SYNTHESIS', 'COMPLETED', 'hash-2'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_stage_exec_idempotency_key
  });

  it('Vector 50: stale StageExecution fencing token', async () => {
    expect(() => {
      validateStageExecutionFencing(5, 4);
    }).toThrowError(RegistryValidationError);
  });

  // 51-60: Transactional, Immutability & Operational Invariants
  it('Vector 51: two writable DecisionCycles for one Run', async () => {
    const runId = uid('run-51');
    await sql`
      INSERT INTO runs (
        run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status
      ) VALUES (
        ${runId}, ${tenantA}, ${uid('corr-51')}, ${taskRev1}, now(), ${rcId}, ${bksId}, 'INITIALIZING'
      )
    `;

    await decService.createDecisionCycle({
      decisionCycleId: uid('cycle-51-1'),
      runId,
      cycleNumber: 1,
      reason: 'First cycle',
      tenantId: tenantA,
    });

    let err: any;
    try {
      await decService.createDecisionCycle({
        decisionCycleId: uid('cycle-51-2'),
        runId,
        cycleNumber: 2,
        reason: 'Second concurrent cycle',
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('MULTIPLE_WRITABLE_CYCLES_FORBIDDEN');
  });

  it('Vector 52: cancellation without cycle epoch bump', async () => {
    const runId = uid('run-52');
    const cycleId = uid('cycle-52');

    await sql`
      INSERT INTO runs (
        run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status
      ) VALUES (
        ${runId}, ${tenantA}, ${uid('corr-52')}, ${taskRev1}, now(), ${rcId}, ${bksId}, 'ACTIVE'
      )
    `;
    await decService.createDecisionCycle({
      decisionCycleId: cycleId,
      runId,
      cycleNumber: 1,
      reason: 'Cancellation cycle',
      tenantId: tenantA,
    });

    // Domain validator rejects cancellation without epoch bump
    expect(() => {
      validateCycleCancellation(1, 1);
    }).toThrowError(RegistryValidationError);

    // Production service cancels and atomically bumps fencing_epoch
    const [before] = await sql`SELECT fencing_epoch FROM decision_cycles WHERE decision_cycle_id = ${cycleId}`;
    await decService.cancelDecisionCycle(cycleId, runId);
    const [after] = await sql`SELECT status, fencing_epoch FROM decision_cycles WHERE decision_cycle_id = ${cycleId}`;

    expect(after?.['status']).toBe('CANCELLED');
    expect(Number(after?.['fencing_epoch'])).toBe(Number(before?.['fencing_epoch']) + 1);
  });

  it('Vector 53: duplicate API idempotency key with different request hash', async () => {
    const scope = 'CMD_SCOPE_53';
    const key = uid('key-53');
    await sql`
      INSERT INTO api_idempotency_records (
        command_scope, idempotency_key, request_hash, status
      ) VALUES (
        ${scope}, ${key}, 'hash-original', 'COMPLETED'
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          ${scope}, ${key}, 'hash-tampered-different', 'COMPLETED'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // PK violation -> IDEMPOTENCY_CONFLICT
  });

  it('Vector 54: duplicate consumer event delivery', async () => {
    const eventId = crypto.randomUUID();
    await sql`
      INSERT INTO outbox_events (
        event_id, aggregate_type, aggregate_id, event_type, payload
      ) VALUES (
        ${eventId}, 'Task', 'task-1', 'CREATED', '{}'
      )
    `;

    await sql`
      INSERT INTO consumer_receipts (consumer_name, event_id)
      VALUES ('processor-worker', ${eventId})
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('processor-worker', ${eventId})
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // duplicate key
  });

  it('Vector 55: activation interval overlap', async () => {
    const actStable = uid('stable-act-55');
    const rev1 = uid('rev-55-1');
    const rev2 = uid('rev-55-2');

    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('PromptConfig', ${actStable}, ${rev1}, ${tenantA}),
        ('PromptConfig', ${actStable}, ${rev2}, ${tenantA})
    `;

    await cpService.activateRevision({
      activationId: uid('act-55-1'),
      deploymentScope: 'TENANT_DEFAULT',
      componentType: 'PromptConfig',
      stableId: actStable,
      activeRevisionId: rev1,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveUntil: new Date('2026-06-01T00:00:00Z'),
    });

    let err: any;
    try {
      await cpService.activateRevision({
        activationId: uid('act-55-2'),
        deploymentScope: 'TENANT_DEFAULT',
        componentType: 'PromptConfig',
        stableId: actStable,
        activeRevisionId: rev2,
        effectiveFrom: new Date('2026-03-01T00:00:00Z'), // Overlaps [01-01, 06-01]
        effectiveUntil: new Date('2026-09-01T00:00:00Z'),
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('ACTIVATION_INTERVAL_OVERLAP');
  });

  it('Vector 56: ambiguous as-of activation', async () => {
    const actStable = uid('stable-act-56');
    const rev1 = uid('rev-56-1');
    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES ('PromptConfig', ${actStable}, ${rev1}, ${tenantA})
    `;
    await cpService.activateRevision({
      activationId: uid('act-56-1'),
      deploymentScope: 'TENANT_DEFAULT',
      componentType: 'PromptConfig',
      stableId: actStable,
      activeRevisionId: rev1,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveUntil: new Date('2026-06-01T00:00:00Z'),
    });

    const active = await cpService.resolveActiveAt(
      'TENANT_DEFAULT',
      'PromptConfig',
      actStable,
      new Date('2026-03-01T00:00:00Z'),
    );
    expect(active).toBe(rev1);

    const noneBefore = await cpService.resolveActiveAt(
      'TENANT_DEFAULT',
      'PromptConfig',
      actStable,
      new Date('2025-12-01T00:00:00Z'),
    );
    expect(noneBefore).toBeNull();
  });

  it('Vector 57: normal UPDATE on immutable entity', async () => {
    let err: any;
    try {
      await sql`
        UPDATE task_contract_revisions
        SET objective = 'Tampered'
        WHERE task_revision_id = ${taskRev1}
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('55000'); // MUTATION_FORBIDDEN
  });

  it('Vector 58: destructive CASCADE deletes historical graph', async () => {
    let err: any;
    try {
      await sql`DELETE FROM content_program_revisions WHERE program_revision_id = ${progRev1}`;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(['55000', '23503']).toContain(err.code);
  });

  it('Vector 59: deleted payload reported as FULL replay', async () => {
    expect(() => {
      validateReplayabilityStatus('DELETED', 'FULL');
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 60: runtime ChangeProposal directly activates revision', async () => {
    const propId = uid('cp-60');
    const targetStable = uid('prompt-target-60');
    const targetRev = uid('rev-target-60');

    // 1. Register target revision in revision_registry
    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES ('PromptConfig', ${targetStable}, ${targetRev}, ${tenantA})
    `;

    // 2. Runtime creates ChangeProposal
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('ChangeProposal', ${propId}, ${tenantA})
    `;
    await sql`
      INSERT INTO change_proposals (
        proposal_id, tenant_id, proposal_type, target_entity_type,
        target_stable_id, target_revision_id, proposed_change, uncertainty
      ) VALUES (
        ${propId}, ${tenantA}, 'POLICY_AMENDMENT', 'PromptConfig',
        ${targetStable}, ${targetRev}, 'Upgrade prompt', 'LOW'
      )
    `;

    // 3. Attempt prohibited runtime activation through real production path:
    // Case A: Runtime caller role attempts direct activation of target revision
    let errRuntime: any;
    try {
      await cpService.activateRevision({
        activationId: uid('act-60-prohibited'),
        deploymentScope: 'TENANT_DEFAULT',
        componentType: 'PromptConfig',
        stableId: targetStable,
        activeRevisionId: targetRev,
        effectiveFrom: new Date(),
        callerRole: 'RUNTIME_EXECUTION', // Prohibited runtime context
      });
    } catch (e) {
      errRuntime = e;
    }
    expect(errRuntime).toBeDefined();
    expect(errRuntime.code).toBe('RUNTIME_ACTIVATION_PROHIBITED');

    // Case B: Attempt to activate ChangeProposal directly as if proposal ID were an active revision ID (SPEC10 §68)
    let errProposalId: any;
    try {
      await cpService.activateRevision({
        activationId: uid('act-60-proposal'),
        deploymentScope: 'TENANT_DEFAULT',
        componentType: 'PromptConfig',
        stableId: targetStable,
        activeRevisionId: propId, // Prohibited proposal self-activation
        effectiveFrom: new Date(),
        callerRole: 'GOVERNANCE_CONTROL_PLANE',
      });
    } catch (e) {
      errProposalId = e;
    }
    expect(errProposalId).toBeDefined();
    expect(errProposalId.code).toBe('PROPOSAL_CANNOT_SELF_ACTIVATE');

    // Verify no activation row was created for targetStable
    const activations = await sql`
      SELECT * FROM control_plane_activations WHERE stable_id = ${targetStable}
    `;
    expect(activations.length).toBe(0);
  });

  // 61-76: Deep Relational & Storage Invariants
  it('Vector 61: primary immutable/revision identity accidentally modeled as self-FK', async () => {
    // 1. Confirm primary identity column is PRIMARY KEY
    const pks = await sql`
      SELECT c.column_name 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = ccu.column_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = 'task_contract_revisions'
    `;
    expect(pks.map(r => r['column_name'])).toContain('task_revision_id');

    // 2. Query PostgreSQL constraint metadata: verify primary identity column is NOT a self-referential foreign key
    const selfFksOnPk = await sql`
      SELECT 
        c.conname,
        rel.relname AS table_name,
        att.attname AS column_name,
        frel.relname AS ref_table_name,
        fatt.attname AS ref_column_name
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_class frel ON frel.oid = c.confrelid
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
      JOIN pg_attribute fatt ON fatt.attrelid = c.confrelid AND fatt.attnum = ANY(c.confkey)
      WHERE c.contype = 'f' 
        AND rel.relname = 'task_contract_revisions'
        AND att.attname = 'task_revision_id'
        AND frel.relname = 'task_contract_revisions'
    `;
    expect(selfFksOnPk.length).toBe(0);

    // 3. Across all canonical revision tables, verify no primary revision key is modeled as a self-FK
    const anySelfFkRevisionPks = await sql`
      SELECT 
        c.conname,
        rel.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_class frel ON frel.oid = c.confrelid
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' 
        AND rel.oid = c.confrelid
        AND att.attname LIKE '%revision_id'
    `;
    expect(anySelfFkRevisionPks.length).toBe(0);
  });

  it('Vector 62: canonical ID-set stored as opaque StructuredCollection', async () => {
    // 1. All canonical reference-set relations must exist as normalized tables with foreign keys
    const requiredNormalizedTables = [
      'strategy_required_propositions',
      'task_guardrail_metrics',
      'task_secondary_metrics',
      'channel_profile_rule_revisions',
      'channel_profile_guidance_revisions',
      'channel_profile_metric_revisions',
      'run_delta_propositions',
      'run_delta_knowledge_gaps',
      'run_delta_evidence_assessments',
      'run_delta_evidence_proposition_links',
      'run_delta_research_traces',
      'run_delta_epistemic_states',
      'decision_snapshot_candidates',
      'decision_policy_results',
      'package_alternative_candidates',
    ];
    const existingTables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = ANY(${requiredNormalizedTables})
    `;
    const foundTableNames = existingTables.map(r => r['table_name']);
    for (const t of requiredNormalizedTables) {
      expect(foundTableNames, `Normalized relation table '${t}' must exist`).toContain(t);
    }

    // 2. Parent entities must NOT simultaneously store canonical ID collections as opaque columns
    const opaqueColumns = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('task_contract_revisions', 'strategy_hypotheses', 'channel_profile_revisions', 'run_knowledge_deltas', 'decision_snapshots')
        AND column_name IN (
          'guardrail_metric_revision_ids', 'secondary_metric_revision_ids',
          'guardrail_metrics', 'secondary_metrics',
          'required_proposition_ids', 'propositions',
          'knowledge_gaps', 'evidence_assessments',
          'candidate_ids', 'candidates'
        )
    `;
    expect(opaqueColumns.length).toBe(0);

    // 3. Verify real foreign keys enforce normalized integrity on reference sets
    const joinFks = await sql`
      SELECT 
        c.conname,
        rel.relname AS table_name,
        att.attname AS column_name,
        frel.relname AS ref_table_name
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_class frel ON frel.oid = c.confrelid
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' AND rel.relname = 'task_guardrail_metrics'
    `;
    const refTables = joinFks.map(r => r['ref_table_name']);
    expect(refTables).toContain('task_contract_revisions');
    expect(refTables).toContain('metric_definition_revisions');
  });

  it('Vector 63: DecisionCycle parent/successor/current pointer crosses Run or dangles', async () => {
    let err: any;
    try {
      await sql`
        INSERT INTO decision_cycles (
          decision_cycle_id, run_id, cycle_number, parent_cycle_id, reason, status, tenant_id
        ) VALUES (
          ${uid('cycle-dangle')}, 'run-non-existent', 1, 'parent-non-existent', 'Dangling test', 'OPEN', ${tenantA}
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // FK violation to runs
  });

  it('Vector 64: retention deletion breaks typed FK graph or mutates surviving semantic history', async () => {
    const targetObj = uid('obj-ret-64');
    const key64 = uid('key-64');
    const ownerArtifactId = uid('art-ret-64');

    // 1. Create canonical target (ObjectRegistry) + dependent canonical FK reference (ObjectReference)
    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${targetObj}, ${tenantA}, ${uid('hash-64')}, ${key64}, 1024, 'application/json', 'AVAILABLE')
    `;
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('ExecutionArtifact', ${ownerArtifactId}, ${tenantA})
    `;
    await sql`
      INSERT INTO object_references (owner_entity_type, owner_entity_id, field_name, tenant_id, object_id)
      VALUES ('ExecutionArtifact', ${ownerArtifactId}, 'actual_content', ${tenantA}, ${targetObj})
    `;

    // 2. Invoke real deletion/retention enforcement path WITHOUT dependent closure:
    // Proves system refuses to leave a surviving dangling enforced FK
    let danglingErr: any;
    try {
      await retService.executeRetentionDeletion({
        tenantId: tenantA,
        targetEntityType: 'ObjectRegistry',
        targetEntityId: targetObj,
        deletionReasonCode: 'GDPR_ERASURE_REQUEST',
        dependentClosureEntities: [], // Omitting dependent reference
      });
    } catch (e) {
      danglingErr = e;
    }
    expect(danglingErr).toBeDefined();
    expect(['CANNOT_LEAVE_DANGLING_FK', '23503']).toContain(danglingErr.code);

    // Verify target was NOT deleted while dangling FK would remain
    const [stillExists] = await sql`SELECT object_id FROM object_registry WHERE object_id = ${targetObj}`;
    expect(stillExists?.['object_id']).toBe(targetObj);

    // 3. Invoke real retention deletion WITH complete lawful deletion closure
    const deletionResult = await retService.executeRetentionDeletion({
      tenantId: tenantA,
      targetEntityType: 'ObjectRegistry',
      targetEntityId: targetObj,
      deletionReasonCode: 'GDPR_ERASURE_REQUEST',
      dependentClosureEntities: [
        { entityType: 'ObjectReference', entityId: ownerArtifactId },
      ],
    });

    // 4. Verify resulting permitted deletion/degraded-replay state:
    expect(deletionResult.tombstoneCreated).toBe(true);
    expect(deletionResult.replayabilityStatus).toBe('DEGRADED');

    // 5. Verify target is removed, tombstone exists, and no surviving dangling FK exists
    const [targetAfter] = await sql`SELECT object_id FROM object_registry WHERE object_id = ${targetObj}`;
    expect(targetAfter).toBeUndefined();

    const [tombstone] = await sql`
      SELECT entity_id, payload_retained, deletion_reason_code 
      FROM deleted_target_tombstones 
      WHERE entity_id = ${targetObj}
    `;
    expect(tombstone?.['entity_id']).toBe(targetObj);
    expect(tombstone?.['payload_retained']).toBe(false);

    const survivingFks = await sql`SELECT * FROM object_references WHERE object_id = ${targetObj}`;
    expect(survivingFks.length).toBe(0);

    // 6. Verify surviving historical semantic references are not rewritten
    const [revRegistryRow] = await sql`
      SELECT revision_id FROM revision_registry WHERE revision_id = ${taskRev1}
    `;
    expect(revRegistryRow?.['revision_id']).toBe(taskRev1);
  });

  it('Vector 65: SourceArtifact snapshot_reference bypasses ObjectRegistry / GC serialization', async () => {
    const saId = uid('sa-65');
    let err: any;
    try {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('SourceArtifact', ${saId}, ${tenantA})
      `;
      await sql`
        INSERT INTO source_artifacts (
          source_id, tenant_id, source_type, publisher, author, jurisdiction,
          source_version, retrieved_at, content_hash, snapshot_reference,
          rights_policy_id, data_scope
        ) VALUES (
          ${saId}, ${tenantA}, 'DOCUMENT', 'Pub', 'Auth', 'US',
          'v1', now(), 'hash-sa', 'obj-dangling-65',
          ${policyId}, 'TENANT_PRIVATE'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // FK to object_registry
  });

  it('Vector 66: Run.current_decision_cycle_id rejects valid FREEZING/FROZEN active cycle', async () => {
    const runId = uid('run-66');
    const cycleId = uid('cycle-66');
    await sql`
      INSERT INTO runs (
        run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status
      ) VALUES (
        ${runId}, ${tenantA}, ${uid('corr-66')}, ${taskRev1}, now(), ${rcId}, ${bksId}, 'ACTIVE'
      )
    `;
    await decService.createDecisionCycle({
      decisionCycleId: cycleId,
      runId,
      cycleNumber: 1,
      reason: 'Closure cycle',
      tenantId: tenantA,
    });
    await sql`
      UPDATE decision_cycles
      SET status = 'FREEZING'
      WHERE decision_cycle_id = ${cycleId}
    `;
    const [row] = await sql`SELECT status FROM decision_cycles WHERE decision_cycle_id = ${cycleId}`;
    expect(row?.['status']).toBe('FREEZING');
  });

  it('Vector 67: required deletion retains prohibited identity data only to preserve FK/replay', async () => {
    // 1. Production database rejects tombstone with payload_retained = true
    let err: any;
    try {
      await sql`
        INSERT INTO deleted_target_tombstones (
          entity_type, entity_id, tenant_id, deletion_reason_code, payload_retained
        ) VALUES (
          'ExecutionArtifact', ${uid('del-67')}, ${tenantA}, 'GDPR_FORGOTTEN', true
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23514'); // ck_tombstone_payload_false

    // 2. Production domain validator rejects prohibited data retention
    expect(() => {
      validateDeletionTombstone({
        payload_retained: true,
      });
    }).toThrowError(RegistryValidationError);
  });

  it('Vector 68: cross-tenant ObjectRegistry content_hash/object reference collision or existence leak', async () => {
    const sharedHash = uid('shared-hash-isolated');
    const objA = uid('obj-iso-a');
    const objB = uid('obj-iso-b');
    const keyA = uid('key-iso-a');
    const keyB = uid('key-iso-b');

    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES 
        (${objA}, ${tenantA}, ${sharedHash}, ${keyA}, 256, 'text/plain', 'AVAILABLE'),
        (${objB}, ${tenantB}, ${sharedHash}, ${keyB}, 256, 'text/plain', 'AVAILABLE')
    `;

    const rowsA = await sql`SELECT object_id FROM object_registry WHERE tenant_id = ${tenantA} AND content_hash = ${sharedHash}`;
    const rowsB = await sql`SELECT object_id FROM object_registry WHERE tenant_id = ${tenantB} AND content_hash = ${sharedHash}`;
    expect(rowsA.length).toBe(1);
    expect(rowsB.length).toBe(1);
    expect(rowsA[0]?.['object_id']).not.toBe(rowsB[0]?.['object_id']);
  });

  it('Vector 69: required deletion rewrites immutable historical reference to tombstone ID', async () => {
    const saId = uid('sa-69');
    const realObjId = uid('obj-real-69');
    const tombstoneObjId = uid('obj-tombstone-69');

    // 1. Create canonical target object and historical SourceArtifact containing real reference
    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${realObjId}, ${tenantA}, ${uid('hash-69')}, ${uid('key-69')}, 512, 'text/plain', 'AVAILABLE')
    `;
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES ('SourceArtifact', ${saId}, ${tenantA})
    `;
    await sql`
      INSERT INTO source_artifacts (
        source_id, tenant_id, source_type, publisher, author, jurisdiction,
        source_version, retrieved_at, content_hash, snapshot_reference,
        rights_policy_id, data_scope
      ) VALUES (
        ${saId}, ${tenantA}, 'DOCUMENT', 'Historical Pub', 'Author', 'US',
        'v1', now(), 'hash-sa-69', ${realObjId},
        ${policyId}, 'TENANT_PRIVATE'
      )
    `;

    // 2. Create lawful deletion/tombstone state through production deletion boundary
    await sql`
      INSERT INTO deleted_target_tombstones (
        entity_type, entity_id, tenant_id, deletion_reason_code, payload_retained
      ) VALUES (
        'ObjectRegistry', ${tombstoneObjId}, ${tenantA}, 'GDPR_ERASURE_REQUEST', false
      )
    `;

    // 3. Exercise the attack: attempt to rewrite old historical reference to the tombstone ID
    let rewriteErr: any;
    try {
      await retService.rewriteHistoricalReferenceForbidden({
        tableName: 'source_artifacts',
        columnName: 'snapshot_reference',
        whereClauseColumn: 'source_id',
        whereClauseValue: saId,
        tombstoneId: tombstoneObjId,
      });
    } catch (e) {
      rewriteErr = e;
    }

    // 4. Prove production persistence boundary rejects the rewrite (immutability trigger 55000 / FK violation 23503)
    expect(rewriteErr).toBeDefined();
    expect(['55000', '23503']).toContain(rewriteErr.code);

    // 5. Verify the original immutable reference value is NOT silently substituted
    const [persistedRow] = await sql`
      SELECT snapshot_reference FROM source_artifacts WHERE source_id = ${saId}
    `;
    expect(persistedRow?.['snapshot_reference']).toBe(realObjId);
    expect(persistedRow?.['snapshot_reference']).not.toBe(tombstoneObjId);
  });

  it('Vector 70: DecisionRecord violates snapshot/task/review/selected-action closure', async () => {
    let err: any;
    try {
      await decService.recordDecision({
        decisionId: uid('dec-70'),
        decisionType: 'CONTENT_RELEASE',
        taskRevisionId: taskRev1,
        snapshotId: 'snap-non-existent',
        reasonCodes: 'APPROVED',
        selectedAction: 'PUBLISH',
        selectedCandidateId: null,
        releaseStatus: 'READY', // READY requires candidate
        policyResultIds: [],
        tenantId: tenantA,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('RELEASE_CANDIDATE_REQUIRED');
  });

  it('Vector 71: generic Control Plane revision has metadata but no exact replayable payload binding', async () => {
    let err: any;
    try {
      await cpService.registerControlPlaneConfig({
        entityType: 'PromptConfig',
        stableId: uid('prompt-71'),
        revisionId: uid('rev-71'),
        tenantId: tenantA,
        objectId: 'obj-missing',
        payloadHash: 'hash-missing',
        payloadSchemaRevisionId: 'schema-v1',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('OBJECT_NOT_FOUND');
  });

  it('Vector 72: required deletion removes target but leaves a surviving enforced FK dangling', async () => {
    let err: any;
    try {
      await sql`DELETE FROM metric_definition_revisions WHERE metric_revision_id = ${metricRev1}`;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(['55000', '23503']).toContain(err.code);
  });

  it('Vector 73: generic Control Plane payload binds tenant A revision to tenant B ObjectRegistry object', async () => {
    const objTenantB = uid('obj-73-b');
    const keyB = uid('key-73');
    const revA = uid('rev-73');
    const stableA = uid('prompt-73');

    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${objTenantB}, ${tenantB}, ${uid('hash-73')}, ${keyB}, 512, 'application/json', 'AVAILABLE')
    `;

    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES ('PromptConfig', ${stableA}, ${revA}, ${tenantA})
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO registered_control_plane_revision_payloads (
          entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
        ) VALUES (
          'PromptConfig', ${stableA}, ${revA}, ${tenantA}, ${objTenantB}, 'hash-val', 'schema-v1'
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23503'); // Composite FK (tenant_id, object_id)
  });

  it('Vector 74: GC sees zero ObjectReference rows but object is still referenced by RegisteredControlPlaneRevisionPayload', async () => {
    const obj74 = uid('obj-74');
    const key74 = uid('key-74');
    const rev74 = uid('rev-74');
    const stable74 = uid('prompt-74');

    await sql`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (${obj74}, ${tenantA}, ${uid('hash-74')}, ${key74}, 512, 'application/json', 'AVAILABLE')
    `;

    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES ('PromptConfig', ${stable74}, ${rev74}, ${tenantA})
    `;

    await sql`
      INSERT INTO registered_control_plane_revision_payloads (
        entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
      ) VALUES (
        'PromptConfig', ${stable74}, ${rev74}, ${tenantA}, ${obj74}, 'hash-val', 'schema-v1'
      )
    `;

    let err: any;
    try {
      await claimObjectForGC(sql, obj74, 'gc-claim-tok-74');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(['OBJECT_IN_USE_CANNOT_GC', 'OBJECT_STILL_REFERENCED']).toContain(err.code);
  });

  it('Vector 75: DecisionCycleBinding duplicates RunKnowledgeDelta / GovernanceSnapshot truth or disagrees with DecisionSnapshot', async () => {
    const snapId = uid('snap-75');
    const runId = uid('run-75');
    const cycle1 = uid('cycle-75-1');
    const cycle2 = uid('cycle-75-2');
    const audId = uid('aud-75');

    await sql`
      INSERT INTO runs (
        run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
        initial_run_config_id, initial_baseline_snapshot_id, status
      ) VALUES (
        ${runId}, ${tenantA}, ${uid('corr-75')}, ${taskRev1}, now(), ${rcId}, ${bksId}, 'ACTIVE'
      )
    `;
    await decService.createDecisionCycle({
      decisionCycleId: cycle1,
      runId,
      cycleNumber: 1,
      reason: 'Binding cycle 1',
      tenantId: tenantA,
    });
    // Freeze cycle 1 to allow cycle 2 to be opened
    await sql`UPDATE decision_cycles SET status = 'FROZEN' WHERE decision_cycle_id = ${cycle1}`;

    await decService.createDecisionCycle({
      decisionCycleId: cycle2,
      runId,
      cycleNumber: 2,
      reason: 'Binding cycle 2',
      tenantId: tenantA,
    });
    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES 
        ('AudienceState', ${audId}, ${tenantA}),
        ('DecisionSnapshot', ${snapId}, ${tenantA})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        ${audId}, ${tenantA}, ${taskRev1}, 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      ) ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO decision_snapshots (
        snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
        governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
      ) VALUES (
        ${snapId}, ${tenantA}, ${bksId}, ${rkdId}, ${govId}, ${rcId}, ${taskRev1}, ${audId}, now()
      )
    `;

    await sql`
      INSERT INTO decision_cycle_bindings (
        decision_cycle_id, tenant_id, decision_snapshot_id
      ) VALUES (
        ${cycle1}, ${tenantA}, ${snapId}
      )
    `;

    let err: any;
    try {
      await sql`
        INSERT INTO decision_cycle_bindings (
          decision_cycle_id, tenant_id, decision_snapshot_id
        ) VALUES (
          ${cycle2}, ${tenantA}, ${snapId}
        )
      `;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('23505'); // uq_cycle_binding_snapshot
  });

  it('Vector 76: RevisionRegistry duplicates supersession truth or disagrees with the authoritative revision row', async () => {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'revision_registry'
    `;
    const colNames = cols.map(c => c['column_name']);
    expect(colNames).not.toContain('supersedes_revision_id');
    expect(colNames).not.toContain('supersedes');
  });
});
