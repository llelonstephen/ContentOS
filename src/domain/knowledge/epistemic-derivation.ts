/**
 * ContentOS — Epistemic State Derivation & Causal Support Guard
 *
 * Implements SPEC03 §40–§75:
 * - Compatibility & Relationship independence (§48)
 * - INCOMPATIBLE contributes zero weight (§45)
 * - UNCERTAIN cannot promote to SUPPORTED (§46)
 * - DOES_NOT_ADDRESS contributes no support/contradiction (§49)
 * - Exact assessment closure (§57)
 * - Superseded assessment double-count guard (§59)
 * - Assessment multiplicity / independence rule (§54, §55)
 * - Causal Support Guard & CausalStatus (§65, §66, §67)
 * - SupportStatus derivation (§60, §61, §62)
 * - Epistemic derivation revision pinning (§63)
 */
import {
  type PropositionType,
  type EvidenceCompatibilityStatus,
  type EvidenceRelationship,
  type EpistemicSupportStatus,
  type CausalStatus,
  type DerivationRevisionRef,
  CAUSAL_STATUSES,
} from './types.js';
import { RegistryValidationError } from '../services/registry-validator.js';

export interface AssessmentForDerivation {
  assessmentId: string;
  linkId: string;
  propositionId: string;
  evidenceId: string;
  compatibilityStatus: EvidenceCompatibilityStatus;
  relationship: EvidenceRelationship;
  supersedesAssessmentId?: string | null;
  limitations?: string;
  studyDesign?: string;
  causalIdentification?: string;
  isObservationalOnly?: boolean;
  isPlatformAttributionOnly?: boolean;
}

export interface DerivationInputs {
  propositionId: string;
  propositionType: PropositionType;
  assessments: AssessmentForDerivation[];
  derivationRevisionRef: DerivationRevisionRef;
  validFrom: Date;
  validUntilIfKnown?: Date | null;
  knownFrom: Date;
}

export interface DerivationResult {
  supportStatus: EpistemicSupportStatus;
  causalStatus: CausalStatus;
  uncertainty: string;
  selectedAssessmentIds: string[];
  effectiveLimitations: string[];
}

/**
 * Executes canonical epistemic derivation according to SPEC03 rules.
 */
export function deriveEpistemicState(inputs: DerivationInputs): DerivationResult {
  const { propositionId, propositionType, assessments } = inputs;

  // 1. Exact Assessment Closure (SPEC03 §57)
  // Every assessment must link strictly to this exact proposition_id
  for (const a of assessments) {
    if (a.propositionId !== propositionId) {
      throw new RegistryValidationError(
        'EPISTEMIC_CLOSURE_VIOLATION',
        `Assessment '${a.assessmentId}' belongs to proposition '${a.propositionId}', not target proposition '${propositionId}'. Cross-proposition assessment closure failed.`,
      );
    }
  }

  // 2. Superseded Assessment Double-Count Guard (SPEC03 §59)
  // Exclude assessments that have been superseded by another assessment in the same set
  const supersedingIds = new Set(
    assessments
      .map((a) => a.supersedesAssessmentId)
      .filter((id): id is string => Boolean(id)),
  );
  const contemporaneous = assessments.filter((a) => !supersedingIds.has(a.assessmentId));

  // 3. Assessment Multiplicity / Independence Rule (SPEC03 §54, §55)
  // Deduplicate by evidenceId so multiple assessments of the same EvidenceItem do not multiply evidence
  const uniqueByEvidence = new Map<string, AssessmentForDerivation>();
  for (const a of contemporaneous) {
    // Keep most specific / latest
    if (!uniqueByEvidence.has(a.evidenceId)) {
      uniqueByEvidence.set(a.evidenceId, a);
    }
  }
  const effectiveAssessments = Array.from(uniqueByEvidence.values());

  // 4. Compatibility filtering (SPEC03 §40–§46)
  // INCOMPATIBLE evidence contributes ZERO weight (SPEC03 §45)
  // DOES_NOT_ADDRESS contributes no support or contradiction weight (SPEC03 §49)
  const compatible = effectiveAssessments.filter(
    (a) => a.compatibilityStatus === 'COMPATIBLE' || a.compatibilityStatus === 'COMPATIBLE_WITH_LIMITS',
  );

  const hasUncertainCompatibility = effectiveAssessments.some(
    (a) => a.compatibilityStatus === 'UNCERTAIN',
  );

  const effectiveLimitations: string[] = [];
  for (const a of compatible) {
    if (a.compatibilityStatus === 'COMPATIBLE_WITH_LIMITS' && a.limitations) {
      effectiveLimitations.push(a.limitations);
    }
  }

  // Separate supporting and contradicting items
  const supporting = compatible.filter(
    (a) => a.relationship === 'SUPPORTS' || a.relationship === 'PARTIALLY_SUPPORTS',
  );
  const contradicting = compatible.filter((a) => a.relationship === 'CONTRADICTS');

  // 5. Epistemic SupportStatus derivation (SPEC03 §60–§62)
  let supportStatus: EpistemicSupportStatus;

  if (compatible.length === 0) {
    // Zero compatible evidence
    supportStatus = 'UNKNOWN';
  } else if (supporting.length > 0 && contradicting.length > 0) {
    // Material contradiction preserved
    supportStatus = 'CONFLICTING';
  } else if (contradicting.length > 0 && supporting.length === 0) {
    supportStatus = 'CONTRADICTED';
  } else if (supporting.length > 0) {
    // UNCERTAIN compatibility cannot promote to SUPPORTED (SPEC03 §46)
    if (hasUncertainCompatibility) {
      supportStatus = 'PARTIALLY_SUPPORTED';
    } else if (
      effectiveLimitations.length > 0 ||
      supporting.some((a) => a.relationship === 'PARTIALLY_SUPPORTS')
    ) {
      supportStatus = 'PARTIALLY_SUPPORTED';
    } else {
      supportStatus = 'SUPPORTED';
    }
  } else {
    // Only QUALIFIES or non-supporting
    supportStatus = 'INSUFFICIENT';
  }

  // 6. Causal Support Guard (SPEC03 §6.7, §65, §66, §67)
  let causalStatus: CausalStatus;

  if (propositionType !== 'CAUSAL') {
    // MANDATORY SPEC03 §6.7: Every non-causal proposition MUST have causal_status = NOT_APPLICABLE
    causalStatus = 'NOT_APPLICABLE';
  } else {
    // For CAUSAL proposition: general SUPPORTS is NOT sufficient for causal_status = SUPPORTED
    if (supportStatus === 'UNKNOWN') {
      causalStatus = 'UNKNOWN';
    } else if (supportStatus === 'CONFLICTING') {
      causalStatus = 'CONFLICTING';
    } else if (supportStatus === 'CONTRADICTED') {
      causalStatus = 'INSUFFICIENT';
    } else if (supporting.length === 0) {
      causalStatus = 'INSUFFICIENT';
    } else {
      // Check observational and attribution firewalls (SPEC03 §67)
      const allObservationalOrAttribution = supporting.every(
        (a) => a.isObservationalOnly || a.isPlatformAttributionOnly,
      );

      if (allObservationalOrAttribution) {
        // Observational correlation or attribution ALONE cannot become causal SUPPORTED
        causalStatus = 'ASSOCIATIONAL_ONLY';
      } else {
        const hasAdequateIdentification = supporting.some(
          (a) =>
            a.studyDesign === 'RANDOMIZED_EXPERIMENT' ||
            a.studyDesign === 'QUASI_EXPERIMENT' ||
            a.causalIdentification === 'INSTRUMENTAL_VARIABLE' ||
            a.causalIdentification === 'REGRESSION_DISCONTINUITY' ||
            a.causalIdentification === 'DIFFERENCE_IN_DIFFERENCES',
        );

        if (hasAdequateIdentification && supportStatus === 'SUPPORTED') {
          causalStatus = 'SUPPORTED';
        } else if (hasAdequateIdentification) {
          causalStatus = 'PARTIALLY_SUPPORTED';
        } else {
          causalStatus = 'ASSOCIATIONAL_ONLY';
        }
      }
    }
  }

  // Build uncertainty payload (SPEC03 §93)
  const uncertaintyParts: string[] = [];
  if (supportStatus === 'CONFLICTING') {
    uncertaintyParts.push('Material conflicting evidence detected');
  }
  if (hasUncertainCompatibility) {
    uncertaintyParts.push('Uncertain compatibility present in assessment set');
  }
  if (effectiveLimitations.length > 0) {
    uncertaintyParts.push(`Limitations: ${effectiveLimitations.join('; ')}`);
  }
  if (causalStatus === 'ASSOCIATIONAL_ONLY') {
    uncertaintyParts.push('Evidence demonstrates association only; causal mechanism unverified');
  }
  const uncertainty = uncertaintyParts.length > 0 ? uncertaintyParts.join(' | ') : 'NONE';

  return {
    supportStatus,
    causalStatus,
    uncertainty,
    selectedAssessmentIds: contemporaneous.map((a) => a.assessmentId),
    effectiveLimitations,
  };
}

/**
 * Asserts causal guard invariants directly on EpistemicStateVersion inputs.
 * Enforces SPEC03 §6.7, §65, §66:
 * proposition_type != CAUSAL => causal_status = NOT_APPLICABLE.
 */
export function validateCausalSupportGuard(
  propositionType: PropositionType | string,
  causalStatus: CausalStatus | string,
): void {
  const isSpec03Causal = (CAUSAL_STATUSES as readonly string[]).includes(causalStatus);
  if (isSpec03Causal && propositionType !== 'CAUSAL' && causalStatus !== 'NOT_APPLICABLE') {
    throw new RegistryValidationError(
      'CAUSAL_STATUS_MUST_BE_NOT_APPLICABLE',
      `Non-causal proposition (type '${propositionType}') MUST have causal_status = 'NOT_APPLICABLE'. Received '${causalStatus}'.`,
    );
  }
}
