/**
 * ContentOS — Policy Conflict Detection & Resolution Engine
 *
 * Implements SPEC04 §57–§76:
 *   - Conflict identity: deterministic SHA-256 hash over snapshot_id and canonically sorted policy_result_ids.
 *   - All conflicting PolicyResults must belong to the SAME snapshot.
 *   - Semantic conflict detection: multiple terminal PolicyResults on the same snapshot whose required outcomes cannot all be satisfied simultaneously.
 *   - No hard-coded action-effect pairs alone: detects incompatible REQUIREMENTS, BLOCK vs release-permitting, and REQUIRE_REVIEW vs auto-release.
 *   - BLOCK != automatically HARD_DENY: HARD_DENY_OVERRIDES requires proven non-overridable hard-deny semantics (override_allowed = false or statutory/mandate basis).
 *   - Structured scope comparison: strict containment comparator over structured scope dimensions. Returns ESCALATE for incomparable, equal, or ambiguous scopes.
 *   - No unconditional global priority ladder: evaluates specific legal justification for each resolution type.
 *   - Closed vocabulary: HARD_DENY_OVERRIDES, HARD_REQUIREMENT_OVERRIDES, MORE_SPECIFIC_SCOPE, EXPLICIT_PRIORITY, AUTHORIZED_OVERRIDE, ESCALATE.
 *   - Rejects insertion-order heuristics, guessing, or hidden state.
 *   - Reversing PolicyResult input order produces identical conflict identity and resolution behavior.
 */
import { createHash } from 'crypto';
import { RegistryValidationError } from '../services/registry-validator.js';

export type ConflictResolutionType =
  | 'HARD_DENY_OVERRIDES'
  | 'HARD_REQUIREMENT_OVERRIDES'
  | 'MORE_SPECIFIC_SCOPE'
  | 'EXPLICIT_PRIORITY'
  | 'AUTHORIZED_OVERRIDE'
  | 'ESCALATE';

export interface PolicyResultDescriptor {
  policyResultId: string;
  snapshotId: string;
  policyRevisionId: string;
  triggered: boolean;
  actionEffect: 'NO_RELEASE_EFFECT' | 'WARNING' | 'REQUIREMENT' | 'REQUIRE_REVIEW' | 'BLOCK';
  actionCode: string;
  actionParameters?: Record<string, unknown>;
  actionSchema?: Record<string, ParameterSemanticType | { type: ParameterSemanticType }>;
  priorityClass?: string | number;
  scope?: string;
  overrideAllowed?: boolean;
}

export interface DetectedConflict {
  conflictKey: string;
  snapshotId: string;
  policyResultIds: string[];
  results: PolicyResultDescriptor[];
}

export interface ConflictResolutionOutcome {
  conflictKey: string;
  resolutionType: ConflictResolutionType;
  overrideId?: string | null;
  reasonCodes: string;
  resolvedWinningResultId?: string | null;
  winningPolicyResultId?: string | null;
}

export interface StructuredScope {
  dimensions: Record<string, string>;
  raw: string;
}

export type ScopeRelation = 'MORE_SPECIFIC' | 'LESS_SPECIFIC' | 'EQUAL' | 'INCOMPARABLE';

/**
 * Parses a policy scope into structured dimensions (SPEC04 §64).
 * Supports JSON objects, delimited key-value pairs (KEY:VALUE or KEY=VALUE separated by / , ;),
 * or single dimension tokens.
 */
export function parseStructuredScope(scopeInput?: string): StructuredScope {
  if (!scopeInput || scopeInput.trim() === '' || scopeInput.toUpperCase() === 'GLOBAL') {
    return { dimensions: {}, raw: scopeInput ?? 'GLOBAL' };
  }
  const raw = scopeInput.trim();
  // Try JSON
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const dimensions: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          dimensions[k.toLowerCase()] = String(v).trim().toLowerCase();
        }
        return { dimensions, raw };
      }
    } catch {
      // Fall through to delimited parsing
    }
  }

  // Delimited key:value or key=value, separated by / or , or ;
  const dimensions: Record<string, string> = {};
  const tokens = raw.split(/[/,;]+/).map((s) => s.trim()).filter(Boolean);
  let hasExplicitKey = false;
  for (const token of tokens) {
    const sepIdx = token.includes('=') ? token.indexOf('=') : token.indexOf(':');
    if (sepIdx > 0) {
      hasExplicitKey = true;
      const k = token.slice(0, sepIdx).trim().toLowerCase();
      const v = token.slice(sepIdx + 1).trim().toLowerCase();
      dimensions[k] = v;
    }
  }
  if (hasExplicitKey) {
    return { dimensions, raw };
  }

  // Single unkeyed token, e.g. "US" or "LEGAL"
  return { dimensions: { domain: raw.toLowerCase() }, raw };
}

/**
 * Compares two structured scopes for strict containment / specificity (SPEC04 §64).
 *
 * Scope A is MORE_SPECIFIC than Scope B iff:
 * 1. Every dimension present in B is present in A with an identical value.
 * 2. Scope A defines at least one additional dimension that B does not specify.
 * 3. No dimension in A contradicts B.
 *
 * Returns:
 *   - MORE_SPECIFIC: A is strictly narrower than B.
 *   - LESS_SPECIFIC: B is strictly narrower than A.
 *   - EQUAL: A and B have identical dimension sets and values.
 *   - INCOMPARABLE: Dimensions are disjoint, partially overlapping without containment, or conflict.
 */
export function compareStructuredScopes(aInput?: string, bInput?: string): ScopeRelation {
  const a = parseStructuredScope(aInput);
  const b = parseStructuredScope(bInput);

  const keysA = Object.keys(a.dimensions);
  const keysB = Object.keys(b.dimensions);

  if (keysA.length === 0 && keysB.length === 0) return 'EQUAL';

  let aContainsB = true;
  for (const k of keysB) {
    if (!Object.prototype.hasOwnProperty.call(a.dimensions, k) || a.dimensions[k] !== b.dimensions[k]) {
      aContainsB = false;
      break;
    }
  }

  let bContainsA = true;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b.dimensions, k) || b.dimensions[k] !== a.dimensions[k]) {
      bContainsA = false;
      break;
    }
  }

  if (aContainsB && bContainsA) {
    return 'EQUAL';
  }
  if (aContainsB && keysA.length > keysB.length) {
    return 'MORE_SPECIFIC';
  }
  if (bContainsA && keysB.length > keysA.length) {
    return 'LESS_SPECIFIC';
  }

  return 'INCOMPARABLE';
}

export type ParameterSemanticType =
  | 'MONOTONIC_LOWER_BOUND' // e.g. minLength, minScore, minCount: jointly satisfiable by max(a, b)
  | 'MONOTONIC_UPPER_BOUND' // e.g. maxLength, maxScore, maxCount: jointly satisfiable by min(a, b)
  | 'ADDITIVE_COLLECTION'   // e.g. requiredTags, requiredHeaders, disclosures: jointly satisfiable by union
  | 'EXCLUSIVE_ENUM'        // e.g. format, mode, placement, style: single-choice discrete values; different values are mutually exclusive
  | 'BOOLEAN_FLAG';         // boolean flags: true vs false is mutually exclusive

export const SUPPORTED_PARAMETER_SEMANTIC_KINDS = new Set<string>([
  'MONOTONIC_LOWER_BOUND',
  'MONOTONIC_UPPER_BOUND',
  'ADDITIVE_COLLECTION',
  'EXCLUSIVE_ENUM',
  'BOOLEAN_FLAG',
]);

/**
 * Parameter semantic contracts MUST be mechanically bound to the evaluated DecisionPolicyRevision schema.
 * Prohibits property-name wording heuristics, global mapping tables, action-code wording, JSON inequality alone, string similarity, or LLM interpretation.
 */
export const FROZEN_ACTION_PARAM_SCHEMAS: Record<string, ParameterSemanticType> = Object.freeze({});

/**
 * Evaluates whether two structured parameter sets are mutually exclusive (SPEC04 §57).
 * Declares REQUIREMENT incompatibility ONLY when the immutable structured action contract
 * mechanically proves mutual exclusivity. If parameter semantics are unknown/unsupported,
 * fails closed with CONFLICT_SEMANTICS_UNDETERMINED error instead of guessing.
 */
export function areParametersIncompatible(
  paramsA?: Record<string, unknown>,
  paramsB?: Record<string, unknown>,
  schemaA?: Record<string, ParameterSemanticType | { type: ParameterSemanticType }>,
  schemaB?: Record<string, ParameterSemanticType | { type: ParameterSemanticType }>,
): boolean {
  if (!paramsA || !paramsB) return false;

  for (const key of Object.keys(paramsA)) {
    if (!Object.prototype.hasOwnProperty.call(paramsB, key)) {
      continue;
    }

    const valA = paramsA[key];
    const valB = paramsB[key];

    // If identical structured values, both are satisfied simultaneously
    if (JSON.stringify(valA) === JSON.stringify(valB)) {
      continue;
    }

    // Resolve semantic contract strictly from the immutable schema bound to DecisionPolicyRevision
    const sA = schemaA?.[key];
    const sB = schemaB?.[key];
    const rawA = typeof sA === 'string' ? sA : (sA && typeof sA === 'object' && 'type' in sA ? (sA as any).type : undefined);
    const rawB = typeof sB === 'string' ? sB : (sB && typeof sB === 'object' && 'type' in sB ? (sB as any).type : undefined);

    if (rawA && !SUPPORTED_PARAMETER_SEMANTIC_KINDS.has(rawA)) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Parameter semantic kind '${rawA}' is not authorized by the pinned schema contract (SPEC04 §41, §110).`,
      );
    }
    if (rawB && !SUPPORTED_PARAMETER_SEMANTIC_KINDS.has(rawB)) {
      throw new RegistryValidationError(
        'POLICY_SCHEMA_UNSUPPORTED',
        `Parameter semantic kind '${rawB}' is not authorized by the pinned schema contract (SPEC04 §41, §110).`,
      );
    }

    let semType: ParameterSemanticType | undefined;
    if (rawA && SUPPORTED_PARAMETER_SEMANTIC_KINDS.has(rawA)) {
      semType = rawA as ParameterSemanticType;
    } else if (rawB && SUPPORTED_PARAMETER_SEMANTIC_KINDS.has(rawB)) {
      semType = rawB as ParameterSemanticType;
    }

    if (!semType) {
      // Do not guess from property names, global conventions, or JSON inequality alone! (SPEC04 §57)
      // Fail closed when system is required to make a determination on unsupported/unbound parameter semantics.
      throw new RegistryValidationError(
        'CONFLICT_SEMANTICS_UNDETERMINED',
        `Cannot determine requirement conflict semantics for parameter '${key}': parameter has no immutable schema-bound semantic contract attached to DecisionPolicyRevision (SPEC04 §57).`,
      );
    }

    switch (semType) {
      case 'MONOTONIC_LOWER_BOUND': {
        // e.g. minLength: 10 vs 20 -> both satisfied simultaneously by any value >= 20. Compatible (no conflict).
        if (typeof valA === 'number' && typeof valB === 'number') {
          continue;
        }
        throw new RegistryValidationError(
          'CONFLICT_SEMANTICS_UNDETERMINED',
          `Parameter '${key}' with MONOTONIC_LOWER_BOUND requires numeric values.`,
        );
      }
      case 'MONOTONIC_UPPER_BOUND': {
        // e.g. maxLength: 50 vs 100 -> both satisfied simultaneously by any value <= 50. Compatible (no conflict).
        if (typeof valA === 'number' && typeof valB === 'number') {
          continue;
        }
        throw new RegistryValidationError(
          'CONFLICT_SEMANTICS_UNDETERMINED',
          `Parameter '${key}' with MONOTONIC_UPPER_BOUND requires numeric values.`,
        );
      }
      case 'ADDITIVE_COLLECTION': {
        // e.g. requiredTags: ["A"] vs ["B"] -> both satisfied simultaneously by union ["A", "B"]. Compatible (no conflict).
        if (Array.isArray(valA) && Array.isArray(valB)) {
          continue;
        }
        throw new RegistryValidationError(
          'CONFLICT_SEMANTICS_UNDETERMINED',
          `Parameter '${key}' with ADDITIVE_COLLECTION requires array values.`,
        );
      }
      case 'EXCLUSIVE_ENUM': {
        // Single-choice discrete options: two different options are mechanically mutually exclusive
        if (valA !== valB) {
          return true; // Conflict!
        }
        continue;
      }
      case 'BOOLEAN_FLAG': {
        if (valA !== valB) {
          return true; // Conflict!
        }
        continue;
      }
      default: {
        throw new RegistryValidationError(
          'CONFLICT_SEMANTICS_UNDETERMINED',
          `Unsupported parameter semantic type '${semType}' for key '${key}'.`,
        );
      }
    }
  }

  return false;
}

/**
 * Determines whether two triggered terminal PolicyResults are incompatible (SPEC04 §57).
 */
export function areResultsInConflict(a: PolicyResultDescriptor, b: PolicyResultDescriptor): boolean {
  if (!a.triggered || !b.triggered) {
    return false;
  }

  // Conflict Case 1: BLOCK vs Non-BLOCK / Release-Permitting
  // One mandates BLOCK while the other permits release or asserts an active requirement/review
  if (a.actionEffect === 'BLOCK' && b.actionEffect !== 'BLOCK') {
    return true;
  }
  if (b.actionEffect === 'BLOCK' && a.actionEffect !== 'BLOCK') {
    return true;
  }

  // Conflict Case 2: Incompatible REQUIREMENTS (SPEC04 §57: "REQUIREMENT A vs incompatible REQUIREMENT B")
  if (a.actionEffect === 'REQUIREMENT' && b.actionEffect === 'REQUIREMENT') {
    // Different requirement action codes alone (e.g. REQUIRE_DISCLOSURE vs REQUIRE_SOURCE_CITATION)
    // are NOT a conflict; different requirements can coexist simultaneously.
    // A conflict exists ONLY if structured immutable action semantics mechanically prove that
    // both demands cannot be satisfied simultaneously.
    return areParametersIncompatible(
      a.actionParameters,
      b.actionParameters,
      a.actionSchema,
      b.actionSchema,
    );
  }

  // Conflict Case 3: REQUIRE_REVIEW vs NO_RELEASE_EFFECT (Automated Release vs Mandatory Review)
  if (
    (a.actionEffect === 'REQUIRE_REVIEW' && b.actionEffect === 'NO_RELEASE_EFFECT') ||
    (b.actionEffect === 'REQUIRE_REVIEW' && a.actionEffect === 'NO_RELEASE_EFFECT')
  ) {
    return true;
  }

  // Conflict Case 4: Multiple competing BLOCK actions with contradictory parameters
  if (a.actionEffect === 'BLOCK' && b.actionEffect === 'BLOCK') {
    return areParametersIncompatible(
      a.actionParameters,
      b.actionParameters,
      a.actionSchema,
      b.actionSchema,
    );
  }

  return false;
}

/**
 * Proves whether a result has legitimate hard-deny semantics (SPEC04 §62).
 *
 * Hard deny requires exact frozen policy/rule semantics:
 * 1. Action is BLOCK
 * 2. overrideAllowed === false (strictly non-overridable)
 *
 * Substring, name, reason text, or priority-class wording inference
 * (such as "HARD", "MANDATE", "STATUTORY") is strictly forbidden (SPEC04 §62).
 * A generic, overridable BLOCK is NOT a hard deny.
 */
export function isHardDeny(result: PolicyResultDescriptor): boolean {
  if (result.actionEffect !== 'BLOCK') {
    return false;
  }
  // Explicitly non-overridable is the exact structured proof required for hard deny
  return result.overrideAllowed === false;
}

export class PolicyConflictResolver {
  /**
   * Proves whether a result has legitimate hard-deny semantics (SPEC04 §62).
   */
  static isHardDeny(result: PolicyResultDescriptor): boolean {
    return isHardDeny(result);
  }

  /**
   * Computes the deterministic conflict_key (SPEC04 §59).
   * hash(snapshot_id + ':' + canonical_sorted(policy_result_ids))
   */
  static computeConflictKey(snapshotId: string, policyResultIds: string[]): string {
    if (!snapshotId) {
      throw new RegistryValidationError('CONFLICT_UNRESOLVED', 'snapshot_id is required to compute conflict_key.');
    }
    if (!Array.isArray(policyResultIds) || policyResultIds.length < 2) {
      throw new RegistryValidationError('CONFLICT_UNRESOLVED', 'A conflict requires at least 2 policy_result_ids.');
    }

    const sortedIds = [...policyResultIds].sort();
    const payload = `${snapshotId}:${sortedIds.join(',')}`;
    return createHash('sha256').update(payload, 'utf-8').digest('hex');
  }

  /**
   * Detects conflicts across a complete set of terminal PolicyResults (SPEC04 §57, §58).
   * Evaluates structured semantic compatibility.
   */
  static detectConflicts(results: PolicyResultDescriptor[]): DetectedConflict[] {
    if (!results || results.length === 0) return [];

    // All results must share the exact same snapshot_id (SPEC04 §59, §72)
    const snapshotId = results[0]!.snapshotId;
    for (const r of results) {
      if (r.snapshotId !== snapshotId) {
        throw new RegistryValidationError(
          'SNAPSHOT_MISMATCH',
          `Cannot evaluate conflicts across different snapshots ('${snapshotId}' vs '${r.snapshotId}') (SPEC04 §59).`,
        );
      }
    }

    const conflicts: DetectedConflict[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i]!;
        const b = results[j]!;

        if (areResultsInConflict(a, b)) {
          const sortedIds = [a.policyResultId, b.policyResultId].sort();
          const pairKey = sortedIds.join(':');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            const conflictKey = this.computeConflictKey(snapshotId, sortedIds);
            conflicts.push({
              conflictKey,
              snapshotId,
              policyResultIds: sortedIds,
              results: [a, b],
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Deterministically resolves a detected conflict using frozen policy rules (SPEC04 §61–§67).
   *
   * Evaluates legal justification for resolution types:
   * 1. HARD_DENY_OVERRIDES: Proven hard deny dominates non-hard-deny. (Generic BLOCK != automatically hard deny).
   * 2. HARD_REQUIREMENT_OVERRIDES: Mandatory requirement dominates advisory warning.
   * 3. MORE_SPECIFIC_SCOPE: Strictly narrower structured scope dominates broader scope.
   * 4. EXPLICIT_PRIORITY: Deterministically higher priority class dominates lower.
   * 5. ESCALATE: Returned when scopes/priorities are equal, incomparable, or resolution cannot be proven.
   *
   * Evaluation is symmetric and invariant to input descriptor ordering.
   */
  static resolveConflict(conflict: DetectedConflict): ConflictResolutionOutcome {
    const conflictKey = conflict.conflictKey;
    const rawResults: PolicyResultDescriptor[] = conflict.results ?? (conflict as any).descriptors ?? [];

    if (rawResults.length < 2) {
      throw new RegistryValidationError('CONFLICT_UNRESOLVED', 'A conflict requires at least 2 results to resolve.');
    }

    // Sort results deterministically by policyResultId for order invariance
    const results = [...rawResults].sort((a, b) => a.policyResultId.localeCompare(b.policyResultId));
    const [resA, resB] = results;

    // 1. HARD_DENY_OVERRIDES (SPEC04 §62)
    // Permitted ONLY when frozen semantics explicitly prove one result is a non-overridable hard deny
    // relative to the other.
    const hardDenyA = isHardDeny(resA!);
    const hardDenyB = isHardDeny(resB!);

    if (hardDenyA && !hardDenyB) {
      return {
        conflictKey,
        resolutionType: 'HARD_DENY_OVERRIDES',
        overrideId: null,
        reasonCodes: 'HARD_DENY_DOMINATES',
        resolvedWinningResultId: resA!.policyResultId,
        winningPolicyResultId: resA!.policyResultId,
      };
    }
    if (hardDenyB && !hardDenyA) {
      return {
        conflictKey,
        resolutionType: 'HARD_DENY_OVERRIDES',
        overrideId: null,
        reasonCodes: 'HARD_DENY_DOMINATES',
        resolvedWinningResultId: resB!.policyResultId,
        winningPolicyResultId: resB!.policyResultId,
      };
    }
    if (hardDenyA && hardDenyB) {
      // Both are hard denies: neither can override the other; must evaluate priority/scope or ESCALATE
    }

    // 2. HARD_REQUIREMENT_OVERRIDES (SPEC04 §63)
    // Mandatory requirement dominates advisory warning when preserving allowed outcome
    const reqA = resA!.actionEffect === 'REQUIREMENT';
    const reqB = resB!.actionEffect === 'REQUIREMENT';
    const warnA = resA!.actionEffect === 'WARNING';
    const warnB = resB!.actionEffect === 'WARNING';

    if (reqA && warnB && !hardDenyB) {
      return {
        conflictKey,
        resolutionType: 'HARD_REQUIREMENT_OVERRIDES',
        overrideId: null,
        reasonCodes: 'MANDATORY_REQUIREMENT_DOMINATES_WARNING',
        resolvedWinningResultId: resA!.policyResultId,
        winningPolicyResultId: resA!.policyResultId,
      };
    }
    if (reqB && warnA && !hardDenyA) {
      return {
        conflictKey,
        resolutionType: 'HARD_REQUIREMENT_OVERRIDES',
        overrideId: null,
        reasonCodes: 'MANDATORY_REQUIREMENT_DOMINATES_WARNING',
        resolvedWinningResultId: resB!.policyResultId,
        winningPolicyResultId: resB!.policyResultId,
      };
    }

    // 3. MORE_SPECIFIC_SCOPE (SPEC04 §64)
    // Allowed only when scope relation is deterministically provable from structured scope
    const scopeRel = compareStructuredScopes(resA!.scope, resB!.scope);
    if (scopeRel === 'MORE_SPECIFIC') {
      return {
        conflictKey,
        resolutionType: 'MORE_SPECIFIC_SCOPE',
        overrideId: null,
        reasonCodes: 'NARROWER_STRUCTURED_SCOPE_DOMINATES',
        resolvedWinningResultId: resA!.policyResultId,
        winningPolicyResultId: resA!.policyResultId,
      };
    }
    if (scopeRel === 'LESS_SPECIFIC') {
      return {
        conflictKey,
        resolutionType: 'MORE_SPECIFIC_SCOPE',
        overrideId: null,
        reasonCodes: 'NARROWER_STRUCTURED_SCOPE_DOMINATES',
        resolvedWinningResultId: resB!.policyResultId,
        winningPolicyResultId: resB!.policyResultId,
      };
    }

    // 4. EXPLICIT_PRIORITY (SPEC04 §65)
    // Permitted ONLY when the exact frozen policy metadata supplies a deterministic ordering (e.g. numeric priority values).
    // The resolver must NOT manufacture priority semantics from naming conventions, arbitrary string labels,
    // or global priority lookup tables. If the contract does not supply comparable priority semantics,
    // or if priorities are equal/incomparable, the resolver MUST ESCALATE (SPEC04 §65, §67).
    if (resA!.priorityClass !== undefined && resB!.priorityClass !== undefined) {
      if (typeof resA!.priorityClass === 'number' && typeof resB!.priorityClass === 'number') {
        const numA = resA!.priorityClass;
        const numB = resB!.priorityClass;
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          const higher = numA > numB ? resA! : resB!;
          return {
            conflictKey,
            resolutionType: 'EXPLICIT_PRIORITY',
            overrideId: null,
            reasonCodes: 'HIGHER_PRIORITY_CLASS_DOMINATES',
            resolvedWinningResultId: higher.policyResultId,
            winningPolicyResultId: higher.policyResultId,
          };
        }
      }
    }

    // 5. ESCALATE (SPEC04 §67)
    // When conflict cannot be resolved deterministically from frozen semantics
    return {
      conflictKey,
      resolutionType: 'ESCALATE',
      overrideId: null,
      reasonCodes: 'UNDETERMINED_PRECEDENCE_ESCALATE_TO_REVIEW',
      resolvedWinningResultId: null,
      winningPolicyResultId: null,
    };
  }

  /**
   * Evaluates if a given conflict resolution permits release (SPEC04 §65, §67).
   */
  static isReleasePermitted(resolutionType: string, intendedReleaseStatus?: string): boolean {
    if (resolutionType === 'ESCALATE' || resolutionType === 'HARD_DENY_OVERRIDES') {
      return false;
    }
    if (intendedReleaseStatus === 'BLOCKED') {
      return false;
    }
    return true;
  }
}
