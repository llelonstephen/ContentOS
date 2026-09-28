import {
  validateGenerationContext,
  type GenerationContextAdmission,
  type JsonValue,
} from '../../domain/content/index.js';
import {
  assertPinnedProviderRequest,
  type PinnedProviderRequest,
} from '../../providers/models/content-intelligence-provider.js';

export interface PinnedGenerationConfig {
  readonly prompt_revision_id: string;
  readonly model_revision_id: string;
  readonly tool_revision_ids: readonly string[];
  readonly schema_revision_id: string;
}

export interface GenerationLayers {
  readonly system_control: JsonValue;
  readonly canonical_decision_data: JsonValue;
  readonly untrusted_source_content: JsonValue;
  readonly optional_style_examples: JsonValue;
}

function assertJsonValue(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`);
    return;
  }
  throw new Error(`Generation context '${path}' is not inert JSON data`);
}

/** Produces a detached data-only snapshot; handles, functions, and class instances fail closed. */
export function isolateProviderJsonContext(value: JsonValue): JsonValue {
  assertJsonValue(value, '$');
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function buildPinnedGenerationRequest(
  admission: GenerationContextAdmission,
  config: PinnedGenerationConfig,
  canonicalInputHash: string,
  layers: GenerationLayers,
): PinnedProviderRequest {
  validateGenerationContext(admission);
  const request: PinnedProviderRequest = {
    ...config,
    canonical_input_hash: canonicalInputHash,
    ...layers,
  };
  assertPinnedProviderRequest(request);
  return request;
}
