/**
 * ContentOS — Standalone Ingestion Adapter
 *
 * Implements SPEC03 §14, §15, §34, §103, §104:
 * Adapter for standalone origin/source/proposition ingestion outside of DecisionCycles.
 * Authority is derived strictly from the PostgreSQL database connection identity
 * (contentos_standalone_role), not from any in-process JS/TS capability.
 * DecisionCycle workers are statically prohibited from importing this adapter.
 */
import postgres from 'postgres';
import {
  EvidencePersistenceService,
  type IngestSourceArtifactParams,
  type ExtractEvidenceItemParams,
  type CreateEvidenceLinkParams,
  type CreateEvidenceAssessmentParams,
} from './evidence-persistence-service.js';
import {
  PropositionPersistenceService,
  type ResolveOrCreatePropositionParams,
  type PropositionResolutionResult,
} from './proposition-persistence-service.js';
import {
  EpistemicPersistenceService,
  type AppendEpistemicStateParams,
} from './epistemic-persistence-service.js';
import {
  KnowledgeGapPersistenceService,
  type CreateKnowledgeGapParams,
  type RecordResearchTraceParams,
} from './knowledge-gap-persistence-service.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export class StandaloneIngestionAdapter {
  private readonly evService: EvidencePersistenceService;
  private readonly propService: PropositionPersistenceService;
  private readonly epiService: EpistemicPersistenceService;
  private readonly gapService: KnowledgeGapPersistenceService;

  constructor(
    sql: ReturnType<typeof postgres>,
    services?: {
      evService?: EvidencePersistenceService;
      propService?: PropositionPersistenceService;
      epiService?: EpistemicPersistenceService;
      gapService?: KnowledgeGapPersistenceService;
    },
  ) {
    this.evService = services?.evService ?? new EvidencePersistenceService(sql);
    this.propService = services?.propService ?? new PropositionPersistenceService(sql);
    this.epiService = services?.epiService ?? new EpistemicPersistenceService(sql);
    this.gapService = services?.gapService ?? new KnowledgeGapPersistenceService(sql);
  }

  async ingestSourceArtifact(
    params: Omit<IngestSourceArtifactParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.evService as any).ingestSourceArtifact({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async resolveOrCreateProposition(
    params: Omit<ResolveOrCreatePropositionParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<PropositionResolutionResult> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.propService as any).resolveOrCreateProposition({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async extractEvidenceItem(
    params: Omit<ExtractEvidenceItemParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.evService as any).extractEvidenceItem({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async linkEvidenceToProposition(
    params: Omit<CreateEvidenceLinkParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<{ linkId: string; created: boolean }> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.evService as any).linkEvidenceToProposition({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async createEvidenceAssessment(
    params: Omit<CreateEvidenceAssessmentParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.evService as any).createEvidenceAssessment({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async appendStandaloneEpistemicState(
    params: Omit<AppendEpistemicStateParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.epiService as any).appendEpistemicState({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async createOrTransitionKnowledgeGap(
    params: Omit<CreateKnowledgeGapParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.gapService as any).createOrTransitionKnowledgeGap({
      ...params,
      writeMode: 'STANDALONE',
    });
  }

  async recordResearchTrace(
    params: Omit<RecordResearchTraceParams, 'writeMode' | 'fencingContext'> & {
      fencingContext?: never;
      decisionCycleId?: never;
    },
  ): Promise<void> {
    if ((params as any).decisionCycleId || (params as any).fencingContext) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_INVALID',
        'Standalone adapter cannot attach to a DecisionCycle. Use decision-cycle commit boundary.',
      );
    }
    return (this.gapService as any).recordResearchTrace({
      ...params,
      writeMode: 'STANDALONE',
    });
  }
}
