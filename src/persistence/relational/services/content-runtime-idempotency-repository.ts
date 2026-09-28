import { createHash } from 'node:crypto';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export const CONTENT_RUNTIME_SLOT_KINDS = [
  'strategySlot',
  'architectureSlot',
  'variantSlot',
] as const;

export type ContentRuntimeSlotKind = (typeof CONTENT_RUNTIME_SLOT_KINDS)[number];

export interface ContentRuntimeSlot {
  kind: ContentRuntimeSlotKind;
  value: string;
}

export interface ContentRuntimeIdentityInput {
  tenantId: string;
  workspaceId?: string | null;
  runId: string;
  decisionCycleId: string;
  cycleEpoch: number;
  stageName: string;
  slot?: ContentRuntimeSlot | null;
  canonicalInput: unknown;
}

export interface ContentRuntimeIdempotencyIdentity {
  idempotencyKey: string;
  canonicalInputHash: string;
}

const SLOT_REQUIRED_STAGES: Readonly<Record<string, ContentRuntimeSlotKind>> = {
  STRATEGY_GENERATE: 'strategySlot',
  ARCHITECTURE_GENERATE: 'architectureSlot',
  CANDIDATE_GENERATE: 'variantSlot',
  CANDIDATE_REWRITE: 'variantSlot',
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'null' : encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

export function assertContentRuntimeSlot(stageName: string, slot?: ContentRuntimeSlot | null): void {
  const requiredKind = SLOT_REQUIRED_STAGES[stageName];
  if (!requiredKind) return;
  if (!slot || slot.kind !== requiredKind || slot.value.trim().length === 0) {
    throw new RegistryValidationError(
      'CONTENT_RUNTIME_SLOT_REQUIRED',
      `Stage '${stageName}' requires a non-empty '${requiredKind}' in its canonical identity.`,
    );
  }
}

export function createContentRuntimeIdempotencyIdentity(
  input: ContentRuntimeIdentityInput,
): ContentRuntimeIdempotencyIdentity {
  assertContentRuntimeSlot(input.stageName, input.slot);
  const envelope = {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId ?? null,
    runId: input.runId,
    decisionCycleId: input.decisionCycleId,
    cycleEpoch: input.cycleEpoch,
    stageName: input.stageName,
    slot: input.slot ?? null,
    canonicalInput: input.canonicalInput,
  };
  const canonicalInputHash = createHash('sha256').update(stableJson(envelope)).digest('hex');
  const keyMaterial = stableJson({ ...envelope, canonicalInput: undefined });
  const keyHash = createHash('sha256').update(keyMaterial).digest('hex');
  return { idempotencyKey: `m4:${keyHash}`, canonicalInputHash };
}

export function assertMatchingContentRuntimeIdentity(
  stored: { idempotency_key: string; canonical_input_hash: string },
  expected: ContentRuntimeIdempotencyIdentity,
): void {
  if (stored.idempotency_key !== expected.idempotencyKey) {
    throw new RegistryValidationError(
      'IDEMPOTENCY_KEY_MISMATCH',
      'StageExecution idempotency key does not match the exact M4 request identity.',
    );
  }
  if (stored.canonical_input_hash !== expected.canonicalInputHash) {
    throw new RegistryValidationError(
      'IDEMPOTENCY_CONFLICT',
      'The M4 idempotency identity was previously used with a different canonical input hash.',
    );
  }
}
