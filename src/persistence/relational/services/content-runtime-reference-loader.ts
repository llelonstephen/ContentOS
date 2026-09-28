import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface ContentRuntimeScope {
  tenantId: string;
  workspaceId?: string | null;
  allowTenantShared?: boolean;
}

export interface ContentRuntimeImmutableRef {
  refKind: 'IMMUTABLE_ENTITY';
  entityType: string;
  entityId: string;
}

export interface ContentRuntimeRevisionRef {
  refKind: 'REVISION';
  entityType: string;
  stableId: string;
  revisionId: string;
}

export type ContentRuntimeReference = ContentRuntimeImmutableRef | ContentRuntimeRevisionRef;

function assertWorkspace(
  actual: string | null,
  scope: ContentRuntimeScope,
  label: string,
): void {
  const expected = scope.workspaceId ?? null;
  if (actual === expected || (scope.allowTenantShared && actual === null)) return;
  throw new RegistryValidationError(
    'WORKSPACE_ISOLATION_VIOLATION',
    `${label} workspace does not match the authorized M4 transaction scope.`,
  );
}

export async function loadContentRuntimeReference(
  sqlTx: any,
  scope: ContentRuntimeScope,
  ref: ContentRuntimeReference,
): Promise<Record<string, unknown>> {
  if (ref.refKind === 'IMMUTABLE_ENTITY') {
    const [row] = await sqlTx`
      SELECT entity_type, entity_id, tenant_id, workspace_id, payload_state
      FROM immutable_entity_registry
      WHERE entity_type = ${ref.entityType} AND entity_id = ${ref.entityId}
    `;
    if (!row) {
      throw new RegistryValidationError(
        'IMMUTABLE_REFERENCE_NOT_FOUND',
        `Immutable reference '${ref.entityType}:${ref.entityId}' does not exist.`,
      );
    }
    if (row.tenant_id !== scope.tenantId) {
      throw new RegistryValidationError('TENANT_ISOLATION_VIOLATION', 'Immutable reference tenant mismatch.');
    }
    assertWorkspace(row.workspace_id ?? null, scope, 'Immutable reference');
    if (row.payload_state !== 'AVAILABLE') {
      throw new RegistryValidationError('REFERENCE_PAYLOAD_UNAVAILABLE', 'Immutable reference payload is unavailable.');
    }
    return row;
  }

  const [row] = await sqlTx`
    SELECT entity_type, stable_id, revision_id, tenant_id, workspace_id, payload_state
    FROM revision_registry
    WHERE entity_type = ${ref.entityType}
      AND stable_id = ${ref.stableId}
      AND revision_id = ${ref.revisionId}
  `;
  if (!row) {
    throw new RegistryValidationError(
      'REVISION_REFERENCE_NOT_FOUND',
      `Revision reference '${ref.entityType}:${ref.stableId}:${ref.revisionId}' does not exist.`,
    );
  }
  if (row.tenant_id !== scope.tenantId) {
    throw new RegistryValidationError('TENANT_ISOLATION_VIOLATION', 'Revision reference tenant mismatch.');
  }
  assertWorkspace(row.workspace_id ?? null, scope, 'Revision reference');
  if (row.payload_state !== 'AVAILABLE') {
    throw new RegistryValidationError('REFERENCE_PAYLOAD_UNAVAILABLE', 'Revision reference payload is unavailable.');
  }
  return row;
}

export async function loadContentRuntimeReferences(
  sqlTx: any,
  scope: ContentRuntimeScope,
  refs: readonly ContentRuntimeReference[],
): Promise<ReadonlyArray<Record<string, unknown>>> {
  return Promise.all(refs.map((ref) => loadContentRuntimeReference(sqlTx, scope, ref)));
}
