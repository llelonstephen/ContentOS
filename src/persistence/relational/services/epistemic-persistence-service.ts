/**
 * ContentOS — Epistemic Chain Transactional Persistence Service
 *
 * Enforces SPEC02 transactional invariants:
 *   - §13, §22: At most one root EpistemicStateVersion per proposition_id.
 *   - §13, §22: Non-branching: At most one direct successor per predecessor.
 *   - §13, §22: Same proposition: Predecessor and successor must share proposition_id.
 *   - §13, §22: Temporal order: Successor known_from > predecessor known_from.
 *   - §13, §22: Acyclic: Chain must not contain cycles.
 *   - §5: Every immutable epistemic entity registers in ImmutableEntityRegistry in the same transaction.
 */
import postgres from 'postgres';
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
    } = params;

    if (supersedesEpistemicStateId && supersedesEpistemicStateId === epistemicStateId) {
      throw new RegistryValidationError(
        'EPISTEMIC_CYCLE',
        `EpistemicStateVersion '${epistemicStateId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify proposition exists
      const [prop] = await sqlTx`
        SELECT proposition_id, tenant_id
        FROM propositions
        WHERE proposition_id = ${propositionId}
      `;
      if (!prop) {
        throw new RegistryValidationError(
          'PROPOSITION_NOT_FOUND',
          `Proposition '${propositionId}' does not exist.`,
        );
      }

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

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EpistemicStateVersion', ${epistemicStateId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert epistemic_state_versions
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

      // 4. Insert normalized assessment links
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
}
