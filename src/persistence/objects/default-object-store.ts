/**
 * ContentOS — Default Object Store Accessor
 *
 * Provides a canonical local filesystem ObjectStore instance for immutable source payloads.
 * Default location: data/objects or CONTENTOS_OBJECT_DIR environment variable.
 */
import path from 'path';
import { LocalObjectStore } from './local-object-store.js';

let defaultStore: LocalObjectStore | null = null;

export function getDefaultObjectStore(): LocalObjectStore {
  if (!defaultStore) {
    const objectDir = process.env.CONTENTOS_OBJECT_DIR || path.resolve(process.cwd(), 'data/objects');
    defaultStore = new LocalObjectStore(objectDir);
  }
  return defaultStore;
}

export function resetDefaultObjectStore(): void {
  defaultStore = null;
}
