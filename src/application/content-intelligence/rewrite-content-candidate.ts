import {
  classifyDependencyInvalidation,
  type ContentCandidateView,
  type MaterialChangeKind,
} from '../../domain/content/index.js';
import type { GenerateContentCandidate } from './generate-content-candidate.js';

export interface CandidateRewriteRequest {
  readonly parent: ContentCandidateView;
  readonly changes: readonly MaterialChangeKind[];
  readonly human_input_contains_new_fact: boolean;
  readonly generation_request: Parameters<GenerateContentCandidate['execute']>[0];
}

export class RewriteContentCandidate {
  constructor(private readonly generator: GenerateContentCandidate) {}

  async execute(request: CandidateRewriteRequest): Promise<ContentCandidateView> {
    if (request.human_input_contains_new_fact) {
      throw new Error('Human factual information must enter the upstream knowledge path');
    }
    const invalidation = classifyDependencyInvalidation(request.changes, 'OPEN');
    if (invalidation.invalidated_stages.some((stage) =>
      stage === 'AUDIENCE' || stage === 'STRATEGY' || stage === 'STRATEGY_GATE' || stage === 'ARCHITECTURE')) {
      throw new Error('Rewrite requires upstream regeneration before Candidate generation');
    }
    const candidate = await this.generator.execute({
      ...request.generation_request,
      parent_candidate_id: request.parent.candidate_id,
    });
    if (candidate.candidate_id === request.parent.candidate_id) {
      throw new Error('Candidate rewrite must create a new immutable candidate_id');
    }
    if (candidate.parent_candidate_id !== request.parent.candidate_id) {
      throw new Error('Candidate rewrite persistence lost exact parent lineage');
    }
    return candidate;
  }
}
