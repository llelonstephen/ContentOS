import {
  validateArchitectureClosure,
  validateGenerationContext,
  type ChannelArchitectureCapability,
  type AudienceStateView,
  type ContentArchitectureView,
  type ContentUnitView,
  type GenerationContextAdmission,
  type JsonValue,
  type StrategyGateResult,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';
import { isolateProviderJsonContext } from './content-generation-context-builder.js';
import type { MinimizedArchitectureContext } from '../../persistence/relational/services/architecture-context-reference-resolver.js';
import type { CanonicalSupplementalPropositionResolver } from '../../persistence/relational/services/canonical-supplemental-proposition-resolver.js';
import type {
  ArchitectureCommitAuthority,
  ContentArchitecturePersistenceService,
} from '../../persistence/relational/services/content-architecture-persistence-service.js';

export interface ArchitectureGenerationRequest {
  readonly authority: ArchitectureCommitAuthority;
  readonly request_identity: string;
  readonly architecture_slot: string;
  readonly task_revision_id: string;
  readonly strategy_id: string;
}

export interface ArchitectureGenerationInput {
  readonly audience: AudienceStateView;
  readonly strategy: StrategyHypothesisView;
  readonly gate_result: StrategyGateResult;
  readonly channel: ChannelArchitectureCapability;
  readonly context: MinimizedArchitectureContext;
  readonly decision_boundary: Date;
}

export interface ArchitectureInputResolver {
  resolveAuthorizedInputs(request: ArchitectureGenerationRequest): Promise<ArchitectureGenerationInput>;
}

export interface ArchitectureProposal {
  readonly supersedes_architecture_id?: string | null;
  readonly units: readonly Omit<ContentUnitView, 'unit_id' | 'created_at'>[];
}

export interface ArchitectureProposalProvider {
  generateArchitectureProposal(context: {
    readonly manifest: readonly {
      readonly context_item_id: string;
      readonly layer: GenerationContextAdmission['items'][number]['layer'];
      readonly attribution: GenerationContextAdmission['items'][number]['attribution'];
    }[];
    readonly values: readonly JsonValue[];
  }): Promise<ArchitectureProposal>;
}

export interface ArchitectureIdentityFactory {
  nextArchitectureId(): string;
  nextUnitId(position: number): string;
  now(): Date;
}

export class GenerateContentArchitecture {
  constructor(
    private readonly resolver: ArchitectureInputResolver,
    private readonly provider: ArchitectureProposalProvider,
    private readonly persistence: ContentArchitecturePersistenceService,
    private readonly identity: ArchitectureIdentityFactory,
    private readonly supplementalProofs: CanonicalSupplementalPropositionResolver,
  ) {}

  async execute(request: ArchitectureGenerationRequest): Promise<ContentArchitectureView> {
    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    if (resolved.strategy.strategy_id !== request.strategy_id) {
      throw new Error('Architecture generation resolved a different StrategyHypothesis');
    }
    validateGenerationContext(resolved.context.admission);
    if (resolved.context.values.length !== resolved.context.admission.items.length) {
      throw new Error('Architecture context values do not match the admitted exact-reference manifest');
    }
    const proposal = await this.provider.generateArchitectureProposal({
      manifest: resolved.context.admission.items.map((item) => ({
        context_item_id: item.context_item_id,
        layer: item.layer,
        attribution: item.attribution,
      })),
      values: resolved.context.values.map(isolateProviderJsonContext),
    });
    const createdAt = this.identity.now();
    const units: ContentUnitView[] = proposal.units.map((unit) => ({
      ...unit,
      unit_id: this.identity.nextUnitId(unit.position),
      created_at: createdAt,
    }));
    const strategyPropositions = new Set(resolved.strategy.required_proposition_ids);
    const supplementalIds = [...new Set(units.flatMap(({ proposition_ids }) => proposition_ids)
      .filter((id) => !strategyPropositions.has(id)))];
    const admittedSupplemental = await this.supplementalProofs.resolve({
      tenant_id: request.authority.tenant_id,
      workspace_id: request.authority.workspace_id,
      task_revision_id: request.task_revision_id,
      decision_boundary: resolved.decision_boundary,
      audience: resolved.audience,
      strategy: resolved.strategy,
      proposition_ids: supplementalIds,
    });
    const architecture: ContentArchitectureView = {
      architecture_id: this.identity.nextArchitectureId(),
      ...(proposal.supersedes_architecture_id
        ? { supersedes_architecture_id: proposal.supersedes_architecture_id }
        : {}),
      task_revision_id: request.task_revision_id,
      strategy_id: request.strategy_id,
      unit_ids: units.map(({ unit_id }) => unit_id),
      created_at: createdAt,
    };
    validateArchitectureClosure(architecture, resolved.strategy, units, {
      expected_task_revision_id: request.task_revision_id,
      gate_result: resolved.gate_result,
      channel: resolved.channel,
    });
    const committed = await this.persistence.commit({
      authority: request.authority,
      request_identity: request.request_identity,
      architecture_slot: request.architecture_slot,
      architecture,
      units,
      strategy: resolved.strategy,
      gate_result: resolved.gate_result,
      channel: resolved.channel,
      supplemental_propositions: admittedSupplemental,
    });
    return committed.architecture;
  }
}
