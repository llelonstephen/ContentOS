/**
 * M0 Test 06 — Object Store Write/Read/Hash-Verify Cycle
 *
 * Validates M0 checklist item 06.
 * Tests the local object store implementation against SPEC01 §12-15.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalObjectStore } from '../../persistence/objects/local-object-store.js';
import { ContentHash, ContentOSError } from '../../domain/shared/types.js';

const TEST_DIR = path.resolve(import.meta.dirname, '../../../data/test-objects');

describe('M0-06: Object Store Write/Read/Hash-Verify', () => {
  let store: LocalObjectStore;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    store = new LocalObjectStore(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write an object and return valid metadata', async () => {
    const data = Buffer.from('test content for ContentOS');
    const metadata = await store.put(data, 'text/plain');

    expect(metadata.object_reference).toMatch(/^objects\//);
    expect(metadata.content_hash).toBeTruthy();
    expect(metadata.size_bytes).toBe(data.length);
    expect(metadata.media_type).toBe('text/plain');
    expect(metadata.created_at).toBeTruthy();
  });

  it('should read back the same content', async () => {
    const data = Buffer.from('immutable evidence payload');
    const metadata = await store.put(data, 'application/json');

    const retrieved = await store.get(metadata.object_reference);
    expect(retrieved.equals(data)).toBe(true);
  });

  it('should verify hash correctly', async () => {
    const data = Buffer.from('content with verifiable hash');
    const metadata = await store.put(data, 'text/plain');

    const valid = await store.verify(metadata.object_reference, metadata.content_hash);
    expect(valid).toBe(true);
  });

  it('should throw OBJECT_INTEGRITY_FAILURE on hash mismatch (SPEC01 §13)', async () => {
    const data = Buffer.from('original content');
    const metadata = await store.put(data, 'text/plain');

    await expect(
      store.verify(metadata.object_reference, 'wrong-hash' as ContentHash),
    ).rejects.toThrow(ContentOSError);

    try {
      await store.verify(metadata.object_reference, 'wrong-hash' as ContentHash);
    } catch (err) {
      expect(err).toBeInstanceOf(ContentOSError);
      expect((err as ContentOSError).error_code).toBe('OBJECT_INTEGRITY_FAILURE');
    }
  });

  it('should throw on reading non-existent object', async () => {
    await expect(
      store.get('objects/nonexistent'),
    ).rejects.toThrow(ContentOSError);
  });

  it('should be idempotent — writing same content returns same hash', async () => {
    const data = Buffer.from('deterministic content');
    const m1 = await store.put(data, 'text/plain');
    const m2 = await store.put(data, 'text/plain');

    expect(m1.content_hash).toBe(m2.content_hash);
    expect(m1.object_reference).toBe(m2.object_reference);
  });

  it('should report isReferenceable correctly', async () => {
    const data = Buffer.from('referenceable content');
    const metadata = await store.put(data, 'text/plain');

    expect(await store.isReferenceable(metadata.object_reference)).toBe(true);
    expect(await store.isReferenceable('objects/nonexistent')).toBe(false);
  });
});
