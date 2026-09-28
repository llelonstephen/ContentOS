import { createHash } from 'node:crypto';
import { failContent } from './content-error-codes.js';
import type { JsonValue, TimestampInput } from './types.js';

export const CONTENT_CANONICAL_SERIALIZATION_VERSION = 'content-runtime-input.v1' as const;

export type CanonicalField =
  | { readonly name: string; readonly kind: 'VALUE'; readonly value: JsonValue }
  | { readonly name: string; readonly kind: 'TIMESTAMP'; readonly value: TimestampInput }
  | { readonly name: string; readonly kind: 'ORDERED_LIST'; readonly value: readonly JsonValue[] }
  | { readonly name: string; readonly kind: 'SEMANTIC_SET'; readonly value: readonly JsonValue[] };

export interface CanonicalInputManifest {
  readonly serialization_version: typeof CONTENT_CANONICAL_SERIALIZATION_VERSION;
  /** Field order is part of the serialization contract. */
  readonly fields: readonly CanonicalField[];
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalizeValue(value: JsonValue): JsonValue {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    failContent('CANONICAL_SERIALIZATION_INVALID', 'Non-finite numbers are not serializable');
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => compareCodeUnits(left, right));
    return Object.fromEntries(
      entries.map(([key, nested]) => [key, canonicalizeValue(nested)]),
    ) as JsonValue;
  }

  return value;
}

function normalizeTimestamp(value: TimestampInput): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    failContent('CANONICAL_SERIALIZATION_INVALID', `Invalid timestamp '${String(value)}'`);
  }
  return timestamp.toISOString();
}

function serializeSet(values: readonly JsonValue[]): readonly JsonValue[] {
  return values
    .map(canonicalizeValue)
    .map((value) => ({ value, key: JSON.stringify(value) }))
    .sort((left, right) => compareCodeUnits(left.key, right.key))
    .map(({ value }) => value);
}

function fieldTuple(field: CanonicalField): readonly [string, JsonValue] {
  if (field.kind === 'TIMESTAMP') return [field.name, normalizeTimestamp(field.value)];
  if (field.kind === 'SEMANTIC_SET') return [field.name, serializeSet(field.value)];
  // VALUE and ORDERED_LIST preserve all array order. ContentUnit order must flow through here.
  return [field.name, canonicalizeValue(field.value)];
}

export function serializeCanonicalInput(manifest: CanonicalInputManifest): string {
  if (manifest.serialization_version !== CONTENT_CANONICAL_SERIALIZATION_VERSION) {
    failContent('CANONICAL_SERIALIZATION_INVALID', 'Unsupported serialization version');
  }

  const names = manifest.fields.map(({ name }) => name);
  if (new Set(names).size !== names.length || names.some((name) => name.length === 0)) {
    failContent('CANONICAL_SERIALIZATION_INVALID', 'Canonical field names must be non-empty and unique');
  }

  return JSON.stringify([
    manifest.serialization_version,
    manifest.fields.map(fieldTuple),
  ]);
}

export function hashCanonicalInput(manifest: CanonicalInputManifest): string {
  return createHash('sha256').update(serializeCanonicalInput(manifest), 'utf8').digest('hex');
}
