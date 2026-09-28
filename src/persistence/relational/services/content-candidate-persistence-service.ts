import {
  validateCandidateClosure,
  type ContentArchitectureView,
  type ContentCandidateView,
  type StrategyHypothesisView,
} from '../../../domain/content/index.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';

export interface CandidateCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface ContentCandidateCommitRequest {
  readonly authority: CandidateCommitAuthority;
  readonly request_identity: string;
  readonly variant_slot: string;
  readonly candidate: ContentCandidateView;
  readonly strategy: StrategyHypothesisView;
  readonly architecture: ContentArchitectureView;
  readonly parent_candidate?: ContentCandidateView;
  readonly payload_is_valid: (candidate: ContentCandidateView) => boolean;
  readonly generation_config?: PinnedGenerationConfig;
}

export interface ContentCandidateAtomicCommitPort {
  commitContentCandidate(request: ContentCandidateCommitRequest): Promise<ContentCandidateView>;
}

export class ContentCandidatePersistenceService {
  constructor(private readonly commitPort: ContentCandidateAtomicCommitPort) {}

  async commit(request: ContentCandidateCommitRequest): Promise<ContentCandidateView> {
    assertContentRuntimeCommitAuthority(
      request.authority,
      request.parent_candidate ? 'CANDIDATE_REWRITE' : 'CANDIDATE_GENERATE',
    );
    if (!request.variant_slot.trim() || !request.request_identity.trim()) {
      throw new Error('Candidate commit requires an intentional variant slot and request identity');
    }
    validateCandidateClosure(request.candidate, request.strategy, request.architecture, {
      expected_task_revision_id: request.candidate.task_revision_id,
      expected_run_config_id: request.authority.run_config_id,
      admitted_strategy_id: request.strategy.strategy_id,
      payload_is_valid: request.payload_is_valid,
      ...(request.parent_candidate ? { parent_candidate: request.parent_candidate } : {}),
      inherited_authority_kinds: [],
    });
    const committed = await this.commitPort.commitContentCandidate(request);
    if (committed.candidate_id !== request.candidate.candidate_id) {
      throw new Error('Candidate atomic commit returned a different immutable identity');
    }
    return committed;
  }
}
