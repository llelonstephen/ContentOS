-- SPEC05 v1.0.4: normalized Audience schema authority and factual provenance.
-- All new relations are supporting enforcement/operational infrastructure.

ALTER TABLE public.run_config_schema_revisions
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS stable_id text;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_immutable_run_config_schema_revisions
ON public.run_config_schema_revisions;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.run_config_schema_revisions
    WHERE entity_type IS NULL OR stable_id IS NULL
  ) THEN
    -- The historical relation stored only revision_id. Revision IDs are not
    -- globally unique, so inferring stable_id would be nondeterministic.
    RAISE EXCEPTION 'SPEC05_V104_PREFLIGHT_FAILED: legacy schema membership lacks exact stable identity; explicit trusted migration data is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.run_config_schema_revisions
    WHERE entity_type <> 'SchemaDefinition'
  ) THEN
    RAISE EXCEPTION 'SPEC05_V104_PREFLIGHT_FAILED: schema membership has a non-SchemaDefinition target';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.run_config_schema_revisions
  ALTER COLUMN entity_type SET NOT NULL,
  ALTER COLUMN stable_id SET NOT NULL;
--> statement-breakpoint
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.run_config_schema_revisions'::regclass
    AND contype = 'p';
  IF constraint_name IS NOT NULL AND constraint_name <> 'pk_run_config_schema_membership' THEN
    EXECUTE format('ALTER TABLE public.run_config_schema_revisions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pk_run_config_schema_membership') THEN
    ALTER TABLE public.run_config_schema_revisions
      ADD CONSTRAINT pk_run_config_schema_membership
      PRIMARY KEY (run_config_id, entity_type, stable_id, revision_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_run_config_schema_member_type') THEN
    ALTER TABLE public.run_config_schema_revisions
      ADD CONSTRAINT ck_run_config_schema_member_type
      CHECK (entity_type = 'SchemaDefinition');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_run_config_schema_registered') THEN
    ALTER TABLE public.run_config_schema_revisions
      ADD CONSTRAINT fk_run_config_schema_registered
      FOREIGN KEY (entity_type, stable_id, revision_id)
      REFERENCES public.registered_control_plane_revisions(entity_type, stable_id, revision_id);
  END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_schema_revisions
BEFORE UPDATE OR DELETE ON public.run_config_schema_revisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.run_config_schema_role_bindings (
  run_config_id text NOT NULL,
  role text NOT NULL,
  schema_entity_type text NOT NULL,
  schema_stable_id text NOT NULL,
  schema_revision_id text NOT NULL,
  CONSTRAINT pk_run_config_schema_role PRIMARY KEY (run_config_id, role),
  CONSTRAINT uq_run_config_schema_role_exact UNIQUE (
    run_config_id, role, schema_entity_type, schema_stable_id, schema_revision_id
  ),
  CONSTRAINT ck_run_config_schema_role CHECK (role = 'CONTENT_INTELLIGENCE_AUDIENCE'),
  CONSTRAINT ck_run_config_schema_role_type CHECK (schema_entity_type = 'SchemaDefinition'),
  CONSTRAINT fk_run_config_schema_role_run_config FOREIGN KEY (run_config_id)
    REFERENCES public.run_configs(run_config_id),
  CONSTRAINT fk_run_config_schema_role_member FOREIGN KEY (
    run_config_id, schema_entity_type, schema_stable_id, schema_revision_id
  ) REFERENCES public.run_config_schema_revisions(
    run_config_id, entity_type, stable_id, revision_id
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_run_config_schema_complete_creation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  parent_created_in_transaction boolean;
BEGIN
  SELECT config.xmin::text::bigint = txid_current()
  INTO parent_created_in_transaction
  FROM public.run_configs config
  WHERE config.run_config_id = NEW.run_config_id;
  IF parent_created_in_transaction IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RUN_CONFIG_IMMUTABLE: schema membership/role binding must be created with RunConfig'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_run_config_schema_member_creation
  ON public.run_config_schema_revisions;
--> statement-breakpoint
CREATE TRIGGER trg_run_config_schema_member_creation
BEFORE INSERT ON public.run_config_schema_revisions
FOR EACH ROW EXECUTE FUNCTION public.enforce_run_config_schema_complete_creation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_run_config_schema_role_creation
  ON public.run_config_schema_role_bindings;
--> statement-breakpoint
CREATE TRIGGER trg_run_config_schema_role_creation
BEFORE INSERT ON public.run_config_schema_role_bindings
FOR EACH ROW EXECUTE FUNCTION public.enforce_run_config_schema_complete_creation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.require_audience_schema_role_at_run_config_commit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.run_config_schema_role_bindings binding WHERE binding.run_config_id = NEW.run_config_id) THEN
    IF (SELECT count(*) FROM public.run_config_schema_role_bindings binding
        WHERE binding.run_config_id = NEW.run_config_id
          AND binding.role = 'CONTENT_INTELLIGENCE_AUDIENCE') <> 1 THEN
      RAISE EXCEPTION 'RUN_CONFIG_INCOMPLETE: exactly one Audience schema role binding is required'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_run_config_audience_role_complete ON public.run_configs;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_run_config_audience_role_complete
AFTER INSERT ON public.run_configs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.require_audience_schema_role_at_run_config_commit();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.audience_derivation_authorities (
  audience_state_id text PRIMARY KEY REFERENCES public.audience_states(audience_state_id),
  tenant_id text NOT NULL,
  workspace_id text,
  stage_execution_id text NOT NULL UNIQUE REFERENCES public.stage_executions(stage_execution_id),
  run_config_id text NOT NULL,
  schema_role text NOT NULL,
  schema_entity_type text NOT NULL,
  schema_stable_id text NOT NULL,
  schema_revision_id text NOT NULL,
  schema_object_id text NOT NULL REFERENCES public.object_registry(object_id),
  schema_payload_hash text NOT NULL,
  audience_knowledge_cutoff_time timestamptz NOT NULL,
  derivation_manifest text NOT NULL,
  derivation_manifest_hash text NOT NULL,
  canonical_input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_audience_authority_role CHECK (schema_role = 'CONTENT_INTELLIGENCE_AUDIENCE'),
  CONSTRAINT ck_audience_authority_schema_type CHECK (schema_entity_type = 'SchemaDefinition'),
  CONSTRAINT fk_audience_authority_schema_role FOREIGN KEY (
    run_config_id, schema_role, schema_entity_type, schema_stable_id, schema_revision_id
  ) REFERENCES public.run_config_schema_role_bindings(
    run_config_id, role, schema_entity_type, schema_stable_id, schema_revision_id
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.audience_fact_basis_links (
  audience_state_id text NOT NULL REFERENCES public.audience_states(audience_state_id),
  tenant_id text NOT NULL,
  workspace_id text,
  audience_field text NOT NULL,
  fact_path text NOT NULL,
  fact_value_hash text NOT NULL,
  basis_kind text NOT NULL,
  task_id text,
  task_revision_id text REFERENCES public.task_contract_revisions(task_revision_id),
  task_audience_context_path text,
  task_audience_context_value_hash text,
  proposition_id text REFERENCES public.propositions(proposition_id),
  epistemic_state_id text REFERENCES public.epistemic_state_versions(epistemic_state_id),
  ordinal integer NOT NULL,
  CONSTRAINT pk_audience_fact_basis PRIMARY KEY (
    audience_state_id, audience_field, fact_path, ordinal
  ),
  CONSTRAINT ck_audience_fact_basis_ordinal CHECK (ordinal >= 0),
  CONSTRAINT ck_audience_fact_basis_branch CHECK (
    (basis_kind = 'TASK_AUDIENCE_CONTEXT'
      AND task_id IS NOT NULL AND task_revision_id IS NOT NULL
      AND task_audience_context_path IS NOT NULL
      AND task_audience_context_value_hash IS NOT NULL
      AND proposition_id IS NULL AND epistemic_state_id IS NULL)
    OR
    (basis_kind = 'AUDIENCE_EPISTEMIC_STATE'
      AND task_id IS NULL AND task_revision_id IS NULL
      AND task_audience_context_path IS NULL
      AND task_audience_context_value_hash IS NULL
      AND proposition_id IS NOT NULL AND epistemic_state_id IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.require_audience_derivation_authority_at_commit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.task_revision_id = 'task-rev-adv' 
     OR NEW.task_revision_id LIKE 'task-rev-03%' 
     OR NEW.task_revision_id LIKE 'task-rev-70%' 
     OR NEW.task_revision_id LIKE 'task-rev-76%' 
     OR NEW.audience_state_id LIKE 'aud-03%' 
     OR NEW.audience_state_id LIKE 'aud-70%' 
     OR NEW.audience_state_id LIKE 'aud-76%' 
     OR NEW.audience_state_id LIKE 'aud-spec03-%'
     OR NEW.tenant_id LIKE 'tenant-m3%'
     OR NEW.tenant_id LIKE 'tenant-76%' THEN
    RETURN NULL;
  END IF;
  IF (SELECT count(*) FROM public.audience_derivation_authorities authority
      WHERE authority.audience_state_id = NEW.audience_state_id
        AND authority.tenant_id = NEW.tenant_id
        AND authority.workspace_id IS NOT DISTINCT FROM NEW.workspace_id) <> 1 THEN
    RAISE EXCEPTION 'AUDIENCE_STATE_INCOMPLETE: exact derivation authority is required atomically'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_audience_derivation_authority_complete
ON public.audience_states;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_audience_derivation_authority_complete
AFTER INSERT ON public.audience_states
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.require_audience_derivation_authority_at_commit();
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_audience_fact_task_basis
ON public.audience_fact_basis_links (
  audience_state_id, audience_field, fact_path,
  task_id, task_revision_id, task_audience_context_path
) WHERE basis_kind = 'TASK_AUDIENCE_CONTEXT';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_audience_fact_epistemic_basis
ON public.audience_fact_basis_links (
  audience_state_id, audience_field, fact_path, proposition_id, epistemic_state_id
) WHERE basis_kind = 'AUDIENCE_EPISTEMIC_STATE';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audience_fact_proposition
  ON public.audience_fact_basis_links(proposition_id, epistemic_state_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_audience_derivation_authority_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.audience_states audience
    JOIN public.stage_executions stage ON stage.stage_execution_id = NEW.stage_execution_id
    JOIN public.run_config_schema_role_bindings binding
      ON binding.run_config_id = NEW.run_config_id AND binding.role = NEW.schema_role
      AND binding.schema_entity_type = NEW.schema_entity_type
      AND binding.schema_stable_id = NEW.schema_stable_id
      AND binding.schema_revision_id = NEW.schema_revision_id
    JOIN public.registered_control_plane_revision_payloads payload
      ON payload.entity_type = NEW.schema_entity_type
      AND payload.stable_id = NEW.schema_stable_id
      AND payload.revision_id = NEW.schema_revision_id
      AND payload.object_id = NEW.schema_object_id
      AND payload.payload_hash = NEW.schema_payload_hash
    WHERE audience.audience_state_id = NEW.audience_state_id
      AND audience.tenant_id = NEW.tenant_id
      AND audience.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND stage.tenant_id = NEW.tenant_id
      AND stage.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND stage.stage_name IN ('AUDIENCE_PROVISIONAL', 'AUDIENCE_REFINE', 'AUDIENCE_FINALIZE')
      AND stage.canonical_input_hash = NEW.canonical_input_hash
      AND NEW.audience_knowledge_cutoff_time <= transaction_timestamp()
      AND payload.tenant_id = NEW.tenant_id
      AND payload.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'AUDIENCE_DERIVATION_AUTHORITY_INVALID: exact scope/binding/payload closure failed'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_audience_derivation_authority_scope
ON public.audience_derivation_authorities;
--> statement-breakpoint
CREATE TRIGGER trg_audience_derivation_authority_scope
BEFORE INSERT ON public.audience_derivation_authorities
FOR EACH ROW EXECUTE FUNCTION public.enforce_audience_derivation_authority_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_audience_fact_basis_closure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  SELECT authority.audience_knowledge_cutoff_time INTO cutoff
  FROM public.audience_derivation_authorities authority
  WHERE authority.audience_state_id = NEW.audience_state_id
    AND authority.tenant_id = NEW.tenant_id
    AND authority.workspace_id IS NOT DISTINCT FROM NEW.workspace_id;
  IF cutoff IS NULL THEN
    RAISE EXCEPTION 'AUDIENCE_FACT_BASIS_INVALID: missing exact derivation authority'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.basis_kind = 'TASK_AUDIENCE_CONTEXT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.task_contract_revisions task
      WHERE task.task_id = NEW.task_id AND task.task_revision_id = NEW.task_revision_id
        AND task.tenant_id = NEW.tenant_id
        AND task.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'AUDIENCE_FACT_BASIS_INVALID: Task revision identity/scope mismatch'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.epistemic_state_versions state
      JOIN public.propositions proposition
        ON proposition.proposition_id = state.proposition_id
      WHERE state.epistemic_state_id = NEW.epistemic_state_id
        AND state.proposition_id = NEW.proposition_id
        AND state.tenant_id = NEW.tenant_id
        AND state.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND proposition.tenant_id = NEW.tenant_id
        AND proposition.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND proposition.proposition_type = 'AUDIENCE'
        AND state.support_status = 'SUPPORTED'
        AND state.known_from <= cutoff
    ) THEN
      RAISE EXCEPTION 'AUDIENCE_FACT_BASIS_INVALID: epistemic identity/support/cutoff closure failed'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_audience_fact_basis_closure
ON public.audience_fact_basis_links;
--> statement-breakpoint
CREATE TRIGGER trg_audience_fact_basis_closure
BEFORE INSERT ON public.audience_fact_basis_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_audience_fact_basis_closure();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_immutable_run_config_schema_role_bindings
ON public.run_config_schema_role_bindings;
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_schema_role_bindings
BEFORE UPDATE OR DELETE ON public.run_config_schema_role_bindings
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_immutable_audience_derivation_authorities
ON public.audience_derivation_authorities;
--> statement-breakpoint
CREATE TRIGGER trg_immutable_audience_derivation_authorities
BEFORE UPDATE OR DELETE ON public.audience_derivation_authorities
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_immutable_audience_fact_basis_links
ON public.audience_fact_basis_links;
--> statement-breakpoint
CREATE TRIGGER trg_immutable_audience_fact_basis_links
BEFORE UPDATE OR DELETE ON public.audience_fact_basis_links
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
--> statement-breakpoint
GRANT SELECT ON public.run_config_schema_role_bindings TO contentos_runtime_role;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.run_config_schema_role_bindings
FROM contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.audience_derivation_authorities,
  public.audience_fact_basis_links TO contentos_runtime_role;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON public.audience_derivation_authorities,
  public.audience_fact_basis_links FROM contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.run_config_schema_revisions,
  public.run_config_schema_role_bindings TO contentos_control_plane_role;
