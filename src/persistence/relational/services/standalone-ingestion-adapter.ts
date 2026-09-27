/**
 * ContentOS — Standalone Ingestion Adapter
 *
 * Implements SPEC03 §14, §15, §34, §103, §104:
 * Trusted adapter for standalone origin/source/proposition ingestion outside of DecisionCycles.
 * Mints and attaches TRUSTED_STANDALONE_CAPABILITY.
 * DecisionCycle workers are statically prohibited from importing this adapter.
 */
import postgres from 'postgres';
import {
  EvidencePersistenceService,
  type IngestSourceArtifactParams,
  type ExtractEvidenceItemParams,
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
import { TRUSTED_STANDALONE_CAPABILITY } from './stage-fencing-coordinator.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export class StandaloneIngestionAdapter {
  private readonly evService: EvidencePersistenceService;
  private readonly propService: PropositionPersistenceService;
  private readonly epiService: EpistemicPersistenceService;
  private readonly gapService: KnowledgeGapPersistenceService;

  constructor(sql: ReturnType<typeof postgres>) {
    this.evService = new EvidencePersistenceService(sql);
    this.propService = new PropositionPersistenceService(sql);
    this.epiService = new EpistemicPersistenceService(sql);
    this.gapService = new KnowledgeGapPersistenceService(sql);
  }

  async ingestSourceArtifact(
    params: Omit<IngestSourceArtifactParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.evService.ingestSourceArtifact({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }

  async resolveOrCreateProposition(
    params: Omit<ResolveOrCreatePropositionParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.propService.resolveOrCreateProposition({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }

  async extractEvidenceItem(
    params: Omit<ExtractEvidenceItemParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.evService.extractEvidenceItem({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }

  async appendStandaloneEpistemicState(
    params: Omit<AppendEpistemicStateParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.epiService.appendEpistemicState({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }

  async createOrTransitionKnowledgeGap(
    params: Omit<CreateKnowledgeGapParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.gapService.createOrTransitionKnowledgeGap({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }

  async recordResearchTrace(
    params: Omit<RecordResearchTraceParams, 'writeMode' | 'fencingContext' | 'trustedCapability'> & {
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
    return this.gapService.recordResearchTrace({
      ...params,
      writeMode: 'STANDALONE',
      trustedCapability: TRUSTED_STANDALONE_CAPABILITY,
    });
  }
}
