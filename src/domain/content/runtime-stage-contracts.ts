import { failContent } from './content-error-codes.js';

export const CONTENT_RUNTIME_STAGES = [
  'AUDIENCE_PROVISIONAL',
  'AUDIENCE_REFINE',
  'AUDIENCE_FINALIZE',
  'STRATEGY_GENERATE',
  'STRATEGY_GATE',
  'ARCHITECTURE_GENERATE',
  'CANDIDATE_GENERATE',
  'CANDIDATE_REWRITE',
  'SPEC06_HANDOFF',
] as const;

export type ContentRuntimeStage = (typeof CONTENT_RUNTIME_STAGES)[number];

export const CONTENT_OUTPUT_KINDS = [
  'AUDIENCE_STATE',
  'STRATEGY_HYPOTHESIS',
  'CONTENT_ARCHITECTURE',
  'CONTENT_CANDIDATE',
  'LOGICAL_RESULT',
  'HANDOFF_DTO',
] as const;

export type ContentOutputKind = (typeof CONTENT_OUTPUT_KINDS)[number];

export const ALLOWED_STAGE_OUTPUTS: Readonly<Record<ContentRuntimeStage, readonly ContentOutputKind[]>> = {
  AUDIENCE_PROVISIONAL: ['AUDIENCE_STATE'],
  AUDIENCE_REFINE: ['AUDIENCE_STATE'],
  AUDIENCE_FINALIZE: ['AUDIENCE_STATE'],
  STRATEGY_GENERATE: ['STRATEGY_HYPOTHESIS'],
  STRATEGY_GATE: ['LOGICAL_RESULT'],
  ARCHITECTURE_GENERATE: ['CONTENT_ARCHITECTURE'],
  CANDIDATE_GENERATE: ['CONTENT_CANDIDATE'],
  CANDIDATE_REWRITE: ['CONTENT_CANDIDATE'],
  SPEC06_HANDOFF: ['HANDOFF_DTO'],
};

export type ContentStageSlot =
  | { readonly name: 'strategySlot'; readonly value: string }
  | { readonly name: 'architectureSlot'; readonly value: string }
  | { readonly name: 'variantSlot'; readonly value: string };

export function assertStageOutputAllowed(
  stage: ContentRuntimeStage,
  outputKind: ContentOutputKind,
): void {
  if (!ALLOWED_STAGE_OUTPUTS[stage].includes(outputKind)) {
    failContent(
      'RUNTIME_STAGE_OUTPUT_INVALID',
      `Stage '${stage}' cannot produce '${outputKind}'`,
    );
  }
}

export function requiredSlotName(
  stage: ContentRuntimeStage,
): ContentStageSlot['name'] | undefined {
  if (stage === 'STRATEGY_GENERATE') return 'strategySlot';
  if (stage === 'ARCHITECTURE_GENERATE') return 'architectureSlot';
  if (stage === 'CANDIDATE_GENERATE' || stage === 'CANDIDATE_REWRITE') return 'variantSlot';
  return undefined;
}
