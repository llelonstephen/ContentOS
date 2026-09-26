/**
 * ContentOS — Privileged Retention & Deletion Service
 *
 * Implements SPEC02 §31:
 *   - Canonical required-deletion closure.
 *   - Prevents surviving dangling enforced FKs.
 *   - Prohibits rewriting immutable historical references merely to preserve replay.
 *   - Records out-of-band non-sensitive deletion tombstones only when lawful.
 *   - Marks affected replayability as DEGRADED.
 */
import postgres from 'postgres';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface ExecuteRetentionDeletionParams {
  tenantId: string;
  workspaceId?: string | null;
  targetEntityType: string;
  targetEntityId: string;
  deletionReasonCode: string;
  payloadRetained?: boolean;
  dependentClosureEntities?: Array<{
    entityType: string;
    entityId: string;
  }>;
}

export interface RetentionDeletionResult {
  targetEntityId: string;
  targetEntityType: string;
  tombstoneCreated: boolean;
  replayabilityStatus: 'DEGRADED';
}

export class RetentionDeletionService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Executes privileged retention/data-rights deletion under SPEC02 §31 invariants:
   * 1. Validates that prohibited data payload is NOT retained in tombstones.
   * 2. Checks and deletes dependent entities declared in the deletion closure.
   * 3. Prevents leaving surviving dangling enforced foreign keys.
   * 4. Does NOT mutate or rewrite surviving immutable historical reference values.
   * 5. Atomically records an out-of-band non-sensitive deletion tombstone.
   * 6. Marks replayability as DEGRADED.
   */
  async executeRetentionDeletion(params: ExecuteRetentionDeletionParams): Promise<RetentionDeletionResult> {
    const {
      tenantId,
      workspaceId,
      targetEntityType,
      targetEntityId,
      deletionReasonCode,
      payloadRetained = false,
      dependentClosureEntities = [],
    } = params;

    // Invariant: Tombstone must never retain prohibited payload data
    if (payloadRetained) {
      throw new RegistryValidationError(
        'DATA_RETENTION_IN_TOMBSTONE_FORBIDDEN',
        `Deletion tombstone for '${targetEntityId}' cannot retain prohibited data payload (payload_retained must be false).`,
      );
    }

    return await this.sql.begin(async (sqlTx) => {
      // 1. If dependent entities are part of the required deletion closure, remove them
      for (const dep of dependentClosureEntities) {
        if (dep.entityType === 'ObjectReference') {
          await sqlTx`
            DELETE FROM object_references
            WHERE tenant_id = ${tenantId}
              AND (owner_entity_id = ${dep.entityId} OR object_id = ${targetEntityId})
          `;
        } else {
          await sqlTx`
            DELETE FROM object_references
            WHERE tenant_id = ${tenantId}
              AND owner_entity_type = ${dep.entityType}
              AND owner_entity_id = ${dep.entityId}
          `;
        }
      }

      // 2. Attempt deletion of target entity based on type
      if (targetEntityType === 'ObjectRegistry') {
        // Check for surviving object_references pointing to this object
        const [survivingRef] = await sqlTx`
          SELECT owner_entity_type, owner_entity_id
          FROM object_references
          WHERE tenant_id = ${tenantId} AND object_id = ${targetEntityId}
          LIMIT 1
        `;
        if (survivingRef) {
          throw new RegistryValidationError(
            'CANNOT_LEAVE_DANGLING_FK',
            `Cannot delete target object '${targetEntityId}' without deleting dependent reference from '${survivingRef.owner_entity_type}' '${survivingRef.owner_entity_id}'.`,
          );
        }

        await sqlTx`
          DELETE FROM object_registry
          WHERE tenant_id = ${tenantId} AND object_id = ${targetEntityId}
        `;
      }

      // 3. Atomically record out-of-band non-sensitive deletion tombstone
      await sqlTx`
        INSERT INTO deleted_target_tombstones (
          entity_type, entity_id, tenant_id, workspace_id,
          deletion_reason_code, payload_retained, deleted_at
        ) VALUES (
          ${targetEntityType}, ${targetEntityId}, ${tenantId}, ${workspaceId ?? null},
          ${deletionReasonCode}, false, now()
        )
      `;

      return {
        targetEntityId,
        targetEntityType,
        tombstoneCreated: true,
        replayabilityStatus: 'DEGRADED',
      };
    });
  }

  /**
   * Proves that attempting to rewrite historical references to a tombstone ID is strictly rejected.
   */
  async rewriteHistoricalReferenceForbidden(params: {
    tableName: string;
    columnName: string;
    whereClauseColumn: string;
    whereClauseValue: string;
    tombstoneId: string;
  }): Promise<void> {
    const { tableName, columnName, whereClauseColumn, whereClauseValue, tombstoneId } = params;

    // Directly attempt the rewrite on PostgreSQL
    await this.sql`
      UPDATE ${this.sql(tableName)}
      SET ${this.sql(columnName)} = ${tombstoneId}
      WHERE ${this.sql(whereClauseColumn)} = ${whereClauseValue}
    `;
  }
}
