import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { StageFencingContext } from './stage-fencing-coordinator.js';
import type { ContentRuntimeReference } from './content-runtime-reference-loader.js';

export type StageExecutionOutputRef = ContentRuntimeReference & { ordinal: number };

export async function loadStageExecutionOutputRefs(
  sqlTx: any,
  stageExecutionId: string,
): Promise<StageExecutionOutputRef[]> {
  const rows = await sqlTx`
    SELECT ordinal, ref_kind, entity_type, entity_id, stable_id, revision_id
    FROM stage_execution_output_refs
    WHERE stage_execution_id = ${stageExecutionId}
    ORDER BY ordinal ASC
  `;
  return rows.map((row: any) => {
    if (row.ref_kind === 'IMMUTABLE_ENTITY' && row.entity_id && !row.stable_id && !row.revision_id) {
      return {
        ordinal: Number(row.ordinal), refKind: 'IMMUTABLE_ENTITY' as const,
        entityType: String(row.entity_type), entityId: String(row.entity_id),
      };
    }
    if (row.ref_kind === 'REVISION' && !row.entity_id && row.stable_id && row.revision_id) {
      return {
        ordinal: Number(row.ordinal), refKind: 'REVISION' as const,
        entityType: String(row.entity_type), stableId: String(row.stable_id),
        revisionId: String(row.revision_id),
      };
    }
    throw new RegistryValidationError(
      'INVALID_STAGE_OUTPUT_REFERENCE',
      `StageExecution '${stageExecutionId}' contains an invalid output reference.`,
    );
  });
}

export async function completeContentStageExecution(
  sqlTx: any,
  context: StageFencingContext,
  outputRefs: readonly StageExecutionOutputRef[],
): Promise<void> {
  const ordinals = new Set<number>();
  for (const ref of outputRefs) {
    if (!Number.isInteger(ref.ordinal) || ref.ordinal < 0 || ordinals.has(ref.ordinal)) {
      throw new RegistryValidationError('INVALID_STAGE_OUTPUT_ORDINAL', 'Stage output ordinals must be unique non-negative integers.');
    }
    ordinals.add(ref.ordinal);
    if (ref.refKind === 'IMMUTABLE_ENTITY') {
      await sqlTx`
        INSERT INTO stage_execution_output_refs (
          stage_execution_id, ordinal, ref_kind, entity_type, entity_id, created_at
        ) VALUES (
          ${context.stageExecutionId}, ${ref.ordinal}, 'IMMUTABLE_ENTITY',
          ${ref.entityType}, ${ref.entityId}, now()
        )
      `;
    } else {
      await sqlTx`
        INSERT INTO stage_execution_output_refs (
          stage_execution_id, ordinal, ref_kind, entity_type, stable_id, revision_id, created_at
        ) VALUES (
          ${context.stageExecutionId}, ${ref.ordinal}, 'REVISION', ${ref.entityType},
          ${ref.stableId}, ${ref.revisionId}, now()
        )
      `;
    }
  }
  const updated = await sqlTx`
    UPDATE stage_executions
    SET status = 'COMPLETED', completed_at = now(), error_code = NULL
    WHERE stage_execution_id = ${context.stageExecutionId}
      AND status = 'RUNNING'
      AND fencing_token = ${context.fencingToken}
      AND idempotency_key = ${context.idempotencyKey}
      AND canonical_input_hash = ${context.canonicalInputHash}
    RETURNING stage_execution_id
  `;
  if (updated.length !== 1) {
    throw new RegistryValidationError(
      'STALE_WORKER_COMMIT_REJECTED',
      'StageExecution changed before completion; the transaction must roll back.',
    );
  }
}
