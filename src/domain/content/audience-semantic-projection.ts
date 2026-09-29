import { createHash } from 'node:crypto';
import { evaluateSemanticEquivalence } from '../knowledge/semantic-fingerprint.js';
import type { PropositionSemanticIdentity } from '../knowledge/types.js';
import { failContent } from './content-error-codes.js';
import { resolveJsonPointer, selectorMatchesFactPath, selectorsOverlap, serializeAudienceScalar } from './audience-fact-path.js';
import type {
  AudienceFactLeaf,
  AudienceProjectionTemplate,
  AudienceProjectionTemplatePart,
  AudienceSemanticProjectionRule,
  AudienceSemanticProjectionSchema,
} from './audience-admission-types.js';
import type { JsonValue } from './types.js';

export interface AudienceProjectionInput {
  readonly leaf: AudienceFactLeaf;
  readonly task_market: string;
  readonly task_jurisdiction: string;
  readonly task_audience_context: JsonValue;
}

function templateInputRef(part: AudienceProjectionTemplatePart): string | undefined {
  if (part.type === 'CONST') return undefined;
  if (part.type === 'TASK_AUDIENCE_CONTEXT') return `TASK_AUDIENCE_CONTEXT:${part.path}`;
  return part.operand;
}

function allTemplates(rule: AudienceSemanticProjectionRule): readonly AudienceProjectionTemplate[] {
  return [
    rule.canonical_meaning_template,
    rule.subject_template,
    rule.predicate_template,
    rule.object_template,
    rule.qualifiers_template,
    rule.conditions_template,
    rule.population_scope_template,
    rule.jurisdiction_scope_template,
  ];
}

function validateRule(rule: AudienceSemanticProjectionRule): void {
  if (!rule.rule_id || rule.classification !== 'FACTUAL_ASSERTION' || rule.proposition_type !== 'AUDIENCE') {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', 'Projection rule contract is invalid');
  }
  const actualRefs = new Set(
    allTemplates(rule).flatMap((template) => template.map(templateInputRef).filter(
      (value): value is string => value !== undefined,
    )),
  );
  const declaredRefs = new Set(rule.required_input_refs);
  if (
    actualRefs.size !== declaredRefs.size ||
    [...actualRefs].some((value) => !declaredRefs.has(value))
  ) {
    failContent(
      'AUDIENCE_SEMANTIC_PROJECTION_INVALID',
      `Projection rule '${rule.rule_id}' required_input_refs do not match its templates`,
    );
  }
}

function rejectOverlaps<T extends { audience_field: string; fact_path_selector: string }>(
  rules: readonly T[],
  errorCode: 'AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS' | 'AUDIENCE_SCHEMA_CLASSIFICATION_INVALID',
): void {
  for (let left = 0; left < rules.length; left += 1) {
    for (let right = left + 1; right < rules.length; right += 1) {
      const a = rules[left]!;
      const b = rules[right]!;
      if (a.audience_field === b.audience_field && selectorsOverlap(a.fact_path_selector, b.fact_path_selector)) {
        failContent(errorCode, `Overlapping selectors '${a.fact_path_selector}' and '${b.fact_path_selector}'`);
      }
    }
  }
}

export function validateAudienceSemanticProjectionSchema(
  schema: AudienceSemanticProjectionSchema,
): void {
  if (
    schema.schema_ref.entity_type !== 'SchemaDefinition' ||
    !schema.schema_ref.stable_id || !schema.schema_ref.revision_id || !schema.payload_hash ||
    schema.path_encoding !== 'JSON_POINTER_V1' ||
    schema.scalar_serialization !== 'CANONICAL_JSON_SCALAR_V1'
  ) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', 'Pinned Audience projection schema is invalid');
  }
  const ruleIds = schema.projection_rules.map(({ rule_id }) => rule_id);
  if (new Set(ruleIds).size !== ruleIds.length) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS', 'Projection rule IDs must be unique');
  }
  schema.projection_rules.forEach(validateRule);
  rejectOverlaps(schema.projection_rules, 'AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS');
  rejectOverlaps(schema.classification_rules, 'AUDIENCE_SCHEMA_CLASSIFICATION_INVALID');
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${(value as readonly JsonValue[]).map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as { readonly [key: string]: JsonValue };
    return `{${Object.keys(object).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(object[key]!)}`,
    ).join(',')}}`;
  }
  return serializeAudienceScalar(value);
}

function renderPart(part: AudienceProjectionTemplatePart, input: AudienceProjectionInput): string {
  if (part.type === 'CONST') return part.value;
  if (part.type === 'TASK_AUDIENCE_CONTEXT') {
    const value = resolveJsonPointer(input.task_audience_context, part.path);
    if (value === undefined) {
      failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', `Missing Task audience input '${part.path}'`);
    }
    return canonicalJson(value);
  }
  const values = {
    FACT_VALUE_CANONICAL: serializeAudienceScalar(input.leaf.value),
    AUDIENCE_FIELD: input.leaf.audience_field,
    FACT_PATH: input.leaf.fact_path,
    TASK_MARKET: input.task_market,
    TASK_JURISDICTION: input.task_jurisdiction,
  } as const;
  const value = values[part.operand];
  if (!value) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', `Missing projection input '${part.operand}'`);
  }
  return value;
}

function render(template: AudienceProjectionTemplate, input: AudienceProjectionInput): string {
  return template.map((part) => renderPart(part, input)).join('');
}

export function projectAudienceFact(
  schema: AudienceSemanticProjectionSchema,
  input: AudienceProjectionInput,
): {
  readonly rule_id: string;
  readonly identity: PropositionSemanticIdentity;
  readonly projection_inputs: Readonly<Record<string, string>>;
  readonly projection_input_hash: string;
} {
  validateAudienceSemanticProjectionSchema(schema);
  const matches = schema.projection_rules.filter(
    (rule) => rule.audience_field === input.leaf.audience_field &&
      selectorMatchesFactPath(rule.fact_path_selector, input.leaf.fact_path),
  );
  if (matches.length === 0) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_MISSING', 'No pinned rule matches the audience fact');
  }
  if (matches.length !== 1) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS', 'Multiple pinned rules match the audience fact');
  }
  const rule = matches[0]!;

  const inputs: Record<string, string> = {};
  for (const template of allTemplates(rule)) {
    for (const part of template) {
      if (part.type === 'TASK_AUDIENCE_CONTEXT') {
        const val = resolveJsonPointer(input.task_audience_context, part.path);
        if (val === undefined) {
          failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', `Missing Task audience input '${part.path}'`);
        }
        inputs[`TASK_AUDIENCE_CONTEXT:${part.path}`] = canonicalJson(val);
      } else if (part.type === 'OPERAND') {
        const values = {
          FACT_VALUE_CANONICAL: serializeAudienceScalar(input.leaf.value),
          AUDIENCE_FIELD: input.leaf.audience_field,
          FACT_PATH: input.leaf.fact_path,
          TASK_MARKET: input.task_market,
          TASK_JURISDICTION: input.task_jurisdiction,
        } as const;
        const val = values[part.operand];
        if (!val) {
          failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', `Missing projection input '${part.operand}'`);
        }
        inputs[part.operand] = val;
      }
    }
  }
  const sortedKeys = Object.keys(inputs).sort();
  const sortedInputs: Record<string, string> = {};
  for (const k of sortedKeys) {
    sortedInputs[k] = inputs[k]!;
  }
  const projection_input_hash = createHash('sha256')
    .update(JSON.stringify(sortedInputs), 'utf8')
    .digest('hex');

  const identity: PropositionSemanticIdentity = {
    propositionType: 'AUDIENCE',
    canonicalMeaning: render(rule.canonical_meaning_template, input),
    subject: render(rule.subject_template, input),
    predicate: render(rule.predicate_template, input),
    object: render(rule.object_template, input),
    qualifiers: render(rule.qualifiers_template, input),
    conditions: render(rule.conditions_template, input),
    populationScope: render(rule.population_scope_template, input),
    jurisdictionScope: render(rule.jurisdiction_scope_template, input),
  };
  if (!identity.canonicalMeaning || !identity.subject || !identity.predicate || !identity.object) {
    failContent('AUDIENCE_SEMANTIC_PROJECTION_INVALID', 'Projected semantic identity is incomplete');
  }
  return { rule_id: rule.rule_id, identity, projection_inputs: sortedInputs, projection_input_hash };
}

export function assertAudienceSemanticClosure(
  projected: PropositionSemanticIdentity,
  linked: PropositionSemanticIdentity,
): void {
  if (linked.propositionType !== 'AUDIENCE' || evaluateSemanticEquivalence(projected, linked) !== 'REUSE_EXISTING') {
    failContent('AUDIENCE_FACT_SEMANTIC_MISMATCH', 'Projected audience fact does not reuse the linked Proposition');
  }
}
