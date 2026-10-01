-- M5 Checkpoint 2: Stage Execution Completion Authority
CREATE OR REPLACE FUNCTION public.complete_m5_stage_execution(
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
  IF p_stage_execution_id IS NULL OR p_tenant_id IS NULL OR p_run_id IS NULL
    OR p_decision_cycle_id IS NULL OR p_cycle_epoch IS NULL OR p_stage_name IS NULL
    OR p_lease_owner IS NULL OR p_fencing_token IS NULL OR p_idempotency_key IS NULL
    OR p_canonical_input_hash IS NULL THEN
    RETURN false;
  END IF;

  IF btrim(p_stage_execution_id) = '' OR btrim(p_tenant_id) = '' OR btrim(p_run_id) = ''
    OR btrim(p_decision_cycle_id) = '' OR btrim(p_stage_name) = ''
    OR btrim(p_lease_owner) = '' OR btrim(p_idempotency_key) = ''
    OR btrim(p_canonical_input_hash) = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO stage_row
  FROM public.stage_executions
  WHERE stage_execution_id = p_stage_execution_id
  FOR UPDATE;
  IF NOT FOUND 
    OR stage_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR stage_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR stage_row.run_id IS DISTINCT FROM p_run_id
    OR stage_row.decision_cycle_id IS DISTINCT FROM p_decision_cycle_id
    OR stage_row.stage_name IS DISTINCT FROM p_stage_name
    OR stage_row.status IS DISTINCT FROM 'RUNNING'
    OR stage_row.lease_owner IS DISTINCT FROM p_lease_owner
    OR stage_row.lease_expires_at IS NULL OR stage_row.lease_expires_at <= now()
    OR stage_row.fencing_token IS DISTINCT FROM p_fencing_token
    OR stage_row.idempotency_key IS DISTINCT FROM p_idempotency_key
    OR stage_row.canonical_input_hash IS DISTINCT FROM p_canonical_input_hash
    OR p_stage_name IS NULL 
    OR p_stage_name NOT IN (
      'ASSERTION_EXTRACT', 'ASSERTION_MAP', 'ASSERTION_VALIDATE',
      'COMPOSITE_ASSESS', 'QUALITATIVE_EVALUATE', 'RISK_ASSESS',
      'UNCERTAINTY_ASSESS', 'EVALUATION_CLOSURE'
    ) THEN
    RETURN false;
  END IF;

  SELECT * INTO run_row FROM public.runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND 
    OR run_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR run_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR run_row.status IS DISTINCT FROM 'RUNNING'
    OR run_row.current_decision_cycle_id IS DISTINCT FROM p_decision_cycle_id THEN
    RETURN false;
  END IF;

  SELECT * INTO cycle_row
  FROM public.decision_cycles
  WHERE decision_cycle_id = p_decision_cycle_id
  FOR UPDATE;
  IF NOT FOUND 
    OR cycle_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR cycle_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR cycle_row.run_id IS DISTINCT FROM p_run_id
    OR cycle_row.status IS DISTINCT FROM 'OPEN'
    OR cycle_row.superseded_by_cycle_id IS NOT NULL
    OR cycle_row.fencing_epoch IS DISTINCT FROM p_cycle_epoch THEN
    RETURN false;
  END IF;

  UPDATE public.stage_executions
  SET status = 'COMPLETED', completed_at = now(), error_code = NULL
  WHERE stage_execution_id = p_stage_execution_id AND status = 'RUNNING';
  RETURN FOUND;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.complete_m5_stage_execution(
  text, text, text, text, text, integer, text, text, integer, text, text
) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.complete_m5_stage_execution(
  text, text, text, text, text, integer, text, text, integer, text, text
) TO contentos_runtime_role;
--> statement-breakpoint

-- M4 completion authority NULL bypass remediation
-- Applies identical hardening to existing M4 authority
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
  IF p_stage_execution_id IS NULL OR p_tenant_id IS NULL OR p_run_id IS NULL
    OR p_decision_cycle_id IS NULL OR p_cycle_epoch IS NULL OR p_stage_name IS NULL
    OR p_lease_owner IS NULL OR p_fencing_token IS NULL OR p_idempotency_key IS NULL
    OR p_canonical_input_hash IS NULL THEN
    RETURN false;
  END IF;

  IF btrim(p_stage_execution_id) = '' OR btrim(p_tenant_id) = '' OR btrim(p_run_id) = ''
    OR btrim(p_decision_cycle_id) = '' OR btrim(p_stage_name) = ''
    OR btrim(p_lease_owner) = '' OR btrim(p_idempotency_key) = ''
    OR btrim(p_canonical_input_hash) = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO stage_row
  FROM public.stage_executions
  WHERE stage_execution_id = p_stage_execution_id
  FOR UPDATE;
  IF NOT FOUND 
    OR stage_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR stage_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR stage_row.run_id IS DISTINCT FROM p_run_id
    OR stage_row.decision_cycle_id IS DISTINCT FROM p_decision_cycle_id
    OR stage_row.stage_name IS DISTINCT FROM p_stage_name
    OR stage_row.status IS DISTINCT FROM 'RUNNING'
    OR stage_row.lease_owner IS DISTINCT FROM p_lease_owner
    OR stage_row.lease_expires_at IS NULL OR stage_row.lease_expires_at <= now()
    OR stage_row.fencing_token IS DISTINCT FROM p_fencing_token
    OR stage_row.idempotency_key IS DISTINCT FROM p_idempotency_key
    OR stage_row.canonical_input_hash IS DISTINCT FROM p_canonical_input_hash
    OR p_stage_name IS NULL 
    OR p_stage_name NOT IN (
      'AUDIENCE_PROVISIONAL', 'AUDIENCE_REFINE', 'AUDIENCE_FINALIZE',
      'STRATEGY_GENERATE', 'STRATEGY_GATE', 'ARCHITECTURE_GENERATE',
      'CANDIDATE_GENERATE', 'CANDIDATE_REWRITE', 'SPEC06_HANDOFF'
    ) THEN
    RETURN false;
  END IF;

  SELECT * INTO run_row FROM public.runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND 
    OR run_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR run_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR run_row.status IS DISTINCT FROM 'RUNNING'
    OR run_row.current_decision_cycle_id IS DISTINCT FROM p_decision_cycle_id THEN
    RETURN false;
  END IF;

  SELECT * INTO cycle_row
  FROM public.decision_cycles
  WHERE decision_cycle_id = p_decision_cycle_id
  FOR UPDATE;
  IF NOT FOUND 
    OR cycle_row.tenant_id IS DISTINCT FROM p_tenant_id
    OR cycle_row.workspace_id IS DISTINCT FROM p_workspace_id
    OR cycle_row.run_id IS DISTINCT FROM p_run_id
    OR cycle_row.status IS DISTINCT FROM 'OPEN'
    OR cycle_row.superseded_by_cycle_id IS NOT NULL
    OR cycle_row.fencing_epoch IS DISTINCT FROM p_cycle_epoch THEN
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
