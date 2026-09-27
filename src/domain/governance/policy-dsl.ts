/**
 * ContentOS — Deterministic Policy DSL Interpreter
 *
 * Implements SPEC04 §35–§46, §53–§56:
 *   - Bounded, typed, side-effect free, deterministic structured AST interpreter.
 *   - Prohibits eval, Function, VM, arbitrary code, shell, network, filesystem, secrets.
 *   - Strictly enforces type safety and fails closed on type mismatch or missing required input.
 *   - Emits structured action effect, reason_code, input_uncertainty, and resolved input_refs.
 */
import { RegistryValidationError } from '../services/registry-validator.js';

export type PolicyPredicateOp =
  | 'ALL'
  | 'ANY'
  | 'NOT'
  | 'EQ'
  | 'NEQ'
  | 'IN'
  | 'NOT_IN'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'COUNT_EQ'
  | 'COUNT_GT'
  | 'COUNT_GTE'
  | 'COUNT_LT'
  | 'COUNT_LTE'
  | 'SET_CONTAINS'
  | 'SET_OVERLAPS'
  | 'IS_TRUE'
  | 'IS_FALSE';

export interface PolicySelector {
  root: string;
  path: string;
  cardinality?: 'ONE' | 'MANY';
  expected_type?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SET' | 'ARRAY' | 'OBJECT';
}

export interface PolicyPredicateNode {
  op: PolicyPredicateOp;
  left?: PolicySelector | unknown;
  right?: PolicySelector | unknown;
  value?: PolicySelector | unknown;
  args?: PolicyPredicateNode[];
}

export interface PolicyActionPayload {
  effect: 'NO_RELEASE_EFFECT' | 'WARNING' | 'REQUIREMENT' | 'REQUIRE_REVIEW' | 'BLOCK';
  code: string;
  message?: string;
  parameters?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  triggered: boolean;
  action: string;
  reasonCode: string;
  inputUncertainty: string;
  inputRefs: string[];
}

const SUPPORTED_OPS = new Set<string>([
  'ALL', 'ANY', 'NOT',
  'EQ', 'NEQ', 'IN', 'NOT_IN',
  'EXISTS', 'NOT_EXISTS',
  'COUNT_EQ', 'COUNT_GT', 'COUNT_GTE', 'COUNT_LT', 'COUNT_LTE',
  'SET_CONTAINS', 'SET_OVERLAPS',
  'IS_TRUE', 'IS_FALSE',
]);

/**
 * Resolves a selector path into the input closure.
 */
export function resolveSelectorValue(
  selector: PolicySelector,
  contextData: Record<string, unknown>,
  collectedRefs: Set<string>,
): unknown {
  const { root, path } = selector;
  if (!contextData || typeof contextData !== 'object') {
    throw new RegistryValidationError('POLICY_INPUT_MISSING', `Context root '${root}' is unavailable.`);
  }

  const rootObj = contextData[root];
  if (rootObj === undefined || rootObj === null) {
    throw new RegistryValidationError('POLICY_INPUT_MISSING', `Required policy input root '${root}' is missing.`);
  }

  // Record reference if root contains an identifier
  if (typeof rootObj === 'object' && rootObj !== null) {
    const idKey = Object.keys(rootObj).find((k) => k.endsWith('_id') || k.endsWith('Id') || k.endsWith('_revision_id'));
    if (idKey && typeof (rootObj as Record<string, unknown>)[idKey] === 'string') {
      collectedRefs.add((rootObj as Record<string, unknown>)[idKey] as string);
    }
  }

  if (!path || path === '') {
    return rootObj;
  }

  const parts = path.split('.');
  let current: unknown = rootObj;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return null;
    }
    if (typeof current !== 'object') {
      throw new RegistryValidationError('POLICY_TYPE_ERROR', `Cannot traverse property '${part}' on non-object.`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (selector.expected_type) {
    validateExpectedType(current, selector.expected_type, path);
  }

  return current;
}

function validateExpectedType(value: unknown, expectedType: string, path: string): void {
  if (value === null || value === undefined) return;
  switch (expectedType) {
    case 'STRING':
      if (typeof value !== 'string') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected STRING at '${path}', got ${typeof value}.`);
      }
      break;
    case 'NUMBER':
      if (typeof value !== 'number') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected NUMBER at '${path}', got ${typeof value}.`);
      }
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected BOOLEAN at '${path}', got ${typeof value}.`);
      }
      break;
    case 'ARRAY':
    case 'SET':
      if (!Array.isArray(value) && !(value instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected ARRAY/SET at '${path}', got ${typeof value}.`);
      }
      break;
    case 'OBJECT':
      if (typeof value !== 'object') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected OBJECT at '${path}', got ${typeof value}.`);
      }
      break;
  }
}

function isSelector(obj: unknown): obj is PolicySelector {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'root' in obj &&
    'path' in obj &&
    typeof (obj as PolicySelector).root === 'string'
  );
}

function resolveValue(val: unknown, contextData: Record<string, unknown>, collectedRefs: Set<string>): unknown {
  if (isSelector(val)) {
    return resolveSelectorValue(val, contextData, collectedRefs);
  }
  if (typeof val === 'string' && val.includes('.')) {
    const dotIdx = val.indexOf('.');
    const root = val.slice(0, dotIdx);
    const path = val.slice(dotIdx + 1);
    if (contextData && typeof contextData === 'object' && root in contextData) {
      return resolveSelectorValue({ root, path }, contextData, collectedRefs);
    }
  }
  return val;
}

/**
 * Pure, deterministic evaluation of structured Policy DSL predicate AST.
 */
export function evaluatePredicate(
  node: PolicyPredicateNode,
  contextData: Record<string, unknown>,
  collectedRefs: Set<string>,
): boolean {
  if (!node || typeof node !== 'object') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Policy predicate node must be an object.');
  }

  const op = node.op;
  if (!op || !SUPPORTED_OPS.has(op)) {
    throw new RegistryValidationError(
      'POLICY_SCHEMA_UNSUPPORTED',
      `Unsupported policy operator '${op}'. Guessing or fallback is forbidden (SPEC04 §35, §40).`,
    );
  }

  switch (op) {
    case 'ALL': {
      if (!Array.isArray(node.args) || node.args.length === 0) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'ALL operator requires non-empty args array.');
      }
      return node.args.every((arg) => evaluatePredicate(arg, contextData, collectedRefs));
    }
    case 'ANY': {
      if (!Array.isArray(node.args) || node.args.length === 0) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'ANY operator requires non-empty args array.');
      }
      return node.args.some((arg) => evaluatePredicate(arg, contextData, collectedRefs));
    }
    case 'NOT': {
      if (!node.args || node.args.length !== 1) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'NOT operator requires exactly one arg.');
      }
      return !evaluatePredicate(node.args[0]!, contextData, collectedRefs);
    }
    case 'EQ': {
      const left = resolveValue(node.left, contextData, collectedRefs);
      const right = resolveValue(node.right, contextData, collectedRefs);
      assertComparable(left, right);
      return left === right;
    }
    case 'NEQ': {
      const left = resolveValue(node.left, contextData, collectedRefs);
      const right = resolveValue(node.right, contextData, collectedRefs);
      assertComparable(left, right);
      return left !== right;
    }
    case 'IN': {
      const left = resolveValue(node.left, contextData, collectedRefs);
      const right = resolveValue(node.right, contextData, collectedRefs);
      if (!Array.isArray(right) && !(right instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'Right side of IN operator must be an array or set.');
      }
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return (right as Set<unknown>).has(left);
    }
    case 'NOT_IN': {
      const left = resolveValue(node.left, contextData, collectedRefs);
      const right = resolveValue(node.right, contextData, collectedRefs);
      if (!Array.isArray(right) && !(right instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'Right side of NOT_IN operator must be an array or set.');
      }
      if (Array.isArray(right)) {
        return !right.includes(left);
      }
      return !(right as Set<unknown>).has(left);
    }
    case 'EXISTS': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs);
      return val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0);
    }
    case 'NOT_EXISTS': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs);
      return val === null || val === undefined || (Array.isArray(val) && val.length === 0);
    }
    case 'COUNT_EQ':
    case 'COUNT_GT':
    case 'COUNT_GTE':
    case 'COUNT_LT':
    case 'COUNT_LTE': {
      const target = resolveValue(node.left ?? node.value, contextData, collectedRefs);
      const count = Array.isArray(target) ? target.length : target instanceof Set ? target.size : 0;
      const expected = resolveValue(node.right, contextData, collectedRefs);
      if (typeof expected !== 'number') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Count comparison requires numeric target, got ${typeof expected}.`);
      }
      if (op === 'COUNT_EQ') return count === expected;
      if (op === 'COUNT_GT') return count > expected;
      if (op === 'COUNT_GTE') return count >= expected;
      if (op === 'COUNT_LT') return count < expected;
      if (op === 'COUNT_LTE') return count <= expected;
      return false;
    }
    case 'SET_CONTAINS': {
      const setVal = resolveValue(node.left, contextData, collectedRefs);
      const item = resolveValue(node.right, contextData, collectedRefs);
      if (!Array.isArray(setVal) && !(setVal instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'SET_CONTAINS left argument must be an array or set.');
      }
      return Array.isArray(setVal) ? setVal.includes(item) : (setVal as Set<unknown>).has(item);
    }
    case 'SET_OVERLAPS': {
      const setA = resolveValue(node.left, contextData, collectedRefs);
      const setB = resolveValue(node.right, contextData, collectedRefs);
      if (!Array.isArray(setA) && !(setA instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'SET_OVERLAPS left argument must be an array or set.');
      }
      if (!Array.isArray(setB) && !(setB instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'SET_OVERLAPS right argument must be an array or set.');
      }
      const arrA = Array.isArray(setA) ? setA : Array.from(setA as Set<unknown>);
      const arrB = Array.isArray(setB) ? setB : Array.from(setB as Set<unknown>);
      return arrA.some((item) => arrB.includes(item));
    }
    case 'IS_TRUE': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs);
      return val === true;
    }
    case 'IS_FALSE': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs);
      return val === false;
    }
    default:
      throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `Unhandled operator ${op}.`);
  }
}

function assertComparable(a: unknown, b: unknown): void {
  if (a === null || a === undefined || b === null || b === undefined) return;
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) {
    throw new RegistryValidationError(
      'POLICY_TYPE_ERROR',
      `Cannot compare disparate types '${typeA}' and '${typeB}' (SPEC04 §43). Type coercion is forbidden.`,
    );
  }
}

/**
 * Evaluates a DecisionPolicyRevision against the frozen snapshot input closure.
 */
export function evaluatePolicyDsl(
  policyJson: {
    conditions: string | PolicyPredicateNode;
    action: string | PolicyActionPayload;
    required_inputs: string | string[];
    priority_class?: string;
  },
  contextData: Record<string, unknown>,
): PolicyEvaluationResult {
  const collectedRefs = new Set<string>();

  // 1. Validate required inputs
  const requiredInputs: string[] = typeof policyJson.required_inputs === 'string'
    ? JSON.parse(policyJson.required_inputs)
    : policyJson.required_inputs;

  if (Array.isArray(requiredInputs)) {
    for (const reqInput of requiredInputs) {
      if (contextData[reqInput] === undefined || contextData[reqInput] === null) {
        throw new RegistryValidationError(
          'POLICY_INPUT_MISSING',
          `Required policy input '${reqInput}' is missing from snapshot closure (SPEC04 §37, §56).`,
        );
      }
      const item = contextData[reqInput];
      if (typeof item === 'object' && item !== null) {
        const idKey = Object.keys(item).find((k) => k.endsWith('_id') || k.endsWith('Id') || k.endsWith('_revision_id'));
        if (idKey && typeof (item as Record<string, unknown>)[idKey] === 'string') {
          collectedRefs.add((item as Record<string, unknown>)[idKey] as string);
        }
      }
    }
  }

  // 2. Parse conditions
  const conditionsNode: PolicyPredicateNode = typeof policyJson.conditions === 'string'
    ? JSON.parse(policyJson.conditions)
    : policyJson.conditions;

  // 3. Parse action
  const actionPayload: PolicyActionPayload = typeof policyJson.action === 'string'
    ? JSON.parse(policyJson.action)
    : policyJson.action;

  if (!actionPayload || typeof actionPayload !== 'object' || !actionPayload.effect) {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Policy action must be a structured payload with an effect.');
  }

  // 4. Evaluate predicate
  const triggered = evaluatePredicate(conditionsNode, contextData, collectedRefs);

  // 5. Determine action effect: non-triggered results produce NO_RELEASE_EFFECT (SPEC04 §50, Preflight 17)
  const effect = triggered ? (actionPayload.effect || 'BLOCK') : 'NO_RELEASE_EFFECT';
  const reasonCode = actionPayload.code || (triggered ? 'POLICY_TRIGGERED' : 'POLICY_NOT_TRIGGERED');
  const actionStr = JSON.stringify({
    ...actionPayload,
    effect,
  });

  // 6. Determine uncertainty: if uncertainty assessment or input indicates UNCERTAIN, preserve it
  let inputUncertainty = 'NONE';
  if (contextData['UncertaintyAssessment']) {
    const uncert = contextData['UncertaintyAssessment'] as Record<string, unknown>;
    if (uncert['uncertainty_level']) {
      inputUncertainty = String(uncert['uncertainty_level']);
    }
  }

  return {
    triggered,
    action: actionStr,
    reasonCode,
    inputUncertainty,
    inputRefs: Array.from(collectedRefs).sort(),
  };
}
