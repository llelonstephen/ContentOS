/**
 * ContentOS — Object Store Interface
 *
 * Implements SPEC01 §12-15:
 *   - Immutable object storage for large payloads
 *   - Content-addressable via hash (SPEC01 §13)
 *   - Cross-store commit protocol (SPEC01 §14)
 *   - Orphan safety (SPEC01 §15)
 *   - Hash mismatch → OBJECT_INTEGRITY_FAILURE (SPEC01 §13)
 *
 * Domain modules use this interface.
 * Infrastructure adapters provide implementations.
 */
import { ContentHash } from '../../domain/shared/types.js';

// ──────────────────────────────────────────────
// Object metadata (SPEC01 §13)
// ──────────────────────────────────────────────

export interface ObjectMetadata {
  readonly object_reference: string;
  readonly content_hash: ContentHash;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly created_at: string;
}

// ──────────────────────────────────────────────
// Object Store Interface
// ──────────────────────────────────────────────

export interface ObjectStore {
  /**
   * Step 1 of cross-store commit protocol (SPEC01 §14):
   * Write immutable object.
   * Returns the content hash and object reference.
   */
  put(data: Buffer, mediaType: string): Promise<ObjectMetadata>;

  /**
   * Step 2-3 of cross-store commit protocol (SPEC01 §14):
   * Verify object exists and verify content hash.
   * Throws OBJECT_INTEGRITY_FAILURE on hash mismatch.
   */
  verify(objectReference: string, expectedHash: ContentHash): Promise<boolean>;

  /**
   * Read object by reference.
   */
  get(objectReference: string): Promise<Buffer>;

  /**
   * Check if an object is actively GC-claimed (SPEC01 §15).
   * Returns true if safe to reference.
   */
  isReferenceable(objectReference: string): Promise<boolean>;

  /**
   * Delete orphan object (maintenance only, SPEC01 §15).
   * Must verify no canonical references exist.
   * Must hold GC claim until deletion committed.
   */
  deleteOrphan(objectReference: string): Promise<void>;
}
