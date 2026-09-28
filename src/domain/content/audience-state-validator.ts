import { failContent } from './content-error-codes.js';
import {
  AUDIENCE_STATE_STAGES,
  type AudienceStateStage,
  type AudienceStateView,
} from './types.js';

export interface AudienceValidationContext {
  readonly expected_task_revision_id: string;
  readonly expected_stage?: AudienceStateStage;
  readonly previous_state?: AudienceStateView;
}

function stageIndex(stage: AudienceStateStage): number {
  return AUDIENCE_STATE_STAGES.indexOf(stage);
}

export function validateAudienceTransition(
  previous: AudienceStateView,
  next: AudienceStateView,
): void {
  if (previous.audience_state_id === next.audience_state_id) {
    failContent('AUDIENCE_TRANSITION_INVALID', 'Audience refinement must create a new immutable ID');
  }
  if (previous.task_revision_id !== next.task_revision_id) {
    failContent('AUDIENCE_TASK_MISMATCH', 'Audience transition cannot change its Task revision');
  }
  if (stageIndex(next.state_stage) <= stageIndex(previous.state_stage)) {
    failContent(
      'AUDIENCE_TRANSITION_INVALID',
      `Audience stage must advance from '${previous.state_stage}', received '${next.state_stage}'`,
    );
  }
}

export function validateAudienceState(
  audience: AudienceStateView,
  context: AudienceValidationContext,
): void {
  if (!AUDIENCE_STATE_STAGES.includes(audience.state_stage)) {
    failContent('AUDIENCE_STAGE_INVALID', `Unknown AudienceState stage '${audience.state_stage}'`);
  }
  if (audience.task_revision_id !== context.expected_task_revision_id) {
    failContent('AUDIENCE_TASK_MISMATCH', 'AudienceState belongs to a different Task revision');
  }
  if (context.expected_stage !== undefined && audience.state_stage !== context.expected_stage) {
    failContent(
      'AUDIENCE_STAGE_INVALID',
      `Expected '${context.expected_stage}', received '${audience.state_stage}'`,
    );
  }
  if (!Array.isArray(audience.origin) || audience.origin.length === 0) {
    failContent('AUDIENCE_ORIGIN_MISSING', 'AudienceState must identify at least one canonical origin');
  }
  if (audience.origin.some((origin) => !origin.kind || !origin.reference_id)) {
    failContent('AUDIENCE_ORIGIN_MISSING', 'Every AudienceState origin must be attributable');
  }
  if (!Array.isArray(audience.uncertainty)) {
    failContent('AUDIENCE_UNCERTAINTY_MISSING', 'AudienceState uncertainty must be explicit');
  }
  if (audience.uncertainty.some((item) => !item.kind || !item.description)) {
    failContent('AUDIENCE_UNCERTAINTY_MISSING', 'AudienceState uncertainty entries must be explicit');
  }
  if (context.previous_state !== undefined) {
    validateAudienceTransition(context.previous_state, audience);
  }
}

export function assertFinalAudienceForTask(
  audience: AudienceStateView,
  taskRevisionId: string,
): void {
  validateAudienceState(audience, {
    expected_task_revision_id: taskRevisionId,
    expected_stage: 'FINAL_FOR_DECISION',
  });
}
