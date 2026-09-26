-- Milestone 2: SPEC03 Immutable Entities Mutation Triggers

DROP TRIGGER IF EXISTS trg_immutable_propositions ON "propositions";
CREATE TRIGGER trg_immutable_propositions
BEFORE UPDATE OR DELETE ON "propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_evidence_items ON "evidence_items";
CREATE TRIGGER trg_immutable_evidence_items
BEFORE UPDATE OR DELETE ON "evidence_items"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_evidence_assessments ON "evidence_assessments";
CREATE TRIGGER trg_immutable_evidence_assessments
BEFORE UPDATE OR DELETE ON "evidence_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_epistemic_state_versions ON "epistemic_state_versions";
CREATE TRIGGER trg_immutable_epistemic_state_versions
BEFORE UPDATE OR DELETE ON "epistemic_state_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_source_artifacts ON "source_artifacts";
CREATE TRIGGER trg_immutable_source_artifacts
BEFORE UPDATE OR DELETE ON "source_artifacts"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_knowledge_gaps ON "knowledge_gaps";
CREATE TRIGGER trg_immutable_knowledge_gaps
BEFORE UPDATE OR DELETE ON "knowledge_gaps"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_research_traces ON "research_traces";
CREATE TRIGGER trg_immutable_research_traces
BEFORE UPDATE OR DELETE ON "research_traces"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_immutable_evidence_proposition_links ON "evidence_proposition_links";
CREATE TRIGGER trg_immutable_evidence_proposition_links
BEFORE UPDATE OR DELETE ON "evidence_proposition_links"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
