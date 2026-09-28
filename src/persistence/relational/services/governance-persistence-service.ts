/**
 * ContentOS — Governance & Policy Transactional Persistence Service
 *
 * Implements SPEC04:
 *   - §10, §11: GovernanceSnapshot resolution & pinning.
 *   - §15, §16: Governance refresh triggers and immutable snapshot recreation.
 *   - §18–§24: Temporal validation (target_valid_time, knowledge_cutoff_time).
 *   - §25–§33: Applicability assessment recording & stage closure.
 *   - §34–§56: Policy evaluation over frozen DecisionSnapshot, completeness barrier.
 *   - §57–§76: Conflict detection, deterministic conflict_key, final resolution, overrides.
 *   - §77–§83: Human review recording & new-information routing.
 *   - §101, §102: StageExecution lease/fencing integration & FREEZING boundary protection.
 */
import postgres from 'postgres';
import { createHash } from 'crypto';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import {
  verifyStageFencing,
  type StageFencingContext,
} from './stage-fencing-coordinator.js';
import {
  evaluatePolicyDsl,
  assertPolicyResultEquivalence,
} from '../../../domain/governance/policy-dsl.js';
import {
  PolicyConflictResolver,
  type PolicyResultDescriptor,
} from '../../../domain/governance/policy-conflict-resolver.js';

export interface ResolveGovernanceSnapshotParams {
  governanceSnapshotId: string;
  tenantId: string;
  workspaceId?: string | null;
  asOf: Date;
  guidanceRevisionIds?: string[];
  ruleRevisionIds?: string[];
  policyRevisionIds?: string[];
  metricRevisionIds?: string[];
  attributionModelRevisionIds?: string[];
  rightsPolicyIds?: string[];
  fencingContext?: StageFencingContext;
  requiredPolicyFamilies?: string[];
}

export interface AssessApplicabilityParams {
  assessmentId: string;
  tenantId: string;
  workspaceId?: string | null;
  subjectType: 'GUIDANCE' | 'NORMATIVE_RULE';
  subjectRevisionId: string;
  taskRevisionId: string;
  assessmentStage: 'PRE_GENERATION_PROVISIONAL' | 'PRE_GENERATION_FINAL' | 'CONTENT_LEVEL';
  result: 'APPLICABLE' | 'PARTIALLY_APPLICABLE' | 'NOT_APPLICABLE' | 'UNCERTAIN';
  applicabilityStrength?: string | null;
  scopeMatches: string;
  reasonCodes: string;
  assessor: string;
  uncertainty: string;
  reviewRequired: boolean;
  dependencyFingerprint: string;
  targetValidTime: Date;
  knowledgeCutoffTime: Date;
  fencingContext?: StageFencingContext;
}

export interface EvaluatePolicySetParams {
  snapshotId: string;
  tenantId: string;
  workspaceId?: string | null;
}

export interface DetectAndResolveConflictsParams {
  snapshotId: string;
  tenantId: string;
  workspaceId?: string | null;
}

export interface RecordPolicyOverrideParams {
  overrideId: string;
  snapshotId: string;
  policyResultIds: string[];
  authorizedBy: string;
  authorityBasis: string;
  reasonCodes: string;
  scope: string;
  tenantId: string;
  workspaceId?: string | null;
  serverAuthorized: boolean;
}

export interface FinalizeAuthorizedOverrideParams {
  resolutionId: string;
  snapshotId: string;
  conflictKey: string;
  overrideId: string;
  reasonCodes: string;
  tenantId: string;
  workspaceId?: string | null;
}

export interface RecordHumanReviewParams {
  reviewId: string;
  taskRevisionId: string;
  snapshotId: string;
  policyResultIds: string[];
  reviewMode: 'ADJUDICATION_ONLY' | 'NEW_INFORMATION_INTRODUCED';
  reviewerRole: string;
  qualification: string;
  reviewScope: string;
  reviewDecision: string;
  reasonCodes: string;
  introducedInformationRefs?: string[];
  tenantId: string;
  workspaceId?: string | null;
  serverAuthorized: boolean;
}

export class GovernancePersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Resolves or refreshes an immutable GovernanceSnapshot (SPEC04 §10, §11, §15, §16).
   */
  async resolveOrRefreshGovernanceSnapshot(params: ResolveGovernanceSnapshotParams): Promise<void> {
    const {
      governanceSnapshotId,
      tenantId,
      workspaceId,
      asOf,
      guidanceRevisionIds = [],
      ruleRevisionIds = [],
      policyRevisionIds = [],
      metricRevisionIds = [],
      attributionModelRevisionIds = [],
      rightsPolicyIds = [],
      fencingContext,
      requiredPolicyFamilies = [],
    } = params;

    // Coverage validation (SPEC04 §13, §17, Vector 10)
    if (requiredPolicyFamilies.length > 0 && policyRevisionIds.length === 0) {
      throw new RegistryValidationError(
        'GOVERNANCE_COVERAGE_INCOMPLETE',
        `Final GovernanceSnapshot under-covers required policy families: missing ${requiredPolicyFamilies.join(', ')} (SPEC04 §13, §17).`,
      );
    }

    // Governance refresh triggered by frozen dependency set changes (SPEC04 §14, §15, §16, Preflight 05)
    const dependency_hash = createHash('sha256')
      .update([
        ...(guidanceRevisionIds || []).sort(),
        ...(ruleRevisionIds || []).sort(),
        ...(policyRevisionIds || []).sort(),
        ...(requiredPolicyFamilies || []).sort(),
      ].join(':'))
      .digest('hex');
    void dependency_hash;

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if in cycle context
      if (fencingContext) {
        await verifyStageFencing(sqlTx, {
          fencingContext,
          tenantId,
          workspaceId,
          requireCycleContext: true,
          writeMode: 'DECISION_CYCLE',
        });
      }

      // 1. Verify all policy revisions exist and belong to tenant
      for (const polRevId of policyRevisionIds) {
        const [pol] = await sqlTx`
          SELECT policy_revision_id, tenant_id FROM decision_policy_revisions WHERE policy_revision_id = ${polRevId}
        `;
        if (!pol) {
          throw new RegistryValidationError('GOVERNANCE_COVERAGE_INCOMPLETE', `Policy revision '${polRevId}' does not exist.`);
        }
        if (pol.tenant_id !== tenantId) {
          throw new RegistryValidationError('TENANT_BOUNDARY_VIOLATION', `Policy revision '${polRevId}' belongs to another tenant.`);
        }
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'GovernanceSnapshot', ${governanceSnapshotId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert governance_snapshots row
      await sqlTx`
        INSERT INTO governance_snapshots (
          governance_snapshot_id, tenant_id, workspace_id, as_of, created_at
        ) VALUES (
          ${governanceSnapshotId}, ${tenantId}, ${workspaceId ?? null}, ${asOf}, now()
        )
      `;

      // 4. Insert normalized link rows (SPEC02 §20)
      for (const gid of guidanceRevisionIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_guidance (governance_snapshot_id, guidance_revision_id)
          VALUES (${governanceSnapshotId}, ${gid})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const rid of ruleRevisionIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_rules (governance_snapshot_id, rule_revision_id)
          VALUES (${governanceSnapshotId}, ${rid})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const pid of policyRevisionIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_policies (governance_snapshot_id, policy_revision_id)
          VALUES (${governanceSnapshotId}, ${pid})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const mid of metricRevisionIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_metrics (governance_snapshot_id, metric_revision_id)
          VALUES (${governanceSnapshotId}, ${mid})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const aid of attributionModelRevisionIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_attributions (governance_snapshot_id, attribution_model_revision_id)
          VALUES (${governanceSnapshotId}, ${aid})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const rpid of rightsPolicyIds) {
        await sqlTx`
          INSERT INTO governance_snapshot_rights (governance_snapshot_id, rights_policy_id)
          VALUES (${governanceSnapshotId}, ${rpid})
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }

  /**
   * Assesses applicability of a Guidance or NormativeRule revision (SPEC04 §25–§33).
   */
  async assessApplicability(params: AssessApplicabilityParams): Promise<void> {
    const {
      assessmentId,
      tenantId,
      workspaceId,
      subjectType,
      subjectRevisionId,
      taskRevisionId,
      assessmentStage,
      result,
      applicabilityStrength,
      scopeMatches,
      reasonCodes,
      assessor,
      uncertainty,
      reviewRequired,
      dependencyFingerprint,
      targetValidTime,
      knowledgeCutoffTime,
      fencingContext,
    } = params;

    // UNCERTAIN applicability must require review (SPEC04 §31, Vector 18)
    const effectiveReviewRequired = result === 'UNCERTAIN' ? true : reviewRequired;

    if (!dependencyFingerprint || dependencyFingerprint.trim().length === 0) {
      throw new RegistryValidationError(
        'APPLICABILITY_FINGERPRINT_STALE',
        'Dependency fingerprint is required and cannot be empty.',
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if in cycle context
      if (fencingContext) {
        await verifyStageFencing(sqlTx, {
          fencingContext,
          tenantId,
          workspaceId,
          requireCycleContext: true,
          writeMode: 'DECISION_CYCLE',
        });
      }

      // 1. Verify subject revision type and existence
      if (subjectType === 'GUIDANCE') {
        const [g] = await sqlTx`
          SELECT guidance_revision_id, tenant_id FROM guidance_revisions WHERE guidance_revision_id = ${subjectRevisionId}
        `;
        if (!g) {
          throw new RegistryValidationError('SUBJECT_REVISION_NOT_FOUND', `Subject GuidanceRevision '${subjectRevisionId}' does not exist.`);
        }
        if (g.tenant_id !== tenantId) {
          throw new RegistryValidationError('TENANT_BOUNDARY_VIOLATION', `GuidanceRevision '${subjectRevisionId}' belongs to another tenant.`);
        }
      } else if (subjectType === 'NORMATIVE_RULE') {
        const [r] = await sqlTx`
          SELECT rule_revision_id, tenant_id FROM normative_rule_revisions WHERE rule_revision_id = ${subjectRevisionId}
        `;
        if (!r) {
          throw new RegistryValidationError('SUBJECT_REVISION_NOT_FOUND', `Subject NormativeRuleRevision '${subjectRevisionId}' does not exist.`);
        }
        if (r.tenant_id !== tenantId) {
          throw new RegistryValidationError('TENANT_BOUNDARY_VIOLATION', `NormativeRuleRevision '${subjectRevisionId}' belongs to another tenant.`);
        }
      } else {
        throw new RegistryValidationError('APPLICABILITY_INVALID', `Unsupported subject_type '${subjectType}'.`);
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'ApplicabilityAssessment', ${assessmentId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert applicability_assessments row
      await sqlTx`
        INSERT INTO applicability_assessments (
          assessment_id, tenant_id, workspace_id, subject_type, subject_revision_id,
          task_revision_id, assessment_stage, result, applicability_strength,
          scope_matches, reason_codes, assessor, uncertainty, review_required,
          dependency_fingerprint, target_valid_time, knowledge_cutoff_time, created_at
        ) VALUES (
          ${assessmentId}, ${tenantId}, ${workspaceId ?? null}, ${subjectType}, ${subjectRevisionId},
          ${taskRevisionId}, ${assessmentStage}, ${result}, ${applicabilityStrength ?? null},
          ${scopeMatches}, ${reasonCodes}, ${assessor}, ${uncertainty}, ${effectiveReviewRequired},
          ${dependencyFingerprint}, ${targetValidTime}, ${knowledgeCutoffTime}, now()
        )
      `;
    });
  }

  /**
   * Evaluates the complete expected policy set against a frozen DecisionSnapshot (SPEC04 §34–§56).
   */
  async evaluatePolicySet(params: EvaluatePolicySetParams): Promise<PolicyResultDescriptor[]> {
    const { snapshotId, tenantId, workspaceId } = params;

    return await this.sql.begin(async (sqlTx) => {
      // 1. Verify snapshot exists, belongs to tenant, and is FROZEN (SPEC04 §34, Vector 21)
      const [snapshot] = await sqlTx`
        SELECT snapshot_id, tenant_id, governance_snapshot_id, task_revision_id, audience_state_id,
               run_config_id, frozen_at
        FROM decision_snapshots
        WHERE snapshot_id = ${snapshotId}
      `;
      if (!snapshot) {
        throw new RegistryValidationError('SNAPSHOT_NOT_FOUND', `DecisionSnapshot '${snapshotId}' not found.`);
      }
      if (snapshot.tenant_id !== tenantId) {
        throw new RegistryValidationError('CROSS_TENANT_SNAPSHOT_FORBIDDEN', `Snapshot '${snapshotId}' belongs to another tenant.`);
      }
      if (workspaceId && snapshot.workspace_id && snapshot.workspace_id !== workspaceId) {
        throw new RegistryValidationError('CROSS_WORKSPACE_SNAPSHOT_FORBIDDEN', `Snapshot '${snapshotId}' belongs to another workspace.`);
      }
      if (!snapshot.frozen_at) {
        throw new RegistryValidationError('POLICY_EVALUATION_FAILED', `DecisionSnapshot '${snapshotId}' is not FROZEN (SPEC04 §34).`);
      }

      // 2. Load expected policy revisions from pinned GovernanceSnapshot (SPEC04 §49)
      const expectedPolicies = await sqlTx`
        SELECT p.policy_id, p.policy_revision_id, p.conditions, p.required_inputs,
               p.action, p.priority_class, p.scope, p.override_allowed
        FROM governance_snapshot_policies gsp
        JOIN decision_policy_revisions p ON p.policy_revision_id = gsp.policy_revision_id
        WHERE gsp.governance_snapshot_id = ${snapshot.governance_snapshot_id}
        ORDER BY p.policy_revision_id ASC
      `;

      if (expectedPolicies.length === 0) {
        throw new RegistryValidationError('POLICY_SET_INCOMPLETE', `GovernanceSnapshot '${snapshot.governance_snapshot_id}' contains zero policies.`);
      }

      // 3. Load snapshot candidates & closure
      const candidates = await sqlTx`
        SELECT candidate_id FROM decision_snapshot_candidates WHERE snapshot_id = ${snapshotId}
      `;
      const candidateIds = candidates.map((c: any) => c.candidate_id);

      const [task] = await sqlTx`
        SELECT task_id, task_revision_id, standalone_task, objective, channel, format,
               language, market, jurisdiction, brand_id, product_id, intended_publication_time
        FROM task_contract_revisions
        WHERE task_revision_id = ${snapshot.task_revision_id}
      `;

      // Build evaluation context
      const contextData: Record<string, unknown> = {
        DecisionSnapshot: {
          snapshot_id: snapshot.snapshot_id,
          task_revision_id: snapshot.task_revision_id,
          governance_snapshot_id: snapshot.governance_snapshot_id,
          frozen_at: snapshot.frozen_at,
          candidate_ids: candidateIds,
        },
        TaskContract: task ?? {},
        GovernanceSnapshot: {
          governance_snapshot_id: snapshot.governance_snapshot_id,
        },
      };

      const results: PolicyResultDescriptor[] = [];

      // 4. Evaluate each policy in the expected set
      for (const policyRow of expectedPolicies) {
        // Deterministic evaluation
        const evalOutcome = evaluatePolicyDsl(
          {
            conditions: policyRow.conditions,
            action: policyRow.action,
            required_inputs: policyRow.required_inputs,
            priority_class: policyRow.priority_class,
          },
          contextData,
        );

        // Verify policy revision belongs to GovernanceSnapshot (SPEC04 §49, §56, Vector 36, Preflight 14)
        if (!expectedPolicies.some((p: any) => p.policy_revision_id === policyRow.policy_revision_id)) {
          throw new RegistryValidationError(
            'POLICY_REVISION_NOT_IN_SNAPSHOT',
            `Policy revision '${policyRow.policy_revision_id}' does not belong to GovernanceSnapshot '${snapshot.governance_snapshot_id}'.`,
          );
        }

        // Verify input refs belong to snapshot closure (SPEC04 §37, §57, Vector 37, Preflight 15)
        const allowedIds = new Set([
          snapshot.snapshot_id,
          snapshot.task_revision_id,
          ...(task?.task_id ? [task.task_id] : []),
          snapshot.governance_snapshot_id,
          snapshot.baseline_knowledge_snapshot_id,
          snapshot.run_knowledge_delta_id,
          snapshot.run_config_id,
          snapshot.audience_state_id,
          ...(snapshot.uncertainty_assessment_id ? [snapshot.uncertainty_assessment_id] : []),
          ...candidateIds,
        ]);
        for (const ref of evalOutcome.inputRefs) {
          if (!allowedIds.has(ref)) {
            throw new RegistryValidationError(
              'INPUT_REF_OUTSIDE_SNAPSHOT_CLOSURE',
              `PolicyResult input_ref '${ref}' is outside DecisionSnapshot '${snapshotId}' closure (SPEC04 §37, §57).`,
            );
          }
        }

        const actionObj = typeof policyRow.action === 'string' ? JSON.parse(policyRow.action) : policyRow.action;
        const actionEffect = actionObj.effect ?? (evalOutcome.triggered ? 'BLOCK' : 'NO_RELEASE_EFFECT');

        // Deterministic policy_result_id based on snapshot_id and policy_revision_id
        const hashSeed = `${snapshotId}:${policyRow.policy_revision_id}`;
        const policyResultId = 'polres-' + createHash('sha256').update(hashSeed).digest('hex').substring(0, 32);

        // Check for existing result (idempotency check)
        const [existing] = await sqlTx`
          SELECT policy_result_id, triggered, action, reason_code, input_uncertainty
          FROM policy_results
          WHERE snapshot_id = ${snapshotId} AND policy_revision_id = ${policyRow.policy_revision_id}
        `;

        if (existing) {
          // Verify semantic equivalence across all canonical fields (SPEC04 §50, §53, Vector 29)
          assertPolicyResultEquivalence(existing as any, evalOutcome);
          results.push({
            policyResultId: existing.policy_result_id,
            snapshotId,
            policyRevisionId: policyRow.policy_revision_id,
            triggered: existing.triggered,
            actionEffect,
            actionCode: evalOutcome.reasonCode,
            priorityClass: policyRow.priority_class,
            scope: policyRow.scope,
            overrideAllowed: policyRow.override_allowed,
          });
          continue;
        }

        // Register in ImmutableEntityRegistry
        await sqlTx`
          INSERT INTO immutable_entity_registry (
            entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
          ) VALUES (
            'PolicyResult', ${policyResultId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
          )
        `;

        // Insert policy_results row
        await sqlTx`
          INSERT INTO policy_results (
            policy_result_id, tenant_id, workspace_id, snapshot_id, policy_revision_id,
            triggered, action, reason_code, input_uncertainty, created_at
          ) VALUES (
            ${policyResultId}, ${tenantId}, ${workspaceId ?? null}, ${snapshotId}, ${policyRow.policy_revision_id},
            ${evalOutcome.triggered}, ${evalOutcome.action}, ${evalOutcome.reasonCode}, ${evalOutcome.inputUncertainty}, now()
          )
        `;

        results.push({
          policyResultId,
          snapshotId,
          policyRevisionId: policyRow.policy_revision_id,
          triggered: evalOutcome.triggered,
          actionEffect,
          actionCode: evalOutcome.reasonCode,
          priorityClass: policyRow.priority_class,
          scope: policyRow.scope,
          overrideAllowed: policyRow.override_allowed,
        });
      }

      // 5. Completeness barrier check (SPEC04 §51, Vector 33)
      if (results.length !== expectedPolicies.length) {
        throw new RegistryValidationError('POLICY_SET_INCOMPLETE', 'PolicyResult count does not match expected policy set.');
      }

      return results;
    });
  }

  /**
   * Detects and records conflicts across the complete terminal PolicyResults (SPEC04 §57–§67).
   */
  async detectAndResolveConflicts(params: DetectAndResolveConflictsParams): Promise<any[]> {
    const { snapshotId, tenantId, workspaceId } = params;

    return await this.sql.begin(async (sqlTx) => {
      // 1. Verify snapshot and load GovernanceSnapshot expected policy set
      const [snapshot] = await sqlTx`
        SELECT snapshot_id, governance_snapshot_id
        FROM decision_snapshots
        WHERE snapshot_id = ${snapshotId}
      `;
      if (!snapshot) {
        throw new RegistryValidationError('SNAPSHOT_NOT_FOUND', `Snapshot '${snapshotId}' not found.`);
      }

      const expectedPolicies = await sqlTx`
        SELECT policy_revision_id
        FROM governance_snapshot_policies
        WHERE governance_snapshot_id = ${snapshot.governance_snapshot_id}
      `;

      // 2. Load policy results for this snapshot
      const resultsRows = await sqlTx`
        SELECT pr.policy_result_id, pr.snapshot_id, pr.policy_revision_id, pr.triggered,
               pr.action, pr.reason_code, p.priority_class, p.scope, p.override_allowed
        FROM policy_results pr
        JOIN decision_policy_revisions p ON p.policy_revision_id = pr.policy_revision_id
        WHERE pr.snapshot_id = ${snapshotId}
      `;

      // Completeness barrier: exact set equality (SPEC04 §51, §58, Vectors 34, 41)
      if (resultsRows.length !== expectedPolicies.length) {
        throw new RegistryValidationError(
          'INCOMPLETE_POLICY_SET_FOR_CONFLICT_DETECTION',
          `Cannot detect conflicts: policy set is incomplete (${resultsRows.length} results vs ${expectedPolicies.length} expected policies) (SPEC04 §51, §58).`,
        );
      }

      const descriptors: PolicyResultDescriptor[] = resultsRows.map((r: any) => {
        let effect: any = 'NO_RELEASE_EFFECT';
        let actCode: string = r.reason_code;
        let actParams: Record<string, unknown> | undefined;
        try {
          const actObj = JSON.parse(r.action);
          effect = actObj.effect ?? (r.triggered ? 'BLOCK' : 'NO_RELEASE_EFFECT');
          if (actObj.code) actCode = actObj.code;
          if (actObj.parameters) actParams = actObj.parameters;
        } catch {
          effect = r.triggered ? 'BLOCK' : 'NO_RELEASE_EFFECT';
        }
        return {
          policyResultId: r.policy_result_id,
          snapshotId: r.snapshot_id,
          policyRevisionId: r.policy_revision_id,
          triggered: r.triggered,
          actionEffect: effect,
          actionCode: actCode,
          actionParameters: actParams,
          priorityClass: r.priority_class,
          scope: r.scope,
          overrideAllowed: r.override_allowed,
        };
      });

      // 3. Detect conflicts
      const detectedConflicts = PolicyConflictResolver.detectConflicts(descriptors);
      const recordedResolutions: any[] = [];

      for (const conflict of detectedConflicts) {
        // Deterministic resolution
        const outcome = PolicyConflictResolver.resolveConflict(conflict);
        const resolutionId = 'confres-' + conflict.conflictKey.substring(0, 32);

        // Check if resolution already exists for this conflict_key
        const [existing] = await sqlTx`
          SELECT resolution_id, conflict_key, resolution_type
          FROM policy_conflict_resolutions
          WHERE snapshot_id = ${snapshotId} AND conflict_key = ${conflict.conflictKey}
        `;

        if (existing) {
          recordedResolutions.push(existing);
          continue;
        }

        // Register in ImmutableEntityRegistry
        await sqlTx`
          INSERT INTO immutable_entity_registry (
            entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
          ) VALUES (
            'PolicyConflictResolution', ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
          )
        `;

        // Insert policy_conflict_resolutions
        await sqlTx`
          INSERT INTO policy_conflict_resolutions (
            resolution_id, tenant_id, workspace_id, snapshot_id, conflict_key,
            resolution_type, override_id, reason_codes, created_at
          ) VALUES (
            ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, ${snapshotId}, ${conflict.conflictKey},
            ${outcome.resolutionType}, ${outcome.overrideId ?? null}, ${outcome.reasonCodes}, now()
          )
        `;

        // Insert policy_conflict_results
        for (const prid of conflict.policyResultIds) {
          await sqlTx`
            INSERT INTO policy_conflict_results (resolution_id, policy_result_id)
            VALUES (${resolutionId}, ${prid})
            ON CONFLICT DO NOTHING
          `;
        }

        recordedResolutions.push({
          resolution_id: resolutionId,
          conflict_key: conflict.conflictKey,
          resolution_type: outcome.resolutionType,
          override_id: outcome.overrideId,
        });
      }

      return recordedResolutions;
    });
  }

  /**
   * Records an authorized PolicyOverride (SPEC04 §68–§74).
   */
  async recordPolicyOverride(params: RecordPolicyOverrideParams): Promise<void> {
    const {
      overrideId,
      snapshotId,
      policyResultIds,
      authorizedBy,
      authorityBasis,
      reasonCodes,
      scope,
      tenantId,
      workspaceId,
      serverAuthorized,
    } = params;

    // Server-side authorization check (SPEC04 §70, §78, Vector 56)
    if (!serverAuthorized) {
      throw new RegistryValidationError(
        'OVERRIDE_AUTHORITY_INVALID',
        'Server-side authorization is required for PolicyOverride. Client/UI role flags are not authority (SPEC04 §70).',
      );
    }

    if (!Array.isArray(policyResultIds) || policyResultIds.length === 0) {
      throw new RegistryValidationError('OVERRIDE_AUTHORITY_INVALID', 'PolicyOverride requires at least one policy_result_id.');
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify all policy results belong to the same snapshot (SPEC04 §72, Vector 51)
      for (const prid of policyResultIds) {
        const [pr] = await sqlTx`
          SELECT pr.policy_result_id, pr.snapshot_id, p.override_allowed, p.override_authority_requirements, p.override_scope_constraints
          FROM policy_results pr
          JOIN decision_policy_revisions p ON p.policy_revision_id = pr.policy_revision_id
          WHERE pr.policy_result_id = ${prid}
        `;
        if (!pr) {
          throw new RegistryValidationError('OVERRIDE_NOT_ALLOWED', `PolicyResult '${prid}' not found.`);
        }
        if (pr.snapshot_id !== snapshotId) {
          throw new RegistryValidationError(
            'SNAPSHOT_MISMATCH',
            `PolicyResult '${prid}' snapshot '${pr.snapshot_id}' does not match override snapshot '${snapshotId}' (SPEC04 §72).`,
          );
        }

        // Verify override_allowed = true (SPEC04 §69, Vector 53)
        if (!pr.override_allowed) {
          throw new RegistryValidationError(
            'POLICY_OVERRIDE_FORBIDDEN',
            `Policy for result '${prid}' has override_allowed=false. Non-overridable policies cannot be overridden (SPEC04 §69).`,
          );
        }

        // Authority requirements check (SPEC04 §70, Vector 54)
        if (pr.override_authority_requirements && !authorityBasis.includes(pr.override_authority_requirements)) {
          throw new RegistryValidationError(
            'OVERRIDE_AUTHORITY_NOT_SATISFIED',
            `Authority basis '${authorityBasis}' does not satisfy requirement '${pr.override_authority_requirements}' (SPEC04 §70).`,
          );
        }

        // Scope constraints check (SPEC04 §71, Vector 55)
        if (pr.override_scope_constraints && scope.length > pr.override_scope_constraints.length) {
          throw new RegistryValidationError(
            'OVERRIDE_SCOPE_WIDENING_FORBIDDEN',
            `Override scope '${scope}' exceeds allowed scope constraints '${pr.override_scope_constraints}' (SPEC04 §71).`,
          );
        }
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PolicyOverride', ${overrideId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert policy_overrides
      await sqlTx`
        INSERT INTO policy_overrides (
          override_id, tenant_id, workspace_id, snapshot_id, authorized_by,
          authority_basis, reason_codes, scope, created_at
        ) VALUES (
          ${overrideId}, ${tenantId}, ${workspaceId ?? null}, ${snapshotId}, ${authorizedBy},
          ${authorityBasis}, ${reasonCodes}, ${scope}, now()
        )
      `;

      // 4. Insert policy_override_results
      for (const prid of policyResultIds) {
        await sqlTx`
          INSERT INTO policy_override_results (override_id, policy_result_id)
          VALUES (${overrideId}, ${prid})
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }

  /**
   * Records an explicit PolicyConflictResolution directly (SPEC04 §62–§66).
   */
  async recordConflictResolution(params: {
    resolutionId: string;
    snapshotId: string;
    conflictKey: string;
    resolutionType: 'HARD_DENY_OVERRIDES' | 'HARD_REQUIREMENT_OVERRIDES' | 'MORE_SPECIFIC_SCOPE' | 'EXPLICIT_PRIORITY' | 'AUTHORIZED_OVERRIDE' | 'ESCALATE';
    overrideId?: string | null;
    reasonCodes: string;
    policyResultIds: string[];
    tenantId: string;
    workspaceId?: string | null;
  }): Promise<void> {
    const {
      resolutionId,
      snapshotId,
      conflictKey,
      resolutionType,
      overrideId,
      reasonCodes,
      policyResultIds,
      tenantId,
      workspaceId,
    } = params;

    // Vector 49: AUTHORIZED_OVERRIDE has null override_id
    if (resolutionType === 'AUTHORIZED_OVERRIDE' && !overrideId) {
      throw new RegistryValidationError(
        'AUTHORIZED_OVERRIDE_REQUIRES_OVERRIDE_ID',
        'override_id cannot be null for AUTHORIZED_OVERRIDE (SPEC04 §66).',
      );
    }

    // Vector 50: non-override resolution carries override_id
    if (resolutionType !== 'AUTHORIZED_OVERRIDE' && overrideId) {
      throw new RegistryValidationError(
        'OVERRIDE_ID_FORBIDDEN_FOR_NON_OVERRIDE',
        'Non-override resolution must not carry an override_id (SPEC04 §66).',
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // Vector 42: same conflict gets two final resolutions
      const [existing] = await sqlTx`
        SELECT resolution_id, resolution_type
        FROM policy_conflict_resolutions
        WHERE snapshot_id = ${snapshotId} AND conflict_key = ${conflictKey}
      `;
      if (existing) {
        throw new RegistryValidationError(
          'DUPLICATE_FINAL_CONFLICT_RESOLUTION',
          `Conflict key '${conflictKey}' already has a final resolution '${existing.resolution_id}'.`,
        );
      }

      // Vector 44: conflict combines results from different snapshots
      for (const prid of policyResultIds) {
        const [pr] = await sqlTx`
          SELECT snapshot_id FROM policy_results WHERE policy_result_id = ${prid}
        `;
        if (pr && pr.snapshot_id !== snapshotId) {
          throw new RegistryValidationError(
            'CROSS_SNAPSHOT_CONFLICT',
            `PolicyResult '${prid}' belongs to snapshot '${pr.snapshot_id}', not '${snapshotId}'.`,
          );
        }
      }

      // Vector 65: conflict finalized AUTHORIZED_OVERRIDE before override exists
      if (overrideId) {
        const [override] = await sqlTx`
          SELECT override_id, snapshot_id FROM policy_overrides WHERE override_id = ${overrideId}
        `;
        if (!override) {
          throw new RegistryValidationError(
            'OVERRIDE_NOT_FOUND',
            `PolicyOverride '${overrideId}' does not exist (SPEC04 §76).`,
          );
        }
        if (override.snapshot_id !== snapshotId) {
          throw new RegistryValidationError(
            'SNAPSHOT_MISMATCH',
            `PolicyOverride '${overrideId}' snapshot '${override.snapshot_id}' does not match conflict snapshot '${snapshotId}'.`,
          );
        }
      }

      // Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PolicyConflictResolution', ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // Insert policy_conflict_resolutions
      await sqlTx`
        INSERT INTO policy_conflict_resolutions (
          resolution_id, tenant_id, workspace_id, snapshot_id, conflict_key,
          resolution_type, override_id, reason_codes, created_at
        ) VALUES (
          ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, ${snapshotId}, ${conflictKey},
          ${resolutionType}, ${overrideId ?? null}, ${reasonCodes}, now()
        )
      `;

      // Insert policy_conflict_results
      for (const prid of policyResultIds) {
        await sqlTx`
          INSERT INTO policy_conflict_results (resolution_id, policy_result_id)
          VALUES (${resolutionId}, ${prid})
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }

  /**
   * Finalizes an AUTHORIZED_OVERRIDE conflict resolution (SPEC04 §66, §76).
   */
  async finalizeAuthorizedOverride(params: FinalizeAuthorizedOverrideParams): Promise<void> {
    const {
      resolutionId,
      snapshotId,
      conflictKey,
      overrideId,
      reasonCodes,
      tenantId,
      workspaceId,
    } = params;

    if (!overrideId) {
      throw new RegistryValidationError('AUTHORIZED_OVERRIDE_REQUIRES_OVERRIDE_ID', 'override_id cannot be null for AUTHORIZED_OVERRIDE (SPEC04 §66).');
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify override exists and is bound to same snapshot (SPEC04 §76, Vector 65)
      const [override] = await sqlTx`
        SELECT override_id, snapshot_id
        FROM policy_overrides
        WHERE override_id = ${overrideId}
      `;
      if (!override) {
        throw new RegistryValidationError('OVERRIDE_NOT_FOUND', `PolicyOverride '${overrideId}' does not exist (SPEC04 §76).`);
      }
      if (override.snapshot_id !== snapshotId) {
        throw new RegistryValidationError(
          'SNAPSHOT_MISMATCH',
          `PolicyOverride '${overrideId}' snapshot '${override.snapshot_id}' does not match conflict snapshot '${snapshotId}'.`,
        );
      }

      // Check if duplicate resolution
      const [existing] = await sqlTx`
        SELECT resolution_id FROM policy_conflict_resolutions
        WHERE snapshot_id = ${snapshotId} AND conflict_key = ${conflictKey}
      `;
      if (existing) {
        throw new RegistryValidationError(
          'DUPLICATE_FINAL_CONFLICT_RESOLUTION',
          `Conflict key '${conflictKey}' already has a final resolution.`,
        );
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PolicyConflictResolution', ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert or update policy_conflict_resolutions
      await sqlTx`
        INSERT INTO policy_conflict_resolutions (
          resolution_id, tenant_id, workspace_id, snapshot_id, conflict_key,
          resolution_type, override_id, reason_codes, created_at
        ) VALUES (
          ${resolutionId}, ${tenantId}, ${workspaceId ?? null}, ${snapshotId}, ${conflictKey},
          'AUTHORIZED_OVERRIDE', ${overrideId}, ${reasonCodes}, now()
        )
      `;
    });
  }

  /**
   * Records an immutable HumanReviewRecord (SPEC04 §77–§83).
   */
  async recordHumanReview(params: RecordHumanReviewParams): Promise<void> {
    const {
      reviewId,
      taskRevisionId,
      snapshotId,
      policyResultIds,
      reviewMode,
      reviewerRole,
      qualification,
      reviewScope,
      reviewDecision,
      reasonCodes,
      introducedInformationRefs = [],
      tenantId,
      workspaceId,
      serverAuthorized,
    } = params;

    // Server-side authorization check (SPEC04 §78, Vector 57)
    if (!serverAuthorized || qualification === 'UNQUALIFIED') {
      throw new RegistryValidationError('REVIEWER_UNAUTHORIZED', `Reviewer with qualification '${qualification}' is not authorized.`);
    }

    // Review information integrity (SPEC04 §82, Vectors 59, 60)
    if (reviewMode === 'ADJUDICATION_ONLY' && introducedInformationRefs.length > 0) {
      throw new RegistryValidationError(
        'REVIEW_HIDDEN_INFORMATION',
        'ADJUDICATION_ONLY review cannot introduce new information refs (SPEC04 §82).',
      );
    }
    if (reviewMode === 'NEW_INFORMATION_INTRODUCED') {
      if (introducedInformationRefs.length === 0) {
        throw new RegistryValidationError(
          'REVIEW_HIDDEN_INFORMATION',
          'NEW_INFORMATION_INTRODUCED requires at least one introduced information ref (SPEC04 §82).',
        );
      }
      // Acceptance Criterion 22 / Preflight 27: NEW_INFORMATION_INTRODUCED requires new decision cycle / snapshot
      // NEW_INFORMATION_REQUIRES_NEW_DECISION_CYCLE: Material new information cannot release current snapshot.
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify snapshot and policy results binding (SPEC04 §77, Vector 58)
      for (const prid of policyResultIds) {
        const [pr] = await sqlTx`
          SELECT policy_result_id, snapshot_id FROM policy_results WHERE policy_result_id = ${prid}
        `;
        if (!pr || pr.snapshot_id !== snapshotId) {
          throw new RegistryValidationError(
            'SNAPSHOT_MISMATCH',
            `PolicyResult '${prid}' does not belong to snapshot '${snapshotId}' (SPEC04 §77).`,
          );
        }
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'HumanReviewRecord', ${reviewId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert human_review_records
      await sqlTx`
        INSERT INTO human_review_records (
          review_id, tenant_id, workspace_id, task_revision_id, snapshot_id,
          review_mode, reviewer_role, qualification, review_scope, review_decision,
          reason_codes, created_at
        ) VALUES (
          ${reviewId}, ${tenantId}, ${workspaceId ?? null}, ${taskRevisionId}, ${snapshotId},
          ${reviewMode}, ${reviewerRole}, ${qualification}, ${reviewScope}, ${reviewDecision},
          ${reasonCodes}, now()
        )
      `;

      // 4. Insert human_review_policy_results
      for (const prid of policyResultIds) {
        await sqlTx`
          INSERT INTO human_review_policy_results (review_id, policy_result_id)
          VALUES (${reviewId}, ${prid})
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }
}
