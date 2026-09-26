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
 *   - SPEC03 §63: Derivation revision pinning.
 *   - SPEC03 §103, §104: FREEZING and stale worker commit rejection.
 *   - SPEC03 §110: Historical exact-reference replay.
 *   - SPEC02 §5: ImmutableEntityRegistry registration.
 */
import postgres from 'postgres';
import { validateCausalSupportGuard } from '../../../domain/knowledge/epistemic-derivation.js';
import type { CausalStatus, PropositionType } from '../../../domain/knowledge/types.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface AppendEpistemicStateParams {
  epistemicStateId: string;
  propositionId: string;
  supersedesEpistemicStateId?: string | null;
  supportStatus: string;
  causalStatus: string;
  uncertainty: string;
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
}

export class EpistemicPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Appends an EpistemicStateVersion (root or successor) with strict transactional invariants.
   */
  async appendEpistemicState(params: AppendEpistemicStateParams): Promise<void> {
    const {
      epistemicStateId,
      propositionId,
      supersedesEpistemicStateId,
      supportStatus,
      causalStatus,
      uncertainty,
      derivationMethod,
      derivationEntityType,
      derivationStableId,
      derivationRevisionId,
      validFrom,
      validUntilIfKnown,
      knownFrom,
      assessmentIds,
      tenantId,
      workspaceId,
      cycleId,
    } = params;

    if (supersedesEpistemicStateId && supersedesEpistemicStateId === epistemicStateId) {
      throw new RegistryValidationError(
        'EPISTEMIC_CYCLE',
        `EpistemicStateVersion '${epistemicStateId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stale worker / FREEZING check (SPEC03 §103, §104)
      if (cycleId) {
        const [cycle] = await sqlTx`
          SELECT decision_cycle_id, status FROM decision_cycles WHERE decision_cycle_id = ${cycleId}
        `;
        if (cycle) {
          if (cycle.status === 'FREEZING' || cycle.status === 'FROZEN') {
            throw new RegistryValidationError(
              'KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING',
              `Cannot commit epistemic state to DecisionCycle '${cycleId}' in status '${cycle.status}'. Upstream knowledge commits are prohibited after FREEZING begins.`,
            );
          }
          if (cycle.status === 'CANCELLED' || cycle.status === 'SUPERSEDED') {
            throw new RegistryValidationError(
              'STALE_WORKER_COMMIT_REJECTED',
              `Cannot commit epistemic state: DecisionCycle '${cycleId}' is '${cycle.status}'. Stale worker commit rejected.`,
            );
          }
        }
      }

      // 1. Verify proposition exists and enforce Causal Support Guard (SPEC03 §6.7, §65)
      const [prop] = await sqlTx`
        SELECT proposition_id, tenant_id, proposition_type
        FROM propositions
        WHERE proposition_id = ${propositionId}
      `;
      if (!prop) {
        throw new RegistryValidationError(
          'PROPOSITION_NOT_FOUND',
          `Proposition '${propositionId}' does not exist.`,
        );
      }

      validateCausalSupportGuard(
        prop.proposition_type as PropositionType,
        causalStatus as CausalStatus,
      );

      // 2. Exact Assessment Closure (SPEC03 §57)
      if (assessmentIds && assessmentIds.length > 0) {
        for (const assId of assessmentIds) {
          const [assessmentRow] = await sqlTx`
            SELECT ea.assessment_id, epl.proposition_id
            FROM evidence_assessments ea
            JOIN evidence_proposition_links epl ON ea.link_id = epl.link_id
            WHERE ea.assessment_id = ${assId}
          `;
          if (!assessmentRow) {
            throw new RegistryValidationError(
              'ASSESSMENT_NOT_FOUND',
              `Assessment '${assId}' does not exist.`,
            );
          }
          if (assessmentRow.proposition_id !== propositionId) {
            throw new RegistryValidationError(
              'EPISTEMIC_CLOSURE_VIOLATION',
              `Assessment '${assId}' links to proposition '${assessmentRow.proposition_id}', which does not match target proposition '${propositionId}'.`,
            );
          }
        }
      }

      // 3. Verify derivation revision exists in RevisionRegistry (SPEC03 §63)
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

      // 4. Single-root vs successor verification
      if (!supersedesEpistemicStateId) {
        // Root case: verify at most one root per proposition_id
        const [existingRoot] = await sqlTx`
          SELECT epistemic_state_id
          FROM epistemic_state_versions
          WHERE proposition_id = ${propositionId} AND supersedes_epistemic_state_id IS NULL
        `;
        if (existingRoot) {
          throw new RegistryValidationError(
            'SECOND_EPISTEMIC_ROOT_FORBIDDEN',
            `Proposition '${propositionId}' already has root EpistemicStateVersion '${existingRoot.epistemic_state_id}'. Only one root is allowed.`,
          );
        }
      } else {
        // Successor case: inspect and lock predecessor
        const [pred] = await sqlTx`
          SELECT epistemic_state_id, proposition_id, known_from, supersedes_epistemic_state_id
          FROM epistemic_state_versions
          WHERE epistemic_state_id = ${supersedesEpistemicStateId}
          FOR UPDATE
        `;
        if (!pred) {
          throw new RegistryValidationError(
            'PREDECESSOR_NOT_FOUND',
            `Predecessor EpistemicStateVersion '${supersedesEpistemicStateId}' does not exist.`,
          );
        }

        // Same proposition check
        if (pred.proposition_id !== propositionId) {
          throw new RegistryValidationError(
            'EPISTEMIC_PROPOSITION_MISMATCH',
            `Successor proposition '${propositionId}' does not match predecessor proposition '${pred.proposition_id}'.`,
          );
        }

        // Temporal order check: known_from must be strictly increasing
        const predKnown = new Date(pred.known_from).getTime();
        const succKnown = knownFrom.getTime();
        if (succKnown <= predKnown) {
          throw new RegistryValidationError(
            'EPISTEMIC_KNOWN_FROM_NON_INCREASING',
            `Successor known_from (${knownFrom.toISOString()}) must be strictly greater than predecessor (${new Date(pred.known_from).toISOString()}).`,
          );
        }

        // Non-branching check: predecessor must not already have a successor
        const [existingSucc] = await sqlTx`
          SELECT epistemic_state_id
          FROM epistemic_state_versions
          WHERE supersedes_epistemic_state_id = ${supersedesEpistemicStateId}
        `;
        if (existingSucc) {
          throw new RegistryValidationError(
            'EPISTEMIC_BRANCHING_FORBIDDEN',
            `Predecessor '${supersedesEpistemicStateId}' already superseded by '${existingSucc.epistemic_state_id}'. Branching is forbidden.`,
          );
        }

        // Cycle check
        let currentPredId: string | null = pred.supersedes_epistemic_state_id as string | null;
        while (currentPredId) {
          if (currentPredId === epistemicStateId) {
            throw new RegistryValidationError(
              'EPISTEMIC_CYCLE',
              `Cycle detected: '${epistemicStateId}' is already an ancestor of '${supersedesEpistemicStateId}'.`,
            );
          }
          const [ancestor] = await sqlTx`
            SELECT supersedes_epistemic_state_id
            FROM epistemic_state_versions
            WHERE epistemic_state_id = ${currentPredId}
          `;
          currentPredId = ancestor ? (ancestor.supersedes_epistemic_state_id as string | null) : null;
        }
      }

      // 5. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EpistemicStateVersion', ${epistemicStateId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 6. Insert epistemic_state_versions
      await sqlTx`
        INSERT INTO epistemic_state_versions (
          epistemic_state_id, tenant_id, workspace_id, supersedes_epistemic_state_id,
          proposition_id, support_status, causal_status, uncertainty, derivation_method,
          derivation_entity_type, derivation_stable_id, derivation_revision_id,
          valid_from, valid_until_if_known, known_from, created_at
        ) VALUES (
          ${epistemicStateId}, ${tenantId}, ${workspaceId ?? null}, ${supersedesEpistemicStateId ?? null},
          ${propositionId}, ${supportStatus}, ${causalStatus}, ${uncertainty}, ${derivationMethod},
          ${derivationEntityType}, ${derivationStableId}, ${derivationRevisionId},
          ${validFrom}, ${validUntilIfKnown ?? null}, ${knownFrom}, now()
        )
      `;

      // 7. Insert normalized assessment links
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
   * Implements SPEC03 §110:
   * Traverses EpistemicStateVersion -> exact assessment_ids -> EvidenceAssessment -> EvidencePropositionLink -> EvidenceItem -> SourceArtifact/PerformanceObservation.
   */
  async getEpistemicStateReplay(epistemicStateId: string): Promise<{
    epistemicState: any;
    proposition: any;
    assessments: any[];
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

    return {
      epistemicState,
      proposition,
      assessments,
    };
  }
}
