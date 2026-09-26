/**
 * ContentOS — Unknown-Preservation Gate
 *
 * Implements SPEC03 §9, §10, §12, §134:
 * - KnowledgeGap status transitions & immutability
 * - Unknown-Preservation Gate enforcement
 * - Research failure != falsity doctrine
 * - Assumption allowed enforcement
 */
import type { KnowledgeGapStatus, ResearchOutcome } from './types.js';
import { RegistryValidationError } from '../services/registry-validator.js';

export interface KnowledgeGapState {
  gapId: string;
  taskRevisionId: string;
  question: string;
  blocking: boolean;
  assumptionAllowed: boolean;
  status: KnowledgeGapStatus;
  supersedesGapId?: string | null;
}

/**
 * Validates KnowledgeGap status transition rules.
 * Implements SPEC03 §9, §10, §134.
 */
export function validateKnowledgeGapTransition(
  current: { blocking: boolean; assumptionAllowed: boolean; status: KnowledgeGapStatus },
  newStatus: KnowledgeGapStatus,
): void {
  // If attempting EXPLICIT_ASSUMPTION, assumption_allowed must be true
  if (newStatus === 'EXPLICIT_ASSUMPTION' && !current.assumptionAllowed) {
    throw new RegistryValidationError(
      'EXPLICIT_ASSUMPTION_DISALLOWED',
      `Cannot transition KnowledgeGap to 'EXPLICIT_ASSUMPTION': assumption_allowed is false for this gap.`,
    );
  }
}

/**
 * Evaluates whether a ResearchTrace outcome may resolve a KnowledgeGap.
 * Implements SPEC03 §10, §12:
 * ResearchTrace outcomes NO_EVIDENCE_FOUND, SEARCH_INCOMPLETE, SEARCH_FAILED
 * MUST NOT close a blocking gap by themselves.
 */
export function validateResearchGapResolution(
  outcome: ResearchOutcome,
  gap: { blocking: boolean; status: KnowledgeGapStatus },
): void {
  if (gap.blocking) {
    if (
      outcome === 'NO_EVIDENCE_FOUND' ||
      outcome === 'SEARCH_INCOMPLETE' ||
      outcome === 'SEARCH_FAILED'
    ) {
      throw new RegistryValidationError(
        'RESEARCH_FAILURE_CANNOT_CLOSE_BLOCKING_GAP',
        `Research outcome '${outcome}' cannot resolve a blocking KnowledgeGap. Research failure is not falsity or resolution.`,
      );
    }
  }
}

/**
 * Enforces the Unknown-Preservation Gate before Strategy execution.
 * Implements SPEC03 §10:
 * For every final KnowledgeGap where blocking = true, normal Strategy generation is allowed
 * only when the gap is RESOLVED_BY_RESEARCH, RESOLVED_BY_USER, or EXPLICIT_ASSUMPTION (with assumption_allowed = true).
 */
export function enforceUnknownPreservationGate(gaps: KnowledgeGapState[]): {
  canProceedToStrategy: boolean;
  unresolvedBlockingGaps: KnowledgeGapState[];
  gateStatus: 'PASSED' | 'BLOCKED' | 'HUMAN_REVIEW_REQUIRED';
} {
  const unresolvedBlockingGaps: KnowledgeGapState[] = [];

  for (const gap of gaps) {
    if (gap.blocking) {
      const isResolved =
        gap.status === 'RESOLVED_BY_RESEARCH' ||
        gap.status === 'RESOLVED_BY_USER' ||
        (gap.status === 'EXPLICIT_ASSUMPTION' && gap.assumptionAllowed);

      if (!isResolved) {
        unresolvedBlockingGaps.push(gap);
      }
    }
  }

  if (unresolvedBlockingGaps.length > 0) {
    return {
      canProceedToStrategy: false,
      unresolvedBlockingGaps,
      gateStatus: 'BLOCKED',
    };
  }

  return {
    canProceedToStrategy: true,
    unresolvedBlockingGaps: [],
    gateStatus: 'PASSED',
  };
}

/**
 * Asserts that the unknown preservation gate allows strategy generation.
 * Throws if blocking gaps remain unresolved.
 */
export function assertUnknownPreservationGate(gaps: KnowledgeGapState[]): void {
  const result = enforceUnknownPreservationGate(gaps);
  if (!result.canProceedToStrategy) {
    const gapIds = result.unresolvedBlockingGaps.map((g) => g.gapId).join(', ');
    throw new RegistryValidationError(
      'UNKNOWN_PRESERVATION_GATE_BLOCKED',
      `Normal strategy path is blocked by unresolved blocking KnowledgeGaps: [${gapIds}]. Inventing certainty is strictly prohibited.`,
    );
  }
}
