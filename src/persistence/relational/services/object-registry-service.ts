/**
 * ContentOS — Object Registry & GC Reachability Service
 *
 * Implements SPEC02 §19, §30:
 *   - Object write protocol (content addressing, verification, availability check)
 *   - Complete reachability awareness across all registered canonical reference sources
 *   - Multi-source GC evaluation: canonical_object_reference_count(object_id) === 0
 *   - GC claim and deletion lifecycle
 */
import postgres from 'postgres';

export interface ObjectRegistryRecord {
  object_id: string;
  tenant_id: string;
  workspace_id?: string | null;
  content_hash: string;
  object_key: string;
  size_bytes: number;
  media_type: string;
  state: 'AVAILABLE' | 'GC_CLAIMED' | 'DELETED';
  gc_claim_token?: string | null;
  gc_claimed_at?: Date | null;
  created_at: Date;
  deleted_at?: Date | null;
}

export interface CanonicalReferenceSource {
  source_name: string;
  source_table: string;
  object_id_column: string;
  owner_scope_columns: string;
  active: boolean;
}

export class ObjectRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'ObjectRegistryError';
  }
}

/**
 * Computes canonical object reachability across ALL registered canonical reference sources (SPEC02 §19, §30).
 *
 * GC reachability CANNOT rely solely on ObjectReference table; it MUST query every
 * active entry in canonical_object_reference_sources.
 */
export async function computeCanonicalObjectReachability(
  sql: ReturnType<typeof postgres>,
  objectId: string,
): Promise<{ totalReferences: number; sourceCounts: Record<string, number> }> {
  // Query all active canonical reference sources
  const sources = await sql<CanonicalReferenceSource[]>`
    SELECT source_name, source_table, object_id_column, owner_scope_columns, active
    FROM canonical_object_reference_sources
    WHERE active = true
  `;

  let totalReferences = 0;
  const sourceCounts: Record<string, number> = {};

  for (const src of sources) {
    // Sanitize identifier inputs
    const tableName = src.source_table.replace(/[^a-zA-Z0-9_]/g, '');
    const colName = src.object_id_column.replace(/[^a-zA-Z0-9_]/g, '');

    const queryStr = `SELECT count(*)::int as ref_count FROM "${tableName}" WHERE "${colName}" = $1`;
    const result = await sql.unsafe(queryStr, [objectId]);
    const count = (result[0]?.['ref_count'] as number) ?? 0;
    sourceCounts[src.source_name] = count;
    totalReferences += count;
  }

  return { totalReferences, sourceCounts };
}

/**
 * Claims an object for GC if and only if reachability count across all canonical sources is zero (SPEC02 §30).
 */
export async function claimObjectForGC(
  sql: ReturnType<typeof postgres>,
  objectId: string,
  claimToken: string,
): Promise<void> {
  const { totalReferences, sourceCounts } = await computeCanonicalObjectReachability(sql, objectId);

  if (totalReferences > 0) {
    const details = Object.entries(sourceCounts)
      .filter(([, c]) => c > 0)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ');
    throw new ObjectRegistryError(
      'OBJECT_IN_USE_CANNOT_GC',
      `Cannot claim object '${objectId}' for GC: still referenced by ${totalReferences} canonical sources (${details})`,
    );
  }

  const updated = await sql`
    UPDATE object_registry
    SET state = 'GC_CLAIMED',
        gc_claim_token = ${claimToken},
        gc_claimed_at = now()
    WHERE object_id = ${objectId}
      AND state = 'AVAILABLE'
    RETURNING object_id
  `;

  if (updated.length === 0) {
    throw new ObjectRegistryError(
      'OBJECT_NOT_AVAILABLE_FOR_GC',
      `Object '${objectId}' is not in AVAILABLE state or does not exist`,
    );
  }
}

/**
 * Finalizes deletion of a GC-claimed object (SPEC02 §30).
 */
export async function finalizeObjectDeletion(
  sql: ReturnType<typeof postgres>,
  objectId: string,
  claimToken: string,
): Promise<void> {
  // Re-verify reachability across serialized boundary
  const { totalReferences } = await computeCanonicalObjectReachability(sql, objectId);
  if (totalReferences > 0) {
    throw new ObjectRegistryError(
      'OBJECT_CONCURRENTLY_REFERENCED',
      `Object '${objectId}' was concurrently referenced prior to final deletion`,
    );
  }

  const updated = await sql`
    UPDATE object_registry
    SET state = 'DELETED',
        deleted_at = now()
    WHERE object_id = ${objectId}
      AND state = 'GC_CLAIMED'
      AND gc_claim_token = ${claimToken}
    RETURNING object_id
  `;

  if (updated.length === 0) {
    throw new ObjectRegistryError(
      'INVALID_GC_CLAIM_TOKEN',
      `Cannot delete object '${objectId}': claim token mismatch or object not in GC_CLAIMED state`,
    );
  }
}
