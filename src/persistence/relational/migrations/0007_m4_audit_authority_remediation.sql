-- M4 audit remediation: runtime may complete, never forge, StageExecution authority.
REVOKE UPDATE ON public.stage_executions FROM contentos_runtime_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.complete_m4_stage_execution(
  p_stage_execution_id text,
  p_fencing_token integer,
  p_idempotency_key text,
  p_canonical_input_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.stage_executions
  SET status = 'COMPLETED', completed_at = now(), error_code = NULL
  WHERE stage_execution_id = p_stage_execution_id
    AND stage_name IN (
      'AUDIENCE_PROVISIONAL', 'AUDIENCE_REFINE', 'AUDIENCE_FINALIZE',
      'STRATEGY_GENERATE', 'STRATEGY_GATE', 'ARCHITECTURE_GENERATE',
      'CANDIDATE_GENERATE', 'CANDIDATE_REWRITE', 'SPEC06_HANDOFF'
    )
    AND status = 'RUNNING'
    AND fencing_token = p_fencing_token
    AND idempotency_key = p_idempotency_key
    AND canonical_input_hash = p_canonical_input_hash;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.complete_m4_stage_execution(text, integer, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.complete_m4_stage_execution(text, integer, text, text)
TO contentos_runtime_role;
