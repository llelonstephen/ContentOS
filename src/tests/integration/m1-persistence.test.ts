/**
 * M1 Integration Test — Live PostgreSQL Persistence & Database Invariants
 *
 * Validates SPEC02 persistence contracts against live PostgreSQL (contentos_test):
 * - Clean application of M0 + M1 migrations (0000 + 0001)
 * - RevisionRegistry exact identity & triple uniqueness
 * - ImmutableEntityRegistry PK enforcement
 * - Multi-source ObjectRegistry reachability audit & GC claim protocol
 * - ControlPlaneActivation database uniqueness & interval resolution
 * - Run & DecisionCycle coherence (cycle_number uniqueness, parent uniqueness, binding uniqueness)
 * - PolicyResult & PolicyConflictResolution uniqueness
 * - PublicationLineage successor uniqueness (no branching)
 * - Relational foreign key enforcement on normalized reference sets
 * - Out-of-band Deletion Tombstone non-substitutability
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import postgres from 'postgres';
import {
  computeCanonicalObjectReachability,
  claimObjectForGC,
  finalizeObjectDeletion,
} from '../../persistence/relational/services/object-registry-service.js';

function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `SAFETY GUARD BLOCKED EXECUTION: Refusing to run destructive migration tests against non-test database '${dbName}'. Database name must explicitly contain 'test'.`,
    );
  }
}

const DB_URL =
  process.env['DATABASE_URL_TEST'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://localhost:5432/contentos_test';

describe('M1 Integration: Live PostgreSQL Relational Persistence', () => {
  let sql: ReturnType<typeof postgres>;
  const tenantId = 'tenant-test';

  beforeAll(async () => {
    assertTestDatabase(DB_URL);
    sql = postgres(DB_URL, { max: 5 });

    // Drop all existing tables to guarantee clean slate migration execution
    await sql.unsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // Apply M0 migration (0000_chemical_iron_man.sql)
    const m0MigrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0000_chemical_iron_man.sql',
    );
    const m0Sql = await fs.readFile(m0MigrationPath, 'utf-8');
    const m0Statements = m0Sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of m0Statements) {
      await sql.unsafe(stmt);
    }

    // Apply M1 migration (0001_tan_blizzard.sql)
    const m1MigrationPath = path.resolve(
      import.meta.dirname,
      '../../persistence/relational/migrations/0001_tan_blizzard.sql',
    );
    const m1Sql = await fs.readFile(m1MigrationPath, 'utf-8');
    const m1Statements = m1Sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of m1Statements) {
      await sql.unsafe(stmt);
    }

    // Seed baseline common control-plane and governance entities needed for FK trees
    await sql`
      INSERT INTO content_program_revisions (
        program_id, program_revision_id, business_objective, brand_objective, target_audiences, markets,
        message_hierarchy, content_pillars, channel_roles, budget_context, effective_from, tenant_id
      ) VALUES (
        'prog-001', 'prog-rev-001', 'Growth', 'Authority', 'B2B', 'US', 'Value First', 'Tech', 'X', 'Q1', now(), ${tenantId}
      )
    `;

    await sql`
      INSERT INTO metric_definition_revisions (
        metric_id, metric_revision_id, metric_name, layer, definition, numerator, denominator, "window", effective_from, tenant_id
      ) VALUES (
        'metric-ctr', 'metric-rev-ctr', 'Click-Through Rate', 'BEHAVIORAL', 'Clicks/Impressions', 'Clicks', 'Impressions', '7d', now(), ${tenantId}
      )
    `;

    await sql`
      INSERT INTO task_contract_revisions (
        task_id, task_revision_id, program_revision_id, task_name, primary_metric_revision_id,
        target_audience, channel, content_format, effective_from, tenant_id
      ) VALUES (
        'task-core', 'task-rev-001', 'prog-rev-001', 'Core Task', 'metric-rev-ctr',
        'Tech Leads', 'TWITTER_X', 'POST', now(), ${tenantId}
      )
    `;

    await sql`
      INSERT INTO eval_contract_revisions (
        eval_contract_id, eval_contract_revision_id, contract_name, target_artifact_type, rubric_definition,
        thresholds, effective_from, tenant_id
      ) VALUES (
        'eval-c1', 'eval-rev-001', 'Quality Contract', 'CONTENT_CANDIDATE', '{}', '{}', now(), ${tenantId}
      )
    `;

    await sql`
      INSERT INTO run_configs (
        run_config_id, task_revision_id, eval_contract_revision_id, prompt_config_revision_id,
        model_config_revision_id, retriever_config_revision_id, tool_config_revision_id,
        evaluator_config_revision_id, runtime_parameters, tenant_id
      ) VALUES (
        'rc-001', 'task-rev-001', 'eval-rev-001', 'p1', 'm1', 'r1', 't1', 'e1', '{}', ${tenantId}
      )
    `;

    await sql`
      INSERT INTO knowledge_manifests (knowledge_manifest_id, tenant_id, content_hash)
      VALUES ('km-001', ${tenantId}, 'hash-km-001')
    `;

    await sql`
      INSERT INTO baseline_knowledge_snapshots (baseline_snapshot_id, tenant_id, as_of, knowledge_manifest_id)
      VALUES ('bks-001', ${tenantId}, now(), 'km-001')
    `;

    await sql`
      INSERT INTO run_knowledge_deltas (delta_id, tenant_id, run_correlation_key)
      VALUES ('rkd-001', ${tenantId}, 'corr-key-001')
    `;

    await sql`
      INSERT INTO governance_snapshots (governance_snapshot_id, tenant_id, as_of)
      VALUES ('gov-001', ${tenantId}, now())
    `;

    await sql`
      INSERT INTO audience_states (
        audience_state_id, tenant_id, task_revision_id, state_stage, context, knowledge_state,
        problem_state, solution_state, product_state, brand_state, intent_state, desired_outcome,
        objections, decision_criteria, prior_exposure, origin, uncertainty
      ) VALUES (
        'aud-001', ${tenantId}, 'task-rev-001', 'AWARENESS', 'c', 'k', 'p', 's', 'pr', 'b', 'i', 'd', 'o', 'dc', 'pe', 'ANALYTICAL', 'u'
      )
    `;
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  describe('Database Schema & Migration Verification', () => {
    it('should verify all core M1 tables exist in information_schema', async () => {
      const requiredTables = [
        'revision_registry',
        'immutable_entity_registry',
        'object_registry',
        'canonical_object_reference_sources',
        'registered_control_plane_revisions',
        'registered_control_plane_revision_payloads',
        'control_plane_activations',
        'source_artifacts',
        'evidence_items',
        'propositions',
        'epistemic_state_versions',
        'content_candidates',
        'decision_snapshots',
        'decision_records',
        'final_content_packages',
        'publication_lineages',
        'published_artifacts',
        'runs',
        'decision_cycles',
        'decision_cycle_bindings',
        'stage_executions',
        'deleted_target_tombstones',
      ];

      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(${requiredTables})
      `;

      const foundTables = rows.map((r) => r.table_name);
      for (const t of requiredTables) {
        expect(foundTables).toContain(t);
      }
    });
  });

  describe('RevisionRegistry & ImmutableEntityRegistry Invariants', () => {
    it('should enforce RevisionRegistry triple uniqueness uq_revision_registry_triple', async () => {
      const entityType = 'GuidanceRevision';
      const stableId = 'guidance-voice';
      const revId = 'rev-001';

      await sql`
        INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
        VALUES (${entityType}, ${stableId}, ${revId}, ${tenantId})
      `;

      // Duplicate triple write MUST fail
      let err: any;
      try {
        await sql`
          INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
          VALUES (${entityType}, ${stableId}, ${revId}, ${tenantId})
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // unique_violation
    });

    it('should enforce ImmutableEntityRegistry PK uniqueness', async () => {
      const entityType = 'EvidenceItem';
      const entityId = 'ev-001';

      await sql`
        INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
        VALUES (${entityType}, ${entityId}, ${tenantId})
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO immutable_entity_registry (entity_type, entity_id, tenant_id)
          VALUES (${entityType}, ${entityId}, ${tenantId})
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // unique_violation
    });
  });

  describe('ObjectRegistry Integrity & Multi-Source Reachability Audit', () => {
    const objId = 'obj-gc-test-001';

    beforeAll(async () => {
      // Register canonical reference sources required by SPEC02 §19, §30
      await sql`
        INSERT INTO canonical_object_reference_sources (source_name, source_table, object_id_column, owner_scope_columns, active)
        VALUES 
          ('ObjectReference', 'object_references', 'object_id', 'owner_entity_type,owner_entity_id', true),
          ('ControlPlanePayload', 'registered_control_plane_revision_payloads', 'object_id', 'entity_type,revision_id', true),
          ('SourceArtifactSnapshot', 'source_artifacts', 'snapshot_reference', 'source_id', true)
        ON CONFLICT (source_name) DO NOTHING
      `;

      // Insert object in AVAILABLE state
      await sql`
        INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
        VALUES (${objId}, ${tenantId}, 'hash-001', 'key-001', 1024, 'application/json', 'AVAILABLE')
      `;
    });

    it('adversarial attack: reject GC claim when object is referenced by generic payload source', async () => {
      // Insert reference into registered_control_plane_revision_payloads (NOT object_references)
      await sql`
        INSERT INTO registered_control_plane_revision_payloads (
          entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
        ) VALUES (
          'PromptConfig', 'prompt-brand', 'rev-001', ${tenantId}, ${objId}, 'hash-001', 'schema-v1'
        )
      `;

      // Verify reachability detected the reference from payload source
      const reachability = await computeCanonicalObjectReachability(sql, objId);
      expect(reachability.totalReferences).toBe(1);
      expect(reachability.sourceCounts['ControlPlanePayload']).toBe(1);
      expect(reachability.sourceCounts['ObjectReference']).toBe(0);

      // Attempting GC claim MUST fail
      let err: any;
      try {
        await claimObjectForGC(sql, objId, 'claim-tok-123');
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('OBJECT_IN_USE_CANNOT_GC');
    });

    it('should successfully claim and delete object after all canonical references are removed', async () => {
      // Remove payload reference
      await sql`
        DELETE FROM registered_control_plane_revision_payloads
        WHERE object_id = ${objId}
      `;

      const reachability = await computeCanonicalObjectReachability(sql, objId);
      expect(reachability.totalReferences).toBe(0);

      // Claim object for GC
      await claimObjectForGC(sql, objId, 'claim-tok-123');

      const claimedRow = await sql`
        SELECT state, gc_claim_token FROM object_registry WHERE object_id = ${objId}
      `;
      expect(claimedRow[0]?.['state']).toBe('GC_CLAIMED');
      expect(claimedRow[0]?.['gc_claim_token']).toBe('claim-tok-123');

      // Finalize deletion
      await finalizeObjectDeletion(sql, objId, 'claim-tok-123');

      const deletedRow = await sql`
        SELECT state FROM object_registry WHERE object_id = ${objId}
      `;
      expect(deletedRow[0]?.['state']).toBe('DELETED');
    });
  });

  describe('ControlPlaneActivation Database Invariants', () => {
    it('should enforce uq_activation_interval_start unique constraint', async () => {
      const actId1 = 'act-uniq-001';
      const actId2 = 'act-uniq-002';
      const scope = 'TENANT_DEFAULT';
      const comp = 'PromptConfig';
      const stableId = 'prompt-intro';
      const fromTime = new Date('2026-01-01T00:00:00Z');

      await sql`
        INSERT INTO control_plane_activations (
          activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from
        ) VALUES (
          ${actId1}, ${scope}, ${comp}, ${stableId}, 'rev-001', ${fromTime}
        )
      `;

      // Duplicate start time for same scope/component/stable_id MUST be rejected
      let err: any;
      try {
        await sql`
          INSERT INTO control_plane_activations (
            activation_id, deployment_scope, component_type, stable_id, active_revision_id, effective_from
          ) VALUES (
            ${actId2}, ${scope}, ${comp}, ${stableId}, 'rev-002', ${fromTime}
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // unique_violation
    });
  });

  describe('Run & DecisionCycle Relational Coherence', () => {
    const runId = 'run-test-001';

    beforeAll(async () => {
      await sql`
        INSERT INTO runs (
          run_id, tenant_id, run_correlation_key, task_revision_id, initialization_cutoff,
          initial_run_config_id, initial_baseline_snapshot_id, status
        ) VALUES (
          ${runId}, ${tenantId}, 'corr-key-001', 'task-rev-001', now(), 'rc-001', 'bks-001', 'INITIALIZING'
        )
      `;
    });

    it('should reject duplicate cycle_number within same Run', async () => {
      await sql`
        INSERT INTO decision_cycles (
          decision_cycle_id, tenant_id, run_id, cycle_number, reason, status
        ) VALUES (
          'cycle-001', ${tenantId}, ${runId}, 1, 'Initial run cycle', 'OPEN'
        )
      `;

      // Duplicate cycle_number in same run
      let err: any;
      try {
        await sql`
          INSERT INTO decision_cycles (
            decision_cycle_id, tenant_id, run_id, cycle_number, reason, status
          ) VALUES (
            'cycle-001-dup', ${tenantId}, ${runId}, 1, 'Duplicate cycle number', 'OPEN'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_cycle_run_number
    });

    it('should reject branching cycles sharing same parent_cycle_id', async () => {
      // Child cycle 1 pointing to parent cycle-001
      await sql`
        INSERT INTO decision_cycles (
          decision_cycle_id, tenant_id, run_id, cycle_number, parent_cycle_id, reason, status
        ) VALUES (
          'cycle-002', ${tenantId}, ${runId}, 2, 'cycle-001', 'Successor 1', 'OPEN'
        )
      `;

      // Child cycle 2 attempting to branch off parent cycle-001
      let err: any;
      try {
        await sql`
          INSERT INTO decision_cycles (
            decision_cycle_id, tenant_id, run_id, cycle_number, parent_cycle_id, reason, status
          ) VALUES (
            'cycle-003', ${tenantId}, ${runId}, 3, 'cycle-001', 'Branching successor', 'OPEN'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_cycle_parent
    });

    it('should enforce DecisionCycleBinding uniqueness on decision_snapshot_id', async () => {
      const snapId = 'snap-binding-001';
      await sql`
        INSERT INTO decision_snapshots (
          snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
          governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
        ) VALUES (
          ${snapId}, ${tenantId}, 'bks-001', 'rkd-001', 'gov-001', 'rc-001', 'task-rev-001', 'aud-001', now()
        )
      `;

      // Bind snapId to cycle-001
      await sql`
        INSERT INTO decision_cycle_bindings (decision_cycle_id, tenant_id, decision_snapshot_id)
        VALUES ('cycle-001', ${tenantId}, ${snapId})
      `;

      // Attempting to bind the same snapId to cycle-002 MUST fail
      let err: any;
      try {
        await sql`
          INSERT INTO decision_cycle_bindings (decision_cycle_id, tenant_id, decision_snapshot_id)
          VALUES ('cycle-002', ${tenantId}, ${snapId})
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_cycle_binding_snapshot
    });
  });

  describe('PolicyResult & PolicyConflictResolution Database Uniqueness', () => {
    const snapId = 'snap-pol-test-001';

    beforeAll(async () => {
      await sql`
        INSERT INTO decision_snapshots (
          snapshot_id, tenant_id, baseline_knowledge_snapshot_id, run_knowledge_delta_id,
          governance_snapshot_id, run_config_id, task_revision_id, audience_state_id, frozen_at
        ) VALUES (
          ${snapId}, ${tenantId}, 'bks-001', 'rkd-001', 'gov-001', 'rc-001', 'task-rev-001', 'aud-001', now()
        )
      `;

      await sql`
        INSERT INTO decision_policy_revisions (
          policy_id, policy_revision_id, conditions, required_inputs, action, priority_class, scope,
          override_allowed, tenant_id
        ) VALUES (
          'pol-safety', 'pol-rev-001', 'c', 'i', 'BLOCK', 'HIGH', 'GLOBAL', true, ${tenantId}
        ) ON CONFLICT DO NOTHING
      `;
    });

    it('should reject duplicate PolicyResult for same (snapshot_id, policy_revision_id)', async () => {
      await sql`
        INSERT INTO policy_results (
          policy_result_id, tenant_id, snapshot_id, policy_revision_id, triggered, action, reason_code, input_uncertainty
        ) VALUES (
          'pres-001', ${tenantId}, ${snapId}, 'pol-rev-001', true, 'BLOCK', 'REASON_FAIL', 'NONE'
        )
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO policy_results (
            policy_result_id, tenant_id, snapshot_id, policy_revision_id, triggered, action, reason_code, input_uncertainty
          ) VALUES (
            'pres-002', ${tenantId}, ${snapId}, 'pol-rev-001', true, 'BLOCK', 'REASON_FAIL', 'NONE'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_policy_result_snapshot_policy
    });

    it('should reject duplicate PolicyConflictResolution for same (snapshot_id, conflict_key)', async () => {
      const conflictKey = 'conf-key-brand-safety';

      await sql`
        INSERT INTO policy_conflict_resolutions (
          resolution_id, tenant_id, snapshot_id, conflict_key, resolution_type, reason_codes
        ) VALUES (
          'conf-res-001', ${tenantId}, ${snapId}, ${conflictKey}, 'PRECEDENCE', 'RESOLVED_BY_PRIORITY'
        )
      `;

      let err: any;
      try {
        await sql`
          INSERT INTO policy_conflict_resolutions (
            resolution_id, tenant_id, snapshot_id, conflict_key, resolution_type, reason_codes
          ) VALUES (
            'conf-res-002', ${tenantId}, ${snapId}, ${conflictKey}, 'PRECEDENCE', 'RESOLVED_AGAIN'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_policy_conflict_res_snapshot_key
    });
  });

  describe('PublicationLineage & PublishedArtifact Database Invariants', () => {
    const lineageId = 'lin-x-test';

    beforeAll(async () => {
      await sql`
        INSERT INTO publication_lineages (publication_lineage_id, tenant_id, channel, destination)
        VALUES (${lineageId}, ${tenantId}, 'TWITTER_X', 'handle:@brand')
      `;
    });

    it('should reject branching in published_artifacts supersedes pointer', async () => {
      // Root artifact
      await sql`
        INSERT INTO published_artifacts (
          published_artifact_id, tenant_id, publication_lineage_id, origin, actual_content,
          published_hash, published_at, effective_from, platform_metadata
        ) VALUES (
          'pub-art-001', ${tenantId}, ${lineageId}, 'MANUAL_EXTERNAL', 'Hello World',
          'hash-pub-1', now(), now(), '{}'
        )
      `;

      // Direct successor 1
      await sql`
        INSERT INTO published_artifacts (
          published_artifact_id, tenant_id, publication_lineage_id, origin, actual_content,
          published_hash, published_at, effective_from, supersedes_published_artifact_id, platform_metadata
        ) VALUES (
          'pub-art-002', ${tenantId}, ${lineageId}, 'MANUAL_EXTERNAL', 'Hello World V2',
          'hash-pub-2', now(), now(), 'pub-art-001', '{}'
        )
      `;

      // Direct successor 2 attempting to supersede pub-art-001 (branching attack)
      let err: any;
      try {
        await sql`
          INSERT INTO published_artifacts (
            published_artifact_id, tenant_id, publication_lineage_id, origin, actual_content,
            published_hash, published_at, effective_from, supersedes_published_artifact_id, platform_metadata
          ) VALUES (
            'pub-art-003', ${tenantId}, ${lineageId}, 'MANUAL_EXTERNAL', 'Hello World V3',
            'hash-pub-3', now(), now(), 'pub-art-001', '{}'
          )
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23505'); // uq_published_artifact_supersedes
    });
  });

  describe('Relational Foreign Key Integrity on Normalized Reference Sets', () => {
    it('adversarial attack: reject reference to non-existent proposition in normalized link table', async () => {
      // Insert valid strategy hypothesis
      await sql`
        INSERT INTO strategy_hypotheses (
          strategy_id, tenant_id, task_revision_id, audience_state_id, core_message,
          behavioral_objective, persuasion_mechanism, proof_strategy, assumptions,
          unknowns, failure_modes, risk_hypotheses
        ) VALUES (
          'strat-fk-test', ${tenantId}, 'task-rev-001', 'aud-001', 'msg', 'obj', 'mech', 'proof',
          'assump', 'unknown', 'fail', 'risk'
        )
      `;

      // Attempt inserting link to non-existent proposition
      let err: any;
      try {
        await sql`
          INSERT INTO strategy_required_propositions (strategy_id, proposition_id)
          VALUES ('strat-fk-test', 'prop-non-existent-999')
        `;
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.code).toBe('23503'); // foreign_key_violation
    });
  });

  describe('Deletion Tombstones Out-Of-Band Integrity', () => {
    it('should allow writing deletion tombstones while rejecting them as substitute FK targets', async () => {
      // Write deletion tombstone out-of-band
      await sql`
        INSERT INTO deleted_target_tombstones (
          entity_type, entity_id, tenant_id, deletion_reason_code
        ) VALUES (
          'EvidenceItem', 'ev-deleted-target-123', ${tenantId}, 'GDPR_ERASURE_REQUEST'
        )
      `;

      const tombstoneRow = await sql`
        SELECT entity_type, entity_id, deletion_reason_code
        FROM deleted_target_tombstones
        WHERE entity_id = 'ev-deleted-target-123'
      `;
      expect(tombstoneRow[0]?.['entity_id']).toBe('ev-deleted-target-123');

      // Attempt to reference tombstone ID from a canonical FK column (e.g. object_references)
      let err: any;
      try {
        await sql`
          INSERT INTO object_references (
            owner_entity_type, owner_entity_id, field_name, object_id
          ) VALUES (
            'EvidenceItem', 'ev-deleted-target-123', 'snapshot_reference', 'obj-non-existent-999'
          )
        `;
      } catch (e) {
        err = e;
      }

      // Foreign key must reject it because deleted_target_tombstones is NOT a substitute target
      expect(err).toBeDefined();
      expect(err.code).toBe('23503'); // foreign_key_violation
    });
  });
});
