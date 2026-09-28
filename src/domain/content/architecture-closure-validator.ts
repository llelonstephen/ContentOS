import { failContent } from './content-error-codes.js';
import type { StrategyGateResult } from './deterministic-strategy-gate.js';
import type {
  ContentArchitectureView,
  ContentUnitView,
  StrategyHypothesisView,
} from './types.js';

export interface ChannelArchitectureCapability {
  readonly format: string;
  readonly supported_formats: readonly string[];
  readonly permits_nonlinear_units: boolean;
}

export interface ArchitectureClosureContext {
  readonly expected_task_revision_id: string;
  readonly gate_result: StrategyGateResult;
  readonly channel: ChannelArchitectureCapability;
}

export function validateArchitectureClosure(
  architecture: ContentArchitectureView,
  strategy: StrategyHypothesisView,
  units: readonly ContentUnitView[],
  context: ArchitectureClosureContext,
): void {
  if (
    context.gate_result.outcome !== 'PROCEED' ||
    context.gate_result.strategy_id !== strategy.strategy_id
  ) {
    failContent('ARCHITECTURE_GATE_NOT_PROCEED', 'Exact Strategy Gate result is not PROCEED');
  }
  if (
    architecture.task_revision_id !== context.expected_task_revision_id ||
    strategy.task_revision_id !== context.expected_task_revision_id
  ) {
    failContent('ARCHITECTURE_TASK_MISMATCH', 'Architecture and Strategy must share the exact Task');
  }
  if (architecture.strategy_id !== strategy.strategy_id) {
    failContent('ARCHITECTURE_STRATEGY_MISMATCH', 'Architecture references a different Strategy');
  }
  if (!context.channel.supported_formats.includes(context.channel.format)) {
    failContent('ARCHITECTURE_SCHEMA_INVALID', 'Task format is unsupported by the pinned Channel');
  }

  const unitIds = units.map(({ unit_id }) => unit_id);
  if (
    architecture.unit_ids.length !== unitIds.length ||
    architecture.unit_ids.some((id, index) => id !== unitIds[index]) ||
    new Set(unitIds).size !== unitIds.length
  ) {
    failContent(
      'ARCHITECTURE_UNIT_ORDER_INVALID',
      'Architecture unit_ids must exactly preserve the supplied immutable unit order',
    );
  }

  const positions = units.map(({ position }) => position);
  if (positions.some((position) => !Number.isInteger(position))) {
    failContent('ARCHITECTURE_UNIT_ORDER_INVALID', 'Every ContentUnit position must be an integer');
  }
  if (!context.channel.permits_nonlinear_units) {
    const duplicate = new Set(positions).size !== positions.length;
    const outOfOrder = positions.some((position, index) => index > 0 && position <= positions[index - 1]!);
    if (duplicate || outOfOrder) {
      failContent('ARCHITECTURE_UNIT_ORDER_INVALID', 'Sequential ContentUnit order is ambiguous');
    }
  }
}
