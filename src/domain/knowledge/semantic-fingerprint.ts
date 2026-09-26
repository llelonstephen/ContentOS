/**
 * ContentOS — Proposition Semantic Fingerprint & Resolution Boundary
 *
 * Implements SPEC03 §30, §31, §32, §33, §34:
 * - Semantic identity resolution
 * - Derived operational fingerprinting (non-authoritative, rebuildable)
 * - Safe reuse detection vs unsafe false merge detection
 * - Concurrency lock keys
 */
import crypto from 'node:crypto';
import type { PropositionSemanticIdentity, PropositionResolutionOutcome } from './types.js';
import { RegistryValidationError } from '../services/registry-validator.js';

/**
 * Normalizes text components for deterministic comparison.
 */
function normalizeString(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Computes a non-authoritative derived semantic fingerprint from material attributes.
 * Implements SPEC03 §33.
 */
export function computeSemanticFingerprint(identity: PropositionSemanticIdentity): string {
  const canonicalForm = [
    identity.propositionType,
    normalizeString(identity.canonicalMeaning),
    normalizeString(identity.subject),
    normalizeString(identity.predicate),
    normalizeString(identity.object),
    normalizeString(identity.qualifiers),
    normalizeString(identity.conditions),
    normalizeString(identity.populationScope),
    normalizeString(identity.jurisdictionScope),
  ].join('||');

  return crypto.createHash('sha256').update(canonicalForm, 'utf-8').digest('hex');
}

/**
 * Derives a deterministic integer lock key for PostgreSQL advisory locking (bigint range).
 * Used during concurrency-safe resolution (SPEC03 §34).
 */
export function computeAdvisoryLockKey(fingerprint: string): number {
  const hashPrefix = fingerprint.slice(0, 15);
  return parseInt(hashPrefix, 16);
}

/**
 * Performs deep semantic comparison between two Proposition identities.
 * Enforces SPEC03 §30, §31: Textual similarity alone is insufficient.
 * Material qualifiers, scopes, and causal vs associational claims must NOT be merged.
 */
export function evaluateSemanticEquivalence(
  a: PropositionSemanticIdentity,
  b: PropositionSemanticIdentity,
): PropositionResolutionOutcome {
  // 1. Proposition type must match exactly
  if (a.propositionType !== b.propositionType) {
    return 'CREATE_NEW';
  }

  // 2. Exact normalized check on material semantic fields
  const normA = {
    meaning: normalizeString(a.canonicalMeaning),
    subject: normalizeString(a.subject),
    predicate: normalizeString(a.predicate),
    object: normalizeString(a.object),
    qualifiers: normalizeString(a.qualifiers),
    conditions: normalizeString(a.conditions),
    population: normalizeString(a.populationScope),
    jurisdiction: normalizeString(a.jurisdictionScope),
  };

  const normB = {
    meaning: normalizeString(b.canonicalMeaning),
    subject: normalizeString(b.subject),
    predicate: normalizeString(b.predicate),
    object: normalizeString(b.object),
    qualifiers: normalizeString(b.qualifiers),
    conditions: normalizeString(b.conditions),
    population: normalizeString(b.populationScope),
    jurisdiction: normalizeString(b.jurisdictionScope),
  };

  // Check for material qualifier / scope differences that prohibit merge
  // e.g., "reduces noise at 1 metre" vs "reduces noise at 3 metres"
  // e.g., "associated with higher CTR" vs "causes higher CTR"
  if (
    normA.qualifiers !== normB.qualifiers ||
    normA.conditions !== normB.conditions ||
    normA.population !== normB.population ||
    normA.jurisdiction !== normB.jurisdiction ||
    normA.subject !== normB.subject ||
    normA.predicate !== normB.predicate ||
    normA.object !== normB.object
  ) {
    return 'CREATE_NEW';
  }

  if (normA.meaning === normB.meaning) {
    return 'REUSE_EXISTING';
  }

  // Meaning differs despite identical structured tokens -> uncertain equivalence
  // SPEC03 §32: Never silently merge uncertain semantics.
  return 'REVIEW_REQUIRED';
}

/**
 * Asserts that a proposed Proposition does not attempt an unsafe merge.
 */
export function validateSemanticMergeSafety(
  candidate: PropositionSemanticIdentity,
  existing: PropositionSemanticIdentity,
): void {
  const outcome = evaluateSemanticEquivalence(candidate, existing);
  if (outcome !== 'REUSE_EXISTING') {
    throw new RegistryValidationError(
      'UNSAFE_SEMANTIC_PROPOSITION_MERGE',
      `Cannot merge candidate proposition into existing proposition. Material differences detected: outcome is ${outcome}.`,
    );
  }
}
