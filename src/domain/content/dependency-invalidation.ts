export const MATERIAL_CHANGE_KINDS = [
  'AUDIENCE_MEANING',
  'KNOWLEDGE_DECISION_STATE',
  'GOVERNANCE_DEPENDENCY',
  'RIGHTS_CONSTRAINT',
  'RISK_CONSTRAINT',
  'STRATEGY_MEANING',
  'ARCHITECTURE_MEANING',
  'CANDIDATE_WORDING',
  'QUALIFICATION_REQUIREMENT',
  'HUMAN_FACTUAL_INFORMATION',
  'RUN_CONFIG',
] as const;
export type MaterialChangeKind = (typeof MATERIAL_CHANGE_KINDS)[number];
export type ContentDecisionCyclePhase = 'OPEN' | 'FREEZING' | 'FROZEN';

export type InvalidatedContentStage =
  | 'AUDIENCE'
  | 'GOVERNANCE_REFRESH'
  | 'STRATEGY'
  | 'STRATEGY_GATE'
  | 'ARCHITECTURE'
  | 'CANDIDATE'
  | 'SPEC06_EVALUATION';

const INVALIDATION_ORDER: readonly InvalidatedContentStage[] = [
  'AUDIENCE',
  'GOVERNANCE_REFRESH',
  'STRATEGY',
  'STRATEGY_GATE',
  'ARCHITECTURE',
  'CANDIDATE',
  'SPEC06_EVALUATION',
];

export interface DependencyInvalidationResult {
  readonly material: boolean;
  readonly requires_successor_cycle: boolean;
  readonly invalidated_stages: readonly InvalidatedContentStage[];
}

function addFrom(stages: Set<InvalidatedContentStage>, first: InvalidatedContentStage): void {
  const start = INVALIDATION_ORDER.indexOf(first);
  for (const stage of INVALIDATION_ORDER.slice(start)) stages.add(stage);
}

export function classifyDependencyInvalidation(
  changes: readonly MaterialChangeKind[],
  cyclePhase: ContentDecisionCyclePhase,
): DependencyInvalidationResult {
  const stages = new Set<InvalidatedContentStage>();
  for (const change of new Set(changes)) {
    if (change === 'AUDIENCE_MEANING' || change === 'HUMAN_FACTUAL_INFORMATION') {
      addFrom(stages, 'AUDIENCE');
    } else if (
      change === 'KNOWLEDGE_DECISION_STATE' || change === 'GOVERNANCE_DEPENDENCY' ||
      change === 'RIGHTS_CONSTRAINT' || change === 'RISK_CONSTRAINT'
    ) {
      addFrom(stages, 'GOVERNANCE_REFRESH');
    } else if (change === 'STRATEGY_MEANING') {
      addFrom(stages, 'STRATEGY');
    } else if (change === 'ARCHITECTURE_MEANING') {
      addFrom(stages, 'ARCHITECTURE');
    } else if (change === 'RUN_CONFIG') {
      addFrom(stages, 'STRATEGY');
    } else {
      addFrom(stages, 'CANDIDATE');
    }
  }

  const material = stages.size > 0;
  return {
    material,
    requires_successor_cycle: material && cyclePhase !== 'OPEN',
    invalidated_stages: INVALIDATION_ORDER.filter((stage) => stages.has(stage)),
  };
}
