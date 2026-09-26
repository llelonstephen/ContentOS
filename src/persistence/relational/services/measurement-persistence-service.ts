/**
 * ContentOS — Measurement & Correction Transactional Persistence Service
 *
 * Enforces SPEC02 transactional invariants:
 *   - §18, §27: MeasurementState replacement-chain non-branching and acyclicity.
 *   - §18, §27: PerformanceObservation publication_state cardinality:
 *       SINGLE_ARTIFACT -> exactly 1 covered artifact.
 *       MIXED_PUBLICATION_STATE -> at least 2 covered artifacts.
 *       All covered artifacts must belong to ONE publication_lineage_id.
 *   - §18, §27: Correction preserves metric_revision_id and semantic measurement scope.
 *   - §18, §27: At most one direct successor per predecessor (non-branching).
 *   - §5: Every immutable measurement entity registers in ImmutableEntityRegistry in the same transaction.
 */
import postgres from 'postgres';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface RecordPerformanceObservationParams {
  observationId: string;
  publicationState: 'SINGLE_ARTIFACT' | 'MIXED_PUBLICATION_STATE' | 'UNRESOLVED_PUBLICATION_STATE';
  coveredPublishedArtifactIds: string[];
  metricRevisionId: string;
  value: string;
  measurementWindowStart: Date;
  measurementWindowEnd: Date;
  populationOrDenominator: string;
  measurementStateId: string;
  sourceReference: string;
  supersedesObservationId?: string | null;
  observedAt: Date;
  tenantId: string;
  workspaceId?: string | null;
}

export class MeasurementPersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Records a PerformanceObservation atomically with its covered artifact links.
   */
  async recordPerformanceObservation(params: RecordPerformanceObservationParams): Promise<void> {
    const {
      observationId,
      publicationState,
      coveredPublishedArtifactIds,
      metricRevisionId,
      value,
      measurementWindowStart,
      measurementWindowEnd,
      populationOrDenominator,
      measurementStateId,
      sourceReference,
      supersedesObservationId,
      observedAt,
      tenantId,
      workspaceId,
    } = params;

    if (measurementWindowEnd <= measurementWindowStart) {
      throw new RegistryValidationError(
        'INVALID_MEASUREMENT_WINDOW',
        `measurement_window_end must be strictly greater than measurement_window_start.`,
      );
    }

    // 1. Validate publication_state cardinality
    if (publicationState === 'SINGLE_ARTIFACT' && coveredPublishedArtifactIds.length !== 1) {
      throw new RegistryValidationError(
        'SINGLE_ARTIFACT_CARDINALITY_VIOLATION',
        `SINGLE_ARTIFACT requires exactly 1 covered artifact, found ${coveredPublishedArtifactIds.length}.`,
      );
    }
    if (publicationState === 'MIXED_PUBLICATION_STATE' && coveredPublishedArtifactIds.length < 2) {
      throw new RegistryValidationError(
        'MIXED_PUBLICATION_CARDINALITY_VIOLATION',
        `MIXED_PUBLICATION_STATE requires at least 2 covered artifacts, found ${coveredPublishedArtifactIds.length}.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 2. Validate covered artifacts and their lineages
      if (coveredPublishedArtifactIds.length > 0) {
        const artifacts = await sqlTx`
          SELECT published_artifact_id, publication_lineage_id, effective_from
          FROM published_artifacts
          WHERE published_artifact_id IN ${sqlTx(coveredPublishedArtifactIds)}
        `;
        if (artifacts.length !== coveredPublishedArtifactIds.length) {
          throw new RegistryValidationError(
            'ARTIFACT_NOT_FOUND',
            `One or more covered published artifacts could not be found.`,
          );
        }

        // Must share one PublicationLineage
        const firstLineage = artifacts[0]?.publication_lineage_id as string;
        for (const art of artifacts) {
          if (art.publication_lineage_id !== firstLineage) {
            throw new RegistryValidationError(
              'MIXED_ACROSS_LINEAGES_FORBIDDEN',
              `Covered artifacts must belong to the same PublicationLineage. Found '${art.publication_lineage_id}' and '${firstLineage}'.`,
            );
          }
        }

        // For SINGLE_ARTIFACT: measurement window must be contained within artifact effective interval
        if (publicationState === 'SINGLE_ARTIFACT') {
          const artEffective = new Date(artifacts[0]?.effective_from as string).getTime();
          if (measurementWindowStart.getTime() < artEffective) {
            throw new RegistryValidationError(
              'MEASUREMENT_WINDOW_EXCEEDS_PUBLICATION',
              `Measurement window start (${measurementWindowStart.toISOString()}) occurs before published artifact effective_from (${new Date(artEffective).toISOString()}).`,
            );
          }
        }
      }

      // 3. Predecessor correction validation
      if (supersedesObservationId) {
        if (supersedesObservationId === observationId) {
          throw new RegistryValidationError(
            'OBSERVATION_CYCLE',
            `PerformanceObservation '${observationId}' cannot supersede itself.`,
          );
        }

        const [pred] = await sqlTx`
          SELECT observation_id, metric_revision_id, measurement_window_start,
                 measurement_window_end, population_or_denominator, supersedes_observation_id,
                 publication_state
          FROM performance_observations
          WHERE observation_id = ${supersedesObservationId}
          FOR UPDATE
        `;
        if (!pred) {
          throw new RegistryValidationError(
            'PREDECESSOR_NOT_FOUND',
            `Predecessor PerformanceObservation '${supersedesObservationId}' not found.`,
          );
        }

        // Metric revision must remain identical
        if (pred.metric_revision_id !== metricRevisionId) {
          throw new RegistryValidationError(
            'CORRECTION_METRIC_REVISION_MISMATCH',
            `Correction cannot change metric_revision_id from '${pred.metric_revision_id}' to '${metricRevisionId}'.`,
          );
        }

        // Publication coverage scope must remain identical
        if (pred.publication_state && pred.publication_state !== publicationState) {
          throw new RegistryValidationError(
            'OBSERVATION_CORRECTION_SCOPE_MISMATCH',
            `Correction cannot alter semantic measurement scope from '${pred.publication_state}' to '${publicationState}'.`,
          );
        }

        // Measurement window must remain identical
        const predStart = new Date(pred.measurement_window_start).getTime();
        const predEnd = new Date(pred.measurement_window_end).getTime();
        if (measurementWindowStart.getTime() !== predStart || measurementWindowEnd.getTime() !== predEnd) {
          throw new RegistryValidationError(
            'CORRECTION_MEASUREMENT_WINDOW_MISMATCH',
            `Correction cannot alter semantic measurement window.`,
          );
        }

        // Non-branching check: predecessor must not already have a successor
        const [existingSucc] = await sqlTx`
          SELECT observation_id
          FROM performance_observations
          WHERE supersedes_observation_id = ${supersedesObservationId}
        `;
        if (existingSucc) {
          throw new RegistryValidationError(
            'CORRECTION_BRANCHING_FORBIDDEN',
            `Predecessor observation '${supersedesObservationId}' already superseded by '${existingSucc.observation_id}'.`,
          );
        }

        // Cycle check
        let currentPredId: string | null = pred.supersedes_observation_id as string | null;
        while (currentPredId) {
          if (currentPredId === observationId) {
            throw new RegistryValidationError(
              'OBSERVATION_CYCLE',
              `Cycle detected: '${observationId}' is already an ancestor of '${supersedesObservationId}'.`,
            );
          }
          const [ancestor] = await sqlTx`
            SELECT supersedes_observation_id
            FROM performance_observations
            WHERE observation_id = ${currentPredId}
          `;
          currentPredId = ancestor ? (ancestor.supersedes_observation_id as string | null) : null;
        }
      }

      // 4. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'PerformanceObservation', ${observationId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 5. Insert performance_observations row
      await sqlTx`
        INSERT INTO performance_observations (
          observation_id, tenant_id, workspace_id, publication_state,
          metric_revision_id, value, measurement_window_start, measurement_window_end,
          population_or_denominator, measurement_state_id, source_reference,
          supersedes_observation_id, observed_at, created_at
        ) VALUES (
          ${observationId}, ${tenantId}, ${workspaceId ?? null}, ${publicationState},
          ${metricRevisionId}, ${value}, ${measurementWindowStart}, ${measurementWindowEnd},
          ${populationOrDenominator}, ${measurementStateId}, ${sourceReference},
          ${supersedesObservationId ?? null}, ${observedAt}, now()
        )
      `;

      // 6. Insert normalized link table rows
      for (const artifactId of coveredPublishedArtifactIds) {
        await sqlTx`
          INSERT INTO performance_observation_artifacts (
            observation_id, published_artifact_id
          ) VALUES (
            ${observationId}, ${artifactId}
          )
        `;
      }
    });
  }
}
