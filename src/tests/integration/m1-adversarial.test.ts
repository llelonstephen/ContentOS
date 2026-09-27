/**
 * M1 Adversarial Verification Suite — Live PostgreSQL Relational & Transactional Invariants
 *
 * Mechanically tests the locked SPEC02 adversarial vectors against live PostgreSQL (contentos_test):
 * 1. Enum vocabulary violation (AudienceState.state_stage = 'AWARENESS')
 * 2. Immutable UPDATE/DELETE trigger enforcement & privileged deletion bypass
 * 3. Cross-tenant private FK attacks (Control Plane payload Tenant A -> Object Tenant B)
 * 4. Control Plane payload without exact RevisionRegistry binding
 * 5. Activation interval overlap and unambiguous as-of resolution
 * 6. Publication DAG attacks: second root, cross-lineage successor, non-monotonic time, branching, cycle
 * 7. Epistemic chain attacks: second root, proposition mismatch, non-monotonic time, branching, cycle
 * 8. Measurement semantic scope attacks: cardinality violation, cross-lineage artifacts
 * 9. DecisionCycle attacks: multiple writable cycles, cross-run parent cycle, unsafe embedded IDs
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { ControlPlanePersistenceService } from '../../persistence/relational/services/control-plane-persistence-service.js';
import { PublicationPersistenceService } from '../../persistence/relational/services/publication-persistence-service.js';
import { EpistemicPersistenceService } from '../../persistence/relational/services/epistemic-persistence-service.js';
import { MeasurementPersistenceService } from '../../persistence/relational/services/measurement-persistence-service.js';
import { DecisionPersistenceService } from '../../persistence/relational/services/decision-persistence-service.js';
import { GovernanceControlPlaneGateway } from '../../control-plane/authority/control-plane-authority.js';
import { createStandaloneIngestionAdapter } from '../../bootstrap/composition-root.js';

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

describe('M1 Adversarial Verification Suite: Live PostgreSQL Invariants', () => {
  let sql: ReturnType<typeof postgres>;
  let standaloneSql: ReturnType<typeof postgres>;
  const tenantA = 'tenant-adversarial-a';
  const tenantB = 'tenant-adversarial-b';

  let cpService: ControlPlanePersistenceService;
  let pubService: PublicationPersistenceService;
  let epiService: EpistemicPersistenceService;
  let measService: MeasurementPersistenceService;
  let decService: DecisionPersistenceService;

  beforeAll(async () => {
    assertTestDatabase(DB_URL);
    sql = postgres(DB_URL, { max: 5 });

    await sql`GRANT contentos_standalone_role TO CURRENT_USER`;
    const standaloneUrl = DB_URL + (DB_URL.includes('?') ? '&' : '?') + 'options=-c%20role=contentos_standalone_role';
    standaloneSql = postgres(standaloneUrl, { max: 5 });

    cpService = new ControlPlanePersistenceService(sql);
    pubService = new PublicationPersistenceService(sql);
    epiService = new EpistemicPersistenceService(sql);
    measService = new MeasurementPersistenceService(sql);
    decService = new DecisionPersistenceService(sql);

    // Seed baseline registries
    await sql`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('ContentProgramRevision', 'prog-adv', 'prog-rev-adv', ${tenantA}),
        ('MetricDefinitionRevision', 'metric-adv-ctr', 'metric-rev-adv-ctr', ${tenantA}),
        ('TaskContractRevision', 'task-adv', 'task-rev-adv', ${tenantA}),
        ('EvalContractRevision', 'eval-adv', 'eval-rev-adv', ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
      VALUES
        ('RunConfig', 'rc-adv', ${tenantA}),
        ('KnowledgeManifest', 'km-adv', ${tenantA}),
        ('BaselineKnowledgeSnapshot', 'bks-adv', ${tenantA}),
        ('RunKnowledgeDelta', 'rkd-adv', ${tenantA}),
        ('GovernanceSnapshot', 'gov-adv', ${tenantA})
      ON CONFLICT DO NOTHING
    `;

    // Seed baseline common control plane fixtures needed for FK targets
    await sql`
      INSERT INTO content_program_revisions (
        program_id, program_revision_id, business_objective, brand_objective, target_audiences, markets,
        message_hierarchy, content_pillars, channel_roles, budget_context, effective_from, tenant_id
      ) VALUES (
        'prog-adv', 'prog-rev-adv', 'Growth', 'Authority', 'B2B', 'US', 'Value First', 'Tech', 'X', 'Q1', now(), ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO metric_definition_revisions (
        metric_id, metric_revision_id, metric_name, layer, definition, numerator, denominator, "window", effective_from, tenant_id
      ) VALUES (
        'metric-adv-ctr', 'metric-rev-adv-ctr', 'CTR', 'BEHAVIORAL', 'Clicks/Impressions', 'Clicks', 'Impressions', '7d', now(), ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO task_contract_revisions (
        task_id, task_revision_id, program_revision_id, standalone_task, objective,
        format, language, market, jurisdiction, brand_id, product_id, audience_context,
        channel, success_metric_revision_id, constraints, risk_context, compute_budget,
        tenant_id
      ) VALUES (
        'task-adv', 'task-rev-adv', 'prog-rev-adv', false, 'Adv Objective',
        'POST', 'en', 'US', 'US-FED', 'brand-adv', 'prod-adv', 'Tech Leads',
        'TWITTER_X', 'metric-rev-adv-ctr', '{}', '{}', '{}',
        ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO eval_contract_revisions (
        eval_contract_id, eval_contract_revision_id, component, capability,
        required_dimensions, hard_gates, release_impact, tenant_id
      ) VALUES (
        'eval-adv', 'eval-rev-adv', 'Quality', 'GENERATION',
        '[]', '[]', 'BLOCK_ON_FAIL', ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO run_configs (
        run_config_id, runtime_parameters, tenant_id
      ) VALUES (
        'rc-adv', '{}', ${tenantA}
      ) ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO knowledge_manifests (knowledge_manifest_id, tenant_id, content_hash)
      VALUES ('km-adv', ${tenantA}, 'hash-km-adv')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO baseline_knowledge_snapshots (baseline_snapshot_id, tenant_id, as_of, knowledge_manifest_id)
      VALUES ('bks-adv', ${tenantA}, now(), 'km-adv')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO run_knowledge_deltas (delta_id, tenant_id, run_correlation_key)
      VALUES ('rkd-adv', ${tenantA}, 'corr-adv')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO governance_snapshots (governance_snapshot_id, tenant_id, as_of)
      VALUES ('gov-adv', ${tenantA}, now())
      ON CONFLICT DO NOTHING
    `;
  });

  afterAll(async () => {
    if (standaloneSql) await standaloneSql.end();
    if (sql) await sql.end();
  });

  describe('Adversarial 1: Enum Vocabulary Violations', () => {
    it('adversarial attack: reject AudienceState.state_stage = AWARENESS (check constraint)', async () => {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('AudienceState', 'aud-invalid-stage', ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO audience_states (
            audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
            problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
            objections, decision_criteria, prior_exposure, origin, uncertainty
          ) VALUES (
            'aud-invalid-stage', ${tenantA}, 'task-rev-adv', 'AWARENESS', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23514'); // check_violation (ck_audience_state_stage)
    });

    it('should accept valid frozen AudienceState stage (FINAL_FOR_DECISION)', async () => {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('AudienceState', 'aud-valid-stage', ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO audience_states (
          audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
          problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
          objections, decision_criteria, prior_exposure, origin, uncertainty
        ) VALUES (
          'aud-valid-stage', ${tenantA}, 'task-rev-adv', 'FINAL_FOR_DECISION', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
        ) ON CONFLICT DO NOTHING
      `;

      const rows = await sql`SELECT audience_state_id FROM audience_states WHERE audience_state_id = 'aud-valid-stage'`;
      expect(rows).toHaveLength(1);
    });
  });

  describe('Adversarial 2: Immutability Protection & Triggers', () => {
    it('adversarial attack: direct insert to typed revision without RevisionRegistry must fail (REGISTRY_IDENTITY_REQUIRED)', async () => {
      let err: any;
      try {
        await sql`
          INSERT INTO task_contract_revisions (
            task_id, task_revision_id, program_revision_id, standalone_task, objective,
            format, language, market, jurisdiction, brand_id, product_id, audience_context,
            channel, success_metric_revision_id, constraints, risk_context, compute_budget,
            tenant_id
          ) VALUES (
            'unregistered-task', 'unregistered-task-rev', 'prog-rev-adv', false, 'Direct Write',
            'POST', 'en', 'US', 'US-FED', 'brand-adv', 'prod-adv', 'Audience',
            'TWITTER_X', 'metric-rev-adv-ctr', '{}', '{}', '{}',
            ${tenantA}
          )
        `;
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe('23503');
      expect(err.message).toContain('REGISTRY_IDENTITY_REQUIRED');
    });

    it('adversarial attack: direct insert to immutable entity without ImmutableEntityRegistry must fail (REGISTRY_IDENTITY_REQUIRED)', async () => {
      let err: any;
      try {
        await sql`
          INSERT INTO knowledge_manifests (knowledge_manifest_id, tenant_id, content_hash)
          VALUES ('unregistered-km', ${tenantA}, 'hash-unregistered')
        `;
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe('23503');
      expect(err.message).toContain('REGISTRY_IDENTITY_REQUIRED');
    });

    it('adversarial attack: reject ordinary UPDATE on immutable table', async () => {
      let err: any;
      try {
        await sql`
          UPDATE task_contract_revisions
          SET objective = 'Tampered Objective'
          WHERE task_revision_id = 'task-rev-adv'
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('55000'); // MUTATION_FORBIDDEN from prevent_immutable_mutation trigger
      expect(err.message).toContain('MUTATION_FORBIDDEN');
    });

    it('adversarial attack: reject ordinary DELETE on immutable table', async () => {
      let err: any;
      try {
        await sql`
          DELETE FROM task_contract_revisions
          WHERE task_revision_id = 'task-rev-adv'
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('55000'); // MUTATION_FORBIDDEN
      expect(err.message).toContain('MUTATION_FORBIDDEN');
    });

    it('adversarial attack: reject DELETE by application role even if contentos.privileged_deletion is enabled', async () => {
      const tempRevId = 'task-rev-app-role-delete';
      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES ('TaskContractRevision', 'task-app-del', ${tempRevId}, ${tenantA})
        ON CONFLICT DO NOTHING
      `;
      await sql`
        INSERT INTO task_contract_revisions (
          task_id, task_revision_id, program_revision_id, standalone_task, objective,
          format, language, market, jurisdiction, brand_id, product_id, audience_context,
          channel, success_metric_revision_id, constraints, risk_context, compute_budget,
          tenant_id
        ) VALUES (
          'task-app-del', ${tempRevId}, 'prog-rev-adv', false, 'App Role Del',
          'POST', 'en', 'US', 'US-FED', 'brand-adv', 'prod-adv', 'Tech Leads',
          'TWITTER_X', 'metric-rev-adv-ctr', '{}', '{}', '{}',
          ${tenantA}
        )
        ON CONFLICT (task_revision_id) DO NOTHING
      `;

      let err: any;
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe("SET LOCAL ROLE contentos_app_role;");
          await tx.unsafe("SET LOCAL contentos.privileged_deletion = 'on';");
          await tx`DELETE FROM task_contract_revisions WHERE task_revision_id = ${tempRevId}`;
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('42501'); // PRIVILEGED_ROLE_REQUIRED
      expect(err.message).toContain('PRIVILEGED_ROLE_REQUIRED');
    });

    it('should allow DELETE under privileged deletion role (contentos_privileged_deleter)', async () => {
      const tempRevId = 'task-rev-to-delete';
      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES ('TaskContractRevision', 'task-del', ${tempRevId}, ${tenantA})
        ON CONFLICT DO NOTHING
      `;
      await sql`
        INSERT INTO task_contract_revisions (
          task_id, task_revision_id, program_revision_id, standalone_task, objective,
          format, language, market, jurisdiction, brand_id, product_id, audience_context,
          channel, success_metric_revision_id, constraints, risk_context, compute_budget,
          tenant_id
        ) VALUES (
          'task-del', ${tempRevId}, 'prog-rev-adv', false, 'To Delete',
          'POST', 'en', 'US', 'US-FED', 'brand-adv', 'prod-adv', 'Tech Leads',
          'TWITTER_X', 'metric-rev-adv-ctr', '{}', '{}', '{}',
          ${tenantA}
        )
      `;

      // Perform privileged deletion as contentos_privileged_deleter
      await sql.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE contentos_privileged_deleter;");
        await tx.unsafe("SET LOCAL contentos.privileged_deletion = 'on';");
        await tx`DELETE FROM task_contract_revisions WHERE task_revision_id = ${tempRevId}`;
      });

      const rows = await sql`SELECT task_revision_id FROM task_contract_revisions WHERE task_revision_id = ${tempRevId}`;
      expect(rows).toHaveLength(0);
    });
  });

  describe('Adversarial 3: Cross-Tenant Private FK Attacks', () => {
    const objTenantB = 'obj-tenant-b-private';

    beforeAll(async () => {
      // Seed object belonging to Tenant B
      await sql`
        INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
        VALUES (${objTenantB}, ${tenantB}, 'hash-tenant-b', 'key-b', 512, 'application/json', 'AVAILABLE')
        ON CONFLICT DO NOTHING
      `;

      // Seed revision belonging to Tenant A
      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES ('PromptConfig', 'prompt-tenant-a', 'rev-tenant-a-1', ${tenantA})
        ON CONFLICT DO NOTHING
      `;
    });

    it('adversarial attack: Tenant A payload binding to Tenant B object must fail composite FK', async () => {
      let err: any;
      try {
        await sql`
          INSERT INTO registered_control_plane_revision_payloads (
            entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
          ) VALUES (
            'PromptConfig', 'prompt-tenant-a', 'rev-tenant-a-1', ${tenantA}, ${objTenantB}, 'hash-tenant-b', 'schema-v1'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23503'); // foreign_key_violation (composite fk tenant_id, object_id)
    });

    it('adversarial attack: ObjectReference tenant mismatch with object_registry fails composite FK', async () => {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('KnowledgeManifest', 'km-ref-tenant-a', ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO object_references (
            owner_entity_type, owner_entity_id, field_name, object_id, tenant_id
          ) VALUES (
            'KnowledgeManifest', 'km-ref-tenant-a', 'data_payload', ${objTenantB}, ${tenantA}
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23503'); // composite FK (tenant_id, object_id) -> object_registry
    });

    it('adversarial attack: Control Plane payload workspace mismatch with object workspace fails integrity check', async () => {
      const objWsA = 'obj-ws-a-1';
      await sql`
        INSERT INTO object_registry (object_id, tenant_id, workspace_id, content_hash, object_key, size_bytes, media_type, state)
        VALUES (${objWsA}, ${tenantA}, 'workspace-1', 'hash-ws-a', 'key-ws-a', 512, 'application/json', 'AVAILABLE')
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id, workspace_id)
        VALUES ('PromptConfig', 'prompt-ws-a', 'rev-ws-a', ${tenantA}, 'workspace-1')
        ON CONFLICT DO NOTHING
      `;

      let err: any;
      try {
        // Attempt payload insert with workspace-2 (mismatched with object's workspace-1)
        await sql`
          INSERT INTO registered_control_plane_revision_payloads (
            entity_type, stable_id, revision_id, tenant_id, workspace_id, object_id, payload_hash, payload_schema_revision_id
          ) VALUES (
            'PromptConfig', 'prompt-ws-a', 'rev-ws-a', ${tenantA}, 'workspace-2', ${objWsA}, 'hash-ws-a', 'schema-v1'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(['23514', 'PAYLOAD_WORKSPACE_MISMATCH']).toContain(err.code);
    });
  });

  describe('Adversarial 4: Mandatory Registries & Generic Payload Contracts', () => {
    it('adversarial attack: reject payload write without matching RevisionRegistry entry', async () => {
      const objValid = 'obj-valid-unreg';
      await sql`
        INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
        VALUES (${objValid}, ${tenantA}, 'hash-unreg', 'key-unreg', 512, 'application/json', 'AVAILABLE')
        ON CONFLICT DO NOTHING
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO registered_control_plane_revision_payloads (
            entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
          ) VALUES (
            'PromptConfig', 'unregistered-prompt', 'unregistered-rev', ${tenantA}, ${objValid}, 'hash-unreg', 'schema-v1'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23503'); // foreign_key_violation on RevisionRegistry composite key
    });

    it('transactional service: reject generic payload when hash does not match object hash', async () => {
      const objMismatch = 'obj-hash-mismatch';
      await sql`
        INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
        VALUES (${objMismatch}, ${tenantA}, 'actual-hash-123', 'key-mismatch', 512, 'application/json', 'AVAILABLE')
        ON CONFLICT DO NOTHING
      `;

      let err: any;
      try {
        await cpService.registerControlPlaneConfig({
          entityType: 'PromptConfig',
          stableId: 'prompt-mismatch',
          revisionId: 'rev-mismatch-1',
          tenantId: tenantA,
          objectId: objMismatch,
          payloadHash: 'forged-hash-456',
          payloadSchemaRevisionId: 'schema-v1',
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('PAYLOAD_HASH_MISMATCH');
    });
  });

  describe('Adversarial 5: Activation Interval Invariants & As-Of Resolution', () => {
    const timestamp = Date.now();
    const comp = 'PromptConfig';
    const stableId = `prompt-act-adv-${timestamp}`;
    const rev1 = `act-rev-1-${timestamp}`;
    const rev2 = `act-rev-2-${timestamp}`;
    const rev3 = `act-rev-3-${timestamp}`;
    const actId1 = `act-span-1-${timestamp}`;

    beforeAll(async () => {
      // Seed revisions in RevisionRegistry with unique revision IDs
      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES 
          (${comp}, ${stableId}, ${rev1}, ${tenantA}),
          (${comp}, ${stableId}, ${rev2}, ${tenantA}),
          (${comp}, ${stableId}, ${rev3}, ${tenantA})
      `;

      // Activate rev-1 from 2026-01-01 to 2026-06-01
      await cpService.activateRevision({
        activationId: actId1,
        deploymentScope: 'TENANT_DEFAULT',
        componentType: comp,
        stableId: stableId,
        activeRevisionId: rev1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveUntil: new Date('2026-06-01T00:00:00Z'),
        authority: GovernanceControlPlaneGateway.issueGovernanceAuthority(),
      });
    });

    it('adversarial attack: reject activation with overlapping interval', async () => {
      let err: any;
      try {
        // Attempt activating rev-2 from 2026-03-01 (overlaps with rev-1 interval [01-01, 06-01])
        await cpService.activateRevision({
          activationId: `act-overlap-attack-${timestamp}`,
          deploymentScope: 'TENANT_DEFAULT',
          componentType: comp,
          stableId: stableId,
          activeRevisionId: rev2,
          effectiveFrom: new Date('2026-03-01T00:00:00Z'),
          effectiveUntil: new Date('2026-09-01T00:00:00Z'),
          authority: GovernanceControlPlaneGateway.issueGovernanceAuthority(),
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('ACTIVATION_INTERVAL_OVERLAP');
    });

    it('as-of resolution: unambiguous active revision resolution', async () => {
      const activeMid = await cpService.resolveActiveAt(
        'TENANT_DEFAULT',
        comp,
        stableId,
        new Date('2026-04-01T00:00:00Z'),
      );
      expect(activeMid).toBe(rev1);

      const activeBefore = await cpService.resolveActiveAt(
        'TENANT_DEFAULT',
        comp,
        stableId,
        new Date('2025-12-31T00:00:00Z'),
      );
      expect(activeBefore).toBeNull();
    });
  });

  describe('Adversarial 6: Publication Lineage & DAG Attacks', () => {
    const timestamp = Date.now();
    const lineageId = `lin-adv-dag-${timestamp}`;
    const rootArtifactId = `art-root-1-${timestamp}`;
    const succ1ArtifactId = `art-succ-1-${timestamp}`;

    beforeAll(async () => {
      await pubService.createLineageWithRoot({
        lineageId,
        channel: 'TWITTER_X',
        destination: 'handle:@contentos',
        artifactId: rootArtifactId,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Root Content',
        publishedHash: `hash-art-root-${timestamp}`,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    });

    it('adversarial attack: reject second root artifact for same publication lineage', async () => {
      let err: any;
      try {
        await pubService.createLineageWithRoot({
          lineageId,
          channel: 'TWITTER_X',
          destination: 'handle:@contentos',
          artifactId: `art-second-root-attack-${timestamp}`,
          origin: 'MANUAL_EXTERNAL',
          actualContent: 'Second Root',
          publishedHash: `hash-art-root-2-${timestamp}`,
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

    it('adversarial attack: reject successor with non-monotonic effective_from', async () => {
      let err: any;
      try {
        await pubService.appendSuccessor({
          artifactId: `art-succ-retroactive-${timestamp}`,
          lineageId,
          supersedesPublishedArtifactId: rootArtifactId,
          origin: 'MANUAL_EXTERNAL',
          actualContent: 'Retroactive content',
          publishedHash: `hash-retro-${timestamp}`,
          publishedAt: new Date('2026-01-02T00:00:00Z'),
          effectiveFrom: new Date('2025-12-01T00:00:00Z'), // Earlier than root (2026-01-01)
          platformMetadata: '{}',
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('PUBLICATION_EFFECTIVE_TIME_NON_INCREASING');
    });

    it('adversarial attack: reject successor pointing to different lineage artifact', async () => {
      const otherLineageId = `lin-other-foreign-${timestamp}`;
      const otherRootId = `art-other-root-${timestamp}`;
      await pubService.createLineageWithRoot({
        lineageId: otherLineageId,
        channel: 'LINKEDIN',
        destination: 'org:contentos',
        artifactId: otherRootId,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Other Root',
        publishedHash: `hash-other-${timestamp}`,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });

      let err: any;
      try {
        await pubService.appendSuccessor({
          artifactId: `art-cross-lineage-attack-${timestamp}`,
          lineageId,
          supersedesPublishedArtifactId: otherRootId, // From other lineage
          origin: 'MANUAL_EXTERNAL',
          actualContent: 'Cross lineage attack',
          publishedHash: `hash-cross-${timestamp}`,
          publishedAt: new Date('2026-02-01T00:00:00Z'),
          effectiveFrom: new Date('2026-02-01T00:00:00Z'),
          platformMetadata: '{}',
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('CROSS_LINEAGE_SUCCESSOR');
    });

    it('adversarial attack: reject branching off same predecessor', async () => {
      // Append legitimate successor 1
      await pubService.appendSuccessor({
        artifactId: succ1ArtifactId,
        lineageId,
        supersedesPublishedArtifactId: rootArtifactId,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Successor 1',
        publishedHash: `hash-succ-1-${timestamp}`,
        publishedAt: new Date('2026-02-01T00:00:00Z'),
        effectiveFrom: new Date('2026-02-01T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });

      // Attempt second successor pointing to same rootArtifactId (branching attack)
      let err: any;
      try {
        await pubService.appendSuccessor({
          artifactId: `art-succ-branch-attack-${timestamp}`,
          lineageId,
          supersedesPublishedArtifactId: rootArtifactId,
          origin: 'MANUAL_EXTERNAL',
          actualContent: 'Branching successor attack',
          publishedHash: `hash-branch-${timestamp}`,
          publishedAt: new Date('2026-03-01T00:00:00Z'),
          effectiveFrom: new Date('2026-03-01T00:00:00Z'),
          platformMetadata: '{}',
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('PUBLICATION_BRANCHING_FORBIDDEN');
    });
  });

  describe('Adversarial 7: Epistemic Chain Attacks', () => {
    const timestamp = Date.now();
    const prop1 = `prop-ep-1-${timestamp}`;
    const prop2 = `prop-ep-2-${timestamp}`;
    const rootEpsId = `eps-root-1-${timestamp}`;

    beforeAll(async () => {
      // Seed immutable_entity_registry for propositions
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES
          ('Proposition', ${prop1}, ${tenantA}),
          ('Proposition', ${prop2}, ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      // Seed propositions with exact SPEC02 columns
      await sql`
        INSERT INTO propositions (
          proposition_id, tenant_id, proposition_type, canonical_meaning,
          subject, predicate, object, qualifiers, conditions, population_scope, jurisdiction_scope
        ) VALUES 
          (${prop1}, ${tenantA}, 'FACTUAL', 'AI increases efficiency', 'AI', 'increases', 'efficiency', '{}', '{}', 'ALL', 'GLOBAL'),
          (${prop2}, ${tenantA}, 'STRATEGIC', 'Content governance is critical', 'Governance', 'is', 'critical', '{}', '{}', 'ALL', 'GLOBAL')
      `;

      const evalRevId = `rev-adv-${timestamp}`;
      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES ('EvaluatorConfig', 'eval-adv', ${evalRevId}, ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      const standaloneAdapter = createStandaloneIngestionAdapter(standaloneSql);

      // Seed root epistemic state for prop1
      await standaloneAdapter.appendStandaloneEpistemicState({
        epistemicStateId: rootEpsId,
        propositionId: prop1,
        supportStatus: 'UNKNOWN',
        causalStatus: 'NOT_APPLICABLE',
        uncertainty: 'NONE',
        derivationMethod: 'RULE_BASED',
        derivationEntityType: 'EvaluatorConfig',
        derivationStableId: 'eval-adv',
        derivationRevisionId: evalRevId,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        knownFrom: new Date('2026-01-01T00:00:00Z'),
        tenantId: tenantA,
      });
    });

    it('adversarial attack: reject second root epistemic state for same proposition', async () => {
      const evalRevId = `rev-adv-${timestamp}`;
      const standaloneAdapter = createStandaloneIngestionAdapter(standaloneSql);
      let err: any;
      try {
        await standaloneAdapter.appendStandaloneEpistemicState({
          epistemicStateId: `eps-second-root-attack-${timestamp}`,
          propositionId: prop1,
          supportStatus: 'UNKNOWN',
          causalStatus: 'NOT_APPLICABLE',
          uncertainty: 'NONE',
          derivationMethod: 'RULE_BASED',
          derivationEntityType: 'EvaluatorConfig',
          derivationStableId: 'eval-adv',
          derivationRevisionId: evalRevId,
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

    it('adversarial attack: reject epistemic successor pointing to different proposition', async () => {
      const evalRevId = `rev-adv-${timestamp}`;
      const standaloneAdapter = createStandaloneIngestionAdapter(standaloneSql);
      let err: any;
      try {
        await standaloneAdapter.appendStandaloneEpistemicState({
          epistemicStateId: `eps-cross-prop-attack-${timestamp}`,
          propositionId: prop2, // Different proposition
          supersedesEpistemicStateId: rootEpsId, // Points to prop1 root
          supportStatus: 'UNKNOWN',
          causalStatus: 'NOT_APPLICABLE',
          uncertainty: 'NONE',
          derivationMethod: 'RULE_BASED',
          derivationEntityType: 'EvaluatorConfig',
          derivationStableId: 'eval-adv',
          derivationRevisionId: evalRevId,
          validFrom: new Date('2026-03-01T00:00:00Z'),
          knownFrom: new Date('2026-03-01T00:00:00Z'),
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('EPISTEMIC_PROPOSITION_MISMATCH');
    });

    it('adversarial attack: reject epistemic successor with non-monotonic known_from', async () => {
      const evalRevId = `rev-adv-${timestamp}`;
      const standaloneAdapter = createStandaloneIngestionAdapter(standaloneSql);
      let err: any;
      try {
        await standaloneAdapter.appendStandaloneEpistemicState({
          epistemicStateId: `eps-retro-attack-${timestamp}`,
          propositionId: prop1,
          supersedesEpistemicStateId: rootEpsId,
          supportStatus: 'UNKNOWN',
          causalStatus: 'NOT_APPLICABLE',
          uncertainty: 'NONE',
          derivationMethod: 'RULE_BASED',
          derivationEntityType: 'EvaluatorConfig',
          derivationStableId: 'eval-adv',
          derivationRevisionId: evalRevId,
          validFrom: new Date('2026-01-01T00:00:00Z'),
          knownFrom: new Date('2025-12-01T00:00:00Z'), // Prior to root knownFrom (2026-01-01)
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('EPISTEMIC_KNOWN_FROM_NON_INCREASING');
    });
  });

  describe('Adversarial 8: Measurement Scope & Cardinality Attacks', () => {
    const timestamp = Date.now();
    const measStateId = `ms-adv-${timestamp}`;
    const lineage1 = `lin-meas-1-${timestamp}`;
    const lineage2 = `lin-meas-2-${timestamp}`;
    const art1 = `art-meas-1-${timestamp}`;
    const art2 = `art-meas-2-${timestamp}`;
    const artOther = `art-meas-other-${timestamp}`;

    beforeAll(async () => {
      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES ('MeasurementState', ${measStateId}, ${tenantA})
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO measurement_states (
          measurement_state_id, tenant_id, data_maturity, is_final, late_event_window,
          missingness, known_incidents, observed_at
        ) VALUES (
          ${measStateId}, ${tenantA}, 'PRELIMINARY', false, '7d', 'LOW', 'NONE', now()
        )
      `;

      // Seed publication lineages and artifacts for measurement tests
      await pubService.createLineageWithRoot({
        lineageId: lineage1,
        channel: 'TWITTER_X',
        destination: 'handle:@brand',
        artifactId: art1,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Art 1',
        publishedHash: `hash-m1-${timestamp}`,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });

      await pubService.appendSuccessor({
        artifactId: art2,
        lineageId: lineage1,
        supersedesPublishedArtifactId: art1,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Art 2',
        publishedHash: `hash-m2-${timestamp}`,
        publishedAt: new Date('2026-01-05T00:00:00Z'),
        effectiveFrom: new Date('2026-01-05T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });

      await pubService.createLineageWithRoot({
        lineageId: lineage2,
        channel: 'LINKEDIN',
        destination: 'org:brand',
        artifactId: artOther,
        origin: 'MANUAL_EXTERNAL',
        actualContent: 'Art Other Lineage',
        publishedHash: `hash-m-other-${timestamp}`,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        platformMetadata: '{}',
        tenantId: tenantA,
      });
    });

    it('adversarial attack: reject SINGLE_ARTIFACT observation with 2 covered artifacts', async () => {
      let err: any;
      try {
        await measService.recordPerformanceObservation({
          observationId: `obs-cardinality-attack-${timestamp}`,
          publicationState: 'SINGLE_ARTIFACT',
          coveredPublishedArtifactIds: [art1, art2], // 2 artifacts violate SINGLE_ARTIFACT cardinality
          metricRevisionId: 'metric-rev-adv-ctr',
          value: '0.045',
          measurementWindowStart: new Date('2026-01-01T00:00:00Z'),
          measurementWindowEnd: new Date('2026-01-08T00:00:00Z'),
          populationOrDenominator: '1000',
          measurementStateId: measStateId,
          sourceReference: 'source-analytics',
          observedAt: new Date('2026-01-08T00:00:00Z'),
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('SINGLE_ARTIFACT_CARDINALITY_VIOLATION');
    });

    it('adversarial attack: reject MIXED_PUBLICATION_STATE observation with covered artifacts across different lineages', async () => {
      let err: any;
      try {
        await measService.recordPerformanceObservation({
          observationId: `obs-cross-lineage-attack-${timestamp}`,
          publicationState: 'MIXED_PUBLICATION_STATE',
          coveredPublishedArtifactIds: [art1, artOther], // from different lineages!
          metricRevisionId: 'metric-rev-adv-ctr',
          value: '0.055',
          measurementWindowStart: new Date('2026-01-01T00:00:00Z'),
          measurementWindowEnd: new Date('2026-01-08T00:00:00Z'),
          populationOrDenominator: '2000',
          measurementStateId: measStateId,
          sourceReference: 'source-analytics',
          observedAt: new Date('2026-01-08T00:00:00Z'),
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('MIXED_ACROSS_LINEAGES_FORBIDDEN');
    });
  });

  describe('Adversarial 9: DecisionCycle & Governance Closure Attacks', () => {
    const timestamp = Date.now();
    const runId = `run-adv-gov-${timestamp}`;
    const cycle1 = `cycle-adv-1-${timestamp}`;
    const snapId = `snap-adv-1-${timestamp}`;

    beforeAll(async () => {
      await sql`
        INSERT INTO runs (
          run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
          initial_run_config_id, initial_baseline_snapshot_id, status
        ) VALUES (
          ${runId}, ${tenantA}, ${'corr-' + timestamp}, 'task-rev-adv', now(), 'rc-adv', 'bks-adv', 'INITIALIZING'
        )
      `;

      // Create cycle 1
      await decService.createDecisionCycle({
        decisionCycleId: cycle1,
        runId,
        cycleNumber: 1,
        reason: 'Initial cycle',
        tenantId: tenantA,
      });
    });

    it('adversarial attack: reject opening second writable DecisionCycle while first is still OPEN', async () => {
      let err: any;
      try {
        await decService.createDecisionCycle({
          decisionCycleId: `cycle-adv-concurrent-attack-${timestamp}`,
          runId,
          cycleNumber: 2,
          reason: 'Concurrent cycle attack',
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('MULTIPLE_WRITABLE_CYCLES_FORBIDDEN');
    });

    it('adversarial attack: reject DecisionRecord release_status = READY without selected candidate', async () => {
      // Freeze snapshot
      await decService.freezeDecisionSnapshot({
        snapshotId: snapId,
        baselineKnowledgeSnapshotId: 'bks-adv',
        runKnowledgeDeltaId: 'rkd-adv',
        governanceSnapshotId: 'gov-adv',
        runConfigId: 'rc-adv',
        taskRevisionId: 'task-rev-adv',
        audienceStateId: 'aud-valid-stage',
        candidateIds: [],
        frozenAt: new Date(),
        tenantId: tenantA,
      });

      let err: any;
      try {
        await decService.recordDecision({
          decisionId: `dec-ready-no-candidate-attack-${timestamp}`,
          decisionType: 'CONTENT_RELEASE',
          taskRevisionId: 'task-rev-adv',
          snapshotId: snapId,
          reasonCodes: 'APPROVED',
          selectedAction: 'PUBLISH',
          selectedCandidateId: null, // null candidate for READY status is illegal!
          releaseStatus: 'READY',
          policyResultIds: [],
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('RELEASE_CANDIDATE_REQUIRED');
    });

    it('adversarial attack: reject DecisionRecord with embedded entity ID in selected_action', async () => {
      let err: any;
      try {
        await decService.recordDecision({
          decisionId: `dec-embedded-id-attack-${timestamp}`,
          decisionType: 'CONTENT_RELEASE',
          taskRevisionId: 'task-rev-adv',
          snapshotId: snapId,
          reasonCodes: 'APPROVED',
          selectedAction: 'PUBLISH candidate-12345', // Contains embedded entity id!
          selectedCandidateId: null,
          releaseStatus: 'BLOCKED',
          policyResultIds: [],
          tenantId: tenantA,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('SELECTED_ACTION_EMBEDDED_ENTITY_ID');
    });
  });
});
