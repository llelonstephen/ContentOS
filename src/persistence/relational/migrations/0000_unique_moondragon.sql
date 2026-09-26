CREATE TABLE "consumer_receipts" (
	"consumer_name" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"response_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consumer_receipts" ADD CONSTRAINT "consumer_receipts_event_id_outbox_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."outbox_events"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consumer_event" ON "consumer_receipts" USING btree ("consumer_name","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idempotency_key" ON "idempotency_records" USING btree ("idempotency_key");