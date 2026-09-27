-- Milestone 3: SPEC04 Governance & Policy Engine Privilege Closure
-- 1. Control Plane Immutability from Runtime:
-- Revoke INSERT, UPDATE, DELETE, TRUNCATE on Control Plane revisions from contentos_runtime_role.
-- Runtime role can only SELECT active/frozen Control Plane revisions, never mutate them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_control_plane_role') THEN
    CREATE ROLE contentos_control_plane_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_runtime_role') THEN
    CREATE ROLE contentos_runtime_role NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO contentos_runtime_role, contentos_control_plane_role;
--> statement-breakpoint
-- Strict revocation of Control Plane mutation authority from runtime role (SPEC04 §145 Vector 03, 04, 05, 80; Preflight 31)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  control_plane_activations,
  guidance_revisions,
  normative_rule_revisions,
  decision_policy_revisions
FROM contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT ON
  control_plane_activations,
  guidance_revisions,
  normative_rule_revisions,
  decision_policy_revisions
TO contentos_runtime_role;
--> statement-breakpoint
-- Control plane role has full mutation rights over control plane tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
  control_plane_activations,
  guidance_revisions,
  normative_rule_revisions,
  decision_policy_revisions
TO contentos_control_plane_role;
--> statement-breakpoint
-- Runtime role has SELECT and INSERT on post-snapshot governance and decision tables
GRANT SELECT, INSERT ON
  governance_snapshots,
  governance_snapshot_guidance,
  governance_snapshot_rules,
  governance_snapshot_policies,
  applicability_assessments,
  policy_results,
  policy_conflict_resolutions,
  policy_overrides,
  human_review_records,
  decision_records,
  decision_policy_results,
  decision_conflict_resolutions
TO contentos_runtime_role;
--> statement-breakpoint
-- Strict revocation of UPDATE and DELETE on immutable governance and decision tables (SPEC04 §145 Vector 07, 62, 63; Preflight 03, 13)
REVOKE UPDATE, DELETE, TRUNCATE ON
  governance_snapshots,
  governance_snapshot_guidance,
  governance_snapshot_rules,
  governance_snapshot_policies,
  applicability_assessments,
  policy_results,
  policy_conflict_resolutions,
  policy_overrides,
  human_review_records,
  decision_records,
  decision_policy_results,
  decision_conflict_resolutions
FROM contentos_runtime_role;
