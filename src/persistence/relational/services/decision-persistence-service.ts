/**
 * ContentOS — Decision & Governance Transactional Persistence Service
 *
 * Enforces SPEC02 transactional invariants:
 *   - §19: DecisionCycle same-Run and single-writable cycle per Run.
 *   - §19: Run.current_decision_cycle_id atomic pointer update.
 *   - §17, §23: DecisionSnapshot closure & temporal containment.
 *   - §17, §24: DecisionRecord sole canonical owner of release_status and snapshot closure.
 *   - §17, §25: FinalContentPackage closure & prohibition of release_status duplication.
 *   - §5: Every immutable snapshot/decision entity registers in ImmutableEntityRegistry in the same transaction.
 */
import postgres from 'postgres';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import { PolicyConflictResolver, PolicyResultDescriptor } from '../../../domain/governance/policy-conflict-resolver.js';

export interface CreateDecisionCycleParams {
  decisionCycleId: string;
  runId: string;
  cycleNumber: number;
  parentCycleId?: string | null;
  reason: string;
  tenantId: string;
  workspaceId?: string | null;
}

export interface FreezeDecisionSnapshotParams {
  snapshotId: string;
  baselineKnowledgeSnapshotId: string;
  runKnowledgeDeltaId: string;
  governanceSnapshotId: string;
  runConfigId: string;
  taskRevisionId: string;
  audienceStateId: string;
  uncertaintyAssessmentId?: string | null;
  candidateIds: string[];
  frozenAt: Date;
  tenantId: string;
  workspaceId?: string | null;
}

export interface RecordDecisionParams {
  decisionId: string;
  decisionType: string;
  taskRevisionId: string;
  snapshotId: string;
  reasonCodes: string;
  selectedAction: string;
  selectedCandidateId?: string | null;
  releaseStatus: 'READY' | 'READY_WITH_WARNINGS' | 'HUMAN_REVIEW_REQUIRED' | 'BLOCKED';
  humanReviewId?: string | null;
  policyResultIds: string[];
  conflictResolutionIds?: string[];
  tenantId: string;
  workspaceId?: string | null;
}

export interface CreateFinalContentPackageParams {
  packageId: string;
  taskRevisionId: string;
  decisionId: string;
  decisionSnapshotId: string;
  selectedCandidateId: string;
  strategyId: string;
  architectureId: string;
  audienceStateId: string;
  warnings: string;
  assertionIds?: string[];
  propositionIds?: string[];
  riskAssessmentIds?: string[];
  rightsCheckIds?: string[];
  alternativeCandidateIds?: string[];
  tenantId: string;
  workspaceId?: string | null;
  release_status?: unknown; // Compile/runtime trap: must NOT exist
}

export class DecisionPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Creates a new DecisionCycle and atomically updates Run.current_decision_cycle_id.
   * Enforces at most one writable (OPEN) cycle per Run.
   */
  async createDecisionCycle(params: CreateDecisionCycleParams): Promise<void> {
    const {
      decisionCycleId,
      runId,
      cycleNumber,
      parentCycleId,
      reason,
      tenantId,
      workspaceId,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 1. Lock Run
      const [run] = await sqlTx`
        SELECT run_id, tenant_id, current_decision_cycle_id, version
        FROM runs
        WHERE run_id = ${runId}
        FOR UPDATE
      `;
      if (!run) {
        throw new RegistryValidationError('RUN_NOT_FOUND', `Run '${runId}' does not exist.`);
      }

      // 2. Validate at most one writable (OPEN) cycle for this Run
      const [openCycle] = await sqlTx`
        SELECT decision_cycle_id
        FROM decision_cycles
        WHERE run_id = ${runId} AND status = 'OPEN'
      `;
      if (openCycle) {
        throw new RegistryValidationError(
          'MULTIPLE_WRITABLE_CYCLES_FORBIDDEN',
          `Run '${runId}' already has an OPEN decision cycle '${openCycle.decision_cycle_id}'. Only one writable cycle is permitted.`,
        );
      }

      // 3. Validate parent cycle if present: must belong to SAME Run
      if (parentCycleId) {
        const [parent] = await sqlTx`
          SELECT decision_cycle_id, run_id
          FROM decision_cycles
          WHERE decision_cycle_id = ${parentCycleId}
        `;
        if (!parent) {
          throw new RegistryValidationError(
            'PARENT_CYCLE_NOT_FOUND',
            `Parent cycle '${parentCycleId}' does not exist.`,
          );
        }
        if (parent.run_id !== runId) {
          throw new RegistryValidationError(
            'CROSS_RUN_DECISION_CYCLE',
            `Parent cycle '${parentCycleId}' belongs to Run '${parent.run_id}', not '${runId}'. Cross-run cycles are forbidden.`,
          );
        }
      }

      // 4. Insert decision cycle
      await sqlTx`
        INSERT INTO decision_cycles (
          decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number,
          parent_cycle_id, reason, status, fencing_epoch, opened_at
        ) VALUES (
          ${decisionCycleId}, ${tenantId}, ${workspaceId ?? null}, ${runId}, ${cycleNumber},
          ${parentCycleId ?? null}, ${reason}, 'OPEN', 0, now()
        )
      `;

      // 5. Atomically update Run.current_decision_cycle_id
      await sqlTx`
        UPDATE runs
        SET current_decision_cycle_id = ${decisionCycleId},
            version = version + 1
        WHERE run_id = ${runId}
      `;
    });
  }

  /**
   * Cancels an active DecisionCycle and atomically increments its fencing_epoch (SPEC02 §19, §37).
   */
  async cancelDecisionCycle(decisionCycleId: string, runId: string): Promise<void> {
    await this.sql.begin(async (sqlTx) => {
      const [cycle] = await sqlTx`
        SELECT decision_cycle_id, run_id, status, fencing_epoch
        FROM decision_cycles
        WHERE decision_cycle_id = ${decisionCycleId} AND run_id = ${runId}
        FOR UPDATE
      `;
      if (!cycle) {
        throw new RegistryValidationError('CYCLE_NOT_FOUND', `DecisionCycle '${decisionCycleId}' not found for Run '${runId}'.`);
      }
      await sqlTx`
        UPDATE decision_cycles
        SET status = 'CANCELLED',
            fencing_epoch = fencing_epoch + 1
        WHERE decision_cycle_id = ${decisionCycleId}
      `;
    });
  }

  /**
   * Freezes a DecisionSnapshot atomically with all reference set associations.
   */
  async freezeDecisionSnapshot(params: FreezeDecisionSnapshotParams): Promise<void> {
    const {
      snapshotId,
      baselineKnowledgeSnapshotId,
      runKnowledgeDeltaId,
      governanceSnapshotId,
      runConfigId,
      taskRevisionId,
      audienceStateId,
      uncertaintyAssessmentId,
      candidateIds,
      frozenAt,
      tenantId,
      workspaceId,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 1. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'DecisionSnapshot', ${snapshotId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 2. Insert decision_snapshots row
      await sqlTx`
        INSERT INTO decision_snapshots (
          snapshot_id, tenant_id, workspace_id, baseline_knowledge_snapshot_id,
          run_knowledge_delta_id, governance_snapshot_id, run_config_id,
          task_revision_id, audience_state_id, uncertainty_assessment_id,
          frozen_at, created_at
        ) VALUES (
          ${snapshotId}, ${tenantId}, ${workspaceId ?? null}, ${baselineKnowledgeSnapshotId},
          ${runKnowledgeDeltaId}, ${governanceSnapshotId}, ${runConfigId},
          ${taskRevisionId}, ${audienceStateId}, ${uncertaintyAssessmentId ?? null},
          ${frozenAt}, now()
        )
      `;

      // 3. Insert candidate links
      for (const candidateId of candidateIds) {
        await sqlTx`
          INSERT INTO decision_snapshot_candidates (
            snapshot_id, candidate_id
          ) VALUES (
            ${snapshotId}, ${candidateId}
          )
        `;
      }
    });
  }

  /**
   * Records a DecisionRecord atomically.
   */
  async recordDecision(params: RecordDecisionParams): Promise<void> {
    const {
      decisionId,
      decisionType,
      taskRevisionId,
      snapshotId,
      reasonCodes,
      selectedAction,
      selectedCandidateId,
      releaseStatus,
      humanReviewId,
      policyResultIds,
      conflictResolutionIds,
      tenantId,
      workspaceId,
    } = params;

    // 1. Release status closure validation
    if (['READY', 'READY_WITH_WARNINGS'].includes(releaseStatus) && !selectedCandidateId) {
      throw new RegistryValidationError(
        'RELEASE_CANDIDATE_REQUIRED',
        `release_status='${releaseStatus}' requires a non-null selected_candidate_id.`,
      );
    }

    // 2. selected_action must be an action code only, not embedding entity IDs
    if (/candidate-|snapshot-|task-|[0-9a-f]{8}-[0-9a-f]{4}/i.test(selectedAction)) {
      throw new RegistryValidationError(
        'SELECTED_ACTION_EMBEDDED_ENTITY_ID',
        `selected_action '${selectedAction}' contains embedded entity IDs, violating SPEC02 §24.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 3. Validate snapshot
      const [snapshot] = await sqlTx`
        SELECT snapshot_id, task_revision_id, governance_snapshot_id
        FROM decision_snapshots
        WHERE snapshot_id = ${snapshotId}
      `;
      if (!snapshot) {
        throw new RegistryValidationError('SNAPSHOT_NOT_FOUND', `Snapshot '${snapshotId}' not found.`);
      }
      if (snapshot.task_revision_id !== taskRevisionId) {
        throw new RegistryValidationError(
          'DECISION_TASK_REVISION_MISMATCH',
          `Decision task_revision_id '${taskRevisionId}' does not match snapshot task_revision_id '${snapshot.task_revision_id}'.`,
        );
      }

      // 4. Validate selected candidate belongs to snapshot candidates (SPEC04 §89, Vector 71)
      if (selectedCandidateId) {
        const [candLink] = await sqlTx`
          SELECT candidate_id
          FROM decision_snapshot_candidates
          WHERE snapshot_id = ${snapshotId} AND candidate_id = ${selectedCandidateId}
        `;
        if (!candLink) {
          throw new RegistryValidationError(
            'SELECTED_CANDIDATE_NOT_IN_SNAPSHOT',
            `selected_candidate_id '${selectedCandidateId}' is not among snapshot '${snapshotId}' candidate_ids.`,
          );
        }
      }

      // 5. Release authorization validation (SPEC04 §94, Acceptance Criterion 28)
      if (releaseStatus === 'BLOCKED' && /^(release|publish|approve|distribute|promote)$/i.test(selectedAction.trim())) {
        throw new RegistryValidationError(
          'BLOCKED_CANNOT_AUTHORIZE_RELEASE',
          `release_status='BLOCKED' cannot authorize release action '${selectedAction}'.`,
        );
      }

      // 6. Completeness of PolicyResults (SPEC04 §85, §86, Acceptance Criteria 10, 24)
      const expectedPolicies = snapshot.governance_snapshot_id
        ? await sqlTx`
            SELECT policy_revision_id
            FROM governance_snapshot_policies
            WHERE governance_snapshot_id = ${snapshot.governance_snapshot_id}
          `
        : [];

      const expectedSet = new Set(expectedPolicies.map((p: any) => p.policy_revision_id));

      let results: any[] = [];
      if (policyResultIds && policyResultIds.length > 0) {
        results = await sqlTx`
          SELECT policy_result_id, snapshot_id, policy_revision_id
          FROM policy_results
          WHERE policy_result_id = ANY(${policyResultIds})
        `;
        if (results.length !== policyResultIds.length) {
          throw new RegistryValidationError(
            'POLICY_RESULTS_NOT_FOUND',
            `One or more policy_result_ids could not be found.`,
          );
        }
        for (const res of results) {
          if (res.snapshot_id !== snapshotId) {
            throw new RegistryValidationError(
              'POLICY_RESULT_WRONG_SNAPSHOT',
              `PolicyResult '${res.policy_result_id}' belongs to snapshot '${res.snapshot_id}', not '${snapshotId}'.`,
            );
          }
        }
      }

      if (expectedSet.size > 0) {
        const actualSet = new Set(results.map((r: any) => r.policy_revision_id));
        for (const expected of expectedSet) {
          if (!actualSet.has(expected)) {
            throw new RegistryValidationError(
              'INCOMPLETE_POLICY_RESULTS',
              `DecisionRecord omits required policy_revision_id '${expected}' from snapshot '${snapshotId}'.`,
            );
          }
        }
      }

      // 7. Conflict resolution closure (SPEC04 §85, §87, Acceptance Criteria 15, 25, Vector 66)
      const existingResolutions = await sqlTx`
        SELECT resolution_id, resolution_type, conflict_key
        FROM policy_conflict_resolutions
        WHERE snapshot_id = ${snapshotId}
      `;
      if (existingResolutions.length > 0) {
        const providedSet = new Set(conflictResolutionIds ?? []);
        for (const er of existingResolutions) {
          if (!providedSet.has(er.resolution_id)) {
            throw new RegistryValidationError(
              'UNRESOLVED_CONFLICT_OMITTED',
              `DecisionRecord omits conflict resolution '${er.resolution_id}' for conflict_key '${er.conflict_key}' (SPEC04 §87).`,
            );
          }
        }
      }

      if (conflictResolutionIds && conflictResolutionIds.length > 0) {
        const resolutions = await sqlTx`
          SELECT resolution_id, snapshot_id, conflict_key
          FROM policy_conflict_resolutions
          WHERE resolution_id = ANY(${conflictResolutionIds})
        `;
        if (resolutions.length !== conflictResolutionIds.length) {
          throw new RegistryValidationError(
            'CONFLICT_RESOLUTIONS_NOT_FOUND',
            `One or more conflict_resolution_ids could not be found.`,
          );
        }
        const seenKeys = new Set<string>();
        for (const res of resolutions) {
          if (res.snapshot_id !== snapshotId) {
            throw new RegistryValidationError(
              'CONFLICT_RESOLUTION_WRONG_SNAPSHOT',
              `ConflictResolution '${res.resolution_id}' belongs to snapshot '${res.snapshot_id}', not '${snapshotId}'.`,
            );
          }
          if (seenKeys.has(res.conflict_key)) {
            throw new RegistryValidationError(
              'DUPLICATE_CONFLICT_KEY_RESOLUTION',
              `DecisionRecord references multiple resolutions for conflict_key '${res.conflict_key}'.`,
            );
          }
          seenKeys.add(res.conflict_key);
        }
      }

      // 7.5 Validate all underlying conflicts have resolutions (including ESCALATE)
      const allResultsRows = await sqlTx`
        SELECT pr.policy_result_id, pr.snapshot_id, pr.policy_revision_id, pr.triggered,
               pr.action, pr.reason_code, p.priority_class, p.scope, p.override_allowed
        FROM policy_results pr
        JOIN decision_policy_revisions p ON p.policy_revision_id = pr.policy_revision_id
        WHERE pr.snapshot_id = ${snapshotId}
      `;

      const descriptors: PolicyResultDescriptor[] = allResultsRows.map((r: any) => {
        let effect: any = 'NO_RELEASE_EFFECT';
        let actCode: string = r.reason_code;
        let actParams: Record<string, unknown> | undefined;
        let actSchema: Record<string, any> | undefined;
        try {
          const actObj = JSON.parse(r.action);
          effect = actObj.effect ?? (r.triggered ? 'BLOCK' : 'NO_RELEASE_EFFECT');
          if (actObj.code) actCode = actObj.code;
          if (actObj.parameters) actParams = actObj.parameters;
          if (actObj.parameter_schemas) actSchema = actObj.parameter_schemas;
          else if (actObj.action_schema) actSchema = actObj.action_schema;
          else if (actObj.schema) actSchema = actObj.schema;
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
          actionSchema: actSchema,
          priorityClass: r.priority_class,
          scope: r.scope,
          overrideAllowed: r.override_allowed,
        };
      });

      const detectedConflicts = PolicyConflictResolver.detectConflicts(descriptors);
      const providedResolutionsKeys = new Set(
        (conflictResolutionIds && conflictResolutionIds.length > 0)
          ? (await sqlTx`SELECT conflict_key FROM policy_conflict_resolutions WHERE resolution_id = ANY(${conflictResolutionIds})`).map((r: any) => r.conflict_key)
          : []
      );

      for (const conflict of detectedConflicts) {
        if (!providedResolutionsKeys.has(conflict.conflictKey)) {
          throw new RegistryValidationError(
            'UNRESOLVED_CONFLICT_OMITTED',
            `Snapshot '${snapshotId}' has an unresolved conflict (conflict_key '${conflict.conflictKey}') that requires manual intervention or is omitted from the decision (SPEC04 §87).`,
          );
        }
      }

      // 8. Human Review Record closure (SPEC04 §83, §85, §129, §130, Acceptance Criteria 20, 22, Vector 61)
      if (humanReviewId) {
        const [review] = await sqlTx`
          SELECT review_id, snapshot_id, review_mode
          FROM human_review_records
          WHERE review_id = ${humanReviewId}
        `;
        if (!review) {
          throw new RegistryValidationError(
            'HUMAN_REVIEW_NOT_FOUND',
            `HumanReviewRecord '${humanReviewId}' not found.`,
          );
        }
        if (review.snapshot_id !== snapshotId) {
          throw new RegistryValidationError(
            'HUMAN_REVIEW_WRONG_SNAPSHOT',
            `HumanReviewRecord '${humanReviewId}' belongs to snapshot '${review.snapshot_id}', not '${snapshotId}'.`,
          );
        }
        if (review.review_mode === 'NEW_INFORMATION_INTRODUCED') {
          throw new RegistryValidationError(
            'NEW_INFORMATION_REQUIRES_NEW_DECISION_CYCLE',
            `HumanReviewRecord '${humanReviewId}' introduced new information. Decisions cannot be finalized on old snapshot '${snapshotId}'; new information requires a successor DecisionCycle and new snapshot (SPEC04 §83, §130, §131).`,
          );
        }
      }

      // 9. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'DecisionRecord', ${decisionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 10. Insert decision_records
      await sqlTx`
        INSERT INTO decision_records (
          decision_id, tenant_id, workspace_id, decision_type, task_revision_id,
          snapshot_id, reason_codes, selected_action, selected_candidate_id,
          release_status, human_review_id, created_at
        ) VALUES (
          ${decisionId}, ${tenantId}, ${workspaceId ?? null}, ${decisionType}, ${taskRevisionId},
          ${snapshotId}, ${reasonCodes}, ${selectedAction}, ${selectedCandidateId ?? null},
          ${releaseStatus}, ${humanReviewId ?? null}, now()
        )
      `;

      // 11. Insert policy result links
      for (const policyResultId of policyResultIds) {
        await sqlTx`
          INSERT INTO decision_policy_results (
            decision_id, policy_result_id
          ) VALUES (
            ${decisionId}, ${policyResultId}
          )
        `;
      }

      // 12. Insert conflict resolution links
      if (conflictResolutionIds) {
        for (const resolutionId of conflictResolutionIds) {
          await sqlTx`
            INSERT INTO decision_conflict_resolutions (
              decision_id, resolution_id
            ) VALUES (
              ${decisionId}, ${resolutionId}
            )
          `;
        }
      }
    });
  }

  /**
   * Creates a FinalContentPackage. Enforces closure and forbids release_status.
   */
  async createFinalContentPackage(params: CreateFinalContentPackageParams): Promise<void> {
    const {
      packageId,
      taskRevisionId,
      decisionId,
      decisionSnapshotId,
      selectedCandidateId,
      strategyId,
      architectureId,
      audienceStateId,
      warnings,
      assertionIds,
      propositionIds,
      riskAssessmentIds,
      rightsCheckIds,
      alternativeCandidateIds,
      tenantId,
      workspaceId,
      release_status,
    } = params;

    // Runtime rejection of release_status on package
    if (release_status !== undefined) {
      throw new RegistryValidationError(
        'RELEASE_STATUS_FORBIDDEN_ON_PACKAGE',
        `FinalContentPackage must NOT duplicate release_status. It belongs solely to DecisionRecord.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // Validate decision record agreement
      const [decision] = await sqlTx`
        SELECT decision_id, task_revision_id, snapshot_id, selected_candidate_id
        FROM decision_records
        WHERE decision_id = ${decisionId}
      `;
      if (!decision) {
        throw new RegistryValidationError('DECISION_NOT_FOUND', `DecisionRecord '${decisionId}' not found.`);
      }
      if (decision.task_revision_id !== taskRevisionId) {
        throw new RegistryValidationError('PACKAGE_TASK_MISMATCH', `Package task_revision_id does not match Decision.`);
      }
      if (decision.snapshot_id !== decisionSnapshotId) {
        throw new RegistryValidationError('PACKAGE_SNAPSHOT_MISMATCH', `Package snapshot_id does not match Decision.`);
      }
      if (decision.selected_candidate_id && decision.selected_candidate_id !== selectedCandidateId) {
        throw new RegistryValidationError('PACKAGE_CANDIDATE_MISMATCH', `Package candidate does not match Decision selected candidate.`);
      }

      // Validate candidate strategy & architecture closure (SPEC02 §25)
      const [cand] = await sqlTx`
        SELECT candidate_id, strategy_id, architecture_id
        FROM content_candidates
        WHERE candidate_id = ${selectedCandidateId}
      `;
      if (cand) {
        if (cand.strategy_id !== strategyId) {
          throw new RegistryValidationError(
            'FINAL_PACKAGE_STRATEGY_MISMATCH',
            `FinalContentPackage strategy_id '${strategyId}' must match candidate strategy_id '${cand.strategy_id}'.`,
          );
        }
      }

      // Validate rights checks against snapshot (SPEC02 §25)
      if (rightsCheckIds && rightsCheckIds.length > 0) {
        const snapshotRights = await sqlTx`
          SELECT rights_check_id FROM decision_snapshot_rights_checks WHERE snapshot_id = ${decisionSnapshotId}
        `;
        const allowed = new Set(snapshotRights.map((r: any) => r.rights_check_id));
        for (const rcId of rightsCheckIds) {
          if (!allowed.has(rcId)) {
            throw new RegistryValidationError(
              'POST_DECISION_RIGHTS_CHECK_INJECTION_FORBIDDEN',
              `RightsCheck '${rcId}' was injected after snapshot freeze; not present in snapshot rights checks.`,
            );
          }
        }
      }

      // 1. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'FinalContentPackage', ${packageId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 2. Insert package
      await sqlTx`
        INSERT INTO final_content_packages (
          package_id, tenant_id, workspace_id, task_revision_id, decision_id,
          decision_snapshot_id, selected_candidate_id, strategy_id, architecture_id,
          audience_state_id, warnings, created_at
        ) VALUES (
          ${packageId}, ${tenantId}, ${workspaceId ?? null}, ${taskRevisionId}, ${decisionId},
          ${decisionSnapshotId}, ${selectedCandidateId}, ${strategyId}, ${architectureId},
          ${audienceStateId}, ${warnings}, now()
        )
      `;

      // 3. Link tables
      if (assertionIds) {
        for (const id of assertionIds) {
          await sqlTx`INSERT INTO package_assertions (package_id, assertion_id) VALUES (${packageId}, ${id})`;
        }
      }
      if (propositionIds) {
        for (const id of propositionIds) {
          await sqlTx`INSERT INTO package_propositions (package_id, proposition_id) VALUES (${packageId}, ${id})`;
        }
      }
      if (riskAssessmentIds) {
        for (const id of riskAssessmentIds) {
          await sqlTx`INSERT INTO package_risks (package_id, risk_assessment_id) VALUES (${packageId}, ${id})`;
        }
      }
      if (rightsCheckIds) {
        for (const id of rightsCheckIds) {
          await sqlTx`INSERT INTO package_rights (package_id, rights_check_id) VALUES (${packageId}, ${id})`;
        }
      }
      if (alternativeCandidateIds) {
        for (const id of alternativeCandidateIds) {
          await sqlTx`INSERT INTO package_alternative_candidates (package_id, candidate_id) VALUES (${packageId}, ${id})`;
        }
      }
    });
  }

  /**
   * Routes a NEW_INFORMATION_INTRODUCED human review to a successor DecisionCycle (SPEC04 §83, §130, §131).
   * Verifies the review introduced new information, marks the current cycle superseded/closed,
   * establishes a successor DecisionCycle linked to the parent cycle, and updates the Run.
   */
  async createSuccessorDecisionCycleForReview(params: {
    reviewId: string;
    successorCycleId: string;
    runId?: string;
    reason?: string;
    tenantId: string;
    workspaceId?: string | null;
  }): Promise<{
    successorCycleId: string;
    parentCycleId: string;
    cycleNumber: number;
    runId: string;
  }> {
    const { reviewId, successorCycleId, runId: suppliedRunId, reason, tenantId, workspaceId } = params;

    return await this.sql.begin(async (sqlTx) => {
      // 1. Verify HumanReviewRecord exists and is NEW_INFORMATION_INTRODUCED
      const [review] = await sqlTx`
        SELECT review_id, snapshot_id, review_mode, tenant_id, workspace_id
        FROM human_review_records
        WHERE review_id = ${reviewId}
      `;
      if (!review) {
        throw new RegistryValidationError('HUMAN_REVIEW_NOT_FOUND', `HumanReviewRecord '${reviewId}' not found.`);
      }
      if (review.tenant_id !== tenantId) {
        throw new RegistryValidationError('CROSS_TENANT_REVIEW', `HumanReviewRecord '${reviewId}' belongs to another tenant.`);
      }
      if (workspaceId && review.workspace_id && review.workspace_id !== workspaceId) {
        throw new RegistryValidationError('CROSS_WORKSPACE_REVIEW', `HumanReviewRecord '${reviewId}' belongs to another workspace.`);
      }
      if (review.review_mode !== 'NEW_INFORMATION_INTRODUCED') {
        throw new RegistryValidationError(
          'INVALID_REVIEW_MODE_FOR_SUCCESSOR_CYCLE',
          `HumanReviewRecord '${reviewId}' has review_mode '${review.review_mode}'. Only NEW_INFORMATION_INTRODUCED creates a successor cycle (SPEC04 §130).`,
        );
      }

      // 2. Derive lineage: review snapshot -> decision cycle binding -> parent cycle -> run
      const [lineage] = await sqlTx`
        SELECT b.decision_cycle_id, c.run_id, c.cycle_number, c.status, c.fencing_epoch
        FROM decision_cycle_bindings b
        JOIN decision_cycles c ON b.decision_cycle_id = c.decision_cycle_id
        WHERE b.decision_snapshot_id = ${review.snapshot_id}
        FOR UPDATE OF c
      `;
      if (!lineage) {
        throw new RegistryValidationError(
          'LINEAGE_NOT_FOUND',
          `Cannot map HumanReviewRecord '${reviewId}' (snapshot '${review.snapshot_id}') to a valid parent DecisionCycle.`,
        );
      }
      if (lineage.status === 'SUPERSEDED' || lineage.status === 'CANCELLED') {
        throw new RegistryValidationError(
          'CYCLE_ALREADY_SUPERSEDED',
          `Parent cycle '${lineage.decision_cycle_id}' is already superseded or cancelled.`,
        );
      }

      const derivedRunId = lineage.run_id;

      if (suppliedRunId && suppliedRunId !== derivedRunId) {
        throw new RegistryValidationError(
          'RUN_ID_MISMATCH',
          `Caller supplied Run ID '${suppliedRunId}' but review lineage strictly belongs to Run '${derivedRunId}'.`,
        );
      }

      // 3. Find the Run to ensure active cycle matches
      const [run] = await sqlTx`
        SELECT run_id, current_decision_cycle_id
        FROM runs
        WHERE run_id = ${derivedRunId}
      `;
      if (!run) {
        throw new RegistryValidationError('RUN_NOT_FOUND', `Run '${derivedRunId}' not found for lineage.`);
      }

      if (run.current_decision_cycle_id !== lineage.decision_cycle_id) {
        throw new RegistryValidationError(
          'INVALID_LINEAGE_STATE',
          `Derived parent cycle '${lineage.decision_cycle_id}' is not the current active cycle for Run '${derivedRunId}'.`,
        );
      }

      // 4. Invalidate/close old cycle
      await sqlTx`
        UPDATE decision_cycles
        SET status = 'SUPERSEDED',
            fencing_epoch = fencing_epoch + 1
        WHERE decision_cycle_id = ${lineage.decision_cycle_id}
      `;

      const newCycleNumber = lineage.cycle_number + 1;

      // 5. Create successor cycle
      await sqlTx`
        INSERT INTO decision_cycles (
          decision_cycle_id, tenant_id, workspace_id, run_id, cycle_number,
          parent_cycle_id, reason, status, fencing_epoch, opened_at
        ) VALUES (
          ${successorCycleId}, ${tenantId}, ${workspaceId ?? null}, ${derivedRunId}, ${newCycleNumber},
          ${lineage.decision_cycle_id}, ${reason ?? 'NEW_INFORMATION_INTRODUCED'}, 'OPEN', 0, now()
        )
      `;

      // 6. Update Run to point to successor cycle
      await sqlTx`
        UPDATE runs
        SET current_decision_cycle_id = ${successorCycleId},
            version = version + 1
        WHERE run_id = ${derivedRunId}
      `;

      return {
        successorCycleId,
        parentCycleId: lineage.decision_cycle_id,
        cycleNumber: newCycleNumber,
        runId: derivedRunId,
      };
    });
  }
}
