/**
 * ContentOS — Publication Transactional Persistence Service
 *
 * Enforces SPEC02 transactional invariants:
 *   - §18, §26: Publication single-root: Lineage and first root are created atomically.
 *   - §18, §26: Non-branching: At most one direct successor per predecessor.
 *   - §18, §26: Same-lineage: Successor must belong to predecessor's lineage.
 *   - §18, §26: Temporal order: Successor effective_from > predecessor effective_from.
 *   - §18, §26: Acyclic: Supersession graph must not contain cycles.
 *   - §18: Origin-discriminator: CONTENTOS_EXECUTION requires execution_artifact_id; MANUAL_EXTERNAL requires null.
 *   - §5: Every immutable published entity registers in ImmutableEntityRegistry in the same transaction.
 */
import postgres from 'postgres';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface CreateLineageWithRootParams {
  lineageId: string;
  channel: string;
  destination: string;
  artifactId: string;
  origin: 'CONTENTOS_EXECUTION' | 'MANUAL_EXTERNAL';
  executionArtifactId?: string | null;
  sourceCandidateId?: string | null;
  actualContent: string;
  publishedHash: string;
  publishedAt: Date;
  effectiveFrom: Date;
  platformMetadata: string;
  tenantId: string;
  workspaceId?: string | null;
}

export interface AppendPublicationSuccessorParams {
  artifactId: string;
  lineageId: string;
  supersedesPublishedArtifactId: string;
  origin: 'CONTENTOS_EXECUTION' | 'MANUAL_EXTERNAL';
  executionArtifactId?: string | null;
  sourceCandidateId?: string | null;
  actualContent: string;
  publishedHash: string;
  publishedAt: Date;
  effectiveFrom: Date;
  platformMetadata: string;
  tenantId: string;
  workspaceId?: string | null;
}

export class PublicationPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Atomically creates a PublicationLineage and its initial single root PublishedArtifact.
   */
  async createLineageWithRoot(params: CreateLineageWithRootParams): Promise<void> {
    const {
      lineageId,
      channel,
      destination,
      artifactId,
      origin,
      executionArtifactId,
      sourceCandidateId,
      actualContent,
      publishedHash,
      publishedAt,
      effectiveFrom,
      platformMetadata,
      tenantId,
      workspaceId,
    } = params;

    if (origin === 'CONTENTOS_EXECUTION' && !executionArtifactId) {
      throw new RegistryValidationError(
        'EXECUTION_ARTIFACT_REQUIRED',
        `origin=CONTENTOS_EXECUTION requires non-null execution_artifact_id.`,
      );
    }
    if (origin === 'MANUAL_EXTERNAL' && executionArtifactId) {
      throw new RegistryValidationError(
        'EXECUTION_ARTIFACT_FORBIDDEN',
        `origin=MANUAL_EXTERNAL requires execution_artifact_id to be null.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Register lineage in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PublicationLineage', ${lineageId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 2. Insert lineage
      await sqlTx`
        INSERT INTO publication_lineages (
          publication_lineage_id, tenant_id, workspace_id, channel, destination, created_at
        ) VALUES (
          ${lineageId}, ${tenantId}, ${workspaceId ?? null}, ${channel}, ${destination}, now()
        )
      `;

      // 3. Register root artifact in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PublishedArtifact', ${artifactId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 4. Insert root PublishedArtifact
      await sqlTx`
        INSERT INTO published_artifacts (
          published_artifact_id, tenant_id, workspace_id, publication_lineage_id,
          origin, execution_artifact_id, source_candidate_id, actual_content,
          published_hash, published_at, effective_from, supersedes_published_artifact_id,
          platform_metadata, created_at
        ) VALUES (
          ${artifactId}, ${tenantId}, ${workspaceId ?? null}, ${lineageId},
          ${origin}, ${executionArtifactId ?? null}, ${sourceCandidateId ?? null}, ${actualContent},
          ${publishedHash}, ${publishedAt}, ${effectiveFrom}, null,
          ${platformMetadata}, now()
        )
      `;
    });
  }

  /**
   * Appends a successor PublishedArtifact to an existing artifact in the same lineage.
   * Guarantees non-branching, strictly increasing effective_from, and acyclicity.
   */
  async appendSuccessor(params: AppendPublicationSuccessorParams): Promise<void> {
    const {
      artifactId,
      lineageId,
      supersedesPublishedArtifactId,
      origin,
      executionArtifactId,
      sourceCandidateId,
      actualContent,
      publishedHash,
      publishedAt,
      effectiveFrom,
      platformMetadata,
      tenantId,
      workspaceId,
    } = params;

    if (origin === 'CONTENTOS_EXECUTION' && !executionArtifactId) {
      throw new RegistryValidationError(
        'EXECUTION_ARTIFACT_REQUIRED',
        `origin=CONTENTOS_EXECUTION requires non-null execution_artifact_id.`,
      );
    }
    if (origin === 'MANUAL_EXTERNAL' && executionArtifactId) {
      throw new RegistryValidationError(
        'EXECUTION_ARTIFACT_FORBIDDEN',
        `origin=MANUAL_EXTERNAL requires execution_artifact_id to be null.`,
      );
    }

    if (artifactId === supersedesPublishedArtifactId) {
      throw new RegistryValidationError(
        'PUBLICATION_CYCLE',
        `PublishedArtifact '${artifactId}' cannot supersede itself.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 1. Lock and inspect predecessor
      const [pred] = await sqlTx`
        SELECT published_artifact_id, publication_lineage_id, effective_from, supersedes_published_artifact_id
        FROM published_artifacts
        WHERE published_artifact_id = ${supersedesPublishedArtifactId}
        FOR UPDATE
      `;
      if (!pred) {
        throw new RegistryValidationError(
          'PREDECESSOR_NOT_FOUND',
          `Predecessor PublishedArtifact '${supersedesPublishedArtifactId}' not found.`,
        );
      }

      // Check same lineage
      if (pred.publication_lineage_id !== lineageId) {
        throw new RegistryValidationError(
          'CROSS_LINEAGE_SUCCESSOR',
          `Successor lineage '${lineageId}' does not match predecessor lineage '${pred.publication_lineage_id}'.`,
        );
      }

      // Check strictly increasing effective_from
      const predEffective = new Date(pred.effective_from).getTime();
      const succEffective = effectiveFrom.getTime();
      if (succEffective <= predEffective) {
        throw new RegistryValidationError(
          'PUBLICATION_EFFECTIVE_TIME_NON_INCREASING',
          `Successor effective_from (${effectiveFrom.toISOString()}) must be strictly greater than predecessor (${new Date(pred.effective_from).toISOString()}).`,
        );
      }

      // Check non-branching: predecessor must not already have a successor
      const [existingSucc] = await sqlTx`
        SELECT published_artifact_id
        FROM published_artifacts
        WHERE supersedes_published_artifact_id = ${supersedesPublishedArtifactId}
      `;
      if (existingSucc) {
        throw new RegistryValidationError(
          'PUBLICATION_BRANCHING_FORBIDDEN',
          `Predecessor '${supersedesPublishedArtifactId}' already superseded by '${existingSucc.published_artifact_id}'. Branching is forbidden.`,
        );
      }

      // Cycle detection: traverse ancestors
      let currentPredId: string | null = pred.supersedes_published_artifact_id as string | null;
      while (currentPredId) {
        if (currentPredId === artifactId) {
          throw new RegistryValidationError(
            'PUBLICATION_CYCLE',
            `Cycle detected: '${artifactId}' is already an ancestor of '${supersedesPublishedArtifactId}'.`,
          );
        }
        const [ancestor] = await sqlTx`
          SELECT supersedes_published_artifact_id
          FROM published_artifacts
          WHERE published_artifact_id = ${currentPredId}
        `;
        currentPredId = ancestor ? (ancestor.supersedes_published_artifact_id as string | null) : null;
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PublishedArtifact', ${artifactId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert successor PublishedArtifact
      await sqlTx`
        INSERT INTO published_artifacts (
          published_artifact_id, tenant_id, workspace_id, publication_lineage_id,
          origin, execution_artifact_id, source_candidate_id, actual_content,
          published_hash, published_at, effective_from, supersedes_published_artifact_id,
          platform_metadata, created_at
        ) VALUES (
          ${artifactId}, ${tenantId}, ${workspaceId ?? null}, ${lineageId},
          ${origin}, ${executionArtifactId ?? null}, ${sourceCandidateId ?? null}, ${actualContent},
          ${publishedHash}, ${publishedAt}, ${effectiveFrom}, ${supersedesPublishedArtifactId},
          ${platformMetadata}, now()
        )
      `;
    });
  }
}
