-- M4 v3: completion is a single database-authorized transition, not a partial predicate.
REVOKE ALL ON FUNCTION public.complete_m4_stage_execution(text, integer, text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.complete_m4_stage_execution(text, integer, text, text) FROM contentos_runtime_role;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.complete_m4_stage_execution(text, integer, text, text);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.complete_m4_stage_execution(
  p_stage_execution_id text,
  p_tenant_id text,
  p_workspace_id text,
  p_run_id text,
  p_decision_cycle_id text,
  p_cycle_epoch integer,
  p_stage_name text,
  p_lease_owner text,
  p_fencing_token integer,
  p_idempotency_key text,
  p_canonical_input_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  stage_row public.stage_executions%ROWTYPE;
  run_row public.runs%ROWTYPE;
  cycle_row public.decision_cycles%ROWTYPE;
BEGIN
  SELECT * INTO stage_row
  FROM public.stage_executions
  WHERE stage_execution_id = p_stage_execution_id
  FOR UPDATE;
  IF NOT FOUND OR stage_row.tenant_id <> p_tenant_id
    OR stage_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR stage_row.run_id <> p_run_id
    OR stage_row.decision_cycle_id <> p_decision_cycle_id
    OR stage_row.stage_name <> p_stage_name
    OR stage_row.status <> 'RUNNING'
    OR stage_row.lease_owner <> p_lease_owner
    OR stage_row.lease_expires_at IS NULL OR stage_row.lease_expires_at <= now()
    OR stage_row.fencing_token <> p_fencing_token
    OR stage_row.idempotency_key <> p_idempotency_key
    OR stage_row.canonical_input_hash <> p_canonical_input_hash
    OR p_stage_name NOT IN (
      'AUDIENCE_PROVISIONAL', 'AUDIENCE_REFINE', 'AUDIENCE_FINALIZE',
      'STRATEGY_GENERATE', 'STRATEGY_GATE', 'ARCHITECTURE_GENERATE',
      'CANDIDATE_GENERATE', 'CANDIDATE_REWRITE', 'SPEC06_HANDOFF'
    ) THEN
    RETURN false;
  END IF;

  SELECT * INTO run_row FROM public.runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND OR run_row.tenant_id <> p_tenant_id
    OR run_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR run_row.status <> 'RUNNING'
    OR run_row.current_decision_cycle_id <> p_decision_cycle_id THEN
    RETURN false;
  END IF;

  SELECT * INTO cycle_row
  FROM public.decision_cycles
  WHERE decision_cycle_id = p_decision_cycle_id
  FOR UPDATE;
  IF NOT FOUND OR cycle_row.tenant_id <> p_tenant_id
    OR cycle_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR cycle_row.run_id <> p_run_id
    OR cycle_row.status <> 'OPEN'
    OR cycle_row.superseded_by_cycle_id IS NOT NULL
    OR cycle_row.fencing_epoch <> p_cycle_epoch THEN
    RETURN false;
  END IF;

  UPDATE public.stage_executions
  SET status = 'COMPLETED', completed_at = now(), error_code = NULL
  WHERE stage_execution_id = p_stage_execution_id AND status = 'RUNNING';
  RETURN FOUND;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.complete_m4_stage_execution(
  text, text, text, text, text, integer, text, text, integer, text, text
) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.complete_m4_stage_execution(
  text, text, text, text, text, integer, text, text, integer, text, text
) TO contentos_runtime_role;
--> statement-breakpoint
-- Preserve the pre-M4 relational FK contract before M4's richer scope guard runs.
CREATE OR REPLACE FUNCTION public.enforce_candidate_run_config_fk_precheck()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.run_configs WHERE run_config_id = NEW.run_config_id) THEN
    RAISE EXCEPTION 'content_candidates.run_config_id references a missing RunConfig'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.content_candidates'::regclass
      AND tgname = 'aaa_m4_candidate_run_config_fk_precheck'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER aaa_m4_candidate_run_config_fk_precheck
    BEFORE INSERT ON public.content_candidates
    FOR EACH ROW EXECUTE FUNCTION public.enforce_candidate_run_config_fk_precheck();
  END IF;
END;
$$;
