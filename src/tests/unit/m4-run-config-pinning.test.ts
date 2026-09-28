import { describe, expect, it } from 'vitest';
import {
  assertPinnedGenerationConfig,
  resolveCanonicalM4RunConfig,
} from '../../persistence/relational/services/content-runtime-run-config-resolver.js';

const authority = { tenant_id: 'tenant', workspace_id: 'workspace', run_id: 'run', decision_cycle_id: 'cycle', run_config_id: 'config-old' };
const canonical = { run_config_id: 'config-old', prompt_revision_id: 'prompt-old', model_revision_id: 'model-old', tool_revision_ids: ['tool-a', 'tool-b'], schema_revision_id: 'schema-old' };
const sql = async () => [{ initial_run_config_id: 'config-old', run_config_id: 'config-old', runtime_parameters: JSON.stringify(canonical) }];

describe('M4 canonical RunConfig and generation pins', () => {
  it('derives the immutable config from Run/DecisionCycle, not caller config payload', async () => {
    await expect(resolveCanonicalM4RunConfig(sql, authority)).resolves.toEqual(canonical);
  });
  it('rejects another valid caller RunConfig ID', async () => {
    await expect(resolveCanonicalM4RunConfig(sql, { ...authority, run_config_id: 'config-new' })).rejects.toMatchObject({ code: 'RUN_CONFIG_AUTHORITY_MISMATCH' });
  });
  it.each([
    ['prompt', { ...canonical, prompt_revision_id: 'prompt-new' }],
    ['model', { ...canonical, model_revision_id: 'model-new' }],
    ['extra tool', { ...canonical, tool_revision_ids: ['tool-a', 'tool-b', 'tool-c'] }],
    ['missing tool', { ...canonical, tool_revision_ids: ['tool-a'] }],
  ])('rejects wrong pinned %s revision set', (_name, claimed) => {
    expect(() => assertPinnedGenerationConfig(claimed, canonical)).toThrow(/PINNED_GENERATION_CONFIG_MISMATCH/);
  });
  it('accepts only the exact old pin set for historical replay/generation', () => {
    expect(() => assertPinnedGenerationConfig(canonical, canonical)).not.toThrow();
  });
});
