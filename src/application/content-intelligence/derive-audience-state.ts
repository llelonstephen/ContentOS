import {
  validateAudienceState,
  type AudienceStateStage,
  type AudienceStateView,
  type JsonValue,
} from '../../domain/content/index.js';
import { isolateProviderJsonContext } from './content-generation-context-builder.js';
import type {
  AudienceCommitAuthority,
  AudienceGovernanceRefreshEvidence,
  AudienceStatePersistenceService,
} from '../../persistence/relational/services/audience-state-persistence-service.js';
import type { M4GenerationPinResolver } from '../../persistence/relational/services/content-runtime-run-config-resolver.js';
import type { PinnedGenerationConfig } from './content-generation-context-builder.js';

export type AudienceStateProposal = Omit<
  AudienceStateView,
  'audience_state_id' | 'task_revision_id' | 'state_stage' | 'created_at'
>;

export interface AudienceDerivationRequest {
  readonly authority: AudienceCommitAuthority;
  readonly request_identity: string;
  readonly task_revision_id: string;
  readonly target_stage: AudienceStateStage;
  readonly previous_audience_state_id?: string;
}

export interface ResolvedAudienceDerivationInput {
  readonly previous_state?: AudienceStateView;
  readonly provider_context: JsonValue;
  readonly material_governance_dependencies_changed: boolean;
  readonly governance_refresh?: Omit<AudienceGovernanceRefreshEvidence, 'audience_state_id'>;
}

export interface AudienceDerivationInputResolver {
  resolveAuthorizedInputs(
    request: AudienceDerivationRequest,
  ): Promise<ResolvedAudienceDerivationInput>;
}

export interface AudienceProposalProvider {
  generateAudienceProposal(context: unknown, pins: PinnedGenerationConfig): Promise<AudienceStateProposal>;
}

export interface AudienceIdentityFactory {
  nextAudienceStateId(): string;
  now(): Date;
}

export class DeriveAudienceState {
  constructor(
    private readonly resolver: AudienceDerivationInputResolver,
    private readonly provider: AudienceProposalProvider,
    private readonly persistence: AudienceStatePersistenceService,
    private readonly identity: AudienceIdentityFactory,
    private readonly generationPins: M4GenerationPinResolver,
  ) {}

  async execute(request: AudienceDerivationRequest): Promise<AudienceStateView> {
    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    const previous = resolved.previous_state;
    if (request.previous_audience_state_id !== previous?.audience_state_id) {
      throw new Error('Audience derivation did not resolve the exact requested previous state');
    }

    // Provider work deliberately completes before the atomic persistence call.
    const pins = await this.generationPins.resolve(request.authority);
    const proposal = await this.provider.generateAudienceProposal(
      isolateProviderJsonContext(resolved.provider_context), pins,
    );
    const state: AudienceStateView = {
      ...proposal,
      audience_state_id: this.identity.nextAudienceStateId(),
      task_revision_id: request.task_revision_id,
      state_stage: request.target_stage,
      created_at: this.identity.now(),
    };
    validateAudienceState(state, {
      expected_task_revision_id: request.task_revision_id,
      expected_stage: request.target_stage,
      ...(previous ? { previous_state: previous } : {}),
    });

    return this.persistence.commit({
      authority: request.authority,
      request_identity: request.request_identity,
      state,
      generation_config: pins,
      ...(previous ? { previous_state: previous } : {}),
      material_governance_dependencies_changed:
        resolved.material_governance_dependencies_changed,
      ...(resolved.governance_refresh
        ? {
            governance_refresh: {
              ...resolved.governance_refresh,
              audience_state_id: state.audience_state_id,
            },
          }
        : {}),
    });
  }
}
