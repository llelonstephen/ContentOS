import {
  admitSupplementalPropositions,
  validateArchitectureClosure,
  type ChannelArchitectureCapability,
  type ContentArchitectureView,
  type ContentUnitView,
  type StrategyGateResult,
  type StrategyHypothesisView,
  type SupplementalPropositionUse,
} from '../../../domain/content/index.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';

export interface ArchitectureCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface ContentArchitectureCommitRequest {
  readonly authority: ArchitectureCommitAuthority;
  readonly request_identity: string;
  readonly architecture_slot: string;
  readonly architecture: ContentArchitectureView;
  readonly units: readonly ContentUnitView[];
  readonly generation_config: PinnedGenerationConfig;
  readonly strategy: StrategyHypothesisView;
  readonly gate_result: StrategyGateResult;
  readonly channel: ChannelArchitectureCapability;
  readonly supplemental_propositions: readonly SupplementalPropositionUse[];
}

export interface ContentArchitectureAtomicCommitPort {
  commitContentArchitecture(request: ContentArchitectureCommitRequest): Promise<{
    readonly architecture: ContentArchitectureView;
    readonly units: readonly ContentUnitView[];
  }>;
}

function requireText(value: string, name: string): void {
  if (!value.trim()) throw new Error(`Architecture commit requires ${name}`);
}

export class ContentArchitecturePersistenceService {
  constructor(private readonly commitPort: ContentArchitectureAtomicCommitPort) {}

  async commit(request: ContentArchitectureCommitRequest): Promise<{
    readonly architecture: ContentArchitectureView;
    readonly units: readonly ContentUnitView[];
  }> {
    const { authority, architecture, strategy, units } = request;
    assertContentRuntimeCommitAuthority(authority, 'ARCHITECTURE_GENERATE');
    if (!request.generation_config) throw new Error('Architecture provider commit requires exact generation_config');
    for (const [name, value] of Object.entries({
      tenant_id: authority.tenant_id, workspace_id: authority.workspace_id,
      run_id: authority.run_id, decision_cycle_id: authority.decision_cycle_id,
      stage_execution_id: authority.stage_execution_id,
      run_config_id: authority.run_config_id,
      canonical_input_hash: authority.canonical_input_hash,
      request_identity: request.request_identity,
      architecture_slot: request.architecture_slot,
    })) requireText(value, name);
    validateArchitectureClosure(architecture, strategy, units, {
      expected_task_revision_id: architecture.task_revision_id,
      gate_result: request.gate_result,
      channel: request.channel,
    });
    const supplemental = admitSupplementalPropositions(
      strategy.required_proposition_ids,
      request.supplemental_propositions,
    );
    if (supplemental.disposition === 'NEW_STRATEGY_REQUIRED') {
      throw new Error('Architecture introduces a material strategy change; create and gate a new StrategyHypothesis');
    }
    const committed = await this.commitPort.commitContentArchitecture(request);
    validateArchitectureClosure(committed.architecture, strategy, committed.units, {
      expected_task_revision_id: architecture.task_revision_id,
      gate_result: request.gate_result,
      channel: request.channel,
    });
    if (committed.architecture.architecture_id !== architecture.architecture_id) {
      throw new Error('Architecture atomic commit returned a different immutable identity');
    }
    return committed;
  }
}
