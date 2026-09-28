import type { ContentCandidateView } from '../../../domain/content/index.js';

export interface CandidateReadPort {
  loadCandidate(candidateId: string, tenantId: string, workspaceId: string): Promise<ContentCandidateView>;
}

export class ContentRuntimeReplayService {
  constructor(private readonly reader: CandidateReadPort) {}

  replay(candidateId: string, tenantId: string, workspaceId: string): Promise<ContentCandidateView> {
    if (!candidateId || !tenantId || !workspaceId) throw new Error('Replay requires exact scoped identity');
    return this.reader.loadCandidate(candidateId, tenantId, workspaceId);
  }
}
