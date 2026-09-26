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
        SELECT snapshot_id, task_revision_id
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

      // 4. Validate selected candidate belongs to snapshot candidates
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

      // 5. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'DecisionRecord', ${decisionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 6. Insert decision_records
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

      // 7. Insert policy result links
      for (const policyResultId of policyResultIds) {
        await sqlTx`
          INSERT INTO decision_policy_results (
            decision_id, policy_result_id
          ) VALUES (
            ${decisionId}, ${policyResultId}
          )
        `;
      }

      // 8. Insert conflict resolution links
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
}
