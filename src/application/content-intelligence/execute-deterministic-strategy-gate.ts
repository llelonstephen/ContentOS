import {
  evaluateStrategyGate,
  type StrategyGateResult,
} from '../../domain/content/index.js';
import type {
  ContentStrategyGateInputResolver,
  StrategyGateResolutionRequest,
} from '../../persistence/relational/services/content-strategy-gate-input-resolver.js';
import type {
  ContentStrategyGatePersistenceService,
  StrategyGateCommitAuthority,
  StrategyGateExecutionReceipt,
} from '../../persistence/relational/services/content-strategy-gate-persistence-service.js';

export interface ExecuteStrategyGateRequest {
  readonly authority: StrategyGateCommitAuthority;
  readonly resolution: StrategyGateResolutionRequest;
}

export interface ExecutedStrategyGate {
  readonly result: StrategyGateResult;
  readonly receipt: StrategyGateExecutionReceipt;
}

export class ExecuteDeterministicStrategyGate {
  constructor(
    private readonly resolver: ContentStrategyGateInputResolver,
    private readonly persistence: ContentStrategyGatePersistenceService,
  ) {}

  async execute(request: ExecuteStrategyGateRequest): Promise<ExecutedStrategyGate> {
    const resolved = await this.resolver.resolve(request.resolution);
    const result = evaluateStrategyGate(resolved.gate_input);
    const receipt = await this.persistence.commit(request.authority, resolved, result);
    return { result, receipt };
  }
}
