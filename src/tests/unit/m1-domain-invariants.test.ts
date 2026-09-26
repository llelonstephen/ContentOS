/**
 * M1 Unit Tests — Domain Invariants & Adversarial Validation
 *
 * Implements M1 verification suite covering SPEC02 contracts:
 * - Supersession integrity (same stable ID, entity type, no self-supersession)
 * - Activation interval ambiguity & overlap
 * - Publication lineage DAG (single root, no branching, same lineage, time order, acyclic)
 * - Epistemic chain (single root, no branching, same proposition, time order, acyclic)
 * - Measurement correction (metric preservation, scope integrity, no branching)
 * - Decision closure (snapshot consistency, candidate validation, release status ownership)
 */
import { describe, it, expect } from 'vitest';
import {
  validateSupersession,
  validateActivationInterval,
  validatePublicationLineage,
  validateEpistemicChain,
  validateMeasurementCorrection,
  validateDecisionClosure,
  RegistryValidationError,
  type RevisionRow,
  type ActivationInterval,
  type PublishedArtifactNode,
  type EpistemicStateNode,
  type PerformanceObservationNode,
  type DecisionSnapshotData,
  type DecisionRecordData,
  type FinalContentPackageData,
} from '../../domain/services/registry-validator.js';

describe('M1 Domain Invariants: Supersession Integrity', () => {
  it('should accept valid supersession between matching stable IDs', () => {
    const pred: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-brand-safety',
      revision_id: 'rev-001',
    };
    const succ: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-brand-safety',
      revision_id: 'rev-002',
      supersedes_revision_id: 'rev-001',
    };

    expect(() => validateSupersession(pred, succ)).not.toThrow();
  });

  it('adversarial attack: reject supersession across different stable IDs', () => {
    const pred: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-brand-safety',
      revision_id: 'rev-001',
    };
    const succ: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-compliance-claims', // ATTACK: crossed stable identity
      revision_id: 'rev-002',
      supersedes_revision_id: 'rev-001',
    };

    expect(() => validateSupersession(pred, succ)).toThrowError(
      /SUPERSEDED_STABLE_ID_MISMATCH/,
    );
  });

  it('adversarial attack: reject supersession across different entity types', () => {
    const pred: RevisionRow = {
      entity_type: 'GuidanceRevision',
      stable_id: 'common-id',
      revision_id: 'rev-001',
    };
    const succ: RevisionRow = {
      entity_type: 'NormativeRuleRevision', // ATTACK: crossed entity type
      stable_id: 'common-id',
      revision_id: 'rev-002',
      supersedes_revision_id: 'rev-001',
    };

    expect(() => validateSupersession(pred, succ)).toThrowError(
      /SUPERSEDED_ENTITY_TYPE_MISMATCH/,
    );
  });

  it('adversarial attack: reject self-supersession', () => {
    const pred: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-brand-safety',
      revision_id: 'rev-001',
    };
    const succ: RevisionRow = {
      entity_type: 'NormativeRuleRevision',
      stable_id: 'rule-brand-safety',
      revision_id: 'rev-001', // ATTACK: self-supersession
      supersedes_revision_id: 'rev-001',
    };

    expect(() => validateSupersession(pred, succ)).toThrowError(
      /SELF_SUPERSEDED_REVISION/,
    );
  });
});

describe('M1 Domain Invariants: Control Plane Activation Intervals', () => {
  const existing: ActivationInterval[] = [
    {
      activation_id: 'act-001',
      deployment_scope: 'GLOBAL',
      component_type: 'ModelConfig',
      stable_id: 'primary-llm',
      active_revision_id: 'rev-001',
      effective_from: new Date('2026-01-01T00:00:00Z'),
      effective_until: new Date('2026-06-01T00:00:00Z'),
    },
  ];

  it('should accept non-overlapping contiguous activation interval', () => {
    const nextAct: ActivationInterval = {
      activation_id: 'act-002',
      deployment_scope: 'GLOBAL',
      component_type: 'ModelConfig',
      stable_id: 'primary-llm',
      active_revision_id: 'rev-002',
      effective_from: new Date('2026-06-01T00:00:00Z'),
      effective_until: null,
    };

    expect(() => validateActivationInterval(existing, nextAct)).not.toThrow();
  });

  it('adversarial attack: reject overlapping activation interval', () => {
    const overlappingAct: ActivationInterval = {
      activation_id: 'act-003',
      deployment_scope: 'GLOBAL',
      component_type: 'ModelConfig',
      stable_id: 'primary-llm',
      active_revision_id: 'rev-003',
      effective_from: new Date('2026-03-01T00:00:00Z'), // ATTACK: starts before existing ends
      effective_until: new Date('2026-08-01T00:00:00Z'),
    };

    expect(() => validateActivationInterval(existing, overlappingAct)).toThrowError(
      /ACTIVATION_INTERVAL_OVERLAP/,
    );
  });

  it('adversarial attack: reject invalid interval where effective_until <= effective_from', () => {
    const invalidAct: ActivationInterval = {
      activation_id: 'act-004',
      deployment_scope: 'GLOBAL',
      component_type: 'ModelConfig',
      stable_id: 'primary-llm',
      active_revision_id: 'rev-004',
      effective_from: new Date('2026-07-01T00:00:00Z'),
      effective_until: new Date('2026-07-01T00:00:00Z'), // ATTACK: zero-width or negative
    };

    expect(() => validateActivationInterval(existing, invalidAct)).toThrowError(
      /INVALID_INTERVAL_RANGE/,
    );
  });
});

describe('M1 Domain Invariants: Publication Lineage DAG', () => {
  const rootArtifact: PublishedArtifactNode = {
    published_artifact_id: 'art-001',
    publication_lineage_id: 'lin-social-x',
    supersedes_published_artifact_id: null,
    effective_from: new Date('2026-01-01T00:00:00Z'),
  };

  it('should accept valid sequential publication successor', () => {
    const succ: PublishedArtifactNode = {
      published_artifact_id: 'art-002',
      publication_lineage_id: 'lin-social-x',
      supersedes_published_artifact_id: 'art-001',
      effective_from: new Date('2026-01-02T00:00:00Z'),
    };

    expect(() => validatePublicationLineage([rootArtifact], succ)).not.toThrow();
  });

  it('adversarial attack: reject multiple roots in same publication lineage', () => {
    const secondRoot: PublishedArtifactNode = {
      published_artifact_id: 'art-002-root',
      publication_lineage_id: 'lin-social-x',
      supersedes_published_artifact_id: null, // ATTACK: second root in same lineage
      effective_from: new Date('2026-01-02T00:00:00Z'),
    };

    expect(() => validatePublicationLineage([rootArtifact], secondRoot)).toThrowError(
      /MULTIPLE_LINEAGE_ROOTS/,
    );
  });

  it('adversarial attack: reject cross-lineage supersession', () => {
    const crossLineageSucc: PublishedArtifactNode = {
      published_artifact_id: 'art-other-001',
      publication_lineage_id: 'lin-linkedin', // ATTACK: different lineage
      supersedes_published_artifact_id: 'art-001',
      effective_from: new Date('2026-01-02T00:00:00Z'),
    };

    expect(() => validatePublicationLineage([rootArtifact], crossLineageSucc)).toThrowError(
      /CROSS_LINEAGE_SUPERSEDED/,
    );
  });

  it('adversarial attack: reject branching (maximum one direct successor per artifact)', () => {
    const succ1: PublishedArtifactNode = {
      published_artifact_id: 'art-002',
      publication_lineage_id: 'lin-social-x',
      supersedes_published_artifact_id: 'art-001',
      effective_from: new Date('2026-01-02T00:00:00Z'),
    };
    const succ2: PublishedArtifactNode = {
      published_artifact_id: 'art-003',
      publication_lineage_id: 'lin-social-x',
      supersedes_published_artifact_id: 'art-001', // ATTACK: branching successor
      effective_from: new Date('2026-01-03T00:00:00Z'),
    };

    expect(() => validatePublicationLineage([rootArtifact, succ1], succ2)).toThrowError(
      /BRANCHED_LINEAGE_SUCCESSOR/,
    );
  });

  it('adversarial attack: reject backward or equal effective time', () => {
    const timeAttackSucc: PublishedArtifactNode = {
      published_artifact_id: 'art-002',
      publication_lineage_id: 'lin-social-x',
      supersedes_published_artifact_id: 'art-001',
      effective_from: new Date('2025-12-31T00:00:00Z'), // ATTACK: predecessor was 2026-01-01
    };

    expect(() => validatePublicationLineage([rootArtifact], timeAttackSucc)).toThrowError(
      /NON_INCREASING_EFFECTIVE_TIME/,
    );
  });
});

describe('M1 Domain Invariants: Epistemic State Chain', () => {
  const rootState: EpistemicStateNode = {
    epistemic_state_id: 'state-001',
    proposition_id: 'prop-efficacy-claim',
    supersedes_epistemic_state_id: null,
    known_from: new Date('2026-01-01T00:00:00Z'),
  };

  it('should accept valid sequential epistemic update', () => {
    const succ: EpistemicStateNode = {
      epistemic_state_id: 'state-002',
      proposition_id: 'prop-efficacy-claim',
      supersedes_epistemic_state_id: 'state-001',
      known_from: new Date('2026-01-05T00:00:00Z'),
    };

    expect(() => validateEpistemicChain([rootState], succ)).not.toThrow();
  });

  it('adversarial attack: reject multiple epistemic roots for same proposition', () => {
    const secondRoot: EpistemicStateNode = {
      epistemic_state_id: 'state-002-root',
      proposition_id: 'prop-efficacy-claim',
      supersedes_epistemic_state_id: null, // ATTACK: second root for same proposition
      known_from: new Date('2026-01-05T00:00:00Z'),
    };

    expect(() => validateEpistemicChain([rootState], secondRoot)).toThrowError(
      /MULTIPLE_EPISTEMIC_ROOTS/,
    );
  });

  it('adversarial attack: reject supersession across different propositions', () => {
    const crossPropSucc: EpistemicStateNode = {
      epistemic_state_id: 'state-002',
      proposition_id: 'prop-different-claim', // ATTACK: different proposition
      supersedes_epistemic_state_id: 'state-001',
      known_from: new Date('2026-01-05T00:00:00Z'),
    };

    expect(() => validateEpistemicChain([rootState], crossPropSucc)).toThrowError(
      /CROSS_PROPOSITION_SUPERSEDED/,
    );
  });

  it('adversarial attack: reject epistemic history branching', () => {
    const succ1: EpistemicStateNode = {
      epistemic_state_id: 'state-002',
      proposition_id: 'prop-efficacy-claim',
      supersedes_epistemic_state_id: 'state-001',
      known_from: new Date('2026-01-05T00:00:00Z'),
    };
    const succ2: EpistemicStateNode = {
      epistemic_state_id: 'state-003',
      proposition_id: 'prop-efficacy-claim',
      supersedes_epistemic_state_id: 'state-001', // ATTACK: branch off state-001
      known_from: new Date('2026-01-06T00:00:00Z'),
    };

    expect(() => validateEpistemicChain([rootState, succ1], succ2)).toThrowError(
      /BRANCHED_EPISTEMIC_SUCCESSOR/,
    );
  });

  it('adversarial attack: reject non-increasing known_from', () => {
    const timeAttackSucc: EpistemicStateNode = {
      epistemic_state_id: 'state-002',
      proposition_id: 'prop-efficacy-claim',
      supersedes_epistemic_state_id: 'state-001',
      known_from: new Date('2025-12-01T00:00:00Z'), // ATTACK: earlier than predecessor
    };

    expect(() => validateEpistemicChain([rootState], timeAttackSucc)).toThrowError(
      /NON_INCREASING_KNOWN_FROM/,
    );
  });
});

describe('M1 Domain Invariants: Measurement Corrections & Scope', () => {
  const obs1: PerformanceObservationNode = {
    observation_id: 'obs-001',
    metric_revision_id: 'metric-rev-ctr-v1',
    publication_state: 'SINGLE_ARTIFACT',
    covered_published_artifact_ids: ['art-001'],
    supersedes_observation_id: null,
    observed_at: new Date('2026-01-10T00:00:00Z'),
  };

  it('should accept valid observation correction preserving metric revision', () => {
    const correction: PerformanceObservationNode = {
      observation_id: 'obs-002',
      metric_revision_id: 'metric-rev-ctr-v1',
      publication_state: 'SINGLE_ARTIFACT',
      covered_published_artifact_ids: ['art-001'],
      supersedes_observation_id: 'obs-001',
      observed_at: new Date('2026-01-11T00:00:00Z'),
    };

    expect(() => validateMeasurementCorrection([obs1], correction)).not.toThrow();
  });

  it('adversarial attack: reject correction altering metric revision', () => {
    const invalidCorrection: PerformanceObservationNode = {
      observation_id: 'obs-002',
      metric_revision_id: 'metric-rev-cvr-v1', // ATTACK: altered metric definition
      publication_state: 'SINGLE_ARTIFACT',
      covered_published_artifact_ids: ['art-001'],
      supersedes_observation_id: 'obs-001',
      observed_at: new Date('2026-01-11T00:00:00Z'),
    };

    expect(() => validateMeasurementCorrection([obs1], invalidCorrection)).toThrowError(
      /METRIC_REVISION_PRESERVATION_VIOLATION/,
    );
  });

  it('adversarial attack: reject SINGLE_ARTIFACT with multiple covered artifacts', () => {
    const invalidScope: PerformanceObservationNode = {
      observation_id: 'obs-003',
      metric_revision_id: 'metric-rev-ctr-v1',
      publication_state: 'SINGLE_ARTIFACT',
      covered_published_artifact_ids: ['art-001', 'art-002'], // ATTACK: > 1 artifact
      observed_at: new Date('2026-01-10T00:00:00Z'),
    };

    expect(() => validateMeasurementCorrection([], invalidScope)).toThrowError(
      /INVALID_SINGLE_ARTIFACT_COUNT/,
    );
  });
});

describe('M1 Domain Invariants: Decision Closure & Release Status Ownership', () => {
  const snapshot: DecisionSnapshotData = {
    snapshot_id: 'snap-001',
    task_revision_id: 'task-rev-001',
    candidate_ids: ['cand-001', 'cand-002'],
  };

  const decisionRecord: DecisionRecordData = {
    decision_id: 'dec-001',
    snapshot_id: 'snap-001',
    task_revision_id: 'task-rev-001',
    selected_action: 'RELEASE',
    selected_candidate_id: 'cand-001',
    release_status: 'READY',
    policy_result_ids: ['pol-res-001'],
    conflict_resolution_ids: [],
  };

  it('should accept valid decision closure and matching content package', () => {
    const pkg: FinalContentPackageData = {
      package_id: 'pkg-001',
      task_revision_id: 'task-rev-001',
      decision_id: 'dec-001',
      decision_snapshot_id: 'snap-001',
      selected_candidate_id: 'cand-001',
    };

    expect(() => validateDecisionClosure(snapshot, decisionRecord, pkg)).not.toThrow();
  });

  it('adversarial attack: reject FinalContentPackage owning release_status', () => {
    const pkgWithStatus: FinalContentPackageData = {
      package_id: 'pkg-001',
      task_revision_id: 'task-rev-001',
      decision_id: 'dec-001',
      decision_snapshot_id: 'snap-001',
      selected_candidate_id: 'cand-001',
      release_status: 'READY', // ATTACK: package attempts to own release_status
    };

    expect(() => validateDecisionClosure(snapshot, decisionRecord, pkgWithStatus)).toThrowError(
      /PACKAGE_OWNS_RELEASE_STATUS_ERROR/,
    );
  });

  it('adversarial attack: reject DecisionRecord selecting candidate not in snapshot', () => {
    const badDecision: DecisionRecordData = {
      ...decisionRecord,
      selected_candidate_id: 'cand-unapproved-outside-snapshot', // ATTACK: candidate outside snapshot
    };

    expect(() => validateDecisionClosure(snapshot, badDecision)).toThrowError(
      /SELECTED_CANDIDATE_NOT_IN_SNAPSHOT/,
    );
  });
});
