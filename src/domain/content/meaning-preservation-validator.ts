import { failContent } from './content-error-codes.js';

export type SemanticClassification = 'FACT' | 'ASSUMPTION' | 'UNKNOWN';

export interface CandidateMeaningStatement {
  readonly statement_id: string;
  readonly source_classification: SemanticClassification;
  readonly rendered_classification: SemanticClassification;
}

export interface GovernanceMeaningConstraint {
  readonly constraint_id: string;
  readonly hard_requirement: boolean;
  readonly preserved: boolean;
}

export interface MeaningPreservationInput {
  readonly statements: readonly CandidateMeaningStatement[];
  readonly governance_constraints: readonly GovernanceMeaningConstraint[];
}

export function validateMeaningPreservation(input: MeaningPreservationInput): void {
  if (input.statements.some(
    (item) => item.source_classification === 'ASSUMPTION' && item.rendered_classification === 'FACT',
  )) {
    failContent('MEANING_ASSUMPTION_PROMOTED', 'Candidate promoted an assumption to fact');
  }
  if (input.statements.some(
    (item) => item.source_classification === 'UNKNOWN' && item.rendered_classification === 'FACT',
  )) {
    failContent('MEANING_UNKNOWN_PROMOTED', 'Candidate promoted an unknown to fact');
  }
  if (input.governance_constraints.some((item) => item.hard_requirement && !item.preserved)) {
    failContent('MEANING_HARD_RULE_WEAKENED', 'Candidate weakened a hard governance requirement');
  }
}
