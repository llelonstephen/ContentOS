import {
  validateAudienceState,
  type AudienceStateView,
} from '../../../domain/content/index.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';

export interface AudienceCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface AudienceGovernanceRefreshEvidence {
  readonly governance_snapshot_id: string;
  readonly audience_state_id: string;
  readonly dependency_fingerprint: string;
}

export interface AudienceStateCommitRequest {
  readonly authority: AudienceCommitAuthority;
  readonly request_identity: string;
  readonly state: AudienceStateView;
  readonly generation_config: PinnedGenerationConfig;
  readonly previous_state?: AudienceStateView;
  readonly material_governance_dependencies_changed: boolean;
  readonly governance_refresh?: AudienceGovernanceRefreshEvidence;
}

/**
 * Phase-02 adapter boundary. Implementations must fence, deduplicate, insert the
 * immutable state, output ref, audit event, and outbox event in one transaction.
 */
export interface AudienceStateAtomicCommitPort {
  commitAudienceState(request: AudienceStateCommitRequest): Promise<AudienceStateView>;
}

function requireValue(value: string, name: string): void {
  if (value.trim().length === 0) throw new Error(`Audience commit requires ${name}`);
}

function sameAudienceEffect(left: AudienceStateView, right: AudienceStateView): boolean {
  const omitIdentity = ({ audience_state_id: _id, created_at: _created, ...value }: AudienceStateView) => value;
  return JSON.stringify(omitIdentity(left)) === JSON.stringify(omitIdentity(right));
}

export class AudienceStatePersistenceService {
  constructor(private readonly commitPort: AudienceStateAtomicCommitPort) {}

  async commit(request: AudienceStateCommitRequest): Promise<AudienceStateView> {
    const { authority, state, previous_state: previousState } = request;
    const expectedStage = {
      PROVISIONAL: 'AUDIENCE_PROVISIONAL',
      REFINED: 'AUDIENCE_REFINE',
      FINAL_FOR_DECISION: 'AUDIENCE_FINALIZE',
    } as const;
    assertContentRuntimeCommitAuthority(authority, expectedStage[state.state_stage]);
    if (!request.generation_config) throw new Error('Audience provider commit requires exact generation_config');
    for (const [name, value] of Object.entries({
      tenant_id: authority.tenant_id,
      workspace_id: authority.workspace_id,
      run_id: authority.run_id,
      decision_cycle_id: authority.decision_cycle_id,
      stage_execution_id: authority.stage_execution_id,
      run_config_id: authority.run_config_id,
      canonical_input_hash: authority.canonical_input_hash,
      request_identity: request.request_identity,
    })) requireValue(value, name);
    validateAudienceState(state, {
      expected_task_revision_id: state.task_revision_id,
      ...(previousState ? { previous_state: previousState } : {}),
    });
    if (state.state_stage !== 'PROVISIONAL' && !previousState) {
      throw new Error(`${state.state_stage} AudienceState requires an exact previous state`);
    }
    if (
      state.state_stage === 'FINAL_FOR_DECISION' &&
      request.material_governance_dependencies_changed
    ) {
      const refresh = request.governance_refresh;
      if (
        !refresh?.governance_snapshot_id ||
        !refresh.dependency_fingerprint ||
        refresh.audience_state_id !== state.audience_state_id
      ) {
        throw new Error(
          'FINAL_FOR_DECISION audience with changed governance dependencies requires bound refresh evidence',
        );
      }
    }

    const committed = await this.commitPort.commitAudienceState(request);
    if (
      committed.task_revision_id !== state.task_revision_id ||
      committed.state_stage !== state.state_stage ||
      !sameAudienceEffect(committed, state)
    ) {
      throw new Error('Audience atomic commit returned a different canonical state');
    }
    return committed;
  }
}
