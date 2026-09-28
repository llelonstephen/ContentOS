import type { JsonValue } from '../../domain/content/index.js';

export interface PinnedProviderRequest {
  readonly prompt_revision_id: string;
  readonly model_revision_id: string;
  readonly tool_revision_ids: readonly string[];
  readonly schema_revision_id: string;
  readonly canonical_input_hash: string;
  readonly system_control: JsonValue;
  readonly canonical_decision_data: JsonValue;
  readonly untrusted_source_content: JsonValue;
  readonly optional_style_examples: JsonValue;
}

export interface ContentIntelligenceProvider {
  generate(request: PinnedProviderRequest): Promise<JsonValue>;
}

/** Provider capability is intentionally generation-only: no database or side-effect ports. */
export function assertPinnedProviderRequest(request: PinnedProviderRequest): void {
  if (
    !request.prompt_revision_id || !request.model_revision_id ||
    !request.schema_revision_id || !request.canonical_input_hash
  ) {
    throw new Error('Generation provider requires exact pinned prompt/model/schema and input hash');
  }
  if (new Set(request.tool_revision_ids).size !== request.tool_revision_ids.length) {
    throw new Error('Pinned provider tool revisions must be unique');
  }
}
