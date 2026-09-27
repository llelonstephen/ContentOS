-- Milestone 2: Standalone ObjectRegistry Lock Authority Closure & Sequence Revocation
-- Revokes table-level UPDATE on object_registry from contentos_standalone_role.
-- Introduces restricted SECURITY DEFINER lock function for row locking without data mutation authority.
-- Revokes historical broad sequence privileges from contentos_standalone_role.

REVOKE UPDATE ON object_registry FROM contentos_standalone_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION contentos_lock_object_registry_row(
  p_object_id text,
  p_tenant_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1
  FROM public.object_registry
  WHERE object_id = p_object_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION contentos_lock_object_registry_row(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION contentos_lock_object_registry_row(text, text) TO contentos_standalone_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION contentos_lock_object_registry_row(text, text) TO contentos_runtime_role;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM contentos_standalone_role;
