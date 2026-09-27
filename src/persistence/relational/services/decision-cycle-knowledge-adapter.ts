/**
 * ContentOS — DecisionCycle Knowledge Adapter
 *
 * Implements SPEC01 §19, §82, §83, SPEC03 §103, §104:
 * Dedicated adapter for all DecisionCycle canonical knowledge commits.
 * Mandates explicit DecisionCycle, StageExecution, and fencingToken context on every write.
 * Missing context fails closed.
 */
import postgres from 'postgres';
import {
  EvidencePersistenceService,
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

export interface DecisionCycleFencingContext {
  decisionCycleId: string;
  stageExecutionId: string;
  fencingToken: number;
  leaseOwner?: string | null;
}

export class DecisionCycleKnowledgeAdapter {
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

  private validateFencingContext(fencingContext?: DecisionCycleFencingContext): void {
    if (!fencingContext || !fencingContext.decisionCycleId) {
      throw new RegistryValidationError(
        'DECISION_CYCLE_CONTEXT_REQUIRED',
        'Decision-cycle knowledge operations require explicit decisionCycleId.',
      );
    }
    if (!fencingContext.stageExecutionId) {
      throw new RegistryValidationError(
        'STAGE_EXECUTION_CONTEXT_REQUIRED',
        'Decision-cycle knowledge operations require explicit stageExecutionId.',
      );
    }
    if (fencingContext.fencingToken === undefined || fencingContext.fencingToken === null) {
      throw new RegistryValidationError(
        'FENCING_TOKEN_REQUIRED',
        'Decision-cycle knowledge operations require explicit fencingToken.',
      );
    }
  }

  async extractEvidenceItem(
    params: Omit<ExtractEvidenceItemParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<void> {
    this.validateFencingContext(params.fencingContext);
    return this.evService.extractEvidenceItem({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async linkEvidenceToProposition(
    params: Omit<CreateEvidenceLinkParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<{ linkId: string; created: boolean }> {
    this.validateFencingContext(params.fencingContext);
    return this.evService.linkEvidenceToProposition({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async createEvidenceAssessment(
    params: Omit<CreateEvidenceAssessmentParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<void> {
    this.validateFencingContext(params.fencingContext);
    return this.evService.createEvidenceAssessment({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async resolveOrCreateProposition(
    params: Omit<ResolveOrCreatePropositionParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<PropositionResolutionResult> {
    this.validateFencingContext(params.fencingContext);
    return this.propService.resolveOrCreateProposition({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async appendEpistemicState(
    params: Omit<AppendEpistemicStateParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<void> {
    this.validateFencingContext(params.fencingContext);
    return this.epiService.appendEpistemicState({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async createOrTransitionKnowledgeGap(
    params: Omit<CreateKnowledgeGapParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<void> {
    this.validateFencingContext(params.fencingContext);
    return this.gapService.createOrTransitionKnowledgeGap({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }

  async recordResearchTrace(
    params: Omit<RecordResearchTraceParams, 'writeMode'> & {
      fencingContext: DecisionCycleFencingContext;
    },
  ): Promise<void> {
    this.validateFencingContext(params.fencingContext);
    return this.gapService.recordResearchTrace({
      ...params,
      writeMode: 'DECISION_CYCLE',
    });
  }
}
