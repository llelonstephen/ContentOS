/**
 * ContentOS — Performance Evidence & Attribution Firewall
 *
 * Implements SPEC03 §24, §25, §26:
 * - Performance evidence boundary
 * - Observational performance cannot establish product/safety/regulatory/medical facts
 * - Attribution != causation firewall
 */
import type { EvidenceOriginType, PropositionType, EvidenceDomain } from './types.js';
import { RegistryValidationError } from '../services/registry-validator.js';

export interface PerformanceFirewallInputs {
  originType: EvidenceOriginType;
  evidenceDomain: EvidenceDomain;
  targetPropositionType: PropositionType;
  isFactualClaimAboutProductOrSafetyOrRegulatory?: boolean;
}

/**
 * Validates the performance evidence firewall.
 * Implements SPEC03 §25:
 * Performance evidence may inform PERFORMANCE, STRATEGIC, or AUDIENCE propositions.
 * By itself it must not establish unrelated product facts, safety facts, regulatory facts, medical facts.
 */
export function validatePerformanceEvidenceFirewall(inputs: PerformanceFirewallInputs): void {
  const isPerformanceOrigin =
    inputs.originType === 'PERFORMANCE_OBSERVATION' ||
    inputs.evidenceDomain === 'OBSERVATIONAL_PERFORMANCE' ||
    inputs.evidenceDomain === 'PLATFORM_ANALYTICS';

  if (isPerformanceOrigin) {
    // Check target proposition type
    if (
      inputs.targetPropositionType === 'FACTUAL' ||
      inputs.targetPropositionType === 'DEFINITIONAL'
    ) {
      throw new RegistryValidationError(
        'PERFORMANCE_EVIDENCE_FIREWALL_VIOLATION',
        `Performance evidence (domain: ${inputs.evidenceDomain}, origin: ${inputs.originType}) cannot be used to establish a ${inputs.targetPropositionType} proposition. Observed performance does not prove factual truth.`,
      );
    }

    if (inputs.isFactualClaimAboutProductOrSafetyOrRegulatory) {
      throw new RegistryValidationError(
        'PERFORMANCE_EVIDENCE_FIREWALL_VIOLATION',
        `Performance evidence cannot establish product facts, safety facts, regulatory facts, or medical facts. High conversion does not prove factual claims true.`,
      );
    }
  }
}

/**
 * Validates the attribution firewall.
 * Implements SPEC03 §26:
 * Attribution models assign observed credit; they do not establish causal effect.
 */
export function validateAttributionFirewall(isAttributionModelEvidence: boolean, claimIsCausal: boolean): void {
  if (isAttributionModelEvidence && claimIsCausal) {
    throw new RegistryValidationError(
      'ATTRIBUTION_NOT_CAUSAL_PROOF',
      `Attributed performance cannot establish causal effect. Attribution does not establish causal proof.`,
    );
  }
}
