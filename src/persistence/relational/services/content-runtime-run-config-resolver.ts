import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { PinnedGenerationConfig } from '../../../application/content-intelligence/content-generation-context-builder.js';
import type { ContentRuntimeCommitAuthority } from './content-runtime-authority.js';

export interface CanonicalM4RunConfig extends PinnedGenerationConfig {
  readonly run_config_id: string;
}

function parsePinnedConfig(value: unknown): PinnedGenerationConfig {
  const root = typeof value === 'string' ? JSON.parse(value) : value;
  const params = (root as { content_intelligence?: unknown })?.content_intelligence ?? root;
  const config = params as Partial<PinnedGenerationConfig>;
  if (!config || typeof config.prompt_revision_id !== 'string' ||
      typeof config.model_revision_id !== 'string' ||
      typeof config.schema_revision_id !== 'string' ||
      !Array.isArray(config.tool_revision_ids) ||
      config.tool_revision_ids.some((id) => typeof id !== 'string')) {
    throw new RegistryValidationError('M4_PINNED_CONFIG_MISSING',
      'RunConfig lacks exact prompt/model/tool/schema revisions for Content Intelligence.');
  }
  return {
    prompt_revision_id: config.prompt_revision_id,
    model_revision_id: config.model_revision_id,
    schema_revision_id: config.schema_revision_id,
    tool_revision_ids: [...config.tool_revision_ids],
  };
}

/** Canonical Run/DecisionCycle lineage is the only RunConfig authority. */
export async function resolveCanonicalM4RunConfig(
  sqlTx: any,
  authority: Pick<ContentRuntimeCommitAuthority,
    'tenant_id' | 'workspace_id' | 'run_id' | 'decision_cycle_id' | 'run_config_id'>,
): Promise<CanonicalM4RunConfig> {
  const [row] = await sqlTx`
    SELECT run.initial_run_config_id, config.run_config_id, config.runtime_parameters
    FROM runs run
    JOIN decision_cycles cycle ON cycle.decision_cycle_id = ${authority.decision_cycle_id}
      AND cycle.run_id = run.run_id
    JOIN run_configs config ON config.run_config_id = run.initial_run_config_id
    WHERE run.run_id = ${authority.run_id}
      AND run.tenant_id = ${authority.tenant_id}
      AND run.workspace_id IS NOT DISTINCT FROM ${authority.workspace_id}
      AND config.tenant_id = ${authority.tenant_id}
      AND config.workspace_id IS NOT DISTINCT FROM ${authority.workspace_id}
  `;
  if (!row || row.initial_run_config_id !== authority.run_config_id) {
    throw new RegistryValidationError('RUN_CONFIG_AUTHORITY_MISMATCH',
      'Caller RunConfig does not equal the exact Run/DecisionCycle-pinned RunConfig.');
  }
  return { run_config_id: String(row.run_config_id), ...parsePinnedConfig(row.runtime_parameters) };
}

export function assertPinnedGenerationConfig(
  claimed: PinnedGenerationConfig,
  canonical: CanonicalM4RunConfig,
): void {
  const sameTools = claimed.tool_revision_ids.length === canonical.tool_revision_ids.length &&
    claimed.tool_revision_ids.every((id, index) => id === canonical.tool_revision_ids[index]);
  if (claimed.prompt_revision_id !== canonical.prompt_revision_id ||
      claimed.model_revision_id !== canonical.model_revision_id ||
      claimed.schema_revision_id !== canonical.schema_revision_id || !sameTools) {
    throw new RegistryValidationError('PINNED_GENERATION_CONFIG_MISMATCH',
      'Generation request does not exactly match the immutable RunConfig pin set.');
  }
}
