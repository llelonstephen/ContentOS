import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import {
  verifyStageFencing,
  type StageFencingContext,
} from './stage-fencing-coordinator.js';
import {
  completeContentStageExecution,
  loadStageExecutionOutputRefs,
  type StageExecutionOutputRef,
} from './content-stage-execution-repository.js';
import {
  loadContentRuntimeReference,
} from './content-runtime-reference-loader.js';
import {
  writeContentRuntimeRegistryEntries,
  type ContentRuntimeRegistryEntry,
} from './content-runtime-registry-writer.js';
import {
  writeContentRuntimeAuditEvent,
  type ContentRuntimeAuditEvent,
} from './content-runtime-audit-writer.js';
import {
  writeContentRuntimeOutboxEvents,
  type ContentRuntimeOutboxEvent,
} from './content-runtime-outbox-writer.js';
import {
  assertPinnedGenerationConfig,
  resolveCanonicalM4RunConfig,
  type CanonicalM4RunConfig,
} from './content-runtime-run-config-resolver.js';

export interface ContentRuntimeCommitRequest {
  tenantId: string;
  workspaceId?: string | null;
  runConfigId: string;
  generationAuthority:
    | { readonly kind: 'PROVIDER'; readonly generationConfig: Omit<CanonicalM4RunConfig, 'run_config_id'> }
    | { readonly kind: 'DETERMINISTIC_GATE' };
  fencingContext: StageFencingContext;
  registryEntries: readonly ContentRuntimeRegistryEntry[];
  auditEvent: ContentRuntimeAuditEvent;
  outboxEvents: readonly ContentRuntimeOutboxEvent[];
}

export interface ContentRuntimeEntityGraphResult<T> {
  value: T;
  outputRefs: readonly StageExecutionOutputRef[];
}

export interface ContentRuntimeCommitResult<T> {
  replayed: boolean;
  value?: T;
  outputRefs: readonly StageExecutionOutputRef[];
  outboxEventIds: readonly string[];
}

function validateMetadata(request: ContentRuntimeCommitRequest): void {
  if (request.auditEvent.tenantId !== request.tenantId ||
      (request.auditEvent.workspaceId ?? null) !== (request.workspaceId ?? null) ||
      request.auditEvent.runId !== request.fencingContext.runId) {
    throw new RegistryValidationError(
      'CONTENT_RUNTIME_METADATA_SCOPE_MISMATCH',
      'Audit metadata must have the exact M4 transaction tenant, workspace, and run scope.',
    );
  }
  for (const entry of request.registryEntries) {
    if (entry.tenantId !== request.tenantId ||
        (entry.workspaceId ?? null) !== (request.workspaceId ?? null)) {
      throw new RegistryValidationError(
        'CONTENT_RUNTIME_METADATA_SCOPE_MISMATCH',
        'Registry entries must have the exact M4 transaction tenant and workspace scope.',
      );
    }
  }
}

/**
 * Runs only the short persistence phase. Provider/model calls belong before this
 * function; the callback receives the SQL transaction solely to insert a
 * prevalidated entity graph and relationship rows.
 */
export async function executeContentRuntimeCommit<T>(
  sql: any,
  request: ContentRuntimeCommitRequest,
  insertEntityGraph: (sqlTx: any) => Promise<ContentRuntimeEntityGraphResult<T>>,
): Promise<ContentRuntimeCommitResult<T>> {
  validateMetadata(request);
  const runCommit = async (sqlTx: any) => {
    const verified = await verifyStageFencing(sqlTx, {
      fencingContext: request.fencingContext,
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      writeMode: 'DECISION_CYCLE',
      authorityScope: 'M4_CONTENT_RUNTIME',
      requireCycleContext: true,
      allowCompletedReplay: true,
    });
    const canonicalConfig = await resolveCanonicalM4RunConfig(sqlTx, {
      tenant_id: request.tenantId,
      workspace_id: request.workspaceId ?? '',
      run_id: request.fencingContext.runId!,
      decision_cycle_id: request.fencingContext.decisionCycleId!,
      run_config_id: request.runConfigId,
    });
    if (request.generationAuthority.kind === 'PROVIDER') {
      assertPinnedGenerationConfig(request.generationAuthority.generationConfig, canonicalConfig);
    } else if (request.fencingContext.stageName !== 'STRATEGY_GATE') {
      throw new RegistryValidationError(
        'M4_PROVIDER_PIN_PROOF_REQUIRED',
        'Only deterministic Strategy Gate commits may omit a provider generation pin proof.',
      );
    }

    if (verified.stageStatus === 'COMPLETED') {
      const outputRefs = await loadStageExecutionOutputRefs(
        sqlTx,
        request.fencingContext.stageExecutionId!,
      );
      for (const ref of outputRefs) {
        await loadContentRuntimeReference(
          sqlTx,
          { tenantId: request.tenantId, workspaceId: request.workspaceId },
          ref,
        );
      }
      return { replayed: true, outputRefs, outboxEventIds: [] };
    }

    await writeContentRuntimeRegistryEntries(sqlTx, request.registryEntries);
    const graph = await insertEntityGraph(sqlTx);
    for (const ref of graph.outputRefs) {
      await loadContentRuntimeReference(
        sqlTx,
        { tenantId: request.tenantId, workspaceId: request.workspaceId },
        ref,
      );
    }
    await completeContentStageExecution(sqlTx, request.fencingContext, {
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    }, graph.outputRefs);
    await writeContentRuntimeAuditEvent(sqlTx, request.auditEvent);
    const outboxEventIds = await writeContentRuntimeOutboxEvents(sqlTx, request.outboxEvents);
    return {
      replayed: false,
      value: graph.value,
      outputRefs: graph.outputRefs,
      outboxEventIds,
    };
  };
  if (typeof sql.begin === "function") {
    return sql.begin(runCommit);
  }
  return runCommit(sql);
}
