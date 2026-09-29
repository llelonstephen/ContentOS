-- M4 Content Intelligence Runtime: frozen-schema invariant closure.
-- Adds constraints, triggers, indexes, and grants only; no canonical entity/column.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.content_architectures child
    LEFT JOIN public.content_architectures parent
      ON parent.architecture_id = child.supersedes_architecture_id
    WHERE child.supersedes_architecture_id IS NOT NULL
      AND parent.architecture_id IS NULL
  ) THEN
    RAISE EXCEPTION 'M4_MIGRATION_PREFLIGHT_FAILED: orphan supersedes_architecture_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.content_candidates child
    LEFT JOIN public.content_candidates parent
      ON parent.candidate_id = child.parent_candidate_id
    WHERE child.parent_candidate_id IS NOT NULL
      AND parent.candidate_id IS NULL
  ) THEN
    RAISE EXCEPTION 'M4_MIGRATION_PREFLIGHT_FAILED: orphan parent_candidate_id';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_content_arch_supersedes') THEN
    ALTER TABLE public.content_architectures ADD CONSTRAINT
      fk_content_arch_supersedes
      FOREIGN KEY (supersedes_architecture_id)
      REFERENCES public.content_architectures(architecture_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_content_candidate_parent') THEN
    ALTER TABLE public.content_candidates ADD CONSTRAINT
      fk_content_candidate_parent
      FOREIGN KEY (parent_candidate_id)
      REFERENCES public.content_candidates(candidate_id) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.content_architectures VALIDATE CONSTRAINT
  fk_content_arch_supersedes;
--> statement-breakpoint
ALTER TABLE public.content_candidates VALIDATE CONSTRAINT
  fk_content_candidate_parent;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_arch_supersedes
  ON public.content_architectures (supersedes_architecture_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_candidate_parent
  ON public.content_candidates (parent_candidate_id);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_stage_output_ref_exact_shape') THEN
    ALTER TABLE public.stage_execution_output_refs ADD CONSTRAINT ck_stage_output_ref_exact_shape
      CHECK (
        (ref_kind = 'IMMUTABLE_ENTITY' AND entity_id IS NOT NULL
          AND stable_id IS NULL AND revision_id IS NULL)
        OR
        (ref_kind = 'REVISION' AND entity_id IS NULL
          AND stable_id IS NOT NULL AND revision_id IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.stage_execution_output_refs
  VALIDATE CONSTRAINT ck_stage_output_ref_exact_shape;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stage_output_immutable_ref
  ON public.stage_execution_output_refs (entity_type, entity_id)
  WHERE ref_kind = 'IMMUTABLE_ENTITY';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stage_output_revision_ref
  ON public.stage_execution_output_refs (entity_type, stable_id, revision_id)
  WHERE ref_kind = 'REVISION';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_m4_immutable_entity_registry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_entity_type text;
  v_entity_id text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'audience_states' THEN
      v_entity_type := 'AudienceState'; v_entity_id := NEW.audience_state_id;
    WHEN 'strategy_hypotheses' THEN
      v_entity_type := 'StrategyHypothesis'; v_entity_id := NEW.strategy_id;
    WHEN 'content_architectures' THEN
      v_entity_type := 'ContentArchitecture'; v_entity_id := NEW.architecture_id;
    WHEN 'content_units' THEN
      v_entity_type := 'ContentUnit'; v_entity_id := NEW.unit_id;
    WHEN 'content_candidates' THEN
      v_entity_type := 'ContentCandidate'; v_entity_id := NEW.candidate_id;
    ELSE
      RAISE EXCEPTION 'M4_REGISTRY_GUARD_CONFIGURATION_INVALID: unsupported table %', TG_TABLE_NAME
        USING ERRCODE = '55000';
  END CASE;
  IF NOT EXISTS (
    SELECT 1 FROM public.immutable_entity_registry registry
    WHERE registry.entity_type = v_entity_type
      AND registry.entity_id = v_entity_id
      AND registry.tenant_id = NEW.tenant_id
      AND registry.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND registry.payload_state = 'AVAILABLE'
  ) THEN
    RAISE EXCEPTION 'REGISTRY_IDENTITY_REQUIRED: missing exact registry entry for %:%',
      v_entity_type, v_entity_id USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_registry_audience_states ON public.audience_states;
--> statement-breakpoint
CREATE TRIGGER trg_registry_audience_states BEFORE INSERT ON public.audience_states
FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_immutable_entity_registry();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_registry_strategy_hypotheses ON public.strategy_hypotheses;
--> statement-breakpoint
CREATE TRIGGER trg_registry_strategy_hypotheses BEFORE INSERT ON public.strategy_hypotheses
FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_immutable_entity_registry();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_registry_content_architectures ON public.content_architectures;
--> statement-breakpoint
CREATE TRIGGER trg_registry_content_architectures BEFORE INSERT ON public.content_architectures
FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_immutable_entity_registry();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_registry_content_units ON public.content_units;
--> statement-breakpoint
CREATE TRIGGER trg_registry_content_units BEFORE INSERT ON public.content_units
FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_immutable_entity_registry();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_registry_content_candidates ON public.content_candidates;
--> statement-breakpoint
CREATE TRIGGER trg_registry_content_candidates BEFORE INSERT ON public.content_candidates
FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_immutable_entity_registry();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_architecture_unit_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_position integer;
BEGIN
  PERFORM 1 FROM public.content_architectures
  WHERE architecture_id = NEW.architecture_id FOR UPDATE;
  SELECT position INTO STRICT v_position FROM public.content_units
  WHERE unit_id = NEW.unit_id;
  IF EXISTS (
    SELECT 1 FROM public.content_architecture_units link
    JOIN public.content_units unit ON unit.unit_id = link.unit_id
    WHERE link.architecture_id = NEW.architecture_id
      AND link.unit_id <> NEW.unit_id
      AND unit.position = v_position
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_CONTENT_UNIT_POSITION: architecture % position %',
      NEW.architecture_id, v_position USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_content_architecture_unit_position
  ON public.content_architecture_units;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_content_architecture_unit_position
AFTER INSERT ON public.content_architecture_units
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.enforce_architecture_unit_position();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_m4_reference_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'audience_states' THEN
    IF NOT EXISTS (SELECT 1 FROM public.task_contract_revisions ref
      WHERE ref.task_revision_id = NEW.task_revision_id
        AND ref.tenant_id = NEW.tenant_id
        AND ref.workspace_id IS NOT DISTINCT FROM NEW.workspace_id) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: AudienceState Task';
    END IF;
  ELSIF TG_TABLE_NAME = 'strategy_hypotheses' THEN
    IF NOT EXISTS (SELECT 1 FROM public.task_contract_revisions task
      JOIN public.audience_states audience
        ON audience.audience_state_id = NEW.audience_state_id
      WHERE task.task_revision_id = NEW.task_revision_id
        AND task.tenant_id = NEW.tenant_id
        AND (task.workspace_id IS NOT DISTINCT FROM NEW.workspace_id OR (NEW.workspace_id IS NOT NULL AND task.workspace_id IS NULL))
        AND audience.tenant_id = NEW.tenant_id
        AND (audience.workspace_id IS NOT DISTINCT FROM NEW.workspace_id OR (NEW.workspace_id IS NOT NULL AND audience.workspace_id IS NULL))) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Strategy inputs';
    END IF;
  ELSIF TG_TABLE_NAME = 'content_architectures' THEN
    IF NOT EXISTS (SELECT 1 FROM public.task_contract_revisions task
      JOIN public.strategy_hypotheses strategy
        ON strategy.strategy_id = NEW.strategy_id
      WHERE task.task_revision_id = NEW.task_revision_id
        AND task.tenant_id = NEW.tenant_id
        AND task.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND strategy.tenant_id = NEW.tenant_id
        AND strategy.workspace_id IS NOT DISTINCT FROM NEW.workspace_id)
      OR (NEW.supersedes_architecture_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.content_architectures parent
        WHERE parent.architecture_id = NEW.supersedes_architecture_id
          AND parent.tenant_id = NEW.tenant_id
          AND parent.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      )) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Architecture inputs';
    END IF;
  ELSIF TG_TABLE_NAME = 'content_candidates' THEN
    IF NOT EXISTS (SELECT 1 FROM public.task_contract_revisions task
      JOIN public.strategy_hypotheses strategy ON strategy.strategy_id = NEW.strategy_id
      JOIN public.content_architectures architecture
        ON architecture.architecture_id = NEW.architecture_id
      JOIN public.run_configs config ON config.run_config_id = NEW.run_config_id
      WHERE task.task_revision_id = NEW.task_revision_id
        AND task.tenant_id = NEW.tenant_id
        AND task.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND strategy.tenant_id = NEW.tenant_id
        AND strategy.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND architecture.tenant_id = NEW.tenant_id
        AND architecture.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
        AND config.tenant_id = NEW.tenant_id
        AND config.workspace_id IS NOT DISTINCT FROM NEW.workspace_id)
      OR (NEW.parent_candidate_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.content_candidates parent
        WHERE parent.candidate_id = NEW.parent_candidate_id
          AND parent.tenant_id = NEW.tenant_id
          AND parent.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      )) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Candidate inputs';
    END IF;
  ELSIF TG_TABLE_NAME = 'strategy_required_propositions' THEN
    IF NOT EXISTS (SELECT 1 FROM public.strategy_hypotheses strategy
      JOIN public.propositions proposition
        ON proposition.proposition_id = NEW.proposition_id
      WHERE strategy.strategy_id = NEW.strategy_id
        AND proposition.tenant_id = strategy.tenant_id
        AND proposition.workspace_id IS NOT DISTINCT FROM strategy.workspace_id) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Strategy Proposition';
    END IF;
  ELSIF TG_TABLE_NAME = 'content_architecture_units' THEN
    IF NOT EXISTS (SELECT 1 FROM public.content_architectures architecture
      JOIN public.content_units unit ON unit.unit_id = NEW.unit_id
      WHERE architecture.architecture_id = NEW.architecture_id
        AND unit.tenant_id = architecture.tenant_id
        AND unit.workspace_id IS NOT DISTINCT FROM architecture.workspace_id) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Architecture Unit';
    END IF;
  ELSIF TG_TABLE_NAME = 'content_unit_propositions' THEN
    IF NOT EXISTS (SELECT 1 FROM public.content_units unit
      JOIN public.propositions proposition
        ON proposition.proposition_id = NEW.proposition_id
      WHERE unit.unit_id = NEW.unit_id
        AND proposition.tenant_id = unit.tenant_id
        AND proposition.workspace_id IS NOT DISTINCT FROM unit.workspace_id) THEN
      RAISE EXCEPTION 'M4_REFERENCE_SCOPE_VIOLATION: Unit Proposition';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'audience_states', 'strategy_hypotheses', 'content_architectures',
    'content_candidates', 'strategy_required_propositions',
    'content_architecture_units', 'content_unit_propositions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_m4_reference_scope ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_m4_reference_scope BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.enforce_m4_reference_scope()',
      table_name
    );
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'contentos_runtime_role') THEN
    CREATE ROLE contentos_runtime_role NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT, INSERT ON
  public.audience_states,
  public.strategy_hypotheses,
  public.strategy_required_propositions,
  public.content_architectures,
  public.content_units,
  public.content_architecture_units,
  public.content_unit_propositions,
  public.content_candidates,
  public.immutable_entity_registry,
  public.stage_execution_output_refs,
  public.audit_events,
  public.outbox_events
TO contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT, UPDATE ON public.stage_executions TO contentos_runtime_role;
--> statement-breakpoint
GRANT SELECT ON public.runs, public.decision_cycles, public.revision_registry
TO contentos_runtime_role;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON
  public.audience_states,
  public.strategy_hypotheses,
  public.strategy_required_propositions,
  public.content_architectures,
  public.content_units,
  public.content_architecture_units,
  public.content_unit_propositions,
  public.content_candidates,
  public.immutable_entity_registry,
  public.stage_execution_output_refs,
  public.audit_events,
  public.outbox_events
FROM contentos_runtime_role;
