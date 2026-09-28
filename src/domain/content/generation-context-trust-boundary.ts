import { failContent } from './content-error-codes.js';
import type { ExactEntityRef, ExactRevisionRef } from './types.js';

export const GENERATION_TRUST_LAYERS = [
  'SYSTEM_CONTROL_INSTRUCTIONS',
  'CANONICAL_DECISION_DATA',
  'UNTRUSTED_SOURCE_CONTENT',
  'OPTIONAL_STYLE_EXAMPLES',
] as const;
export type GenerationTrustLayer = (typeof GENERATION_TRUST_LAYERS)[number];

export type AuthorityRequest =
  | 'SYSTEM_OVERRIDE'
  | 'GOVERNANCE_OVERRIDE'
  | 'TASK_IDENTITY_CHANGE'
  | 'RUN_CONFIG_CHANGE'
  | 'TOOL_ESCALATION'
  | 'EXTERNAL_EFFECT'
  | 'CONTROL_PLANE_MUTATION'
  | 'SELF_CERTIFICATION';

export type ContextDataScope =
  | 'TENANT_PRIVATE'
  | 'WORKSPACE_SHARED'
  | 'AUTHORIZED_AGGREGATE'
  | 'GLOBAL_PUBLIC';

export interface GenerationContextItem {
  readonly context_item_id: string;
  readonly layer: GenerationTrustLayer;
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly data_scope: ContextDataScope;
  readonly scope_authorized: boolean;
  readonly attribution: ExactEntityRef | ExactRevisionRef;
  readonly decision_relevant: boolean;
  readonly generation_allowed: boolean;
  readonly contains_secret: boolean;
  readonly stale: boolean;
  readonly provides_unrestricted_datastore: boolean;
  readonly authority_requests: readonly AuthorityRequest[];
  readonly requested_tool_ids: readonly string[];
}

export interface GenerationContextAdmission {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly authorized_tool_ids: readonly string[];
  readonly items: readonly GenerationContextItem[];
}

function isCrossScope(item: GenerationContextItem, admission: GenerationContextAdmission): boolean {
  if (item.tenant_id === admission.tenant_id && item.workspace_id === admission.workspace_id) return false;
  return item.data_scope !== 'GLOBAL_PUBLIC' && item.data_scope !== 'AUTHORIZED_AGGREGATE';
}

export function validateGenerationContext(admission: GenerationContextAdmission): void {
  const authorizedTools = new Set(admission.authorized_tool_ids);
  for (const item of admission.items) {
    if (isCrossScope(item, admission) || !item.scope_authorized) {
      failContent('TENANT_SCOPE_VIOLATION', `Context item '${item.context_item_id}' is outside scope`);
    }
    if (!item.attribution || !item.context_item_id) {
      failContent(
        'GENERATION_CONTEXT_UNATTRIBUTED',
        'Every generation context item must have explicit canonical/config attribution',
      );
    }
    if (item.stale) {
      failContent('GENERATION_CONTEXT_STALE', `Context item '${item.context_item_id}' is stale`);
    }
    if (!item.decision_relevant || !item.generation_allowed || item.provides_unrestricted_datastore) {
      failContent(
        'GENERATION_CONTEXT_NOT_ALLOWED',
        `Context item '${item.context_item_id}' is not admitted for minimized generation use`,
      );
    }
    if (item.contains_secret) {
      failContent('GENERATION_SECRET_EXPOSURE', 'Secrets cannot enter standard generation context');
    }
    if (
      item.authority_requests.includes('EXTERNAL_EFFECT') ||
      item.authority_requests.includes('CONTROL_PLANE_MUTATION')
    ) {
      failContent(
        'GENERATION_EXTERNAL_EFFECT_FORBIDDEN',
        'SPEC05 generation has no external-effect or Control Plane authority',
      );
    }
    if (
      item.layer === 'UNTRUSTED_SOURCE_CONTENT' ||
      item.layer === 'OPTIONAL_STYLE_EXAMPLES'
    ) {
      if (item.authority_requests.length > 0 || item.requested_tool_ids.length > 0) {
        failContent(
          'GENERATION_AUTHORITY_ESCALATION',
          'Untrusted/style content cannot supply instructions or tool authority',
        );
      }
    }
    if (item.requested_tool_ids.some((toolId) => !authorizedTools.has(toolId))) {
      failContent('GENERATION_AUTHORITY_ESCALATION', 'Context requested a tool not pinned by RunConfig');
    }
  }
}
