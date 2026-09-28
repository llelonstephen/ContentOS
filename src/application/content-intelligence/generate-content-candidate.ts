import {
  validateCandidateClosure,
  validateGenerationContext,
  validateMeaningPreservation,
  type ContentArchitectureView,
  type ContentCandidateView,
  type GenerationContextAdmission,
  type JsonValue,
  type MeaningPreservationInput,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';
import type {
  ContentIntelligenceProvider,
  PinnedProviderRequest,
} from '../../providers/models/content-intelligence-provider.js';
import { assertPinnedProviderRequest } from '../../providers/models/content-intelligence-provider.js';
import type {
  CandidateCommitAuthority,
  ContentCandidatePersistenceService,
} from '../../persistence/relational/services/content-candidate-persistence-service.js';

export interface CandidateGenerationRequest {
  readonly authority: CandidateCommitAuthority;
  readonly request_identity: string;
  readonly variant_slot: string;
  readonly task_revision_id: string;
  readonly strategy_id: string;
  readonly architecture_id: string;
  readonly audience_state_id: string;
  readonly parent_candidate_id?: string;
}

export interface CandidateGenerationInput {
  readonly strategy: StrategyHypothesisView;
  readonly architecture: ContentArchitectureView;
  readonly context_admission: GenerationContextAdmission;
  readonly provider_request: PinnedProviderRequest;
  readonly meaning: MeaningPreservationInput;
  readonly payload_is_valid: (payload: JsonValue) => boolean;
  readonly parent_candidate?: ContentCandidateView;
}

export interface CandidateInputResolver {
  resolveAuthorizedInputs(request: CandidateGenerationRequest): Promise<CandidateGenerationInput>;
}

export interface CandidateIdentityFactory {
  nextCandidateId(): string;
  now(): Date;
}

export class GenerateContentCandidate {
  constructor(
    private readonly resolver: CandidateInputResolver,
    private readonly provider: ContentIntelligenceProvider,
    private readonly persistence: ContentCandidatePersistenceService,
    private readonly identity: CandidateIdentityFactory,
  ) {}

  async execute(request: CandidateGenerationRequest): Promise<ContentCandidateView> {
    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    if (
      resolved.strategy.strategy_id !== request.strategy_id ||
      resolved.architecture.architecture_id !== request.architecture_id ||
      resolved.provider_request.canonical_input_hash !== request.authority.canonical_input_hash ||
      (request.parent_candidate_id ?? null) !==
        (resolved.parent_candidate?.candidate_id ?? null)
    ) {
      throw new Error('Candidate generation resolved stale or mismatched exact inputs');
    }
    validateGenerationContext(resolved.context_admission);
    assertPinnedProviderRequest(resolved.provider_request);
    validateMeaningPreservation(resolved.meaning);
    const payload = await this.provider.generate(resolved.provider_request);
    if (!resolved.payload_is_valid(payload)) {
      throw new Error('GENERATION_OUTPUT_MALFORMED');
    }
    const candidate: ContentCandidateView = {
      candidate_id: this.identity.nextCandidateId(),
      task_revision_id: request.task_revision_id,
      strategy_id: request.strategy_id,
      architecture_id: request.architecture_id,
      content_payload: payload,
      run_config_id: request.authority.run_config_id,
      ...(request.parent_candidate_id
        ? { parent_candidate_id: request.parent_candidate_id }
        : {}),
      created_at: this.identity.now(),
    };
    validateCandidateClosure(candidate, resolved.strategy, resolved.architecture, {
      expected_task_revision_id: request.task_revision_id,
      expected_run_config_id: request.authority.run_config_id,
      admitted_strategy_id: request.strategy_id,
      payload_is_valid: ({ content_payload }) => resolved.payload_is_valid(content_payload),
      ...(resolved.parent_candidate ? { parent_candidate: resolved.parent_candidate } : {}),
    });
    return this.persistence.commit({
      authority: request.authority,
      request_identity: request.request_identity,
      variant_slot: request.variant_slot,
      candidate,
      strategy: resolved.strategy,
      architecture: resolved.architecture,
      ...(resolved.parent_candidate ? { parent_candidate: resolved.parent_candidate } : {}),
      payload_is_valid: ({ content_payload }) => resolved.payload_is_valid(content_payload),
      generation_config: {
        prompt_revision_id: resolved.provider_request.prompt_revision_id,
        model_revision_id: resolved.provider_request.model_revision_id,
        tool_revision_ids: resolved.provider_request.tool_revision_ids,
        schema_revision_id: resolved.provider_request.schema_revision_id,
      },
    });
  }
}
