import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { AudienceAdmissionEvidence } from '../../../domain/content/audience-admission-types.js';
import {
  validateAudienceState,
  type AudienceStateView,
} from '../../../domain/content/index.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';
import type { AudienceSchemaBindingAuthority } from './audience-derivation-authority-resolver.js';

export interface AudienceCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface AudienceGovernanceRefreshEvidence {
  readonly governance_snapshot_id: string;
  readonly audience_state_id: string;
  readonly dependency_fingerprint: string;
}

export interface AudienceDerivationAuthorityMetadata {
  readonly audience_knowledge_cutoff_time: string;
  readonly derivation_manifest: Readonly<Record<string, unknown>>;
  readonly derivation_manifest_hash: string;
  readonly schema_binding: AudienceSchemaBindingAuthority;
  readonly audience_admission_hash?: string;
}

interface AudienceFactBasisCommon {
  readonly audience_field: string;
  readonly fact_path: string;
  readonly fact_value_hash: string;
  readonly ordinal: number;
}

export type AudienceFactBasisLinkInput = AudienceFactBasisCommon & (
  | {
      readonly basis_kind: 'TASK_AUDIENCE_CONTEXT';
      readonly task_id: string;
      readonly task_revision_id: string;
      readonly task_audience_context_path: string;
      readonly task_audience_context_value_hash: string;
    }
  | {
      readonly basis_kind: 'AUDIENCE_EPISTEMIC_STATE';
      readonly proposition_id: string;
      readonly epistemic_state_id: string;
    }
);

export interface AudienceStateCommitRequest {
  readonly authority: AudienceCommitAuthority;
  readonly request_identity: string;
  readonly state: AudienceStateView;
  readonly generation_config: PinnedGenerationConfig;
  readonly previous_state?: AudienceStateView;
  readonly material_governance_dependencies_changed: boolean;
  readonly governance_refresh?: AudienceGovernanceRefreshEvidence;
  readonly derivation_authority?: AudienceDerivationAuthorityMetadata;
  readonly fact_basis_links?: readonly AudienceFactBasisLinkInput[];
  readonly audience_admission_hash?: string;
  readonly admission_evidence?: readonly AudienceAdmissionEvidence[];
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

export function requireAudienceDerivationAuthority(
  request: AudienceStateCommitRequest,
): {
  derivationAuthority: AudienceDerivationAuthorityMetadata;
  factBasisLinks: readonly AudienceFactBasisLinkInput[];
} {
  const derivationAuthority = request.derivation_authority;
  if (!derivationAuthority || !request.fact_basis_links) {
    throw new Error('Audience commit requires exact v1.0.4 derivation authority and fact basis links');
  }
  const cutoff = new Date(derivationAuthority.audience_knowledge_cutoff_time);
  if (!Number.isFinite(cutoff.getTime()) ||
      cutoff.toISOString() !== derivationAuthority.audience_knowledge_cutoff_time) {
    throw new Error('Audience commit requires a canonical UTC audience knowledge cutoff');
  }
  if (!derivationAuthority.derivation_manifest_hash.trim() ||
      Object.keys(derivationAuthority.derivation_manifest).length === 0) {
    throw new Error('Audience commit requires a non-empty exact derivation manifest identity');
  }
  const binding = derivationAuthority.schema_binding;
  if (binding.run_config_id !== request.authority.run_config_id ||
      binding.role !== 'CONTENT_INTELLIGENCE_AUDIENCE' ||
      binding.schema_entity_type !== 'SchemaDefinition' ||
      binding.schema_revision_id !== request.generation_config.schema_revision_id) {
    throw new Error('Audience generation schema must equal the exact normalized role binding');
  }
  const unique = new Set<string>();
  for (const link of request.fact_basis_links) {
    // The empty JSON Pointer is the canonical path for a scalar surface root.
    if (!link.audience_field.trim() || typeof link.fact_path !== 'string' || !link.fact_value_hash.trim() ||
        !Number.isSafeInteger(link.ordinal) || link.ordinal < 0) {
      throw new Error('Audience fact basis link has invalid path, hash, or ordinal');
    }
    const branch = link.basis_kind === 'TASK_AUDIENCE_CONTEXT'
      ? `${link.task_id}\u0000${link.task_revision_id}\u0000${link.task_audience_context_path}`
      : `${link.proposition_id}\u0000${link.epistemic_state_id}`;
    const identity = `${link.audience_field}\u0000${link.fact_path}\u0000${link.basis_kind}\u0000${branch}`;
    if (unique.has(identity)) throw new Error('Audience fact basis identity must be unique');
    unique.add(identity);
  }
  return { derivationAuthority, factBasisLinks: request.fact_basis_links };
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
    if (state.state_stage === 'FINAL_FOR_DECISION') {
      requireAudienceDerivationAuthority(request);
      const admissionHash = request.audience_admission_hash ?? request.derivation_authority?.audience_admission_hash;
      if (!admissionHash || typeof admissionHash !== 'string' || admissionHash.trim().length === 0) {
        throw new RegistryValidationError(
          'AUDIENCE_ADMISSION_HASH_REQUIRED',
          'FINAL_FOR_DECISION audience commit requires a non-empty audience_admission_hash',
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
