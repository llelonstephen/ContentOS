/**
 * ContentOS — Control Plane Transactional Persistence Service
 *
 * Enforces SPEC02 transactional invariants:
 *   - §6, §21: Exact typed revision must be registered in RevisionRegistry in the same transaction.
 *   - §7, §21: Supersession integrity (same entity_type, same stable_id, no self-supersession).
 *   - §14: RegisteredControlPlaneRevisionPayload must FK to exact RevisionRegistry triple and ObjectRegistry.
 *   - §14, §32: RegisteredControlPlaneRevisionPayload / RevisionRegistry / ObjectRegistry same-tenant ownership.
 *   - §14: payload_schema_revision_id must resolve to registered SchemaDefinition revision.
 *   - §14: payload_hash must match ObjectRegistry content_hash.
 *   - §19, §29: ControlPlaneActivation non-overlapping intervals and unambiguous as-of resolution.
 */
import postgres from 'postgres';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface RegisterTypedRevisionParams {
  entityType: string;
  stableId: string;
  revisionId: string;
  supersedesRevisionId?: string | null;
  tenantId: string;
  workspaceId?: string | null;
  insertTypedRow: (sqlTx: postgres.TransactionSql) => Promise<void>;
  insertReferenceSets?: (sqlTx: postgres.TransactionSql) => Promise<void>;
}

export interface RegisterControlPlaneConfigParams {
  entityType: string;
  stableId: string;
  revisionId: string;
  supersedesRevisionId?: string | null;
  tenantId: string;
  workspaceId?: string | null;
  objectId: string;
  payloadHash: string;
  payloadSchemaRevisionId: string;
}

export interface ActivateRevisionParams {
  activationId: string;
  deploymentScope: string;
  componentType: string;
  stableId: string;
  activeRevisionId: string;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
}

export class ControlPlanePersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Registers a typed domain revision atomically with its RevisionRegistry identity and link sets.
   */
  async registerTypedRevision(params: RegisterTypedRevisionParams): Promise<void> {
    const {
      entityType,
      stableId,
      revisionId,
      supersedesRevisionId,
      tenantId,
      workspaceId,
      insertTypedRow,
      insertReferenceSets,
    } = params;

    // Self-supersession check
    if (supersedesRevisionId && supersedesRevisionId === revisionId) {
      throw new RegistryValidationError(
        'SELF_SUPERSESSION',
        `Revision '${revisionId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // Validate predecessor if present
      if (supersedesRevisionId) {
        const [pred] = await sqlTx`
          SELECT entity_type, stable_id, revision_id, tenant_id
          FROM revision_registry
          WHERE entity_type = ${entityType} AND revision_id = ${supersedesRevisionId}
        `;
        if (!pred) {
          throw new RegistryValidationError(
            'PREDECESSOR_NOT_FOUND',
            `Predecessor revision '${supersedesRevisionId}' of type '${entityType}' not found in RevisionRegistry.`,
          );
        }
        if (pred.stable_id !== stableId) {
          throw new RegistryValidationError(
            'SUPERSESSION_STABLE_ID_MISMATCH',
            `Predecessor stable_id '${pred.stable_id}' does not match successor stable_id '${stableId}'.`,
          );
        }
        if (pred.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'CROSS_TENANT_SUPERSEDES',
            `Predecessor tenant '${pred.tenant_id}' does not match successor tenant '${tenantId}'.`,
          );
        }
      }

      // 1. Insert into RevisionRegistry
      await sqlTx`
        INSERT INTO revision_registry (
          entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          ${entityType}, ${stableId}, ${revisionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 2. Insert typed revision row
      await insertTypedRow(sqlTx);

      // 3. Insert normalized reference set link tables if present
      if (insertReferenceSets) {
        await insertReferenceSets(sqlTx);
      }
    });
  }

  /**
   * Registers a generic Control Plane configuration revision and its payload atomically.
   */
  async registerControlPlaneConfig(params: RegisterControlPlaneConfigParams): Promise<void> {
    const {
      entityType,
      stableId,
      revisionId,
      supersedesRevisionId,
      tenantId,
      workspaceId,
      objectId,
      payloadHash,
      payloadSchemaRevisionId,
    } = params;

    const allowedTypes = [
      'PromptConfig',
      'ModelConfig',
      'ToolConfig',
      'RetrieverConfig',
      'EvaluatorConfig',
      'SchemaDefinition',
    ];
    if (!allowedTypes.includes(entityType)) {
      throw new RegistryValidationError(
        'INVALID_CONTROL_PLANE_ENTITY_TYPE',
        `Entity type '${entityType}' is not an authorized generic Control Plane entity type.`,
      );
    }

    if (supersedesRevisionId && supersedesRevisionId === revisionId) {
      throw new RegistryValidationError(
        'SELF_SUPERSESSION',
        `Revision '${revisionId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify object exists, is AVAILABLE, and belongs to SAME tenant
      const [obj] = await sqlTx`
        SELECT object_id, tenant_id, content_hash, state
        FROM object_registry
        WHERE object_id = ${objectId}
        FOR UPDATE
      `;
      if (!obj) {
        throw new RegistryValidationError(
          'OBJECT_NOT_FOUND',
          `Referenced ObjectRegistry object '${objectId}' does not exist.`,
        );
      }
      if (obj.state !== 'AVAILABLE') {
        throw new RegistryValidationError(
          'OBJECT_NOT_AVAILABLE',
          `Referenced ObjectRegistry object '${objectId}' is in state '${obj.state}', expected 'AVAILABLE'.`,
        );
      }
      if (obj.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'CROSS_TENANT_PAYLOAD_OBJECT',
          `Cross-tenant violation: Payload tenant '${tenantId}' does not match ObjectRegistry tenant '${obj.tenant_id}'.`,
        );
      }
      if (obj.content_hash !== payloadHash) {
        throw new RegistryValidationError(
          'PAYLOAD_HASH_MISMATCH',
          `Payload hash '${payloadHash}' does not match ObjectRegistry content_hash '${obj.content_hash}'.`,
        );
      }

      // 2. Validate payload_schema_revision_id resolves to a registered SchemaDefinition revision
      const [schemaRev] = await sqlTx`
        SELECT revision_id
        FROM revision_registry
        WHERE entity_type = 'SchemaDefinition' AND revision_id = ${payloadSchemaRevisionId}
      `;
      if (!schemaRev) {
        throw new RegistryValidationError(
          'SCHEMA_DEFINITION_NOT_FOUND',
          `payload_schema_revision_id '${payloadSchemaRevisionId}' does not resolve to a registered SchemaDefinition revision.`,
        );
      }

      // 3. Predecessor check
      if (supersedesRevisionId) {
        const [pred] = await sqlTx`
          SELECT entity_type, stable_id, revision_id, tenant_id
          FROM revision_registry
          WHERE entity_type = ${entityType} AND revision_id = ${supersedesRevisionId}
        `;
        if (!pred) {
          throw new RegistryValidationError(
            'PREDECESSOR_NOT_FOUND',
            `Predecessor revision '${supersedesRevisionId}' not found.`,
          );
        }
        if (pred.stable_id !== stableId) {
          throw new RegistryValidationError(
            'SUPERSESSION_STABLE_ID_MISMATCH',
            `Predecessor stable_id '${pred.stable_id}' does not match '${stableId}'.`,
          );
        }
        if (pred.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'CROSS_TENANT_SUPERSEDES',
            `Predecessor tenant '${pred.tenant_id}' does not match '${tenantId}'.`,
          );
        }
      }

      // 4. Insert into revision_registry
      await sqlTx`
        INSERT INTO revision_registry (
          entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          ${entityType}, ${stableId}, ${revisionId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 5. Insert into registered_control_plane_revisions
      await sqlTx`
        INSERT INTO registered_control_plane_revisions (
          entity_type, stable_id, revision_id, supersedes_revision_id,
          payload_hash, payload_schema_revision_id, created_at, tenant_id, workspace_id
        ) VALUES (
          ${entityType}, ${stableId}, ${revisionId}, ${supersedesRevisionId ?? null},
          ${payloadHash}, ${payloadSchemaRevisionId}, now(), ${tenantId}, ${workspaceId ?? null}
        )
      `;

      // 6. Insert into registered_control_plane_revision_payloads
      await sqlTx`
        INSERT INTO registered_control_plane_revision_payloads (
          entity_type, stable_id, revision_id, tenant_id, workspace_id,
          object_id, payload_hash, payload_schema_revision_id, created_at
        ) VALUES (
          ${entityType}, ${stableId}, ${revisionId}, ${tenantId}, ${workspaceId ?? null},
          ${objectId}, ${payloadHash}, ${payloadSchemaRevisionId}, now()
        )
      `;
    });
  }

  /**
   * Activates a revision for a given deployment scope and stable ID.
   * Enforces interval non-overlap under single-active semantics.
   */
  async activateRevision(params: ActivateRevisionParams): Promise<void> {
    const {
      activationId,
      deploymentScope,
      componentType,
      stableId,
      activeRevisionId,
      effectiveFrom,
      effectiveUntil,
    } = params;

    if (effectiveUntil && effectiveUntil <= effectiveFrom) {
      throw new RegistryValidationError(
        'INVALID_TEMPORAL_INTERVAL',
        `effective_until must be strictly greater than effective_from.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Verify revision exists in revision_registry
      const [rev] = await sqlTx`
        SELECT entity_type, stable_id, revision_id
        FROM revision_registry
        WHERE entity_type = ${componentType} AND stable_id = ${stableId} AND revision_id = ${activeRevisionId}
      `;
      if (!rev) {
        throw new RegistryValidationError(
          'REVISION_NOT_FOUND',
          `Cannot activate unregistered revision '${activeRevisionId}' for component '${componentType}'.`,
        );
      }

      // 2. Lock and check for overlapping intervals
      const existing = await sqlTx`
        SELECT activation_id, effective_from, effective_until
        FROM control_plane_activations
        WHERE deployment_scope = ${deploymentScope}
          AND component_type = ${componentType}
          AND stable_id = ${stableId}
        FOR UPDATE
      `;

      for (const row of existing) {
        const from = new Date(row.effective_from);
        const until = row.effective_until ? new Date(row.effective_until) : null;

        const newFrom = effectiveFrom.getTime();
        const newUntil = effectiveUntil ? effectiveUntil.getTime() : Infinity;
        const existFrom = from.getTime();
        const existUntil = until ? until.getTime() : Infinity;

        // Overlap predicate: newFrom < existUntil && newUntil > existFrom
        if (newFrom < existUntil && newUntil > existFrom) {
          throw new RegistryValidationError(
            'ACTIVATION_INTERVAL_OVERLAP',
            `Activation interval [${effectiveFrom.toISOString()}, ${effectiveUntil?.toISOString() ?? 'infinity'}) overlaps with existing activation '${row.activation_id}' [${from.toISOString()}, ${until?.toISOString() ?? 'infinity'}).`,
          );
        }
      }

      // 3. Insert activation
      await sqlTx`
        INSERT INTO control_plane_activations (
          activation_id, deployment_scope, component_type, stable_id,
          active_revision_id, effective_from, effective_until, created_at
        ) VALUES (
          ${activationId}, ${deploymentScope}, ${componentType}, ${stableId},
          ${activeRevisionId}, ${effectiveFrom}, ${effectiveUntil ?? null}, now()
        )
      `;
    });
  }

  /**
   * Resolves active revision at an instant `asOf`. Guaranteed to return at most one revision.
   */
  async resolveActiveAt(
    deploymentScope: string,
    componentType: string,
    stableId: string,
    asOf: Date,
  ): Promise<string | null> {
    const rows = await this.sql`
      SELECT active_revision_id
      FROM control_plane_activations
      WHERE deployment_scope = ${deploymentScope}
        AND component_type = ${componentType}
        AND stable_id = ${stableId}
        AND effective_from <= ${asOf}
        AND (effective_until IS NULL OR effective_until > ${asOf})
    `;

    if (rows.length > 1) {
      throw new RegistryValidationError(
        'AMBIGUOUS_AS_OF_RESOLUTION',
        `Ambiguous resolution at ${asOf.toISOString()}: expected 0 or 1 active revision, found ${rows.length}.`,
      );
    }

    return rows.length === 1 ? (rows[0]?.active_revision_id as string) : null;
  }
}
