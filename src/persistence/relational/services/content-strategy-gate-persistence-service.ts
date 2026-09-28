import type { StrategyGateResult } from '../../../domain/content/index.js';
import type { ResolvedStrategyGateInput } from './content-strategy-gate-input-resolver.js';
import {
  assertContentRuntimeCommitAuthority,
  type ContentRuntimeCommitAuthority,
} from './content-runtime-authority.js';

export interface StrategyGateCommitAuthority extends ContentRuntimeCommitAuthority {}

export interface StrategyGateExecutionReceipt {
  readonly stage_execution_id: string;
  readonly output_ref_id: string;
  readonly result: StrategyGateResult;
}

export interface StrategyGateAtomicCommitRequest {
  readonly authority: StrategyGateCommitAuthority;
  readonly resolved_input: ResolvedStrategyGateInput;
  readonly result: StrategyGateResult;
  readonly reason_metadata: {
    readonly outcome: StrategyGateResult['outcome'];
    readonly reason_codes: StrategyGateResult['reason_codes'];
    readonly input_hash: string;
  };
}

/**
 * Adapter persists only StageExecution outcome/output refs plus append-only audit
 * and outbox metadata in one fenced transaction. It must not create a gate entity.
 */
export interface StrategyGateAtomicCommitPort {
  commitStrategyGateExecution(
    request: StrategyGateAtomicCommitRequest,
  ): Promise<StrategyGateExecutionReceipt>;
}

export class ContentStrategyGatePersistenceService {
  constructor(private readonly commitPort: StrategyGateAtomicCommitPort) {}

  async commit(
    authority: StrategyGateCommitAuthority,
    resolvedInput: ResolvedStrategyGateInput,
    result: StrategyGateResult,
  ): Promise<StrategyGateExecutionReceipt> {
    assertContentRuntimeCommitAuthority(authority, 'STRATEGY_GATE');
    const required = [
      authority.tenant_id,
      authority.workspace_id,
      authority.run_id,
      authority.decision_cycle_id,
      authority.stage_execution_id,
      authority.run_config_id,
      authority.canonical_input_hash,
    ];
    if (required.some((value) => value.trim().length === 0)) {
      throw new Error('Strategy Gate commit authority is incomplete');
    }
    const request = resolvedInput.request;
    if (
      authority.tenant_id !== request.tenant_id ||
      authority.workspace_id !== request.workspace_id ||
      authority.run_id !== request.run_id ||
      authority.decision_cycle_id !== request.decision_cycle_id ||
      authority.run_config_id !== request.run_config_id ||
      authority.canonical_input_hash !== resolvedInput.input_hash
    ) {
      throw new Error('Strategy Gate commit authority does not match exact resolved input');
    }
    if (
      result.strategy_id !== request.strategy_id ||
      result.audience_state_id !== request.audience_state_id ||
      result.gate_config_revision !== request.gate_config_revision
    ) {
      throw new Error('Strategy Gate result identity does not match exact resolved input');
    }
    if (result.outcome === 'PROCEED' && result.reason_codes.length > 0) {
      throw new Error('PROCEED Strategy Gate result cannot contain failure reasons');
    }

    const receipt = await this.commitPort.commitStrategyGateExecution({
      authority,
      resolved_input: resolvedInput,
      result,
      reason_metadata: {
        outcome: result.outcome,
        reason_codes: result.reason_codes,
        input_hash: resolvedInput.input_hash,
      },
    });
    if (receipt.stage_execution_id !== authority.stage_execution_id) {
      throw new Error('Strategy Gate commit returned a different StageExecution');
    }
    return receipt;
  }
}
