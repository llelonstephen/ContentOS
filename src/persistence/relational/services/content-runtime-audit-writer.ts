export interface ContentRuntimeAuditEvent {
  auditEventId: string;
  tenantId: string;
  workspaceId?: string | null;
  eventType: string;
  principalRef: string;
  resourceRef?: string | null;
  runId: string;
  reasonCodes: readonly string[];
}

export async function writeContentRuntimeAuditEvent(
  sqlTx: any,
  event: ContentRuntimeAuditEvent,
): Promise<void> {
  await sqlTx`
    INSERT INTO audit_events (
      audit_event_id, tenant_id, workspace_id, event_type, principal_ref,
      resource_ref, run_id, reason_codes, created_at
    ) VALUES (
      ${event.auditEventId}, ${event.tenantId}, ${event.workspaceId ?? null},
      ${event.eventType}, ${event.principalRef}, ${event.resourceRef ?? null},
      ${event.runId}, ${JSON.stringify(event.reasonCodes)}, now()
    )
  `;
}
