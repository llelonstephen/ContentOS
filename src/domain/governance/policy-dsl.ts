/**
 * ContentOS — Deterministic Policy DSL Interpreter
 *
 * Implements SPEC04 §35–§46, §53–§56:
 *   - Bounded, typed, side-effect free, deterministic structured AST interpreter.
 *   - Prohibits eval, Function, VM, arbitrary code, shell, network, filesystem, secrets.
 *   - Strictly enforces type safety and fails closed on type mismatch or missing required input.
 *   - Compile-time/pre-evaluation required_inputs allowlist enforcement across all AST selectors.
 *   - Prototype pollution and escape guards: rejects __proto__, prototype, constructor; own-properties only.
 *   - Distinct missing selector semantics: distinguishes missing path (POLICY_INPUT_MISSING) from null, false, 0, [].
 *   - COUNT_* type safety: target MUST be Array or Set; scalar target throws POLICY_TYPE_ERROR.
 *   - expected_type validation against frozen vocabulary.
 *   - action.effect validation against frozen vocabulary.
 *   - Recursive AST pre-validation enforcing bounded depth/node count, valid operands, no executable values.
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

export const FROZEN_SUPPORTED_OPS = new Set<string>([
  'ALL', 'ANY', 'NOT',
  'EQ', 'NEQ', 'IN', 'NOT_IN',
  'EXISTS', 'NOT_EXISTS',
  'COUNT_EQ', 'COUNT_GT', 'COUNT_GTE', 'COUNT_LT', 'COUNT_LTE',
  'SET_CONTAINS', 'SET_OVERLAPS',
  'IS_TRUE', 'IS_FALSE',
]);

export const FROZEN_EXPECTED_TYPES = new Set<string>([
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'ARRAY',
  'SET',
  'OBJECT',
]);

export const FROZEN_ACTION_EFFECTS = new Set<string>([
  'NO_RELEASE_EFFECT',
  'WARNING',
  'REQUIREMENT',
  'REQUIRE_REVIEW',
  'BLOCK',
]);

export const FORBIDDEN_PATH_SEGMENTS = new Set<string>([
  '__proto__',
  'prototype',
  'constructor',
]);

const MAX_AST_DEPTH = 20;
const MAX_AST_NODES = 100;

export function isSelector(obj: unknown): obj is PolicySelector {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'root' in obj &&
    'path' in obj &&
    typeof (obj as PolicySelector).root === 'string' &&
    typeof (obj as PolicySelector).path === 'string'
  );
}

/**
 * Validates a selector schema and guards against prototype traversal (SPEC04 §38, §39).
 */
export function validateSelector(selector: PolicySelector, allowedRoots?: Set<string>): void {
  if (!selector.root || typeof selector.root !== 'string' || selector.root.trim() === '') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Selector root must be a non-empty string.');
  }

  // Guard against prototype pollution in root
  if (FORBIDDEN_PATH_SEGMENTS.has(selector.root.toLowerCase())) {
    throw new RegistryValidationError(
      'POLICY_SCHEMA_UNSUPPORTED',
      `Selector root contains forbidden escape segment '${selector.root}' (SPEC04 §36, §39).`,
    );
  }

  // Required inputs allowlist check (SPEC04 §37)
  if (allowedRoots && !allowedRoots.has(selector.root)) {
    throw new RegistryValidationError(
      'POLICY_SCHEMA_UNSUPPORTED',
      `Selector references input root '${selector.root}', which is not declared in required_inputs allowlist [${Array.from(allowedRoots).join(', ')}] (SPEC04 §37).`,
    );
  }

  // Path validation
  if (typeof selector.path !== 'string') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Selector path must be a string.');
  }

  if (selector.path.length > 0) {
    const parts = selector.path.split('.');
    for (const part of parts) {
      if (FORBIDDEN_PATH_SEGMENTS.has(part.toLowerCase())) {
        throw new RegistryValidationError(
          'POLICY_SCHEMA_UNSUPPORTED',
          `Selector path contains forbidden escape segment '${part}' (SPEC04 §36, §39).`,
        );
      }
    }
  }

  // expected_type validation (SPEC04 §38, §43)
  if (selector.expected_type !== undefined) {
    if (!FROZEN_EXPECTED_TYPES.has(selector.expected_type)) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Unsupported expected_type '${selector.expected_type}' in selector schema (SPEC04 §38).`,
      );
    }
  }
}

/**
 * Resolves a selector path into the input closure.
 * Distinguishes missing property (POLICY_INPUT_MISSING) from explicit null/false/0/[].
 */
export function resolveSelectorValue(
  selector: PolicySelector,
  contextData: Record<string, unknown>,
  collectedRefs: Set<string>,
  allowedRoots?: Set<string>,
): unknown {
  validateSelector(selector, allowedRoots);

  const { root, path } = selector;
  if (!contextData || typeof contextData !== 'object') {
    throw new RegistryValidationError('POLICY_INPUT_MISSING', `Context root '${root}' is unavailable.`);
  }

  if (!Object.prototype.hasOwnProperty.call(contextData, root)) {
    throw new RegistryValidationError(
      'POLICY_INPUT_MISSING',
      `Required policy input root '${root}' is missing from snapshot context (SPEC04 §37, §42).`,
    );
  }

  const rootObj = contextData[root];
  if (rootObj === undefined || rootObj === null) {
    // Root exists and is explicitly null/undefined
    if (!path || path === '') {
      return rootObj;
    }
    throw new RegistryValidationError(
      'POLICY_INPUT_MISSING',
      `Cannot traverse path '${path}' on null/undefined root '${root}' (SPEC04 §42).`,
    );
  }

  // Record reference if root contains an identifier
  if (typeof rootObj === 'object' && rootObj !== null) {
    const idKey = Object.keys(rootObj).find(
      (k) => k.endsWith('_id') || k.endsWith('Id') || k.endsWith('_revision_id'),
    );
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
    if (FORBIDDEN_PATH_SEGMENTS.has(part.toLowerCase())) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Selector path contains forbidden escape segment '${part}' (SPEC04 §36, §39).`,
      );
    }

    if (current === null || current === undefined || typeof current !== 'object') {
      throw new RegistryValidationError(
        'POLICY_INPUT_MISSING',
        `Cannot traverse property '${part}' on non-object at '${path}' (SPEC04 §42).`,
      );
    }

    // Strict own-property enforcement: do not traverse prototype chain
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      throw new RegistryValidationError(
        'POLICY_INPUT_MISSING',
        `Required selector path property '${part}' in '${path}' is missing on root '${root}' (SPEC04 §42).`,
      );
    }

    current = (current as Record<string, unknown>)[part];

    // Prohibit resolving functions or prototype objects
    if (typeof current === 'function') {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Selector cannot resolve executable function at '${root}.${path}'.`,
      );
    }
  }

  if (selector.expected_type) {
    validateExpectedType(current, selector.expected_type, path);
  }

  return current;
}

export function validateExpectedType(value: unknown, expectedType: string, path: string): void {
  if (value === null || value === undefined) return;
  switch (expectedType) {
    case 'STRING':
      if (typeof value !== 'string') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected STRING at '${path}', got ${typeof value}.`);
      }
      break;
    case 'NUMBER':
      if (typeof value !== 'number' || isNaN(value)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected NUMBER at '${path}', got ${typeof value}.`);
      }
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected BOOLEAN at '${path}', got ${typeof value}.`);
      }
      break;
    case 'ARRAY':
      if (!Array.isArray(value)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected ARRAY at '${path}', got ${typeof value}.`);
      }
      break;
    case 'SET':
      if (!Array.isArray(value) && !(value instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected SET at '${path}', got ${typeof value}.`);
      }
      break;
    case 'OBJECT':
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', `Expected OBJECT at '${path}', got ${typeof value}.`);
      }
      break;
    default:
      throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `Unsupported expected_type '${expectedType}'.`);
  }
}

function resolveValue(
  val: unknown,
  contextData: Record<string, unknown>,
  collectedRefs: Set<string>,
  allowedRoots?: Set<string>,
): unknown {
  if (typeof val === 'function') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Executable functions are forbidden in policy operands.');
  }
  if (isSelector(val)) {
    return resolveSelectorValue(val, contextData, collectedRefs, allowedRoots);
  }
  if (typeof val === 'string' && val.includes('.')) {
    const dotIdx = val.indexOf('.');
    const root = val.slice(0, dotIdx);
    const path = val.slice(dotIdx + 1);

    // If root matches an allowed root or contextData root, resolve as a selector
    if ((allowedRoots && allowedRoots.has(root)) || (contextData && Object.prototype.hasOwnProperty.call(contextData, root))) {
      return resolveSelectorValue({ root, path }, contextData, collectedRefs, allowedRoots);
    }
    // If root is a forbidden escape token, fail closed
    if (FORBIDDEN_PATH_SEGMENTS.has(root.toLowerCase())) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Selector root contains forbidden escape segment '${root}' (SPEC04 §36, §39).`,
      );
    }
    // If selector dotted string looks like an identifier path but was not declared in allowedRoots
    if (allowedRoots && !allowedRoots.has(root) && /^[A-Z][A-Za-z0-9_]*$/.test(root)) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Selector references undeclared input root '${root}' (SPEC04 §37).`,
      );
    }
  }
  return val;
}

/**
 * Pre-validates the complete condition AST recursively before execution (SPEC04 §35, §41).
 */
export function validateAstNode(
  node: PolicyPredicateNode,
  allowedRoots: Set<string>,
  depth = 1,
  counter = { count: 0 },
): void {
  counter.count++;
  if (counter.count > MAX_AST_NODES) {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `Policy AST exceeds maximum node bound (${MAX_AST_NODES}).`);
  }
  if (depth > MAX_AST_DEPTH) {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `Policy AST exceeds maximum depth bound (${MAX_AST_DEPTH}).`);
  }

  if (!node || typeof node !== 'object') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Policy predicate node must be an object.');
  }

  const op = node.op;
  if (!op || !FROZEN_SUPPORTED_OPS.has(op)) {
    throw new RegistryValidationError(
      'POLICY_SCHEMA_UNSUPPORTED',
      `Unsupported policy operator '${op}'. Guessing or fallback is forbidden (SPEC04 §35, §40).`,
    );
  }

  // Validate no function properties
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'function') {
      throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `Executable functions forbidden on node key '${k}'.`);
    }
  }

  // Validate operand selectors
  const checkOperand = (operand: unknown) => {
    if (isSelector(operand)) {
      validateSelector(operand, allowedRoots);
    } else if (typeof operand === 'string' && operand.includes('.')) {
      const dotIdx = operand.indexOf('.');
      const root = operand.slice(0, dotIdx);
      if (FORBIDDEN_PATH_SEGMENTS.has(root.toLowerCase())) {
        throw new RegistryValidationError(
          'POLICY_SCHEMA_UNSUPPORTED',
          `Operand contains forbidden segment '${root}'.`,
        );
      }
      if (/^[A-Z][A-Za-z0-9_]*$/.test(root) && !allowedRoots.has(root)) {
        throw new RegistryValidationError(
          'POLICY_SCHEMA_UNSUPPORTED',
          `Selector references input root '${root}', which is not declared in required_inputs allowlist (SPEC04 §37).`,
        );
      }
    }
  };

  if ('left' in node) checkOperand(node.left);
  if ('right' in node) checkOperand(node.right);
  if ('value' in node) checkOperand(node.value);

  // Validate operator structure
  switch (op) {
    case 'ALL':
    case 'ANY': {
      if (!Array.isArray(node.args) || node.args.length === 0) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `${op} operator requires non-empty args array.`);
      }
      for (const child of node.args) {
        validateAstNode(child, allowedRoots, depth + 1, counter);
      }
      break;
    }
    case 'NOT': {
      if (!Array.isArray(node.args) || node.args.length !== 1) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'NOT operator requires exactly one arg in args array.');
      }
      validateAstNode(node.args[0]!, allowedRoots, depth + 1, counter);
      break;
    }
    case 'EQ':
    case 'NEQ':
    case 'IN':
    case 'NOT_IN':
    case 'SET_CONTAINS':
    case 'SET_OVERLAPS': {
      if (node.left === undefined || node.right === undefined) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `${op} operator requires both left and right operands.`);
      }
      break;
    }
    case 'COUNT_EQ':
    case 'COUNT_GT':
    case 'COUNT_GTE':
    case 'COUNT_LT':
    case 'COUNT_LTE': {
      const target = node.left !== undefined ? node.left : node.value;
      if (target === undefined || node.right === undefined) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `${op} operator requires target (left/value) and right operand.`);
      }
      break;
    }
    case 'EXISTS':
    case 'NOT_EXISTS':
    case 'IS_TRUE':
    case 'IS_FALSE': {
      const target = node.value !== undefined ? node.value : node.left;
      if (target === undefined) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', `${op} operator requires target (value/left) operand.`);
      }
      break;
    }
  }
}

/**
 * Pure, deterministic evaluation of structured Policy DSL predicate AST.
 */
export function evaluatePredicate(
  node: PolicyPredicateNode,
  contextData: Record<string, unknown>,
  collectedRefs: Set<string>,
  allowedRoots?: Set<string>,
): boolean {
  if (!node || typeof node !== 'object') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Policy predicate node must be an object.');
  }

  const op = node.op;
  if (!op || !FROZEN_SUPPORTED_OPS.has(op)) {
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
      return node.args.every((arg) => evaluatePredicate(arg, contextData, collectedRefs, allowedRoots));
    }
    case 'ANY': {
      if (!Array.isArray(node.args) || node.args.length === 0) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'ANY operator requires non-empty args array.');
      }
      return node.args.some((arg) => evaluatePredicate(arg, contextData, collectedRefs, allowedRoots));
    }
    case 'NOT': {
      if (!node.args || node.args.length !== 1) {
        throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'NOT operator requires exactly one arg.');
      }
      return !evaluatePredicate(node.args[0]!, contextData, collectedRefs, allowedRoots);
    }
    case 'EQ': {
      const left = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const right = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      assertComparable(left, right);
      return left === right;
    }
    case 'NEQ': {
      const left = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const right = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      assertComparable(left, right);
      return left !== right;
    }
    case 'IN': {
      const left = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const right = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      if (!Array.isArray(right) && !(right instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'Right side of IN operator must be an array or set.');
      }
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return (right as Set<unknown>).has(left);
    }
    case 'NOT_IN': {
      const left = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const right = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      if (!Array.isArray(right) && !(right instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'Right side of NOT_IN operator must be an array or set.');
      }
      if (Array.isArray(right)) {
        return !right.includes(left);
      }
      return !(right as Set<unknown>).has(left);
    }
    case 'EXISTS': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs, allowedRoots);
      return val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0);
    }
    case 'NOT_EXISTS': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs, allowedRoots);
      return val === null || val === undefined || (Array.isArray(val) && val.length === 0);
    }
    case 'COUNT_EQ':
    case 'COUNT_GT':
    case 'COUNT_GTE':
    case 'COUNT_LT':
    case 'COUNT_LTE': {
      const target = resolveValue(node.left ?? node.value, contextData, collectedRefs, allowedRoots);
      // COUNT_* operator strictly requires collection input (Array or Set) (SPEC04 §40, §43)
      if (!Array.isArray(target) && !(target instanceof Set)) {
        throw new RegistryValidationError(
          'POLICY_TYPE_ERROR',
          `COUNT_* operator requires collection target (Array or Set), got ${target === null ? 'null' : typeof target} (SPEC04 §43).`,
        );
      }
      const count = Array.isArray(target) ? target.length : (target as Set<unknown>).size;
      const expected = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      if (typeof expected !== 'number' || isNaN(expected)) {
        throw new RegistryValidationError(
          'POLICY_TYPE_ERROR',
          `Count comparison requires numeric target, got ${typeof expected}.`,
        );
      }
      if (op === 'COUNT_EQ') return count === expected;
      if (op === 'COUNT_GT') return count > expected;
      if (op === 'COUNT_GTE') return count >= expected;
      if (op === 'COUNT_LT') return count < expected;
      if (op === 'COUNT_LTE') return count <= expected;
      return false;
    }
    case 'SET_CONTAINS': {
      const setVal = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const item = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
      if (!Array.isArray(setVal) && !(setVal instanceof Set)) {
        throw new RegistryValidationError('POLICY_TYPE_ERROR', 'SET_CONTAINS left argument must be an array or set.');
      }
      return Array.isArray(setVal) ? setVal.includes(item) : (setVal as Set<unknown>).has(item);
    }
    case 'SET_OVERLAPS': {
      const setA = resolveValue(node.left, contextData, collectedRefs, allowedRoots);
      const setB = resolveValue(node.right, contextData, collectedRefs, allowedRoots);
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
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs, allowedRoots);
      return val === true;
    }
    case 'IS_FALSE': {
      const val = resolveValue(node.value ?? node.left, contextData, collectedRefs, allowedRoots);
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

  // 1. Validate and compile required_inputs allowlist (SPEC04 §37)
  const rawRequired = typeof policyJson.required_inputs === 'string'
    ? JSON.parse(policyJson.required_inputs)
    : policyJson.required_inputs;

  if (!Array.isArray(rawRequired)) {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'required_inputs must be an array of input family names.');
  }

  const allowedRoots = new Set<string>(rawRequired);

  for (const reqInput of rawRequired) {
    if (!contextData || !Object.prototype.hasOwnProperty.call(contextData, reqInput)) {
      throw new RegistryValidationError(
        'POLICY_INPUT_MISSING',
        `Required policy input '${reqInput}' is missing from snapshot closure (SPEC04 §37, §56).`,
      );
    }
    const item = contextData[reqInput];
    if (typeof item === 'object' && item !== null) {
      const idKey = Object.keys(item).find(
        (k) => k.endsWith('_id') || k.endsWith('Id') || k.endsWith('_revision_id'),
      );
      if (idKey && typeof (item as Record<string, unknown>)[idKey] === 'string') {
        collectedRefs.add((item as Record<string, unknown>)[idKey] as string);
      }
    }
  }

  // 2. Parse and validate conditions AST
  let conditionsNode: PolicyPredicateNode;
  if (typeof policyJson.conditions === 'string') {
    try {
      conditionsNode = JSON.parse(policyJson.conditions);
    } catch {
      throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Malformed JSON in policy conditions.');
    }
  } else {
    conditionsNode = policyJson.conditions;
  }

  // Recursive AST schema, bounds, and allowlist validation
  validateAstNode(conditionsNode, allowedRoots);

  // 3. Parse and validate action vocabulary (SPEC04 §44)
  let actionPayload: PolicyActionPayload;
  if (typeof policyJson.action === 'string') {
    try {
      actionPayload = JSON.parse(policyJson.action);
    } catch {
      throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Malformed JSON in policy action.');
    }
  } else {
    actionPayload = policyJson.action;
  }

  if (!actionPayload || typeof actionPayload !== 'object') {
    throw new RegistryValidationError('POLICY_SCHEMA_UNSUPPORTED', 'Policy action must be a structured payload object.');
  }

  if (!actionPayload.effect || !FROZEN_ACTION_EFFECTS.has(actionPayload.effect)) {
    throw new RegistryValidationError(
      'POLICY_SCHEMA_UNSUPPORTED',
      `Unsupported policy action effect '${actionPayload.effect}' (SPEC04 §44). Must be one of: [${Array.from(FROZEN_ACTION_EFFECTS).join(', ')}].`,
    );
  }

  // 4. Evaluate predicate
  const triggered = evaluatePredicate(conditionsNode, contextData, collectedRefs, allowedRoots);

  // 5. Determine action effect: non-triggered results produce NO_RELEASE_EFFECT (SPEC04 §50, Preflight 17)
  const effect = triggered ? actionPayload.effect : 'NO_RELEASE_EFFECT';
  const reasonCode = actionPayload.code || (triggered ? 'POLICY_TRIGGERED' : 'POLICY_NOT_TRIGGERED');
  const actionStr = JSON.stringify({
    ...actionPayload,
    effect,
  });

  // 6. Determine uncertainty: if uncertainty assessment or input indicates UNCERTAIN, preserve it
  let inputUncertainty = 'NONE';
  if (contextData && Object.prototype.hasOwnProperty.call(contextData, 'UncertaintyAssessment')) {
    const uncert = contextData['UncertaintyAssessment'] as Record<string, unknown>;
    if (uncert && uncert['uncertainty_level']) {
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
