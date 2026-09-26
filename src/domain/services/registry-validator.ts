/**
 * ContentOS — Domain Registry & Invariant Validator Service
 *
 * Implements SPEC02:
 *   - §5, §6: RevisionRef & ImmutableEntityRef validation
 *   - §10, §21: Supersession integrity (same stable ID, same entity type, no self-supersession)
 *   - §19, §29: ControlPlaneActivation interval non-overlap validation
 *   - §18: PublicationLineage DAG integrity (acyclic, single lineage, strictly increasing time)
 *   - §13, §28: Epistemic state chain integrity (acyclic, strictly increasing known_from)
 *   - §18: MeasurementState & PerformanceObservation correction integrity
 *   - §17: Decision closure validation
 */

export interface RevisionRefInput {
  entity_type: string;
  stable_id: string;
  revision_id: string;
}

export interface ImmutableEntityRefInput {
  entity_type: string;
  entity_id: string;
}

export interface RevisionRow {
  entity_type: string;
  stable_id: string;
  revision_id: string;
  supersedes_revision_id?: string | null;
}

export interface ActivationInterval {
  activation_id: string;
  deployment_scope: string;
  component_type: string;
  stable_id: string;
  active_revision_id: string;
  effective_from: Date;
  effective_until?: Date | null;
}

export interface PublishedArtifactNode {
  published_artifact_id: string;
  publication_lineage_id: string;
  supersedes_published_artifact_id?: string | null;
  effective_from: Date;
}

export interface EpistemicStateNode {
  epistemic_state_id: string;
  proposition_id: string;
  supersedes_epistemic_state_id?: string | null;
  known_from: Date;
}

export interface PerformanceObservationNode {
  observation_id: string;
  metric_revision_id: string;
  publication_state: 'SINGLE_ARTIFACT' | 'MIXED';
  covered_published_artifact_ids: string[];
  supersedes_observation_id?: string | null;
  observed_at: Date;
}

export interface DecisionSnapshotData {
  snapshot_id: string;
  task_revision_id: string;
  candidate_ids: string[];
}

export interface DecisionRecordData {
  decision_id: string;
  snapshot_id: string;
  task_revision_id: string;
  selected_action: string;
  selected_candidate_id?: string | null;
  release_status: string;
  policy_result_ids: string[];
  conflict_resolution_ids: string[];
}

export interface FinalContentPackageData {
  package_id: string;
  task_revision_id: string;
  decision_id: string;
  decision_snapshot_id: string;
  selected_candidate_id: string;
  release_status?: unknown; // MUST NOT exist on package
}

export class RegistryValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'RegistryValidationError';
  }
}

/**
 * Validates supersession invariants between predecessor and successor revisions (SPEC02 §10, §21).
 */
export function validateSupersession(
  predecessor: RevisionRow,
  successor: RevisionRow,
): void {
  if (successor.entity_type !== predecessor.entity_type) {
    throw new RegistryValidationError(
      'SUPERSEDED_ENTITY_TYPE_MISMATCH',
      `Successor entity_type '${successor.entity_type}' must match predecessor entity_type '${predecessor.entity_type}'`,
    );
  }

  if (successor.stable_id !== predecessor.stable_id) {
    throw new RegistryValidationError(
      'SUPERSEDED_STABLE_ID_MISMATCH',
      `Successor stable_id '${successor.stable_id}' must match predecessor stable_id '${predecessor.stable_id}'`,
    );
  }

  if (successor.revision_id === predecessor.revision_id) {
    throw new RegistryValidationError(
      'SELF_SUPERSEDED_REVISION',
      `Revision '${successor.revision_id}' cannot supersede itself`,
    );
  }

  if (successor.supersedes_revision_id !== predecessor.revision_id) {
    throw new RegistryValidationError(
      'SUPERSEDED_REVISION_MISMATCH',
      `Successor declares superseding '${successor.supersedes_revision_id}' but predecessor is '${predecessor.revision_id}'`,
    );
  }
}

/**
 * Validates activation intervals for single-active semantics (SPEC02 §19, §29).
 * Ensures no overlapping intervals for the same (deployment_scope, component_type, stable_id).
 */
export function validateActivationInterval(
  existingActivations: ActivationInterval[],
  newActivation: ActivationInterval,
): void {
  const newFrom = newActivation.effective_from.getTime();
  const newUntil = newActivation.effective_until ? newActivation.effective_until.getTime() : Infinity;

  if (newUntil <= newFrom) {
    throw new RegistryValidationError(
      'INVALID_INTERVAL_RANGE',
      `effective_until (${newActivation.effective_until?.toISOString()}) must be strictly greater than effective_from (${newActivation.effective_from.toISOString()})`,
    );
  }

  for (const existing of existingActivations) {
    if (existing.activation_id === newActivation.activation_id) continue;

    if (
      existing.deployment_scope === newActivation.deployment_scope &&
      existing.component_type === newActivation.component_type &&
      existing.stable_id === newActivation.stable_id
    ) {
      const exFrom = existing.effective_from.getTime();
      const exUntil = existing.effective_until ? existing.effective_until.getTime() : Infinity;

      // Intervals [newFrom, newUntil) and [exFrom, exUntil) overlap if newFrom < exUntil && exFrom < newUntil
      const overlaps = newFrom < exUntil && exFrom < newUntil;
      if (overlaps) {
        throw new RegistryValidationError(
          'ACTIVATION_INTERVAL_OVERLAP',
          `Activation interval [${newActivation.effective_from.toISOString()}, ${newActivation.effective_until?.toISOString() ?? 'inf'}) overlaps with existing activation '${existing.activation_id}' [${existing.effective_from.toISOString()}, ${existing.effective_until?.toISOString() ?? 'inf'}) for scope '${newActivation.deployment_scope}', component '${newActivation.component_type}', stable_id '${newActivation.stable_id}'`,
        );
      }
    }
  }
}

/**
 * Validates publication lineage invariants (SPEC02 §18):
 * - Exactly one root per lineage
 * - Maximum one direct successor per artifact
 * - Successor remains in same lineage
 * - Strictly increasing effective_from
 * - Acyclic supersession
 */
export function validatePublicationLineage(
  lineageArtifacts: PublishedArtifactNode[],
  newArtifact: PublishedArtifactNode,
): void {
  if (!newArtifact.supersedes_published_artifact_id) {
    // Root artifact check: lineage must not already have a root
    const existingRoot = lineageArtifacts.find(
      (a) =>
        a.publication_lineage_id === newArtifact.publication_lineage_id &&
        !a.supersedes_published_artifact_id &&
        a.published_artifact_id !== newArtifact.published_artifact_id,
    );
    if (existingRoot) {
      throw new RegistryValidationError(
        'MULTIPLE_LINEAGE_ROOTS',
        `PublicationLineage '${newArtifact.publication_lineage_id}' already has a root '${existingRoot.published_artifact_id}'`,
      );
    }
    return;
  }

  const predecessor = lineageArtifacts.find(
    (a) => a.published_artifact_id === newArtifact.supersedes_published_artifact_id,
  );
  if (!predecessor) {
    throw new RegistryValidationError(
      'MISSING_PREDECESSOR',
      `Predecessor '${newArtifact.supersedes_published_artifact_id}' not found in lineage`,
    );
  }

  if (predecessor.publication_lineage_id !== newArtifact.publication_lineage_id) {
    throw new RegistryValidationError(
      'CROSS_LINEAGE_SUPERSEDED',
      `Successor artifact '${newArtifact.published_artifact_id}' in lineage '${newArtifact.publication_lineage_id}' cannot supersede artifact '${predecessor.published_artifact_id}' from lineage '${predecessor.publication_lineage_id}'`,
    );
  }

  // At most one direct successor check
  const existingSuccessor = lineageArtifacts.find(
    (a) =>
      a.supersedes_published_artifact_id === predecessor.published_artifact_id &&
      a.published_artifact_id !== newArtifact.published_artifact_id,
  );
  if (existingSuccessor) {
    throw new RegistryValidationError(
      'BRANCHED_LINEAGE_SUCCESSOR',
      `Predecessor '${predecessor.published_artifact_id}' already has successor '${existingSuccessor.published_artifact_id}'`,
    );
  }

  // Strictly increasing effective_from
  if (newArtifact.effective_from.getTime() <= predecessor.effective_from.getTime()) {
    throw new RegistryValidationError(
      'NON_INCREASING_EFFECTIVE_TIME',
      `Successor effective_from (${newArtifact.effective_from.toISOString()}) must be strictly greater than predecessor effective_from (${predecessor.effective_from.toISOString()})`,
    );
  }

  // Cycle check: trace backwards from predecessor
  const visited = new Set<string>([newArtifact.published_artifact_id]);
  let current: PublishedArtifactNode | undefined = predecessor;
  while (current) {
    if (visited.has(current.published_artifact_id)) {
      throw new RegistryValidationError(
        'LINEAGE_CYCLE_DETECTED',
        `Cycle detected in publication lineage at '${current.published_artifact_id}'`,
      );
    }
    visited.add(current.published_artifact_id);
    current = current.supersedes_published_artifact_id
      ? lineageArtifacts.find((a) => a.published_artifact_id === current?.supersedes_published_artifact_id)
      : undefined;
  }
}

/**
 * Validates epistemic chain invariants (SPEC02 §13, §28):
 * - Successor proposition_id MUST equal predecessor proposition_id
 * - At most one direct successor per predecessor
 * - Successor known_from MUST be greater than predecessor known_from
 * - Supersession graph MUST be acyclic
 */
export function validateEpistemicChain(
  existingStates: EpistemicStateNode[],
  newState: EpistemicStateNode,
): void {
  if (!newState.supersedes_epistemic_state_id) {
    // Root state for this proposition
    const existingRoot = existingStates.find(
      (s) =>
        s.proposition_id === newState.proposition_id &&
        !s.supersedes_epistemic_state_id &&
        s.epistemic_state_id !== newState.epistemic_state_id,
    );
    if (existingRoot) {
      throw new RegistryValidationError(
        'MULTIPLE_EPISTEMIC_ROOTS',
        `Proposition '${newState.proposition_id}' already has a root epistemic state '${existingRoot.epistemic_state_id}'`,
      );
    }
    return;
  }

  const predecessor = existingStates.find(
    (s) => s.epistemic_state_id === newState.supersedes_epistemic_state_id,
  );
  if (!predecessor) {
    throw new RegistryValidationError(
      'MISSING_EPISTEMIC_PREDECESSOR',
      `Predecessor epistemic state '${newState.supersedes_epistemic_state_id}' not found`,
    );
  }

  if (predecessor.proposition_id !== newState.proposition_id) {
    throw new RegistryValidationError(
      'CROSS_PROPOSITION_SUPERSEDED',
      `Successor proposition_id '${newState.proposition_id}' must equal predecessor proposition_id '${predecessor.proposition_id}'`,
    );
  }

  const existingSuccessor = existingStates.find(
    (s) =>
      s.supersedes_epistemic_state_id === predecessor.epistemic_state_id &&
      s.epistemic_state_id !== newState.epistemic_state_id,
  );
  if (existingSuccessor) {
    throw new RegistryValidationError(
      'BRANCHED_EPISTEMIC_SUCCESSOR',
      `Epistemic predecessor '${predecessor.epistemic_state_id}' already has successor '${existingSuccessor.epistemic_state_id}'`,
    );
  }

  if (newState.known_from.getTime() <= predecessor.known_from.getTime()) {
    throw new RegistryValidationError(
      'NON_INCREASING_KNOWN_FROM',
      `Successor known_from (${newState.known_from.toISOString()}) must be strictly greater than predecessor known_from (${predecessor.known_from.toISOString()})`,
    );
  }

  // Cycle check
  const visited = new Set<string>([newState.epistemic_state_id]);
  let current: EpistemicStateNode | undefined = predecessor;
  while (current) {
    if (visited.has(current.epistemic_state_id)) {
      throw new RegistryValidationError(
        'EPISTEMIC_CYCLE_DETECTED',
        `Cycle detected in epistemic history at '${current.epistemic_state_id}'`,
      );
    }
    visited.add(current.epistemic_state_id);
    current = current.supersedes_epistemic_state_id
      ? existingStates.find((s) => s.epistemic_state_id === current?.supersedes_epistemic_state_id)
      : undefined;
  }
}

/**
 * Validates measurement correction invariants (SPEC02 §18):
 * - Correction preserves metric_revision_id and semantic measurement scope
 * - At most one direct successor per predecessor
 * - SINGLE_ARTIFACT requires exactly 1 covered artifact; MIXED requires at least 2
 */
export function validateMeasurementCorrection(
  existingObservations: PerformanceObservationNode[],
  newObservation: PerformanceObservationNode,
): void {
  // Scope check
  if (newObservation.publication_state === 'SINGLE_ARTIFACT') {
    if (newObservation.covered_published_artifact_ids.length !== 1) {
      throw new RegistryValidationError(
        'INVALID_SINGLE_ARTIFACT_COUNT',
        `SINGLE_ARTIFACT requires exactly 1 covered published artifact, received ${newObservation.covered_published_artifact_ids.length}`,
      );
    }
  } else if (newObservation.publication_state === 'MIXED') {
    if (newObservation.covered_published_artifact_ids.length < 2) {
      throw new RegistryValidationError(
        'INVALID_MIXED_ARTIFACT_COUNT',
        `MIXED publication state requires at least 2 covered published artifacts, received ${newObservation.covered_published_artifact_ids.length}`,
      );
    }
  }

  if (!newObservation.supersedes_observation_id) return;

  const predecessor = existingObservations.find(
    (o) => o.observation_id === newObservation.supersedes_observation_id,
  );
  if (!predecessor) {
    throw new RegistryValidationError(
      'MISSING_MEASUREMENT_PREDECESSOR',
      `Predecessor observation '${newObservation.supersedes_observation_id}' not found`,
    );
  }

  if (newObservation.metric_revision_id !== predecessor.metric_revision_id) {
    throw new RegistryValidationError(
      'METRIC_REVISION_PRESERVATION_VIOLATION',
      `Measurement correction cannot change metric_revision_id from '${predecessor.metric_revision_id}' to '${newObservation.metric_revision_id}'`,
    );
  }

  const existingSuccessor = existingObservations.find(
    (o) =>
      o.supersedes_observation_id === predecessor.observation_id &&
      o.observation_id !== newObservation.observation_id,
  );
  if (existingSuccessor) {
    throw new RegistryValidationError(
      'BRANCHED_MEASUREMENT_SUCCESSOR',
      `Observation '${predecessor.observation_id}' already has correction successor '${existingSuccessor.observation_id}'`,
    );
  }
}

/**
 * Validates decision closure invariants (SPEC02 §17):
 * - DecisionRecord owns canonical release_status
 * - FinalContentPackage does NOT duplicate release_status
 * - Selected candidate belongs to DecisionSnapshot candidate_ids
 * - Transitive references match between DecisionRecord and FinalContentPackage
 */
export function validateDecisionClosure(
  snapshot: DecisionSnapshotData,
  decisionRecord: DecisionRecordData,
  contentPackage?: FinalContentPackageData,
): void {
  if (decisionRecord.snapshot_id !== snapshot.snapshot_id) {
    throw new RegistryValidationError(
      'DECISION_SNAPSHOT_MISMATCH',
      `DecisionRecord snapshot_id '${decisionRecord.snapshot_id}' does not match DecisionSnapshot '${snapshot.snapshot_id}'`,
    );
  }

  if (decisionRecord.task_revision_id !== snapshot.task_revision_id) {
    throw new RegistryValidationError(
      'DECISION_TASK_REVISION_MISMATCH',
      `DecisionRecord task_revision_id '${decisionRecord.task_revision_id}' does not match DecisionSnapshot '${snapshot.task_revision_id}'`,
    );
  }

  if (decisionRecord.selected_candidate_id) {
    if (!snapshot.candidate_ids.includes(decisionRecord.selected_candidate_id)) {
      throw new RegistryValidationError(
        'SELECTED_CANDIDATE_NOT_IN_SNAPSHOT',
        `Selected candidate '${decisionRecord.selected_candidate_id}' is not present in DecisionSnapshot candidates`,
      );
    }
  }

  if (contentPackage) {
    if ('release_status' in contentPackage && contentPackage.release_status !== undefined) {
      throw new RegistryValidationError(
        'PACKAGE_OWNS_RELEASE_STATUS_ERROR',
        'FinalContentPackage MUST NOT duplicate release_status; DecisionRecord is the sole canonical owner',
      );
    }

    if (contentPackage.decision_id !== decisionRecord.decision_id) {
      throw new RegistryValidationError(
        'PACKAGE_DECISION_ID_MISMATCH',
        `Package decision_id '${contentPackage.decision_id}' does not match DecisionRecord '${decisionRecord.decision_id}'`,
      );
    }

    if (contentPackage.decision_snapshot_id !== decisionRecord.snapshot_id) {
      throw new RegistryValidationError(
        'PACKAGE_SNAPSHOT_ID_MISMATCH',
        `Package decision_snapshot_id '${contentPackage.decision_snapshot_id}' does not match DecisionRecord snapshot_id '${decisionRecord.snapshot_id}'`,
      );
    }

    if (contentPackage.task_revision_id !== decisionRecord.task_revision_id) {
      throw new RegistryValidationError(
        'PACKAGE_TASK_REVISION_MISMATCH',
        `Package task_revision_id '${contentPackage.task_revision_id}' does not match DecisionRecord task_revision_id '${decisionRecord.task_revision_id}'`,
      );
    }

    if (
      decisionRecord.selected_candidate_id &&
      contentPackage.selected_candidate_id !== decisionRecord.selected_candidate_id
    ) {
      throw new RegistryValidationError(
        'PACKAGE_CANDIDATE_MISMATCH',
        `Package selected_candidate_id '${contentPackage.selected_candidate_id}' does not match DecisionRecord '${decisionRecord.selected_candidate_id}'`,
      );
    }
  }
}

export interface GenericReferenceInput {
  entity_id?: string | null;
  entity_type?: string | null;
  stable_id?: string | null;
  revision_id?: string | null;
}

export function validateGenericReference(ref: GenericReferenceInput): void {
  const hasEntity = Boolean(ref.entity_id);
  const hasRevision = Boolean(ref.revision_id || ref.stable_id);
  if (hasEntity && hasRevision) {
    throw new RegistryValidationError(
      'GENERIC_REF_BRANCH_CONFLICT',
      'Cannot populate both entity_id and revision_id/stable_id in GenericReference',
    );
  }
  if (!hasEntity && !hasRevision) {
    throw new RegistryValidationError(
      'GENERIC_REF_EMPTY',
      'GenericReference must populate either entity_id or revision_id',
    );
  }
}

export interface KnowledgeGapResolutionInput {
  gap_id: string;
  blocking: boolean;
  status: string;
  resolution_id?: string | null;
}

export function validateKnowledgeGapClosure(gaps: KnowledgeGapResolutionInput[]): void {
  for (const gap of gaps) {
    if (gap.blocking && (gap.status === 'UNRESOLVED_REMOVED' || (!gap.resolution_id && gap.status === 'RESOLVED'))) {
      throw new RegistryValidationError(
        'BLOCKING_KNOWLEDGE_GAP_SILENT_REMOVAL_FORBIDDEN',
        `Blocking KnowledgeGap '${gap.gap_id}' cannot be silently removed; it requires an explicit resolution record`,
      );
    }
  }
}

export interface EvidenceItemOriginInput {
  origin_type: string;
  origin_id: string;
  referenced_entity_type?: string;
}

export function validateEvidenceOrigin(evidence: EvidenceItemOriginInput): void {
  if (!['SOURCE_ARTIFACT', 'PERFORMANCE_OBSERVATION'].includes(evidence.origin_type)) {
    throw new RegistryValidationError(
      'EVIDENCE_DISCRIMINATOR_MISMATCH',
      `EvidenceItem origin_type '${evidence.origin_type}' is invalid; must be 'SOURCE_ARTIFACT' or 'PERFORMANCE_OBSERVATION'`,
    );
  }
  if (
    evidence.origin_type === 'PERFORMANCE_OBSERVATION' &&
    evidence.referenced_entity_type &&
    evidence.referenced_entity_type !== 'PerformanceObservation'
  ) {
    throw new RegistryValidationError(
      'PERFORMANCE_EVIDENCE_SOURCE_ARTIFACT_FORBIDDEN',
      `EvidenceItem with origin_type 'PERFORMANCE_OBSERVATION' cannot reference entity of type '${evidence.referenced_entity_type}'`,
    );
  }
  if (
    evidence.origin_type === 'SOURCE_ARTIFACT' &&
    evidence.referenced_entity_type &&
    evidence.referenced_entity_type !== 'SourceArtifact'
  ) {
    throw new RegistryValidationError(
      'SOURCE_EVIDENCE_TYPE_MISMATCH',
      `EvidenceItem with origin_type 'SOURCE_ARTIFACT' cannot reference entity of type '${evidence.referenced_entity_type}'`,
    );
  }
}

export interface ApplicabilityAssessmentInput {
  assessment_id: string;
  subject_type: string;
  subject_revision_id: string;
  actual_entity_type?: string;
}

export function validateApplicabilityAssessment(assessment: ApplicabilityAssessmentInput): void {
  if (assessment.actual_entity_type && assessment.actual_entity_type !== assessment.subject_type) {
    throw new RegistryValidationError(
      'APPLICABILITY_SUBJECT_TYPE_MISMATCH',
      `Applicability subject_type '${assessment.subject_type}' does not match actual revision entity_type '${assessment.actual_entity_type}'`,
    );
  }
}

export function validateSnapshotTemporalCutoff(params: {
  snapshot_frozen_at: Date;
  cutoff_time: Date;
  field_name?: string;
}): void {
  if (params.cutoff_time.getTime() > params.snapshot_frozen_at.getTime()) {
    const code = params.field_name === 'rights_check'
      ? 'RIGHTS_CHECK_CUTOFF_AFTER_SNAPSHOT_FROZEN_AT'
      : 'APPLICABILITY_CUTOFF_AFTER_SNAPSHOT_FROZEN_AT';
    throw new RegistryValidationError(
      code,
      `Cutoff time (${params.cutoff_time.toISOString()}) cannot be after snapshot frozen_at (${params.snapshot_frozen_at.toISOString()})`,
    );
  }
}

export function validateEvaluatorRunConfigMembership(
  runConfigEvaluators: string[],
  candidateEvaluatorId: string,
): void {
  if (!runConfigEvaluators.includes(candidateEvaluatorId)) {
    throw new RegistryValidationError(
      'EVALUATOR_ABSENT_FROM_RUN_CONFIG',
      `Evaluator revision '${candidateEvaluatorId}' is absent from RunConfig evaluator set [${runConfigEvaluators.join(', ')}]`,
    );
  }
}

export function validateSnapshotTransitiveTenant(
  snapshotTenantId: string,
  inputs: { input_id: string; tenant_id: string }[],
): void {
  for (const input of inputs) {
    if (input.tenant_id !== snapshotTenantId) {
      throw new RegistryValidationError(
        'SNAPSHOT_TRANSITIVE_TENANT_MISMATCH',
        `Input '${input.input_id}' has tenant_id '${input.tenant_id}' which does not match snapshot tenant_id '${snapshotTenantId}'`,
      );
    }
  }
}

export function validateSnapshotInputTemporalClosure(
  snapshotFrozenAt: Date,
  inputs: { input_id: string; created_at: Date }[],
): void {
  for (const input of inputs) {
    if (input.created_at.getTime() > snapshotFrozenAt.getTime()) {
      throw new RegistryValidationError(
        'SNAPSHOT_INPUT_CREATED_AFTER_FROZEN_AT',
        `Input '${input.input_id}' created at ${input.created_at.toISOString()} is after snapshot frozen_at ${snapshotFrozenAt.toISOString()}`,
      );
    }
  }
}

export function validatePolicyResultSetCompleteness(
  expectedPolicyIds: string[],
  evaluatedPolicyIds: string[],
): void {
  const evaluatedSet = new Set(evaluatedPolicyIds);
  for (const pid of expectedPolicyIds) {
    if (!evaluatedSet.has(pid)) {
      throw new RegistryValidationError(
        'PARTIAL_POLICY_RESULT_SET_INCOMPLETE',
        `Policy evaluation is incomplete: missing required policy '${pid}'`,
      );
    }
  }
}

export function validatePolicyConflictResolution(resolution: {
  resolution_type: string;
  override_id?: string | null;
}): void {
  if (resolution.resolution_type === 'AUTHORIZED_OVERRIDE' && !resolution.override_id) {
    throw new RegistryValidationError(
      'OVERRIDE_RECORD_REQUIRED_FOR_AUTHORIZED_OVERRIDE',
      `PolicyConflictResolution with resolution_type 'AUTHORIZED_OVERRIDE' requires a non-null override_id`,
    );
  }
  if (resolution.resolution_type !== 'AUTHORIZED_OVERRIDE' && resolution.override_id) {
    throw new RegistryValidationError(
      'OVERRIDE_RECORD_FORBIDDEN_FOR_NON_OVERRIDE',
      `PolicyConflictResolution with resolution_type '${resolution.resolution_type}' must NOT have an override_id`,
    );
  }
}

export function validatePolicyOverrideSnapshot(
  decisionSnapshotId: string,
  overrideSnapshotId: string,
): void {
  if (overrideSnapshotId !== decisionSnapshotId) {
    throw new RegistryValidationError(
      'POLICY_OVERRIDE_SNAPSHOT_MISMATCH',
      `PolicyOverride snapshot_id '${overrideSnapshotId}' does not match DecisionSnapshot '${decisionSnapshotId}'`,
    );
  }
}

export function validatePackageStrategy(
  candidateStrategyId: string,
  packageStrategyId: string,
): void {
  if (candidateStrategyId !== packageStrategyId) {
    throw new RegistryValidationError(
      'FINAL_PACKAGE_STRATEGY_MISMATCH',
      `FinalContentPackage strategy_id '${packageStrategyId}' must match candidate strategy_id '${candidateStrategyId}'`,
    );
  }
}

export function validatePackageRightsChecks(
  snapshotRightsChecks: string[],
  packageRightsChecks: string[],
): void {
  const allowed = new Set(snapshotRightsChecks);
  for (const rcId of packageRightsChecks) {
    if (!allowed.has(rcId)) {
      throw new RegistryValidationError(
        'POST_DECISION_RIGHTS_CHECK_INJECTION_FORBIDDEN',
        `RightsCheck '${rcId}' was injected after snapshot freeze; not present in snapshot rights checks`,
      );
    }
  }
}

export function validateStageExecutionFencing(
  currentFencingToken: number,
  incomingFencingToken: number,
): void {
  if (incomingFencingToken < currentFencingToken) {
    throw new RegistryValidationError(
      'STALE_FENCING_TOKEN',
      `Incoming fencing token (${incomingFencingToken}) is stale; current token is (${currentFencingToken})`,
    );
  }
}

export function validateCycleCancellation(
  currentEpoch: number,
  cancelledEpoch: number,
): void {
  if (cancelledEpoch <= currentEpoch) {
    throw new RegistryValidationError(
      'CANCELLATION_REQUIRES_EPOCH_BUMP',
      `Cycle cancellation requires fencing_epoch (${cancelledEpoch}) to be strictly greater than current epoch (${currentEpoch})`,
    );
  }
}

export function validateReplayabilityStatus(
  payloadState: 'AVAILABLE' | 'REDACTED' | 'DELETED' | 'PRUNED',
  reportedReplayStatus: 'FULL' | 'PARTIAL_REDACTED' | 'UNAVAILABLE_DUE_TO_RETENTION' | 'INVALIDATED_BY_DELETION',
): void {
  if (payloadState !== 'AVAILABLE' && reportedReplayStatus === 'FULL') {
    throw new RegistryValidationError(
      'DELETED_PAYLOAD_CANNOT_BE_REPORTED_AS_FULL_REPLAY',
      `Target with payload_state '${payloadState}' cannot be reported as FULL replay status`,
    );
  }
}

export function validateDeletionTombstone(tombstone: {
  payload_retained: boolean;
  contains_prohibited_identity_data?: boolean;
}): void {
  if (tombstone.payload_retained || tombstone.contains_prohibited_identity_data) {
    throw new RegistryValidationError(
      'PROHIBITED_IDENTITY_DATA_RETAINED',
      'Required deletion must not retain prohibited identity or payload data merely to preserve FK/replay',
    );
  }
}

export function validateControlPlaneActivationRole(callerRole: string): void {
  if (callerRole === 'RUNTIME_EXECUTION' || callerRole === 'RUNTIME_AGENT') {
    throw new RegistryValidationError(
      'RUNTIME_ACTIVATION_PROHIBITED',
      `Runtime execution context is strictly forbidden from directly activating Control Plane revisions (SPEC02 §18, SPEC07 §75, SPEC10 §68). Revisions may only be activated by authorized Governance authority.`,
    );
  }
}

