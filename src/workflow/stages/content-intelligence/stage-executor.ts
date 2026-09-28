import {
  assertStageOutputAllowed,
  requiredSlotName,
  type ContentOutputKind,
  type ContentRuntimeStage,
  type ContentStageSlot,
} from '../../../domain/content/index.js';

export interface ContentStageCommand<T> {
  readonly stage: ContentRuntimeStage;
  readonly output_kind: ContentOutputKind;
  readonly slot?: ContentStageSlot;
  readonly run_provider_phase: () => Promise<T>;
  readonly commit_phase: (validated: T) => Promise<string>;
}

/**
 * Enforces the provider-outside-transaction sequence. The injected commit phase
 * must be the short fenced persistence boundary; this executor exposes no SQL.
 */
export class ContentIntelligenceStageExecutor {
  async execute<T>(command: ContentStageCommand<T>): Promise<string> {
    assertStageOutputAllowed(command.stage, command.output_kind);
    const required = requiredSlotName(command.stage);
    if (required && (command.slot?.name !== required || !command.slot.value.trim())) {
      throw new Error(`Stage '${command.stage}' requires a non-empty ${required}`);
    }
    if (!required && command.slot) {
      throw new Error(`Stage '${command.stage}' does not accept a variant slot`);
    }
    const providerResult = await command.run_provider_phase();
    return command.commit_phase(providerResult);
  }
}
