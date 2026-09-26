/**
 * ContentOS — Local Filesystem Object Store
 *
 * Development implementation of ObjectStore (SPEC01 §12-15).
 * Uses local filesystem with content-hash addressing (SPEC01 §13):
 *   objects/{content_hash}
 *
 * Production deployments should use S3-compatible storage.
 */
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ContentHash } from '../../domain/shared/types.js';
import { ContentOSError, RetryCategory } from '../../domain/shared/types.js';
import type { ObjectMetadata, ObjectStore } from './object-store-interface.js';

export class LocalObjectStore implements ObjectStore {
  private readonly basePath: string;
  private readonly gcClaimed: Set<string> = new Set();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async put(data: Buffer, mediaType: string): Promise<ObjectMetadata> {
    // Content-addressable hash (SPEC01 §13)
    const hash = createHash('sha256').update(data).digest('hex') as ContentHash;
    const objectReference = `objects/${hash}`;
    const filePath = path.join(this.basePath, hash);

    // Ensure directory exists
    await fs.mkdir(this.basePath, { recursive: true });

    // Write immutable object (Step 1, SPEC01 §14)
    // If file already exists with same hash, that's fine — idempotent
    await fs.writeFile(filePath, data);

    const metadata: ObjectMetadata = {
      object_reference: objectReference,
      content_hash: hash,
      size_bytes: data.length,
      media_type: mediaType,
      created_at: new Date().toISOString(),
    };

    // Write metadata sidecar
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  async verify(objectReference: string, expectedHash: ContentHash): Promise<boolean> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      const data = await fs.readFile(filePath);
      const actualHash = createHash('sha256').update(data).digest('hex');

      if (actualHash !== expectedHash) {
        throw new ContentOSError({
          error_code: 'OBJECT_INTEGRITY_FAILURE',
          message: `Hash mismatch for ${objectReference}: expected ${expectedHash}, got ${actualHash}`,
          category: RetryCategory.DOMAIN_INVARIANT_FAILED,
        });
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof ContentOSError) throw err;
      return false;
    }
  }

  async get(objectReference: string): Promise<Buffer> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      return await fs.readFile(filePath);
    } catch {
      throw new ContentOSError({
        error_code: 'OBJECT_NOT_FOUND',
        message: `Object not found: ${objectReference}`,
        category: RetryCategory.DOMAIN_INVARIANT_FAILED,
      });
    }
  }

  async isReferenceable(objectReference: string): Promise<boolean> {
    // Object is not referenceable if it's actively GC-claimed (SPEC01 §15)
    if (this.gcClaimed.has(objectReference)) {
      return false;
    }

    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteOrphan(objectReference: string): Promise<void> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    // Claim GC lock (SPEC01 §15)
    this.gcClaimed.add(objectReference);

    try {
      // In production: verify no canonical DB references exist
      // For local dev: just delete
      await fs.unlink(filePath).catch(() => { /* already deleted */ });
      await fs.unlink(`${filePath}.meta.json`).catch(() => { /* metadata may not exist */ });
    } finally {
      this.gcClaimed.delete(objectReference);
    }
  }
}
