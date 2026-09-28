import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface ContentRuntimeRegistryEntry {
  entityType: string;
  entityId: string;
  tenantId: string;
  workspaceId?: string | null;
}

export async function writeContentRuntimeRegistryEntries(
  sqlTx: any,
  entries: readonly ContentRuntimeRegistryEntry[],
): Promise<void> {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.entityType}\u0000${entry.entityId}`;
    if (seen.has(key)) {
      throw new RegistryValidationError(
        'DUPLICATE_REGISTRY_ENTRY',
        `Duplicate immutable registry request for '${entry.entityType}:${entry.entityId}'.`,
      );
    }
    seen.add(key);
    await sqlTx`
      INSERT INTO immutable_entity_registry (
        entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
      ) VALUES (
        ${entry.entityType}, ${entry.entityId}, ${entry.tenantId},
        ${entry.workspaceId ?? null}, 'AVAILABLE', now()
      )
    `;
  }
}
