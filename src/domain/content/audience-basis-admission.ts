import { failContent } from './content-error-codes.js';
import { hashAudienceScalar, resolveJsonPointer } from './audience-fact-path.js';
import { assertAudienceSemanticClosure, projectAudienceFact } from './audience-semantic-projection.js';
import type {
  AudienceAdmissionInput,
  AudienceFactBasisLink,
  AudienceFactBasisSelection,
  AudienceFactLeaf,
} from './audience-admission-types.js';
import type { JsonPrimitive } from './types.js';

function selectionKey(selection: AudienceFactBasisSelection): string {
  const identity = selection.basis_kind === 'TASK_AUDIENCE_CONTEXT'
    ? selection.task_audience_context_path
    : `${selection.proposition_id}:${selection.epistemic_state_id}`;
  return `${selection.audience_field}:${selection.fact_path}:${selection.basis_kind}:${identity}`;
}

function assertSelectionShape(selection: AudienceFactBasisSelection): void {
  const common = ['audience_field', 'fact_path', 'ordinal', 'basis_kind'];
  const allowed = selection.basis_kind === 'TASK_AUDIENCE_CONTEXT'
    ? [...common, 'task_audience_context_path']
    : [...common, 'proposition_id', 'epistemic_state_id'];
  if (Object.keys(selection).some((key) => !allowed.includes(key))) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Provider/caller supplied unauthorized basis fields');
  }
  if (!Number.isInteger(selection.ordinal) || selection.ordinal < 0) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Audience fact basis ordinal must be non-negative');
  }
}

function requireLeaf(
  leaves: readonly AudienceFactLeaf[],
  selection: AudienceFactBasisSelection,
): AudienceFactLeaf {
  const leaf = leaves.find(
    (item) => item.audience_field === selection.audience_field && item.fact_path === selection.fact_path,
  );
  if (!leaf || leaf.classification !== 'FACTUAL_ASSERTION') {
    failContent('AUDIENCE_BASIS_REF_INVALID', 'Audience basis path does not resolve to a factual leaf');
  }
  return leaf;
}

function admitTaskBasis(
  input: AudienceAdmissionInput,
  selection: Extract<AudienceFactBasisSelection, { basis_kind: 'TASK_AUDIENCE_CONTEXT' }>,
  leaf: AudienceFactLeaf,
): AudienceFactBasisLink {
  const manifestValue = input.manifest.eligible_task_audience_context.find(
    ({ path }) => path === selection.task_audience_context_path,
  );
  const taskValue = resolveJsonPointer(
    input.task_audience_context,
    selection.task_audience_context_path,
  );
  if (
    !manifestValue || taskValue === undefined || taskValue === null || typeof taskValue === 'object'
  ) {
    failContent('AUDIENCE_BASIS_REF_INVALID', 'Task audience-context basis is absent from the manifest');
  }
  const taskValueHash = hashAudienceScalar(taskValue as JsonPrimitive);
  if (taskValueHash !== manifestValue.value_hash || taskValueHash !== leaf.fact_value_hash) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Task basis value does not equal the admitted audience fact');
  }
  return {
    tenant_id: input.manifest.tenant_id,
    workspace_id: input.manifest.workspace_id,
    audience_state_id: input.audience.audience_state_id,
    audience_field: leaf.audience_field,
    fact_path: leaf.fact_path,
    fact_value_hash: leaf.fact_value_hash,
    ordinal: selection.ordinal,
    basis_kind: 'TASK_AUDIENCE_CONTEXT',
    task_id: input.manifest.task_id,
    task_revision_id: input.manifest.task_revision_id,
    task_audience_context_path: selection.task_audience_context_path,
    task_audience_context_value_hash: taskValueHash,
  };
}

function admitEpistemicBasis(
  input: AudienceAdmissionInput,
  selection: Extract<AudienceFactBasisSelection, { basis_kind: 'AUDIENCE_EPISTEMIC_STATE' }>,
  leaf: AudienceFactLeaf,
): AudienceFactBasisLink {
  const inManifest = input.manifest.eligible_epistemic_refs.some(
    (ref) => ref.proposition_id === selection.proposition_id &&
      ref.epistemic_state_id === selection.epistemic_state_id,
  );
  const proposition = input.propositions.find(
    ({ proposition_id }) => proposition_id === selection.proposition_id,
  );
  const epistemic = input.epistemic_states.find(
    ({ epistemic_state_id }) => epistemic_state_id === selection.epistemic_state_id,
  );
  const cutoff = new Date(input.manifest.audience_knowledge_cutoff_time).getTime();
  const knownFrom = new Date(epistemic?.known_from ?? Number.NaN).getTime();
  if (
    !inManifest || !proposition || !epistemic || !proposition.scope_authorized ||
    !epistemic.scope_authorized || !epistemic.valid_at_cutoff ||
    epistemic.proposition_id !== proposition.proposition_id ||
    epistemic.support_status !== 'SUPPORTED' || !Number.isFinite(cutoff) ||
    !Number.isFinite(knownFrom) || knownFrom > cutoff
  ) {
    failContent('AUDIENCE_BASIS_REF_INVALID', 'Epistemic basis fails exact closure or cutoff admission');
  }
  const projected = projectAudienceFact(input.schema, {
    leaf,
    task_market: input.task_market,
    task_jurisdiction: input.task_jurisdiction,
    task_audience_context: input.task_audience_context,
  });
  assertAudienceSemanticClosure(projected.identity, proposition.semantic_identity);
  return {
    tenant_id: input.manifest.tenant_id,
    workspace_id: input.manifest.workspace_id,
    audience_state_id: input.audience.audience_state_id,
    audience_field: leaf.audience_field,
    fact_path: leaf.fact_path,
    fact_value_hash: leaf.fact_value_hash,
    ordinal: selection.ordinal,
    basis_kind: 'AUDIENCE_EPISTEMIC_STATE',
    proposition_id: selection.proposition_id,
    epistemic_state_id: selection.epistemic_state_id,
  };
}

export function materializeAudienceFactBasisLinks(
  input: AudienceAdmissionInput,
  leaves: readonly AudienceFactLeaf[],
): readonly AudienceFactBasisLink[] {
  const keys = new Set<string>();
  return input.basis_selections.map((selection) => {
    assertSelectionShape(selection);
    const key = selectionKey(selection);
    if (keys.has(key)) {
      failContent('AUDIENCE_PROVENANCE_INVALID', `Duplicate Audience fact basis '${key}'`);
    }
    keys.add(key);
    const leaf = requireLeaf(leaves, selection);
    return selection.basis_kind === 'TASK_AUDIENCE_CONTEXT'
      ? admitTaskBasis(input, selection, leaf)
      : admitEpistemicBasis(input, selection, leaf);
  });
}
