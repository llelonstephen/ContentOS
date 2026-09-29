import { createHash } from 'node:crypto';
import { failContent } from './content-error-codes.js';
import {
  AUDIENCE_FACTUAL_FIELDS,
  type AudienceFactualField,
  type AudienceStateView,
  type JsonPrimitive,
  type JsonValue,
} from './types.js';
import type {
  AudienceFactLeaf,
  AudiencePathClassificationRule,
} from './audience-admission-types.js';

function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function isJsonArray(value: JsonValue | undefined): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function decodePointerSegment(segment: string): string {
  if (/~(?![01])/u.test(segment)) {
    failContent('AUDIENCE_SCHEMA_CLASSIFICATION_INVALID', `Invalid JSON pointer segment '${segment}'`);
  }
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitPath(path: string, selector: boolean): readonly string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) {
    failContent('AUDIENCE_SCHEMA_CLASSIFICATION_INVALID', `Fact path '${path}' must be a JSON pointer`);
  }
  const segments = path.slice(1).split('/');
  for (const segment of segments) {
    if (selector && segment === '[*]') continue;
    decodePointerSegment(segment);
  }
  return segments;
}

export function selectorMatchesFactPath(selector: string, factPath: string): boolean {
  const selectorSegments = splitPath(selector, true);
  const pathSegments = splitPath(factPath, false);
  return selectorSegments.length === pathSegments.length && selectorSegments.every(
    (segment, index) => segment === '[*]' || segment === pathSegments[index],
  );
}

export function selectorsOverlap(left: string, right: string): boolean {
  const leftSegments = splitPath(left, true);
  const rightSegments = splitPath(right, true);
  return leftSegments.length === rightSegments.length && leftSegments.every((segment, index) => {
    const other = rightSegments[index];
    return segment === other || segment === '[*]' || other === '[*]';
  });
}

export function resolveJsonPointer(root: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const encoded of splitPath(path, false)) {
    const segment = decodePointerSegment(encoded);
    if (isJsonArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(segment)) return undefined;
      current = current[Number(segment)];
    } else if (current !== null && typeof current === 'object') {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function serializeAudienceScalar(value: JsonPrimitive): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    failContent('AUDIENCE_SCHEMA_CLASSIFICATION_INVALID', 'Audience scalar is not canonical JSON');
  }
  return serialized;
}

export function hashAudienceScalar(value: JsonPrimitive): string {
  return createHash('sha256').update(serializeAudienceScalar(value), 'utf8').digest('hex');
}

function classifyLeaf(
  field: AudienceFactualField,
  path: string,
  rules: readonly AudiencePathClassificationRule[],
): AudienceFactLeaf['classification'] {
  const matches = rules.filter(
    (rule) => rule.audience_field === field && selectorMatchesFactPath(rule.fact_path_selector, path),
  );
  if (matches.length > 1) {
    failContent('AUDIENCE_SCHEMA_CLASSIFICATION_INVALID', `Ambiguous classification for ${field}${path}`);
  }
  return matches[0]?.classification ?? 'FACTUAL_ASSERTION';
}

function collectValueLeaves(
  value: JsonValue,
  field: AudienceFactualField,
  path: string,
  rules: readonly AudiencePathClassificationRule[],
  output: AudienceFactLeaf[],
): void {
  if (value === null) return;
  if (isJsonArray(value)) {
    value.forEach((item, index) => collectValueLeaves(item, field, `${path}/${index}`, rules, output));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).sort().forEach((key) => {
      collectValueLeaves(value[key]!, field, `${path}/${encodePointerSegment(key)}`, rules, output);
    });
    return;
  }
  output.push({
    audience_field: field,
    fact_path: path,
    value,
    fact_value_hash: hashAudienceScalar(value),
    classification: classifyLeaf(field, path, rules),
  });
}

export function collectAudienceFactLeaves(
  audience: AudienceStateView,
  rules: readonly AudiencePathClassificationRule[],
): readonly AudienceFactLeaf[] {
  const output: AudienceFactLeaf[] = [];
  for (const field of AUDIENCE_FACTUAL_FIELDS) {
    collectValueLeaves(audience[field], field, '', rules, output);
  }
  return output;
}
