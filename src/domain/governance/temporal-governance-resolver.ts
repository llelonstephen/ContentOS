/**
 * ContentOS — Temporal Governance Resolver
 *
 * Implements SPEC04 §18–§24, §147B:
 *   - Canonical target valid time: Task.intended_publication_time if present, else DecisionSnapshot.frozen_at.
 *   - Knowledge cutoff time: must be <= DecisionSnapshot.frozen_at.
 *   - Temporal eligibility for NormativeRuleRevision and GuidanceRevision.
 *   - Single canonical resolver used across all final applicability and governance paths.
 */
import { RegistryValidationError } from '../services/registry-validator.js';

export interface TemporalContextInput {
  intendedPublicationTime?: Date | string | null;
  frozenAt?: Date | string | null;
  knowledgeCutoffTime?: Date | string | null;
}

export interface NormativeRuleTemporalInput {
  ruleId: string;
  ruleRevisionId: string;
  validFrom: Date | string;
  knownFrom: Date | string;
  scheduledExpiration?: Date | string | null;
}

export interface GuidanceTemporalInput {
  guidanceId: string;
  guidanceRevisionId: string;
  effectiveFrom: Date | string;
  createdAt: Date | string;
  scheduledExpiration?: Date | string | null;
}

export class TemporalGovernanceResolver {
  /**
   * Resolves canonical target valid time (SPEC04 §19, §147B).
   * Task.intended_publication_time if present, else DecisionSnapshot.frozen_at.
   */
  static resolveTargetValidTime(input: {
    intendedPublicationTime?: Date | string | null;
    frozenAt?: Date | string | null;
  }): Date {
    if (input.intendedPublicationTime) {
      const pubDate = new Date(input.intendedPublicationTime);
      if (isNaN(pubDate.getTime())) {
        throw new RegistryValidationError('TEMPORAL_ELIGIBILITY_FAILED', 'Invalid intended_publication_time.');
      }
      return pubDate;
    }
    if (input.frozenAt) {
      const frozenDate = new Date(input.frozenAt);
      if (isNaN(frozenDate.getTime())) {
        throw new RegistryValidationError('TEMPORAL_ELIGIBILITY_FAILED', 'Invalid frozen_at timestamp.');
      }
      return frozenDate;
    }
    throw new RegistryValidationError(
      'TEMPORAL_ELIGIBILITY_FAILED',
      'Cannot resolve target_valid_time: both intended_publication_time and frozen_at are missing.',
    );
  }

  /**
   * Validates knowledge cutoff time against DecisionSnapshot.frozen_at (SPEC04 §20).
   */
  static validateKnowledgeCutoff(knowledgeCutoffTime: Date | string, frozenAt: Date | string): Date {
    const cutoffDate = new Date(knowledgeCutoffTime);
    const frozenDate = new Date(frozenAt);

    if (isNaN(cutoffDate.getTime()) || isNaN(frozenDate.getTime())) {
      throw new RegistryValidationError('TEMPORAL_ELIGIBILITY_FAILED', 'Invalid timestamp for cutoff or frozen_at.');
    }

    if (cutoffDate.getTime() > frozenDate.getTime()) {
      throw new RegistryValidationError(
        'TEMPORAL_ELIGIBILITY_FAILED',
        `knowledge_cutoff_time (${cutoffDate.toISOString()}) cannot be after DecisionSnapshot.frozen_at (${frozenDate.toISOString()}) (SPEC04 §20).`,
      );
    }

    return cutoffDate;
  }

  /**
   * Evaluates temporal eligibility of a NormativeRuleRevision (SPEC04 §21, §22, §23).
   */
  static isRuleEligible(
    rule: NormativeRuleTemporalInput,
    targetValidTime: Date,
    knowledgeCutoffTime: Date,
  ): { eligible: boolean; reason?: string } {
    const validFrom = new Date(rule.validFrom);
    const knownFrom = new Date(rule.knownFrom);

    // Rule must be known before or at cutoff time (SPEC04 §21, §23)
    if (knownFrom.getTime() > knowledgeCutoffTime.getTime()) {
      return {
        eligible: false,
        reason: `Rule revision '${rule.ruleRevisionId}' known_from (${knownFrom.toISOString()}) > cutoff (${knowledgeCutoffTime.toISOString()}). Future-known rules are prohibited (SPEC04 §23).`,
      };
    }

    // Rule must be valid at target valid time (SPEC04 §21, §22)
    if (validFrom.getTime() > targetValidTime.getTime()) {
      return {
        eligible: false,
        reason: `Rule revision '${rule.ruleRevisionId}' valid_from (${validFrom.toISOString()}) > target (${targetValidTime.toISOString()}).`,
      };
    }

    // If expiration exists, target time must be before expiration (SPEC04 §21)
    if (rule.scheduledExpiration) {
      const expiration = new Date(rule.scheduledExpiration);
      if (targetValidTime.getTime() >= expiration.getTime()) {
        return {
          eligible: false,
          reason: `Rule revision '${rule.ruleRevisionId}' expired at ${expiration.toISOString()} before target ${targetValidTime.toISOString()}.`,
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Evaluates temporal eligibility of a GuidanceRevision (SPEC04 §24).
   */
  static isGuidanceEligible(
    guidance: GuidanceTemporalInput,
    targetValidTime: Date,
    knowledgeCutoffTime?: Date,
  ): { eligible: boolean; reason?: string } {
    const effectiveFrom = new Date(guidance.effectiveFrom);
    const createdAt = new Date(guidance.createdAt);

    if (knowledgeCutoffTime && createdAt.getTime() > knowledgeCutoffTime.getTime()) {
      return {
        eligible: false,
        reason: `Guidance revision '${guidance.guidanceRevisionId}' created_at (${createdAt.toISOString()}) > cutoff (${knowledgeCutoffTime.toISOString()}).`,
      };
    }

    if (effectiveFrom.getTime() > targetValidTime.getTime()) {
      return {
        eligible: false,
        reason: `Guidance revision '${guidance.guidanceRevisionId}' effective_from (${effectiveFrom.toISOString()}) > target (${targetValidTime.toISOString()}).`,
      };
    }

    if (guidance.scheduledExpiration) {
      const expiration = new Date(guidance.scheduledExpiration);
      if (targetValidTime.getTime() >= expiration.getTime()) {
        return {
          eligible: false,
          reason: `Guidance revision '${guidance.guidanceRevisionId}' expired at ${expiration.toISOString()} before target ${targetValidTime.toISOString()}.`,
        };
      }
    }

    return { eligible: true };
  }
}
