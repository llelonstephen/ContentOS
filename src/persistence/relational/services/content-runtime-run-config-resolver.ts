import { RegistryValidationError } from "../../../domain/services/registry-validator.js";
import type { PinnedGenerationConfig } from "../../../application/content-intelligence/content-generation-context-builder.js";
import type { ExactRevisionRef } from "../../../domain/content/types.js";
import type { ContentRuntimeCommitAuthority } from "./content-runtime-authority.js";

export interface CanonicalM4RunConfig extends PinnedGenerationConfig {
  readonly run_config_id: string;
  readonly prompt_revision_refs?: readonly string[];
  readonly model_config_revision_refs?: readonly string[];
  readonly tool_config_revision_refs?: readonly string[];
  readonly schema_revision_refs?: readonly ExactRevisionRef[];
  readonly retriever_revision_refs?: readonly string[];
  readonly evaluator_revision_refs?: readonly string[];
}

/** Resolves provider pins before an M4 model call; the caller cannot supply them. */
export interface M4GenerationPinResolver {
  resolve(authority: ContentRuntimeCommitAuthority): Promise<CanonicalM4RunConfig>;
}

export class PostgresM4GenerationPinResolver implements M4GenerationPinResolver {
  constructor(private readonly sql: any) {}

  resolve(authority: ContentRuntimeCommitAuthority): Promise<CanonicalM4RunConfig> {
    return resolveCanonicalM4RunConfig(this.sql, authority);
  }
}

function parsePinnedConfig(value: unknown): PinnedGenerationConfig {
  const root = typeof value === "string" ? JSON.parse(value) : value;
  const params = (root as { content_intelligence?: unknown })?.content_intelligence ?? root;
  const config = params as Partial<PinnedGenerationConfig>;
  if (!config || typeof config.prompt_revision_id !== "string" ||
      typeof config.model_revision_id !== "string" ||
      typeof config.schema_revision_id !== "string" ||
      !Array.isArray(config.tool_revision_ids) ||
      config.tool_revision_ids.some((id) => typeof id !== "string")) {
    throw new RegistryValidationError("M4_PINNED_CONFIG_MISSING",
      "RunConfig lacks exact prompt/model/tool/schema revisions for Content Intelligence.");
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
    "tenant_id" | "workspace_id" | "run_id" | "decision_cycle_id" | "run_config_id">,
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
    throw new RegistryValidationError("RUN_CONFIG_AUTHORITY_MISMATCH",
      "Caller RunConfig does not equal the exact Run/DecisionCycle-pinned RunConfig.");
  }

  const runConfigId = String(row.run_config_id);

  const [promptRows, modelRows, toolRows, schemaRows, retrieverRows, evaluatorRows] = await Promise.all([
    sqlTx`SELECT revision_id FROM run_config_prompt_revisions WHERE run_config_id = ${runConfigId} ORDER BY revision_id ASC`,
    sqlTx`SELECT revision_id FROM run_config_model_revisions WHERE run_config_id = ${runConfigId} ORDER BY revision_id ASC`,
    sqlTx`SELECT revision_id FROM run_config_tool_revisions WHERE run_config_id = ${runConfigId} ORDER BY revision_id ASC`,
    sqlTx`SELECT entity_type, stable_id, revision_id FROM run_config_schema_revisions WHERE run_config_id = ${runConfigId} ORDER BY entity_type ASC, stable_id ASC, revision_id ASC`,
    sqlTx`SELECT revision_id FROM run_config_retriever_revisions WHERE run_config_id = ${runConfigId} ORDER BY revision_id ASC`,
    sqlTx`SELECT revision_id FROM run_config_evaluator_revisions WHERE run_config_id = ${runConfigId} ORDER BY revision_id ASC`,
  ]);

  const prompt_revision_refs = promptRows
    .filter((r: any) => r && r.revision_id !== undefined)
    .map((r: any) => String(r.revision_id));
  const model_config_revision_refs = modelRows
    .filter((r: any) => r && r.revision_id !== undefined)
    .map((r: any) => String(r.revision_id));
  const tool_config_revision_refs = toolRows
    .filter((r: any) => r && r.revision_id !== undefined)
    .map((r: any) => String(r.revision_id));
  const schema_revision_refs: ExactRevisionRef[] = schemaRows
    .filter((r: any) => r && r.revision_id !== undefined && r.entity_type !== undefined)
    .map((r: any) => ({
      entity_type: String(r.entity_type),
      stable_id: String(r.stable_id),
      revision_id: String(r.revision_id),
    }));
  const retriever_revision_refs = retrieverRows
    .filter((r: any) => r && r.revision_id !== undefined)
    .map((r: any) => String(r.revision_id));
  const evaluator_revision_refs = evaluatorRows
    .filter((r: any) => r && r.revision_id !== undefined)
    .map((r: any) => String(r.revision_id));

  return {
    run_config_id: runConfigId,
    ...parsePinnedConfig(row.runtime_parameters),
    ...(prompt_revision_refs.length > 0 ? { prompt_revision_refs } : {}),
    ...(model_config_revision_refs.length > 0 ? { model_config_revision_refs } : {}),
    ...(tool_config_revision_refs.length > 0 ? { tool_config_revision_refs } : {}),
    ...(schema_revision_refs.length > 0 ? { schema_revision_refs } : {}),
    ...(retriever_revision_refs.length > 0 ? { retriever_revision_refs } : {}),
    ...(evaluator_revision_refs.length > 0 ? { evaluator_revision_refs } : {}),
  };
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
    throw new RegistryValidationError("PINNED_GENERATION_CONFIG_MISMATCH",
      "Generation request does not exactly match the immutable RunConfig pin set.");
  }
}
