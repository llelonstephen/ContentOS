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
import type {
  CausalStatus,
  PropositionType,
  EvidenceCompatibilityStatus,
  EvidenceRelationship,
} from '../../../domain/knowledge/types.js';
import { verifyStageFencing, type StageFencingContext } from './stage-fencing-coordinator.js';
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
}

export type ReplayabilityStatus =
  | 'FULL'
  | 'PARTIAL_REDACTED'
  | 'UNAVAILABLE_DUE_TO_RETENTION'
  | 'INVALIDATED_BY_DELETION';

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
    } = params;

    if (supersedesEpistemicStateId && supersedesEpistemicStateId === epistemicStateId) {
      throw new RegistryValidationError(
        'EPISTEMIC_CYCLE',
        `EpistemicStateVersion '${epistemicStateId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing & DecisionCycle state check (SPEC03 §103, §104)
      const effectiveFencingContext: StageFencingContext | undefined = fencingContext || cycleId
        ? {
            decisionCycleId: cycleId ?? fencingContext?.decisionCycleId,
            stageExecutionId: fencingContext?.stageExecutionId,
            fencingToken: fencingContext?.fencingToken,
            leaseOwner: fencingContext?.leaseOwner,
          }
        : undefined;
      await verifyStageFencing(sqlTx, {
        fencingContext: effectiveFencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: !!(effectiveFencingContext?.decisionCycleId),
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
      if (prop.workspace_id && workspaceId && prop.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Proposition '${propositionId}' is scoped to workspace '${prop.workspace_id}', not '${workspaceId}'.`,
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

      // If runConfigId is provided, verify derivation revision is pinned in the RunConfig
      if (runConfigId) {
        const [rc] = await sqlTx`
          SELECT run_config_id, runtime_parameters FROM run_configs WHERE run_config_id = ${runConfigId}
        `;
        if (rc && rc.runtime_parameters) {
          const paramsObj = typeof rc.runtime_parameters === 'string'
            ? JSON.parse(rc.runtime_parameters)
            : rc.runtime_parameters;
          const pinnedRevision = paramsObj.derivation_revision_ref ?? paramsObj.derivation_revision_id;
          if (pinnedRevision && pinnedRevision !== derivationRevisionId && pinnedRevision !== `${derivationEntityType}/${derivationStableId}/${derivationRevisionId}`) {
            throw new RegistryValidationError(
              'DERIVATION_REVISION_NOT_PINNED',
              `Derivation revision '${derivationRevisionId}' is not pinned by RunConfig '${runConfigId}' (pinned: '${pinnedRevision}'). Mid-run evaluator drift prohibited.`,
            );
          }
        }
      }

      // 3. Load DB assessments, verify closure, tenant isolation, valid time, and lawful availability
      const assessmentsForDerivation: AssessmentForDerivation[] = [];

      for (const assId of assessmentIds) {
        const [row] = await sqlTx`
          SELECT 
            ea.assessment_id, ea.link_id, ea.compatibility_status, ea.relationship,
            ea.supersedes_assessment_id, ea.limitations, ea.tenant_id as assessment_tenant,
            epl.proposition_id, epl.tenant_id as link_tenant,
            ei.evidence_id, ei.tenant_id as evidence_tenant, ei.valid_from, ei.valid_until_if_known,
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

        // SPEC02 Retention boundary check: if underlying payload is deleted, evidence is unavailable for new derivations
        if (row.origin_type === 'SOURCE_ARTIFACT') {
          const [source] = await sqlTx`
            SELECT sa.snapshot_reference, obr.state as payload_state
            FROM source_artifacts sa
            JOIN object_registry obr ON sa.snapshot_reference = obr.object_id
            WHERE sa.source_id = ${row.origin_id}
          `;
          if (source && source.payload_state === 'DELETED') {
            throw new RegistryValidationError(
              'UNAVAILABLE_EVIDENCE_IN_DERIVATION',
              `EvidenceItem '${row.evidence_id}' payload has been deleted under retention policy. Unavailable prohibited evidence cannot contribute to new epistemic derivations.`,
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
      let finalSupportStatus = params.supportStatus ?? 'UNKNOWN';
      let finalCausalStatus = params.causalStatus ?? (prop.proposition_type === 'CAUSAL' ? 'UNKNOWN' : 'NOT_APPLICABLE');
      let finalUncertainty = params.uncertainty ?? 'NONE';

      if (derivationEntityType === 'EvaluatorConfig' || derivationMethod === 'RULE_BASED') {
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
   * Performs an exact historical replay traversal for an EpistemicStateVersion.
   * Implements SPEC03 §110, §111:
   * Traverses EpistemicStateVersion -> exact assessment_ids -> EvidenceAssessment -> EvidencePropositionLink -> EvidenceItem -> SourceArtifact/PerformanceObservation.
   * Checks payload availability to report degraded retention replayability.
   */
  async getEpistemicStateReplay(epistemicStateId: string): Promise<{
    epistemicState: any;
    proposition: any;
    assessments: any[];
    replayability: ReplayabilityStatus;
  }> {
    const [epistemicState] = await this.sql`
      SELECT * FROM epistemic_state_versions WHERE epistemic_state_id = ${epistemicStateId}
    `;
    if (!epistemicState) {
      throw new RegistryValidationError(
        'EPISTEMIC_STATE_NOT_FOUND',
        `EpistemicStateVersion '${epistemicStateId}' does not exist.`,
      );
    }

    const [proposition] = await this.sql`
      SELECT * FROM propositions WHERE proposition_id = ${epistemicState.proposition_id}
    `;

    const assessments = await this.sql`
      SELECT 
        ea.*,
        epl.evidence_id,
        ei.statement,
        ei.origin_type,
        ei.origin_id
      FROM epistemic_state_assessments esa
      JOIN evidence_assessments ea ON esa.assessment_id = ea.assessment_id
      JOIN evidence_proposition_links epl ON ea.link_id = epl.link_id
      JOIN evidence_items ei ON epl.evidence_id = ei.evidence_id
      WHERE esa.epistemic_state_id = ${epistemicStateId}
    `;

    // Check payload states in object_registry (SPEC03 §111, SPEC02 §30)
    let hasDeletedPayload = false;
    for (const a of assessments) {
      if (a.origin_type === 'SOURCE_ARTIFACT') {
        const [source] = await this.sql`
          SELECT sa.snapshot_reference, obr.state as payload_state
          FROM source_artifacts sa
          JOIN object_registry obr ON sa.snapshot_reference = obr.object_id
          WHERE sa.source_id = ${a.origin_id}
        `;
        if (source && source.payload_state === 'DELETED') {
          hasDeletedPayload = true;
        }
      }
    }

    const replayability: ReplayabilityStatus = hasDeletedPayload
      ? 'UNAVAILABLE_DUE_TO_RETENTION'
      : 'FULL';

    return {
      epistemicState,
      proposition,
      assessments,
      replayability,
    };
  }
}
