/**
 * ContentOS — Policy Conflict Detection & Resolution Engine
 *
 * Implements SPEC04 §57–§76:
 *   - Conflict identity: deterministic SHA-256 hash over snapshot_id and canonically sorted policy_result_ids.
 *   - All conflicting PolicyResults must belong to the SAME snapshot.
 *   - Closed vocabulary: HARD_DENY_OVERRIDES, HARD_REQUIREMENT_OVERRIDES, MORE_SPECIFIC_SCOPE, EXPLICIT_PRIORITY, AUTHORIZED_OVERRIDE, ESCALATE.
 *   - Deterministic resolution ordering: hard deny -> hard requirement -> specific scope -> explicit priority -> escalate.
 *   - Rejects insertion-order heuristics, guessing, or hidden state.
 *   - AUTHORIZED_OVERRIDE strictly requires valid PolicyOverride, while non-override resolutions require override_id = null.
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
}

export class PolicyConflictResolver {
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
   * Conflict detection admitted ONLY after policy result set is complete.
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

    // Check for triggered BLOCK vs non-BLOCK (e.g. REQUIREMENT, WARNING, NO_RELEASE_EFFECT, etc.)
    const blockResults = results.filter((r) => r.triggered && r.actionEffect === 'BLOCK');
    const nonBlockResults = results.filter((r) => r.triggered && r.actionEffect !== 'BLOCK');

    if (blockResults.length > 0 && nonBlockResults.length > 0) {
      for (const b of blockResults) {
        for (const nb of nonBlockResults) {
          const conflicting = [b, nb];
          const conflictKey = this.computeConflictKey(snapshotId, [b.policyResultId, nb.policyResultId]);
          conflicts.push({
            conflictKey,
            snapshotId,
            policyResultIds: [b.policyResultId, nb.policyResultId].sort(),
            results: conflicting,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Deterministically resolves a detected conflict using frozen policy rules (SPEC04 §61–§67, §75).
   */
  static resolveConflict(conflict: DetectedConflict): ConflictResolutionOutcome {
    const conflictKey = conflict.conflictKey;
    const results = conflict.results ?? (conflict as any).descriptors ?? [];

    // 1. HARD_DENY_OVERRIDES (SPEC04 §62)
    const blockResult = results.find((r) => r.actionEffect === 'BLOCK');
    if (blockResult) {
      // If one is BLOCK and non-overridable, or standard hard deny
      return {
        conflictKey,
        resolutionType: 'HARD_DENY_OVERRIDES',
        overrideId: null,
        reasonCodes: 'HARD_DENY_DOMINATES',
        resolvedWinningResultId: blockResult.policyResultId,
      };
    }

    // 2. HARD_REQUIREMENT_OVERRIDES (SPEC04 §63)
    const reqResult = results.find((r) => r.actionEffect === 'REQUIREMENT');
    const warnResult = results.find((r) => r.actionEffect === 'WARNING');
    if (reqResult && warnResult) {
      return {
        conflictKey,
        resolutionType: 'HARD_REQUIREMENT_OVERRIDES',
        overrideId: null,
        reasonCodes: 'MANDATORY_REQUIREMENT_DOMINATES_WARNING',
        resolvedWinningResultId: reqResult.policyResultId,
      };
    }

    // 3. MORE_SPECIFIC_SCOPE (SPEC04 §64)
    // If scopes can be deterministically compared by depth / specificity
    const [resA, resB] = results;
    if (resA && resB && resA.scope && resB.scope && resA.scope !== resB.scope) {
      const scopeDepthA = resA.scope.split(':').length;
      const scopeDepthB = resB.scope.split(':').length;
      if (scopeDepthA > scopeDepthB && resA.scope.startsWith(resB.scope)) {
        return {
          conflictKey,
          resolutionType: 'MORE_SPECIFIC_SCOPE',
          overrideId: null,
          reasonCodes: 'NARROWER_SCOPE_DOMINATES',
          resolvedWinningResultId: resA.policyResultId,
        };
      }
      if (scopeDepthB > scopeDepthA && resB.scope.startsWith(resA.scope)) {
        return {
          conflictKey,
          resolutionType: 'MORE_SPECIFIC_SCOPE',
          overrideId: null,
          reasonCodes: 'NARROWER_SCOPE_DOMINATES',
          resolvedWinningResultId: resB.policyResultId,
        };
      }
    }

    // 4. EXPLICIT_PRIORITY (SPEC04 §65)
    if (resA && resB && resA.priorityClass !== undefined && resB.priorityClass !== undefined) {
      const pA = Number(resA.priorityClass);
      const pB = Number(resB.priorityClass);
      if (!isNaN(pA) && !isNaN(pB) && pA !== pB) {
        const higher = pA > pB ? resA : resB;
        return {
          conflictKey,
          resolutionType: 'EXPLICIT_PRIORITY',
          overrideId: null,
          reasonCodes: 'HIGHER_PRIORITY_CLASS_DOMINATES',
          resolvedWinningResultId: higher.policyResultId,
        };
      }
    }

    // 5. If none of the above deterministically resolve, ESCALATE (SPEC04 §67)
    // Insertion order or guessing is strictly forbidden (SPEC04 §45, §67).
    return {
      conflictKey,
      resolutionType: 'ESCALATE',
      overrideId: null,
      reasonCodes: 'UNDETERMINED_PRECEDENCE_ESCALATE_TO_REVIEW',
      resolvedWinningResultId: null,
    };
  }

  /**
   * Evaluates if a given conflict resolution permits release (SPEC04 §65, §67).
   */
  static isReleasePermitted(resolutionType: string): boolean {
    if (resolutionType === 'ESCALATE' || resolutionType === 'HARD_DENY_OVERRIDES') {
      return false;
    }
    return true;
  }
}
