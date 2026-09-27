-- Milestone 2: SPEC03 Standalone Role Least-Privilege Closure
-- Authoritative forward migration for operational NOLOGIN standalone principal.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_standalone_role') THEN
    CREATE ROLE contentos_standalone_role NOLOGIN;
  END IF;
  REVOKE contentos_standalone_role FROM contentos_runtime_role;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO contentos_standalone_role;
--> statement-breakpoint
-- Canonical knowledge and reference tables required for standalone ingestion writes and reads
GRANT SELECT, INSERT ON
  "propositions",
  "evidence_items",
  "evidence_proposition_links",
  "evidence_assessments",
  "epistemic_state_versions",
  "knowledge_gaps",
  "research_traces",
  "source_artifacts",
  "immutable_entity_registry",
  "object_references",
  "epistemic_state_assessments"
TO contentos_standalone_role;
--> statement-breakpoint
-- Read-only references required for origin, policy, task, revision, and availability checks
GRANT SELECT ON
  "revision_registry",
  "object_registry",
  "rights_policies",
  "performance_observations",
  "task_contract_revisions",
  "run_configs",
  "deleted_target_tombstones",
  "decision_cycles",
  "stage_executions"
TO contentos_standalone_role;
--> statement-breakpoint
-- Object registry row locking required by ingestSourceArtifact and extractEvidenceItem (SELECT ... FOR UPDATE)
GRANT UPDATE ON "object_registry" TO contentos_standalone_role;
--> statement-breakpoint
-- Sequence access required for serial identifiers
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contentos_standalone_role;
--> statement-breakpoint
-- Re-assert revocation from runtime role
REVOKE contentos_standalone_role FROM contentos_runtime_role;
