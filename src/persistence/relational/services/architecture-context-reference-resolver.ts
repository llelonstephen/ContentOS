import {
  validateGenerationContext,
  type GenerationContextAdmission,
  type GenerationContextItem,
  type JsonValue,
} from '../../../domain/content/index.js';

export const ARCHITECTURE_CONTEXT_ENTITY_ALLOWLIST = new Set([
  'TaskContractRevision', 'AudienceState', 'StrategyHypothesis', 'Proposition',
  'EpistemicStateVersion', 'ApplicabilityAssessment', 'GuidanceRevision',
  'ChannelProfileRevision', 'RunConfig',
]);

export interface ScopedArchitectureContextSource {
  loadAuthorizedItems(input: {
    readonly tenant_id: string;
    readonly workspace_id: string;
    readonly exact_reference_ids: readonly string[];
  }): Promise<readonly { item: GenerationContextItem; value: JsonValue }[]>;
}

export interface MinimizedArchitectureContext {
  readonly admission: GenerationContextAdmission;
  readonly values: readonly JsonValue[];
}

/** The source port accepts exact refs only and never exposes a datastore handle. */
export class ArchitectureContextReferenceResolver {
  constructor(private readonly source: ScopedArchitectureContextSource) {}

  async resolve(input: {
    readonly tenant_id: string;
    readonly workspace_id: string;
    readonly exact_reference_ids: readonly string[];
    readonly authorized_tool_ids: readonly string[];
  }): Promise<MinimizedArchitectureContext> {
    if (!input.exact_reference_ids.length || new Set(input.exact_reference_ids).size !== input.exact_reference_ids.length) {
      throw new Error('Architecture context requires a unique, explicit exact-reference allowlist');
    }
    const resolved = await this.source.loadAuthorizedItems(input);
    if (resolved.length !== input.exact_reference_ids.length) {
      throw new Error('Architecture context source did not resolve the exact requested manifest');
    }
    for (const { item } of resolved) {
      const type = 'entity_type' in item.attribution
        ? item.attribution.entity_type : '';
      if (!ARCHITECTURE_CONTEXT_ENTITY_ALLOWLIST.has(type)) {
        throw new Error(`Architecture context type '${type}' is not decision-relevant allowlisted state`);
      }
    }
    const admission: GenerationContextAdmission = {
      tenant_id: input.tenant_id, workspace_id: input.workspace_id,
      authorized_tool_ids: input.authorized_tool_ids,
      items: resolved.map(({ item }) => item),
    };
    validateGenerationContext(admission);
    return { admission, values: resolved.map(({ value }) => value) };
  }
}
