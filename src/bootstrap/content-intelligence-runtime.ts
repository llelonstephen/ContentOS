import type postgres from 'postgres';
import { AudienceStatePersistenceService } from '../persistence/relational/services/audience-state-persistence-service.js';
import { ContentArchitecturePersistenceService } from '../persistence/relational/services/content-architecture-persistence-service.js';
import { ContentCandidatePersistenceService } from '../persistence/relational/services/content-candidate-persistence-service.js';
import { ContentStrategyGatePersistenceService } from '../persistence/relational/services/content-strategy-gate-persistence-service.js';
import { PostgresAudienceStateCommitPort } from '../persistence/relational/services/postgres-audience-state-commit-port.js';
import { PostgresContentArchitectureCommitPort } from '../persistence/relational/services/postgres-content-architecture-commit-port.js';
import { PostgresContentCandidateCommitPort } from '../persistence/relational/services/postgres-content-candidate-commit-port.js';
import { PostgresStrategyGateCommitPort } from '../persistence/relational/services/postgres-strategy-gate-commit-port.js';
import { PostgresStrategyHypothesisCommitPort } from '../persistence/relational/services/postgres-strategy-hypothesis-commit-port.js';
import { StrategyHypothesisPersistenceService } from '../persistence/relational/services/strategy-hypothesis-persistence-service.js';

/** Persistence-only M4 bundle. Provider execution remains an explicit caller-owned boundary. */
export interface ContentIntelligencePersistence {
  readonly audience: AudienceStatePersistenceService;
  readonly strategy: StrategyHypothesisPersistenceService;
  readonly gate: ContentStrategyGatePersistenceService;
  readonly architecture: ContentArchitecturePersistenceService;
  readonly candidate: ContentCandidatePersistenceService;
}

export function createContentIntelligencePersistence(
  sql: ReturnType<typeof postgres>,
): ContentIntelligencePersistence {
  return {
    audience: new AudienceStatePersistenceService(new PostgresAudienceStateCommitPort(sql)),
    strategy: new StrategyHypothesisPersistenceService(
      new PostgresStrategyHypothesisCommitPort(sql),
    ),
    gate: new ContentStrategyGatePersistenceService(new PostgresStrategyGateCommitPort(sql)),
    architecture: new ContentArchitecturePersistenceService(
      new PostgresContentArchitectureCommitPort(sql),
    ),
    candidate: new ContentCandidatePersistenceService(
      new PostgresContentCandidateCommitPort(sql),
    ),
  };
}
