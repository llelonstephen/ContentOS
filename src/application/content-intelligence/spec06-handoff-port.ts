import {
  createSpec06Handoff,
  type ContentArchitectureView,
  type ContentCandidateView,
  type Spec06HandoffContext,
  type Spec06HandoffDto,
  type StrategyHypothesisView,
} from '../../domain/content/index.js';

export interface Spec06HandoffSink {
  enqueueHandoff(dto: Spec06HandoffDto): Promise<void>;
}

export class Spec06HandoffPort {
  constructor(private readonly sink: Spec06HandoffSink) {}

  async handoff(
    candidate: ContentCandidateView,
    strategy: StrategyHypothesisView,
    architecture: ContentArchitectureView,
    context: Spec06HandoffContext,
  ): Promise<Spec06HandoffDto> {
    const dto = createSpec06Handoff(candidate, strategy, architecture, context);
    await this.sink.enqueueHandoff(dto);
    return dto;
  }
}
