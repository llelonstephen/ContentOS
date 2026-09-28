import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  serializeCanonicalInput,
  type CanonicalInputManifest,
} from './canonical-input-serialization.js';
import { failContent } from './content-error-codes.js';
import {
  requiredSlotName,
  type ContentRuntimeStage,
  type ContentStageSlot,
} from './runtime-stage-contracts.js';
import type { ExactEntityRef, ExactRevisionRef, JsonValue } from './types.js';

export interface ContentRequestIdentityInput {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly run_id: string;
  readonly decision_cycle_id: string;
  readonly stage_name: ContentRuntimeStage;
  readonly slot?: ContentStageSlot;
  readonly exact_entity_refs: readonly ExactEntityRef[];
  readonly exact_revision_refs: readonly ExactRevisionRef[];
  readonly run_config_id: string;
  readonly canonical_input_hash: string;
}

function assertIdentityInput(input: ContentRequestIdentityInput): void {
  const required = requiredSlotName(input.stage_name);
  if (required !== input.slot?.name) {
    failContent(
      'CANONICAL_SERIALIZATION_INVALID',
      required
        ? `Stage '${input.stage_name}' requires slot '${required}'`
        : `Stage '${input.stage_name}' does not accept a generation slot`,
    );
  }
  if (input.slot !== undefined && input.slot.value.length === 0) {
    failContent('CANONICAL_SERIALIZATION_INVALID', 'Generation slot value must be non-empty');
  }

  const scalars = [
    input.tenant_id,
    input.workspace_id,
    input.run_id,
    input.decision_cycle_id,
    input.run_config_id,
    input.canonical_input_hash,
  ];
  if (scalars.some((value) => value.length === 0)) {
    failContent('CANONICAL_SERIALIZATION_INVALID', 'Request identity values must be non-empty');
  }
}

export function requestIdentityManifest(
  input: ContentRequestIdentityInput,
): CanonicalInputManifest {
  assertIdentityInput(input);
  const slot = input.slot === undefined
    ? null
    : [input.slot.name, input.slot.value] as unknown as JsonValue;
  const entityRefs = input.exact_entity_refs.map((ref) => ({
    entity_type: ref.entity_type,
    entity_id: ref.entity_id,
  }));
  const revisionRefs = input.exact_revision_refs.map((ref) => ({
    entity_type: ref.entity_type,
    stable_id: ref.stable_id,
    revision_id: ref.revision_id,
  }));

  return {
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields: [
      { name: 'tenant_id', kind: 'VALUE', value: input.tenant_id },
      { name: 'workspace_id', kind: 'VALUE', value: input.workspace_id },
      { name: 'run_id', kind: 'VALUE', value: input.run_id },
      { name: 'decision_cycle_id', kind: 'VALUE', value: input.decision_cycle_id },
      { name: 'stage_name', kind: 'VALUE', value: input.stage_name },
      { name: 'slot', kind: 'VALUE', value: slot },
      { name: 'exact_entity_refs', kind: 'SEMANTIC_SET', value: entityRefs },
      { name: 'exact_revision_refs', kind: 'SEMANTIC_SET', value: revisionRefs },
      { name: 'run_config_id', kind: 'VALUE', value: input.run_config_id },
      { name: 'canonical_input_hash', kind: 'VALUE', value: input.canonical_input_hash },
    ],
  };
}

export function serializeRequestIdentity(input: ContentRequestIdentityInput): string {
  return serializeCanonicalInput(requestIdentityManifest(input));
}

export function deriveRequestIdentity(input: ContentRequestIdentityInput): string {
  return `content-request.v1:${hashCanonicalInput(requestIdentityManifest(input))}`;
}
