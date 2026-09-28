import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface ContentRuntimeOutboxEvent {
  eventId?: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
}

export async function writeContentRuntimeOutboxEvents(
  sqlTx: any,
  events: readonly ContentRuntimeOutboxEvent[],
): Promise<string[]> {
  if (events.length === 0) {
    throw new RegistryValidationError(
      'CONTENT_RUNTIME_OUTBOX_REQUIRED',
      'An M4 canonical commit must atomically append at least one outbox event.',
    );
  }
  const eventIds: string[] = [];
  for (const event of events) {
    const payload = JSON.stringify(event.payload);
    const rows = event.eventId
      ? await sqlTx`
          INSERT INTO outbox_events (
            event_id, aggregate_type, aggregate_id, event_type, payload, created_at
          ) VALUES (
            ${event.eventId}, ${event.aggregateType}, ${event.aggregateId},
            ${event.eventType}, ${payload}, now()
          ) RETURNING event_id
        `
      : await sqlTx`
          INSERT INTO outbox_events (
            aggregate_type, aggregate_id, event_type, payload, created_at
          ) VALUES (
            ${event.aggregateType}, ${event.aggregateId}, ${event.eventType},
            ${payload}, now()
          ) RETURNING event_id
        `;
    eventIds.push(String(rows[0].event_id));
  }
  return eventIds;
}
