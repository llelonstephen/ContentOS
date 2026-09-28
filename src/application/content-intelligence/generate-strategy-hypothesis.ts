import {
  assertFinalAudienceForTask,
  validateStrategyGrounding,
  type AudienceStateView,
  type JsonValue,
  type StrategyFactualBasis,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';
import { isolateProviderJsonContext } from './content-generation-context-builder.js';
import type {
  StrategyCommitAuthority,
  StrategyHypothesisPersistenceService,
} from '../../persistence/relational/services/strategy-hypothesis-persistence-service.js';

export type StrategyHypothesisProposal = Omit<
  StrategyHypothesisView,
  'strategy_id' | 'task_revision_id' | 'audience_state_id' | 'created_at'
>;

export interface StrategyProposalEnvelope {
  readonly strategy: StrategyHypothesisProposal;
  readonly factual_bases: readonly StrategyFactualBasis[];
}

export interface StrategyGenerationRequest {
  readonly authority: StrategyCommitAuthority;
  readonly request_identity: string;
  readonly task_revision_id: string;
  readonly audience_state_id: string;
  readonly strategy_slot: string;
}

export interface ResolvedStrategyGenerationInput {
  readonly audience: AudienceStateView;
  readonly available_proposition_ids: readonly string[];
  readonly provider_context: JsonValue;
}

export interface StrategyGenerationInputResolver {
  resolveAuthorizedInputs(
    request: StrategyGenerationRequest,
  ): Promise<ResolvedStrategyGenerationInput>;
}

export interface StrategyProposalProvider {
  generateStrategyProposal(context: unknown): Promise<StrategyProposalEnvelope>;
}

export interface StrategyIdentityFactory {
  nextStrategyId(): string;
  now(): Date;
}

export class GenerateStrategyHypothesis {
  constructor(
    private readonly resolver: StrategyGenerationInputResolver,
    private readonly provider: StrategyProposalProvider,
    private readonly persistence: StrategyHypothesisPersistenceService,
    private readonly identity: StrategyIdentityFactory,
  ) {}

  async execute(request: StrategyGenerationRequest): Promise<StrategyHypothesisView> {
    if (request.strategy_slot.trim().length === 0) {
      throw new Error('Strategy generation requires a non-empty strategySlot');
    }
    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    if (resolved.audience.audience_state_id !== request.audience_state_id) {
      throw new Error('Strategy generation resolved a different AudienceState');
    }
    assertFinalAudienceForTask(resolved.audience, request.task_revision_id);

    // Model/provider execution happens before the short atomic commit boundary.
    const proposal = await this.provider.generateStrategyProposal(
      isolateProviderJsonContext(resolved.provider_context),
    );
    const strategy: StrategyHypothesisView = {
      ...proposal.strategy,
      strategy_id: this.identity.nextStrategyId(),
      task_revision_id: request.task_revision_id,
      audience_state_id: request.audience_state_id,
      created_at: this.identity.now(),
    };
    validateStrategyGrounding(strategy, {
      task_revision_id: request.task_revision_id,
      audience: resolved.audience,
      available_proposition_ids: resolved.available_proposition_ids,
      factual_bases: proposal.factual_bases,
    });

    return this.persistence.commit({
      authority: request.authority,
      request_identity: request.request_identity,
      strategy_slot: request.strategy_slot,
      strategy,
      audience: resolved.audience,
      available_proposition_ids: resolved.available_proposition_ids,
      factual_bases: proposal.factual_bases,
    });
  }
}
