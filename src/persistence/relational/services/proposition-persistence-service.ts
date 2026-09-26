/**
 * ContentOS — Proposition Concurrency-Safe Persistence Service
 *
 * Implements SPEC03 §29–§36, §105, §116:
 * - Immutable Proposition semantic identity
 * - Concurrency-safe proposition resolution using derived advisory lock
 * - Double-check re-query pattern before creation
 * - Cross-tenant isolation & DataScope boundaries
 * - ImmutableEntityRegistry registration
 * - Material semantic change creates new proposition; never mutates old row
 */
import postgres from 'postgres';
import type { PropositionSemanticIdentity, PropositionType } from '../../../domain/knowledge/types.js';
import {
  computeSemanticFingerprint,
  computeAdvisoryLockKey,
  evaluateSemanticEquivalence,
} from '../../../domain/knowledge/semantic-fingerprint.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface ResolveOrCreatePropositionParams {
  propositionId: string;
  tenantId: string;
  workspaceId?: string | null;
  propositionType: PropositionType;
  canonicalMeaning: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers?: string;
  conditions?: string;
  populationScope?: string;
  jurisdictionScope?: string;
  supersedesPropositionId?: string | null;
}

export interface PropositionResolutionResult {
  propositionId: string;
  outcome: 'REUSE_EXISTING' | 'CREATED_NEW';
  fingerprint: string;
}

export class PropositionPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Resolves an accessible equivalent Proposition or creates a new one in a concurrency-safe transaction.
   * Implements SPEC03 §34, §116.
   */
  async resolveOrCreateProposition(
    params: ResolveOrCreatePropositionParams,
  ): Promise<PropositionResolutionResult> {
    const {
      propositionId,
      tenantId,
      workspaceId,
      propositionType,
      canonicalMeaning,
      subject,
      predicate,
      object,
      qualifiers = '',
      conditions = '',
      populationScope = '',
      jurisdictionScope = '',
      supersedesPropositionId,
    } = params;

    const identity: PropositionSemanticIdentity = {
      propositionType,
      canonicalMeaning,
      subject,
      predicate,
      object,
      qualifiers,
      conditions,
      populationScope,
      jurisdictionScope,
    };

    const fingerprint = computeSemanticFingerprint(identity);
    const lockKey = computeAdvisoryLockKey(fingerprint);

    return await this.sql.begin(async (sqlTx) => {
      // 1. Acquire transaction-level advisory lock on derived semantic fingerprint (SPEC03 §34)
      await sqlTx`SELECT pg_advisory_xact_lock(${lockKey})`;

      // 2. Re-query accessible propositions inside the locked transaction (SPEC03 §34, §105)
      // Only check propositions belonging to the same tenant or explicitly public/shared
      const candidates = await sqlTx`
        SELECT 
          proposition_id, tenant_id, workspace_id, proposition_type,
          canonical_meaning, subject, predicate, object, qualifiers,
          conditions, population_scope, jurisdiction_scope, supersedes_proposition_id
        FROM propositions
        WHERE tenant_id = ${tenantId}
          AND proposition_type = ${propositionType}
      `;

      for (const row of candidates) {
        const existingIdentity: PropositionSemanticIdentity = {
          propositionType: row.proposition_type as PropositionType,
          canonicalMeaning: row.canonical_meaning as string,
          subject: row.subject as string,
          predicate: row.predicate as string,
          object: row.object as string,
          qualifiers: (row.qualifiers as string) ?? '',
          conditions: (row.conditions as string) ?? '',
          populationScope: (row.population_scope as string) ?? '',
          jurisdictionScope: (row.jurisdiction_scope as string) ?? '',
        };

        const outcome = evaluateSemanticEquivalence(identity, existingIdentity);
        if (outcome === 'REUSE_EXISTING') {
          // Re-use existing canonical proposition
          return {
            propositionId: row.proposition_id as string,
            outcome: 'REUSE_EXISTING',
            fingerprint,
          };
        }
      }

      // 3. If supersedes_proposition_id is provided, verify it exists and is accessible
      if (supersedesPropositionId) {
        const [prior] = await sqlTx`
          SELECT proposition_id FROM propositions
          WHERE proposition_id = ${supersedesPropositionId} AND tenant_id = ${tenantId}
        `;
        if (!prior) {
          throw new RegistryValidationError(
            'SUPERSEDED_PROPOSITION_NOT_FOUND',
            `Prior proposition '${supersedesPropositionId}' to supersede not found in accessible tenant scope.`,
          );
        }
        if (supersedesPropositionId === propositionId) {
          throw new RegistryValidationError(
            'PROPOSITION_SELF_SUPERSEDING',
            `Proposition '${propositionId}' cannot supersede itself.`,
          );
        }
      }

      // 4. Register in ImmutableEntityRegistry (SPEC02 §5)
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'Proposition', ${propositionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 5. Insert canonical Proposition
      await sqlTx`
        INSERT INTO propositions (
          proposition_id, tenant_id, workspace_id, proposition_type,
          canonical_meaning, subject, predicate, object, qualifiers,
          conditions, population_scope, jurisdiction_scope, supersedes_proposition_id, created_at
        ) VALUES (
          ${propositionId}, ${tenantId}, ${workspaceId ?? null}, ${propositionType},
          ${canonicalMeaning}, ${subject}, ${predicate}, ${object}, ${qualifiers},
          ${conditions}, ${populationScope}, ${jurisdictionScope}, ${supersedesPropositionId ?? null}, now()
        )
      `;

      return {
        propositionId,
        outcome: 'CREATED_NEW',
        fingerprint,
      };
    });
  }
}
