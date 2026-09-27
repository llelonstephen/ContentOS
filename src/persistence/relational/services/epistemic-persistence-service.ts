/**
 * ContentOS — Epistemic Chain Transactional Persistence Service
 *
 * Enforces SPEC02 & SPEC03 transactional invariants:
 *   - SPEC02 §13, §22: At most one root EpistemicStateVersion per proposition_id.
 *   - SPEC02 §13, §22: Non-branching: At most one direct successor per predecessor.
 *   - SPEC02 §13, §22: Same proposition: Predecessor and successor must share proposition_id.
 *   - SPEC02 §13, §22: Temporal order: Successor known_from > predecessor known_from.
 *   - SPEC02 §13, §22: Acyclic: Chain must not contain cycles.
 *   - SPEC03 §6.7, §65: Causal support guard (non-causal proposition requires causal_status = NOT_APPLICABLE).
 *   - SPEC03 §57: Exact assessment closure (all assessments must resolve to the same proposition).
 *   - SPEC03 §60–§64: Canonical derivation mechanical validation (callers cannot bypass derivation engine).
 *   - SPEC03 §63: Derivation revision pinning against RunConfig / StageExecution.
 *   - SPEC03 §66: Evidence valid-time boundary check.
 *   - SPEC03 §103, §104: FREEZING and stale worker commit rejection.
 *   - SPEC03 §110, §111: Historical exact-reference replay & degraded retention replayability.
 *   - SPEC02 §5: ImmutableEntityRegistry registration.
 */
import postgres from 'postgres';
import {
  deriveEpistemicState,
  validateCausalSupportGuard,
  type AssessmentForDerivation,
} from '../../../domain/knowledge/epistemic-derivation.js';
import {
  EPISTEMIC_SUPPORT_STATUSES,
  CAUSAL_STATUSES,
  type CausalStatus,
  type PropositionType,
  type EvidenceCompatibilityStatus,
  type EvidenceRelationship,
} from '../../../domain/knowledge/types.js';
import {
  verifyStageFencing,
  type StageFencingContext,
  type WriteMode,
  type TrustedWriteCapability,
} from './stage-fencing-coordinator.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface AppendEpistemicStateParams {
  epistemicStateId: string;
  propositionId: string;
  supersedesEpistemicStateId?: string | null;
  supportStatus?: string;
  causalStatus?: string;
  uncertainty?: string;
  derivationMethod: string;
  derivationEntityType: string;
  derivationStableId: string;
  derivationRevisionId: string;
  validFrom: Date;
  validUntilIfKnown?: Date | null;
  knownFrom: Date;
  assessmentIds?: string[];
  tenantId: string;
  workspaceId?: string | null;
  cycleId?: string | null;
  runConfigId?: string | null;
  fencingContext?: StageFencingContext | null;
  writeMode?: WriteMode;
  trustedCapability?: TrustedWriteCapability;
}

export interface EpistemicReplayAuthContext {
  tenantId: string;
  workspaceId?: string | null;
  dataScope?: 'TENANT' | 'WORKSPACE' | 'SHARED' | 'PUBLIC';
}

export type ReplayabilityStatus =
  | 'FULL'
  | 'PARTIAL_REDACTED'
  | 'UNAVAILABLE_DUE_TO_RETENTION'
  | 'INVALIDATED_BY_DELETION';

const ALLOWED_DERIVATION_METHODS = ['RULE_BASED', 'BAYESIAN', 'EXPERIMENTAL', 'EXPERT_CONSENSUS'];

export class EpistemicPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Appends an EpistemicStateVersion (root or successor) with strict transactional invariants
   * and mechanical derivation validation.
   */
  async appendEpistemicState(params: AppendEpistemicStateParams): Promise<void> {
    const {
      epistemicStateId,
      propositionId,
      supersedesEpistemicStateId,
      derivationMethod,
      derivationEntityType,
      derivationStableId,
      derivationRevisionId,
      validFrom,
      validUntilIfKnown,
      knownFrom,
      assessmentIds = [],
      tenantId,
      workspaceId,
      cycleId,
      runConfigId,
      fencingContext,
      writeMode,
      trustedCapability,
    } = params;

    if (supersedesEpistemicStateId && supersedesEpistemicStateId === epistemicStateId) {
      throw new RegistryValidationError(
        'EPISTEMIC_CYCLE',
        `EpistemicStateVersion '${epistemicStateId}' cannot supersede itself.`,
      );
    }

    // Validate frozen vocabulary for caller-supplied statuses
    if (params.supportStatus && !EPISTEMIC_SUPPORT_STATUSES.includes(params.supportStatus as any)) {
      throw new RegistryValidationError(
        'INVALID_EPISTEMIC_STATUS',
        `Invalid supportStatus '${params.supportStatus}'. Must be one of: ${EPISTEMIC_SUPPORT_STATUSES.join(', ')}.`,
      );
    }
    if (params.causalStatus && !CAUSAL_STATUSES.includes(params.causalStatus as any)) {
      throw new RegistryValidationError(
        'INVALID_CAUSAL_STATUS',
        `Invalid causalStatus '${params.causalStatus}'. Must be one of: ${CAUSAL_STATUSES.join(', ')}.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing & DecisionCycle state check (SPEC03 §103, §104)
      const isCycle = writeMode === 'DECISION_CYCLE' || Boolean(cycleId || fencingContext?.decisionCycleId);
      if (isCycle && (!fencingContext || !fencingContext.decisionCycleId) && !cycleId) {
        throw new RegistryValidationError(
          'DECISION_CYCLE_CONTEXT_REQUIRED',
          'Canonical decision-cycle epistemic commit requires an explicit DecisionCycle context. Omitting stage authorization fails closed.',
        );
      }
      if (isCycle && !fencingContext?.stageExecutionId) {
        throw new RegistryValidationError(
          'STAGE_EXECUTION_CONTEXT_REQUIRED',
          'Decision-cycle epistemic commit requires stageExecutionId. Omitting stage authorization fails closed.',
        );
      }
      if (isCycle && (fencingContext?.fencingToken === undefined || fencingContext?.fencingToken === null)) {
        throw new RegistryValidationError(
          'FENCING_TOKEN_REQUIRED',
          'Decision-cycle epistemic commit requires fencingToken. Omitting fencing token fails closed.',
        );
      }

      const effectiveFencingContext: StageFencingContext | undefined = fencingContext || cycleId
        ? {
            decisionCycleId: (cycleId ?? fencingContext?.decisionCycleId) as string,
            stageExecutionId: fencingContext?.stageExecutionId,
            fencingToken: fencingContext?.fencingToken,
            leaseOwner: fencingContext?.leaseOwner,
          }
        : undefined;

      await verifyStageFencing(sqlTx, {
        fencingContext: effectiveFencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: isCycle,
        writeMode,
        trustedCapability,
      });

      // 1. Verify target proposition exists and belongs to tenant
      const [prop] = await sqlTx`
        SELECT proposition_id, tenant_id, workspace_id, proposition_type
        FROM propositions
        WHERE proposition_id = ${propositionId}
      `;
      if (!prop) {
        throw new RegistryValidationError(
          'PROPOSITION_NOT_FOUND',
          `Proposition '${propositionId}' does not exist.`,
        );
      }
      if (prop.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `Proposition '${propositionId}' belongs to tenant '${prop.tenant_id}', not caller '${tenantId}'.`,
        );
      }
      if (prop.workspace_id && (!workspaceId || prop.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Proposition '${propositionId}' is scoped to workspace '${prop.workspace_id}', not '${workspaceId || 'NONE'}'.`,
        );
      }

      // 2. Derivation Revision Pinning Verification (SPEC03 §63)
      if (derivationEntityType !== 'ResearchTrace') {
        const [rev] = await sqlTx`
          SELECT revision_id FROM revision_registry
          WHERE entity_type = ${derivationEntityType}
            AND stable_id = ${derivationStableId}
            AND revision_id = ${derivationRevisionId}
        `;
        if (!rev) {
          throw new RegistryValidationError(
            'DERIVATION_REVISION_NOT_FOUND',
            `Derivation revision ref '${derivationEntityType}/${derivationStableId}/${derivationRevisionId}' does not exist in RevisionRegistry.`,
          );
        }
      }

      // Authoritative Pinning for run-created decision knowledge
      if (isCycle && !runConfigId) {
        throw new RegistryValidationError(
          'RUN_CONFIG_REQUIRED',
          'Caller omitted RunConfig on a run-created derivation. RunConfig pinning is required.',
        );
      }

      if (runConfigId) {
        if (isCycle && effectiveFencingContext?.decisionCycleId) {
          const [cycleRow] = await sqlTx`
            SELECT run_id FROM decision_cycles WHERE decision_cycle_id = ${effectiveFencingContext.decisionCycleId}
          `;
          if (cycleRow?.run_id) {
            const [runRow] = await sqlTx`
              SELECT initial_run_config_id FROM runs WHERE run_id = ${cycleRow.run_id}
            `;
            if (runRow?.initial_run_config_id && runRow.initial_run_config_id !== runConfigId) {
              throw new RegistryValidationError(
                'RUN_CONFIG_MISMATCH',
                `Supplied RunConfig '${runConfigId}' does not match DecisionCycle RunConfig '${runRow.initial_run_config_id}'.`,
              );
            }
          }
        }

        const [rc] = await sqlTx`
          SELECT run_config_id, runtime_parameters FROM run_configs WHERE run_config_id = ${runConfigId}
        `;
        if (!rc) {
          throw new RegistryValidationError(
            'RUN_CONFIG_NOT_FOUND',
            `RunConfig '${runConfigId}' does not exist.`,
          );
        }
        if (!rc.runtime_parameters) {
          throw new RegistryValidationError(
            'DERIVATION_REVISION_NOT_PINNED',
            `RunConfig '${runConfigId}' runtime parameters contain no applicable derivation pin.`,
          );
        }

        const paramsObj = typeof rc.runtime_parameters === 'string'
          ? JSON.parse(rc.runtime_parameters)
          : rc.runtime_parameters;
        const pinnedRevision = paramsObj.derivation_revision_ref ?? paramsObj.derivation_revision_id;
        if (!pinnedRevision) {
          throw new RegistryValidationError(
            'DERIVATION_REVISION_NOT_PINNED',
            `RunConfig '${runConfigId}' runtime parameters do not pin a derivation revision.`,
          );
        }

        if (pinnedRevision !== derivationRevisionId && pinnedRevision !== `${derivationEntityType}/${derivationStableId}/${derivationRevisionId}`) {
          throw new RegistryValidationError(
            'DERIVATION_REVISION_NOT_PINNED',
            `Derivation revision '${derivationRevisionId}' is not pinned by RunConfig '${runConfigId}' (pinned: '${pinnedRevision}'). Mid-run evaluator drift prohibited.`,
          );
        }
      }

      // 3. Load DB assessments, verify closure, tenant isolation, valid time, and lawful availability
      const assessmentsForDerivation: AssessmentForDerivation[] = [];

      for (const assId of assessmentIds) {
        const [row] = await sqlTx`
          SELECT 
            ea.assessment_id, ea.link_id, ea.compatibility_status, ea.relationship,
            ea.supersedes_assessment_id, ea.limitations, ea.tenant_id as assessment_tenant,
            ea.workspace_id as assessment_workspace,
            epl.proposition_id, epl.tenant_id as link_tenant, epl.workspace_id as link_workspace,
            ei.evidence_id, ei.tenant_id as evidence_tenant, ei.workspace_id as evidence_workspace,
            ei.valid_from, ei.valid_until_if_known,
            ei.origin_type, ei.origin_id
          FROM evidence_assessments ea
          JOIN evidence_proposition_links epl ON ea.link_id = epl.link_id
          JOIN evidence_items ei ON epl.evidence_id = ei.evidence_id
          WHERE ea.assessment_id = ${assId}
        `;

        if (!row) {
          throw new RegistryValidationError(
            'ASSESSMENT_NOT_FOUND',
            `Assessment '${assId}' does not exist.`,
          );
        }

        // Exact assessment closure (SPEC03 §57)
        if (row.proposition_id !== propositionId) {
          throw new RegistryValidationError(
            'EPISTEMIC_CLOSURE_VIOLATION',
            `Assessment '${assId}' links to proposition '${row.proposition_id}', which does not match target proposition '${propositionId}'.`,
          );
        }

        // Tenant isolation across assessment, link, evidence
        if (row.assessment_tenant !== tenantId || row.link_tenant !== tenantId || row.evidence_tenant !== tenantId) {
          throw new RegistryValidationError(
            'TENANT_ISOLATION_VIOLATION',
            `Assessment '${assId}' or underlying link/evidence does not belong to tenant '${tenantId}'. Cross-tenant derivation is prohibited.`,
          );
        }

        // Fail-closed workspace isolation
        if (row.assessment_workspace && (!workspaceId || row.assessment_workspace !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `Assessment '${assId}' is scoped to workspace '${row.assessment_workspace}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
          );
        }
        if (row.link_workspace && (!workspaceId || row.link_workspace !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `EvidencePropositionLink is scoped to workspace '${row.link_workspace}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
          );
        }
        if (row.evidence_workspace && (!workspaceId || row.evidence_workspace !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `EvidenceItem is scoped to workspace '${row.evidence_workspace}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
          );
        }

        // SPEC02 Retention & deletion boundary check: check ObjectRegistry, IER, and tombstones
        if (row.origin_type === 'SOURCE_ARTIFACT') {
          const [source] = await sqlTx`
            SELECT sa.snapshot_reference, obr.state as payload_state
            FROM source_artifacts sa
            LEFT JOIN object_registry obr ON sa.snapshot_reference = obr.object_id
            WHERE sa.source_id = ${row.origin_id}
          `;
          const [tombstone] = await sqlTx`
            SELECT deletion_reason_code FROM deleted_target_tombstones
            WHERE (entity_type = 'Object' AND entity_id = ${source?.snapshot_reference ?? ''})
               OR (entity_type = 'SourceArtifact' AND entity_id = ${row.origin_id})
          `;
          const [ier] = await sqlTx`
            SELECT payload_state FROM immutable_entity_registry
            WHERE entity_type = 'SourceArtifact' AND entity_id = ${row.origin_id}
          `;

          if (
            !source ||
            !source.payload_state ||
            source.payload_state === 'DELETED' ||
            source.payload_state === 'GC_CLAIMED' ||
            source.payload_state !== 'AVAILABLE' ||
            ier?.payload_state === 'REDACTED' ||
            ier?.payload_state === 'DELETED' ||
            ier?.payload_state !== 'AVAILABLE' ||
            Boolean(tombstone)
          ) {
            throw new RegistryValidationError(
              'UNAVAILABLE_EVIDENCE_IN_DERIVATION',
              `EvidenceItem '${row.evidence_id}' source payload is unavailable, redacted, deleted, or tombstoned (object: '${source?.payload_state ?? 'MISSING'}', IER: '${ier?.payload_state ?? 'MISSING'}', tombstone: ${Boolean(tombstone)}). Unavailable prohibited evidence cannot contribute to new epistemic derivations.`,
            );
          }
        }

        // Evidence valid-time boundary check (SPEC03 §66)
        const evValidFrom = new Date(row.valid_from);
        const evValidUntil = row.valid_until_if_known ? new Date(row.valid_until_if_known) : null;
        if (evValidFrom > validFrom || (evValidUntil && evValidUntil < validFrom)) {
          throw new RegistryValidationError(
            'EVIDENCE_VALID_TIME_MISMATCH',
            `EvidenceItem '${row.evidence_id}' valid time (${evValidFrom.toISOString()} - ${evValidUntil?.toISOString() ?? 'open'}) does not cover derivation target valid_from (${validFrom.toISOString()}).`,
          );
        }

        assessmentsForDerivation.push({
          assessmentId: row.assessment_id as string,
          linkId: row.link_id as string,
          propositionId: row.proposition_id as string,
          evidenceId: row.evidence_id as string,
          compatibilityStatus: row.compatibility_status as EvidenceCompatibilityStatus,
          relationship: row.relationship as EvidenceRelationship,
          supersedesAssessmentId: row.supersedes_assessment_id as string | null,
          limitations: row.limitations as string | undefined,
        });
      }

      // 4. Single-root vs successor verification (SPEC02 §13, §22, SPEC03 §80–§85)
      if (!supersedesEpistemicStateId) {
        // Root case: verify at most one root per proposition_id
        const [existingRoot] = await sqlTx`
          SELECT epistemic_state_id
          FROM epistemic_state_versions
          WHERE proposition_id = ${propositionId}
            AND supersedes_epistemic_state_id IS NULL
        `;
        if (existingRoot) {
          throw new RegistryValidationError(
            'SECOND_EPISTEMIC_ROOT_FORBIDDEN',
            `Proposition '${propositionId}' already has a root EpistemicStateVersion ('${existingRoot.epistemic_state_id}'). Only one root is allowed per proposition.`,
          );
        }
      } else {
        // Successor case
        const [predecessor] = await sqlTx`
          SELECT epistemic_state_id, proposition_id, known_from, tenant_id
          FROM epistemic_state_versions
          WHERE epistemic_state_id = ${supersedesEpistemicStateId}
        `;
        if (!predecessor) {
          throw new RegistryValidationError(
            'PREDECESSOR_NOT_FOUND',
            `Predecessor EpistemicStateVersion '${supersedesEpistemicStateId}' not found.`,
          );
        }

        // Same proposition invariant (SPEC02 §13, §22)
        if (predecessor.proposition_id !== propositionId) {
          throw new RegistryValidationError(
            'EPISTEMIC_PROPOSITION_MISMATCH',
            `Successor EpistemicStateVersion belongs to proposition '${propositionId}', but predecessor belongs to '${predecessor.proposition_id}'.`,
          );
        }

        // Non-branching invariant: at most one direct successor per predecessor
        const [existingSuccessor] = await sqlTx`
          SELECT epistemic_state_id
          FROM epistemic_state_versions
          WHERE supersedes_epistemic_state_id = ${supersedesEpistemicStateId}
        `;
        if (existingSuccessor) {
          throw new RegistryValidationError(
            'EPISTEMIC_BRANCHING_FORBIDDEN',
            `Predecessor '${supersedesEpistemicStateId}' already has a direct successor ('${existingSuccessor.epistemic_state_id}'). Branching is prohibited.`,
          );
        }

        // Monotonic known_from invariant: successor known_from must be strictly greater than predecessor
        const predKnownFrom = new Date(predecessor.known_from).getTime();
        const succKnownFrom = knownFrom.getTime();
        if (succKnownFrom <= predKnownFrom) {
          throw new RegistryValidationError(
            'EPISTEMIC_KNOWN_FROM_NON_INCREASING',
            `Successor known_from (${knownFrom.toISOString()}) must be strictly greater than predecessor known_from (${new Date(predecessor.known_from).toISOString()}).`,
          );
        }

        // Acyclic chain verification: traverse ancestors to ensure no cycles
        let currentAncestorId: string | null = supersedesEpistemicStateId;
        const visited = new Set<string>([epistemicStateId]);
        while (currentAncestorId) {
          if (visited.has(currentAncestorId)) {
            throw new RegistryValidationError(
              'EPISTEMIC_CYCLE',
              `Cycle detected in EpistemicStateVersion chain at '${currentAncestorId}'. Chains must be strictly acyclic.`,
            );
          }
          visited.add(currentAncestorId);

          const [ancestor] = await sqlTx`
            SELECT supersedes_epistemic_state_id
            FROM epistemic_state_versions
            WHERE epistemic_state_id = ${currentAncestorId}
          `;
          currentAncestorId = ancestor?.supersedes_epistemic_state_id as string | null;
        }
      }

      // 5. Mechanically Derive Canonical Epistemic State (SPEC03 §60–§64)
      if (!ALLOWED_DERIVATION_METHODS.includes(derivationMethod)) {
        throw new RegistryValidationError(
          'UNKNOWN_DERIVATION_METHOD',
          `Unrecognized derivation method '${derivationMethod}'. Allowed canonical methods are: ${ALLOWED_DERIVATION_METHODS.join(', ')}.`,
        );
      }

      let finalSupportStatus = 'UNKNOWN';
      let finalCausalStatus = prop.proposition_type === 'CAUSAL' ? 'UNKNOWN' : 'NOT_APPLICABLE';
      let finalUncertainty = 'NONE';

      if (
        derivationEntityType === 'EvaluatorConfig' ||
        derivationMethod === 'RULE_BASED' ||
        derivationMethod === 'BAYESIAN'
      ) {
        const derived = deriveEpistemicState({
          propositionId,
          propositionType: prop.proposition_type as PropositionType,
          assessments: assessmentsForDerivation,
          derivationRevisionRef: {
            entityType: derivationEntityType as any,
            stableId: derivationStableId,
            revisionId: derivationRevisionId,
          },
          validFrom,
          validUntilIfKnown,
          knownFrom,
        });

        // Mechanical validation: verify caller does not bypass derivation engine
        if (params.supportStatus && params.supportStatus !== derived.supportStatus) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied supportStatus '${params.supportStatus}' does not match mechanically derived status '${derived.supportStatus}'. Canonical persistence cannot bypass the derivation engine.`,
          );
        }

        if (params.causalStatus && params.causalStatus !== derived.causalStatus) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied causalStatus '${params.causalStatus}' does not match mechanically derived causalStatus '${derived.causalStatus}'.`,
          );
        }

        const normCallerUncertainty = params.uncertainty?.trim().toUpperCase();
        const normDerivedUncertainty = derived.uncertainty?.trim().toUpperCase();
        if (normCallerUncertainty && normCallerUncertainty !== normDerivedUncertainty) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied uncertainty '${params.uncertainty}' does not match mechanically derived uncertainty '${derived.uncertainty}'.`,
          );
        }

        finalSupportStatus = derived.supportStatus;
        finalCausalStatus = derived.causalStatus;
        finalUncertainty = derived.uncertainty;
      } else if (derivationMethod === 'EXPERIMENTAL' && derivationEntityType === 'ResearchTrace') {
        const [trace] = await sqlTx`
          SELECT research_trace_id, tenant_id, outcome FROM research_traces WHERE research_trace_id = ${derivationStableId}
        `;
        if (trace && trace.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'TENANT_ISOLATION_VIOLATION',
            `ResearchTrace belongs to tenant '${trace.tenant_id}', not '${tenantId}'.`,
          );
        }

        // Mechanical derivation from actual assessments under pinned revision
        const derived = deriveEpistemicState({
          propositionId,
          propositionType: prop.proposition_type as PropositionType,
          assessments: assessmentsForDerivation,
          derivationRevisionRef: {
            entityType: derivationEntityType as any,
            stableId: derivationStableId,
            revisionId: derivationRevisionId,
          },
          validFrom,
          validUntilIfKnown,
          knownFrom,
        });

        // If research trace found no evidence or incomplete, support cannot be SUPPORTED
        if (trace && (trace.outcome === 'NO_EVIDENCE_FOUND' || trace.outcome === 'SEARCH_FAILED')) {
          if (params.supportStatus && params.supportStatus !== 'UNKNOWN' && params.supportStatus !== 'INSUFFICIENT') {
            throw new RegistryValidationError(
              'DERIVED_STATE_MISMATCH',
              `ResearchTrace outcome '${trace.outcome}' cannot produce supportStatus '${params.supportStatus}'. Adequate evidence is required.`,
            );
          }
        }

        // Caller cannot supply arbitrary assertions that differ from mechanical derivation
        if (params.supportStatus && params.supportStatus !== derived.supportStatus) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied supportStatus '${params.supportStatus}' does not match mechanically derived status '${derived.supportStatus}'.`,
          );
        }
        if (params.causalStatus && params.causalStatus !== derived.causalStatus) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied causalStatus '${params.causalStatus}' does not match mechanically derived causalStatus '${derived.causalStatus}'.`,
          );
        }
        const normCallerUncertainty = params.uncertainty?.trim().toUpperCase();
        const normDerivedUncertainty = derived.uncertainty?.trim().toUpperCase();
        if (normCallerUncertainty && normCallerUncertainty !== normDerivedUncertainty) {
          throw new RegistryValidationError(
            'DERIVED_STATE_MISMATCH',
            `Caller-supplied uncertainty '${params.uncertainty}' does not match mechanically derived uncertainty '${derived.uncertainty}'.`,
          );
        }

        finalSupportStatus = derived.supportStatus;
        finalCausalStatus = derived.causalStatus;
        finalUncertainty = derived.uncertainty;
      } else {
        throw new RegistryValidationError(
          'CANONICAL_DERIVATION_UNSUPPORTED',
          `Derivation method '${derivationMethod}' with entity '${derivationEntityType}' cannot produce canonical epistemic state without an authoritative validator.`,
        );
      }

      // Enforce frozen vocabulary preservation
      if (!EPISTEMIC_SUPPORT_STATUSES.includes(finalSupportStatus as any)) {
        throw new RegistryValidationError(
          'INVALID_EPISTEMIC_STATUS',
          `Derived supportStatus '${finalSupportStatus}' is not a canonical frozen SPEC03 status.`,
        );
      }
      if (!CAUSAL_STATUSES.includes(finalCausalStatus as any)) {
        throw new RegistryValidationError(
          'INVALID_CAUSAL_STATUS',
          `Derived causalStatus '${finalCausalStatus}' is not a canonical frozen SPEC03 status.`,
        );
      }

      // Causal Support Guard (SPEC03 §6.7, §65)
      validateCausalSupportGuard(
        prop.proposition_type as PropositionType,
        finalCausalStatus as CausalStatus,
      );

      // 6. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EpistemicStateVersion', ${epistemicStateId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 7. Insert epistemic_state_versions
      await sqlTx`
        INSERT INTO epistemic_state_versions (
          epistemic_state_id, tenant_id, workspace_id, supersedes_epistemic_state_id,
          proposition_id, support_status, causal_status, uncertainty,
          derivation_method, derivation_entity_type, derivation_stable_id,
          derivation_revision_id, valid_from, valid_until_if_known, known_from, created_at
        ) VALUES (
          ${epistemicStateId}, ${tenantId}, ${workspaceId ?? null}, ${supersedesEpistemicStateId ?? null},
          ${propositionId}, ${finalSupportStatus}, ${finalCausalStatus}, ${finalUncertainty},
          ${derivationMethod}, ${derivationEntityType}, ${derivationStableId},
          ${derivationRevisionId}, ${validFrom}, ${validUntilIfKnown ?? null}, ${knownFrom}, now()
        )
      `;

      // 8. Insert normalized assessment links
      if (assessmentIds && assessmentIds.length > 0) {
        for (const assessmentId of assessmentIds) {
          await sqlTx`
            INSERT INTO epistemic_state_assessments (
              epistemic_state_id, assessment_id
            ) VALUES (
              ${epistemicStateId}, ${assessmentId}
            )
          `;
        }
      }
    });
  }

  /**
   * Explicit decision-cycle EpistemicStateVersion appending. Requires valid stage fencing context.
   */
  async appendEpistemicStateForDecisionCycle(params: AppendEpistemicStateParams): Promise<void> {
    return this.appendEpistemicState({ ...params, writeMode: 'DECISION_CYCLE' });
  }

  /**
   * Performs an authorized exact historical replay traversal for an EpistemicStateVersion.
   * Implements SPEC03 §110, §111:
   *   - Enforces tenant and workspace authorization (knowing an ID never grants access).
   *   - Public Proposition does not expose inaccessible private assessments/evidence.
   *   - Traverses EpistemicStateVersion -> exact assessment_ids -> EvidenceAssessment -> EvidencePropositionLink -> EvidenceItem -> SourceArtifact/PerformanceObservation.
   *   - Checks payload availability across ObjectRegistry, deleted tombstones, and ImmutableEntityRegistry.
   */
  async getEpistemicStateReplay(
    epistemicStateId: string,
    authContext: EpistemicReplayAuthContext,
  ): Promise<{
    epistemicState: any;
    proposition: any;
    assessments: any[];
    replayability: ReplayabilityStatus;
  }> {
    if (!authContext || !authContext.tenantId) {
      throw new RegistryValidationError(
        'AUTHORIZATION_REQUIRED',
        'Replay authorization context with tenantId is required. Knowing an ID does not grant access.',
      );
    }

    const [epistemicState] = await this.sql`
      SELECT * FROM epistemic_state_versions WHERE epistemic_state_id = ${epistemicStateId}
    `;
    if (!epistemicState) {
      throw new RegistryValidationError(
        'EPISTEMIC_STATE_NOT_FOUND',
        `EpistemicStateVersion '${epistemicStateId}' does not exist.`,
      );
    }

    // Tenant isolation
    if (epistemicState.tenant_id !== authContext.tenantId) {
      throw new RegistryValidationError(
        'TENANT_ISOLATION_VIOLATION',
        `EpistemicStateVersion '${epistemicStateId}' belongs to tenant '${epistemicState.tenant_id}', not '${authContext.tenantId}'.`,
      );
    }

    // Workspace isolation: workspace-private epistemic state requires matching workspace
    if (epistemicState.workspace_id) {
      if (!authContext.workspaceId || authContext.workspaceId !== epistemicState.workspace_id) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EpistemicStateVersion '${epistemicStateId}' is scoped to workspace '${epistemicState.workspace_id}'. Caller workspace '${authContext.workspaceId || 'NONE'}' does not have access.`,
        );
      }
    }

    const [proposition] = await this.sql`
      SELECT * FROM propositions WHERE proposition_id = ${epistemicState.proposition_id}
    `;

    if (proposition && proposition.tenant_id !== authContext.tenantId) {
      throw new RegistryValidationError(
        'TENANT_ISOLATION_VIOLATION',
        `Proposition '${proposition.proposition_id}' belongs to tenant '${proposition.tenant_id}', not '${authContext.tenantId}'.`,
      );
    }

    const rawAssessments = await this.sql`
      SELECT 
        ea.*,
        ea.tenant_id as assessment_tenant,
        ea.workspace_id as assessment_workspace,
        epl.evidence_id,
        epl.tenant_id as link_tenant,
        epl.workspace_id as link_workspace,
        ei.statement,
        ei.origin_type,
        ei.origin_id,
        ei.tenant_id as evidence_tenant,
        ei.workspace_id as evidence_workspace
      FROM epistemic_state_assessments esa
      JOIN evidence_assessments ea ON esa.assessment_id = ea.assessment_id
      JOIN evidence_proposition_links epl ON ea.link_id = epl.link_id
      JOIN evidence_items ei ON epl.evidence_id = ei.evidence_id
      WHERE esa.epistemic_state_id = ${epistemicStateId}
    `;

    // Filter assessments: public proposition does not expose inaccessible private assessments/evidence
    const assessments = rawAssessments.filter((a: any) => {
      if (a.assessment_tenant && a.assessment_tenant !== authContext.tenantId) return false;
      if (a.link_tenant && a.link_tenant !== authContext.tenantId) return false;
      if (a.evidence_tenant && a.evidence_tenant !== authContext.tenantId) return false;
      if (a.assessment_workspace && (!authContext.workspaceId || a.assessment_workspace !== authContext.workspaceId)) {
        return false;
      }
      if (a.evidence_workspace && (!authContext.workspaceId || a.evidence_workspace !== authContext.workspaceId)) {
        return false;
      }
      return true;
    });

    // Check payload states in object_registry, tombstones, and immutable_entity_registry (SPEC03 §111, SPEC02 §30, §31)
    let hasDeletedPayload = false;
    let hasRedactedPayload = false;
    let hasInvalidatedPayload = false;
    let hasMissingPayload = false;

    for (const a of assessments) {
      if (a.origin_type === 'SOURCE_ARTIFACT') {
        const [source] = await this.sql`
          SELECT sa.snapshot_reference, sa.source_id, obr.state as payload_state
          FROM source_artifacts sa
          LEFT JOIN object_registry obr ON sa.snapshot_reference = obr.object_id
          WHERE sa.source_id = ${a.origin_id}
        `;
        const [tombstone] = await this.sql`
          SELECT deletion_reason_code FROM deleted_target_tombstones
          WHERE (entity_type = 'Object' AND entity_id = ${source?.snapshot_reference ?? ''})
             OR (entity_type = 'SourceArtifact' AND entity_id = ${a.origin_id})
        `;
        const [ier] = await this.sql`
          SELECT payload_state FROM immutable_entity_registry
          WHERE entity_type = 'SourceArtifact' AND entity_id = ${a.origin_id}
        `;

        if (tombstone?.deletion_reason_code === 'USER_REQUESTED_DELETION') {
          hasInvalidatedPayload = true;
        } else if (ier && ier.payload_state === 'REDACTED') {
          hasRedactedPayload = true;
        } else if (source && (source.payload_state === 'DELETED' || source.payload_state === 'GC_CLAIMED')) {
          hasDeletedPayload = true;
        } else if (tombstone) {
          hasDeletedPayload = true;
        } else if (!source || !source.payload_state || source.payload_state !== 'AVAILABLE') {
          hasMissingPayload = true;
        }
      }
    }

    let replayability: ReplayabilityStatus = 'FULL';
    if (hasInvalidatedPayload) {
      replayability = 'INVALIDATED_BY_DELETION';
    } else if (hasRedactedPayload) {
      replayability = 'PARTIAL_REDACTED';
    } else if (hasDeletedPayload || hasMissingPayload) {
      replayability = 'UNAVAILABLE_DUE_TO_RETENTION';
    }

    return {
      epistemicState,
      proposition,
      assessments,
      replayability,
    };
  }
}
