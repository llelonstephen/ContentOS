/**
 * ContentOS — Evidence, Source, Link & Assessment Persistence Service
 *
 * Implements SPEC03 §14–§28, §37–§55, §117, §118:
 * - SourceArtifact admission & safe source boundary & serialized ObjectRegistry reachability
 * - EvidenceItem extraction fidelity & origin integrity (SOURCE_ARTIFACT, PERFORMANCE_OBSERVATION)
 * - Performance evidence firewall
 * - EvidencePropositionLink uniqueness, idempotent convergence, tenant & workspace isolation
 * - EvidenceAssessment immutability, reassessment rules, compatibility & relationship separation
 * - StageExecution and DecisionCycle fencing boundary
 */
import postgres from 'postgres';
import type {
  EvidenceDomain,
  EvidenceOriginType,
  EvidenceCompatibilityStatus,
  EvidenceRelationship,
  DataScope,
} from '../../../domain/knowledge/types.js';
import { validateSafeSourceBoundary } from '../../../domain/knowledge/safe-source-boundary.js';
import { validatePerformanceEvidenceFirewall } from '../../../domain/knowledge/performance-evidence-firewall.js';
import { validateEvidenceExtractionFidelity } from '../../../domain/knowledge/evidence-extraction-validator.js';
import { verifyStageFencing, type StageFencingContext } from './stage-fencing-coordinator.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';

export interface IngestSourceArtifactParams {
  sourceId: string;
  tenantId: string;
  workspaceId?: string | null;
  sourceType: string;
  publisher: string;
  author: string;
  jurisdiction: string;
  sourceVersion: string;
  retrievedAt: Date;
  contentHash: string;
  snapshotReference: string;
  rightsPolicyId: string;
  dataScope: DataScope;
  rawText?: string;
  fencingContext?: StageFencingContext | null;
}

export interface ExtractEvidenceItemParams {
  evidenceId: string;
  tenantId: string;
  workspaceId?: string | null;
  originType: EvidenceOriginType;
  originId: string;
  locator?: string | null;
  statement: string;
  statementType: string;
  assertionMethod: string;
  evidenceDomain: EvidenceDomain;
  studyDesign: string;
  causalIdentification: string;
  mechanismSupport: string;
  validFrom: Date;
  validUntilIfKnown?: Date | null;
  limitations: string;
  sourceContent?: string;
  qualifiers?: string[];
  conditions?: string[];
  populationScope?: string | null;
  jurisdictionScope?: string | null;
  measurementBasis?: string | null;
  fencingContext?: StageFencingContext | null;
}

export interface CreateEvidenceLinkParams {
  linkId: string;
  evidenceId: string;
  propositionId: string;
  tenantId: string;
  workspaceId?: string | null;
  fencingContext?: StageFencingContext | null;
}

export interface CreateEvidenceAssessmentParams {
  assessmentId: string;
  tenantId: string;
  workspaceId?: string | null;
  linkId: string;
  compatibilityStatus: EvidenceCompatibilityStatus;
  relationship: EvidenceRelationship;
  assessor?: string;
  assessmentMethod?: string;
  authority?: string;
  methodologicalQuality?: string;
  directness?: string;
  applicability?: string;
  populationMatch?: string;
  contextMatch?: string;
  freshness?: string;
  independence?: string;
  precision?: string;
  limitations?: string;
  uncertainty?: string;
  assessedAt?: Date;
  supersedesAssessmentId?: string | null;
  decisionCycleId?: string | null;
  fencingContext?: StageFencingContext | null;
}

export class EvidencePersistenceService {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  /**
   * Ingests a SourceArtifact after validating the safe source boundary and serialized ObjectRegistry state.
   * Implements SPEC03 §14, §15, SPEC02 §19, §30.
   */
  async ingestSourceArtifact(params: IngestSourceArtifactParams): Promise<void> {
    const {
      sourceId,
      tenantId,
      workspaceId,
      sourceType,
      publisher,
      author,
      jurisdiction,
      sourceVersion,
      retrievedAt,
      contentHash,
      snapshotReference,
      rightsPolicyId,
      dataScope,
      rawText,
      fencingContext,
    } = params;

    // Validate safe source boundary if raw text is provided
    if (rawText) {
      validateSafeSourceBoundary({ sourceId, rawText });
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if operating in cycle context
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: !!fencingContext?.decisionCycleId,
      });

      // 1. Verify snapshot reference exists and is AVAILABLE in ObjectRegistry (SPEC02 §30)
      const [obj] = await sqlTx`
        SELECT object_id, tenant_id, state FROM object_registry WHERE object_id = ${snapshotReference} FOR UPDATE
      `;
      if (!obj) {
        throw new RegistryValidationError(
          'SNAPSHOT_REFERENCE_NOT_FOUND',
          `SourceArtifact snapshot_reference '${snapshotReference}' does not exist in ObjectRegistry.`,
        );
      }
      if (obj.state === 'DELETED') {
        throw new RegistryValidationError(
          'CANONICAL_REFERENCE_REJECTED_DELETED',
          `SourceArtifact snapshot_reference '${snapshotReference}' is in DELETED state. Cannot create reference to deleted object.`,
        );
      }
      if (obj.state === 'GC_CLAIMED') {
        throw new RegistryValidationError(
          'OBJECT_NOT_AVAILABLE_FOR_REFERENCE',
          `SourceArtifact snapshot_reference '${snapshotReference}' is currently GC_CLAIMED. Cannot create canonical reference.`,
        );
      }
      if (obj.state !== 'AVAILABLE') {
        throw new RegistryValidationError(
          'OBJECT_NOT_AVAILABLE_FOR_REFERENCE',
          `SourceArtifact snapshot_reference '${snapshotReference}' is in '${obj.state}' state (expected 'AVAILABLE').`,
        );
      }

      // 2. Verify RightsPolicy exists and belongs to tenant
      const [rp] = await sqlTx`
        SELECT rights_policy_id, tenant_id FROM rights_policies WHERE rights_policy_id = ${rightsPolicyId}
      `;
      if (!rp) {
        throw new RegistryValidationError(
          'RIGHTS_POLICY_NOT_FOUND',
          `Rights policy '${rightsPolicyId}' does not exist.`,
        );
      }
      if (rp.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `Rights policy '${rightsPolicyId}' belongs to tenant '${rp.tenant_id}', not caller '${tenantId}'.`,
        );
      }

      // 3. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'SourceArtifact', ${sourceId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 4. Insert into source_artifacts
      await sqlTx`
        INSERT INTO source_artifacts (
          source_id, tenant_id, workspace_id, source_type, publisher, author,
          jurisdiction, source_version, retrieved_at, content_hash, snapshot_reference,
          rights_policy_id, data_scope, created_at
        ) VALUES (
          ${sourceId}, ${tenantId}, ${workspaceId ?? null}, ${sourceType}, ${publisher}, ${author},
          ${jurisdiction}, ${sourceVersion}, ${retrievedAt}, ${contentHash}, ${snapshotReference},
          ${rightsPolicyId}, ${dataScope}, now()
        )
      `;

      // 5. Register canonical reference reachability in object_references to protect against GC
      await sqlTx`
        INSERT INTO object_references (
          owner_entity_type, owner_entity_id, field_name, tenant_id, workspace_id, object_id, created_at
        ) VALUES (
          'SourceArtifact', ${sourceId}, 'snapshot_reference', ${tenantId}, ${workspaceId ?? null}, ${snapshotReference}, now()
        ) ON CONFLICT DO NOTHING
      `;
    });
  }

  /**
   * Extracts and stores an EvidenceItem with strict origin integrity, extraction fidelity, and firewall checks.
   * Implements SPEC03 §18–§28.
   */
  async extractEvidenceItem(params: ExtractEvidenceItemParams): Promise<void> {
    const {
      evidenceId,
      tenantId,
      workspaceId,
      originType,
      originId,
      locator,
      statement,
      statementType,
      assertionMethod,
      evidenceDomain,
      studyDesign,
      causalIdentification,
      mechanismSupport,
      validFrom,
      validUntilIfKnown,
      limitations,
      sourceContent,
      qualifiers,
      conditions,
      populationScope,
      jurisdictionScope,
      measurementBasis,
      fencingContext,
    } = params;

    // Validate origin type (SPEC03 §18: exactly SOURCE_ARTIFACT or PERFORMANCE_OBSERVATION)
    if (originType !== 'SOURCE_ARTIFACT' && originType !== 'PERFORMANCE_OBSERVATION') {
      throw new RegistryValidationError(
        'UNSUPPORTED_EVIDENCE_ORIGIN_TYPE',
        `Unsupported evidence origin type '${originType}'. Only SOURCE_ARTIFACT and PERFORMANCE_OBSERVATION are admitted in V1.`,
      );
    }

    // Extraction fidelity validator (SPEC03 §5.1–5.4)
    if (sourceContent) {
      validateEvidenceExtractionFidelity({
        sourceContent,
        extractedStatement: statement,
        qualifiers,
        conditions,
        populationScope,
        jurisdictionScope,
        measurementBasis,
      });
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: !!fencingContext?.decisionCycleId,
      });

      // 1. Origin existence & discriminator verification (SPEC03 §18)
      if (originType === 'SOURCE_ARTIFACT') {
        const [source] = await sqlTx`
          SELECT source_id, tenant_id FROM source_artifacts WHERE source_id = ${originId}
        `;
        if (!source) {
          throw new RegistryValidationError(
            'EVIDENCE_ORIGIN_NOT_FOUND',
            `Origin SourceArtifact '${originId}' does not exist.`,
          );
        }
        if (source.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'CROSS_TENANT_ORIGIN_ACCESS',
            `EvidenceItem tenant '${tenantId}' cannot reference SourceArtifact from tenant '${source.tenant_id}'.`,
          );
        }
      } else if (originType === 'PERFORMANCE_OBSERVATION') {
        const [obs] = await sqlTx`
          SELECT observation_id, tenant_id FROM performance_observations WHERE observation_id = ${originId}
        `;
        if (!obs) {
          throw new RegistryValidationError(
            'EVIDENCE_ORIGIN_NOT_FOUND',
            `Origin PerformanceObservation '${originId}' does not exist.`,
          );
        }
        if (obs.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'CROSS_TENANT_ORIGIN_ACCESS',
            `EvidenceItem tenant '${tenantId}' cannot reference PerformanceObservation from tenant '${obs.tenant_id}'.`,
          );
        }
      }

      // 2. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EvidenceItem', ${evidenceId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 3. Insert into evidence_items
      await sqlTx`
        INSERT INTO evidence_items (
          evidence_id, tenant_id, workspace_id, origin_type, origin_id, locator,
          statement, statement_type, assertion_method, evidence_domain, study_design,
          causal_identification, mechanism_support, valid_from, valid_until_if_known,
          limitations, created_at
        ) VALUES (
          ${evidenceId}, ${tenantId}, ${workspaceId ?? null}, ${originType}, ${originId}, ${locator ?? null},
          ${statement}, ${statementType}, ${assertionMethod}, ${evidenceDomain}, ${studyDesign},
          ${causalIdentification}, ${mechanismSupport}, ${validFrom}, ${validUntilIfKnown ?? null},
          ${limitations}, now()
        )
      `;
    });
  }

  /**
   * Creates an EvidencePropositionLink. Idempotent on unique constraint with strict tenant & workspace checks.
   * Implements SPEC03 §37–§39, §117.
   */
  async linkEvidenceToProposition(params: CreateEvidenceLinkParams): Promise<{ linkId: string; created: boolean }> {
    const { linkId, evidenceId, propositionId, tenantId, workspaceId, fencingContext } = params;

    return await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: !!fencingContext?.decisionCycleId,
      });

      // 1. Verify EvidenceItem exists and matches tenant/workspace
      const [ev] = await sqlTx`
        SELECT evidence_id, tenant_id, workspace_id, origin_type, evidence_domain
        FROM evidence_items
        WHERE evidence_id = ${evidenceId}
      `;
      if (!ev) {
        throw new RegistryValidationError(
          'EVIDENCE_ITEM_NOT_FOUND',
          `EvidenceItem '${evidenceId}' does not exist.`,
        );
      }
      if (ev.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `EvidenceItem belongs to tenant '${ev.tenant_id}', but caller operates as tenant '${tenantId}'. Cross-tenant evidence linking is prohibited.`,
        );
      }
      if (ev.workspace_id && workspaceId && ev.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EvidenceItem is scoped to workspace '${ev.workspace_id}', which does not match caller workspace '${workspaceId}'.`,
        );
      }

      // 2. Verify Proposition exists and matches tenant/workspace
      const [prop] = await sqlTx`
        SELECT proposition_id, tenant_id, workspace_id, proposition_type
        FROM propositions
        WHERE proposition_id = ${propositionId}
      `;
      if (!prop) {
        throw new RegistryValidationError(
          'PROPOSITION_NOT_FOUND',
          `Proposition '${propositionId}' does not exist.`,
        );
      }
      if (prop.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `Proposition belongs to tenant '${prop.tenant_id}', but caller operates as tenant '${tenantId}'. Cross-tenant proposition linking is prohibited.`,
        );
      }
      if (prop.workspace_id && workspaceId && prop.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Proposition is scoped to workspace '${prop.workspace_id}', which does not match caller workspace '${workspaceId}'.`,
        );
      }

      // 3. Performance Evidence Firewall (SPEC03 §25)
      validatePerformanceEvidenceFirewall({
        originType: ev.origin_type as EvidenceOriginType,
        evidenceDomain: ev.evidence_domain as EvidenceDomain,
        targetPropositionType: prop.proposition_type as any,
      });

      // 4. Check if link already exists (SPEC03 §38, §117)
      const [existing] = await sqlTx`
        SELECT link_id FROM evidence_proposition_links
        WHERE evidence_id = ${evidenceId} AND proposition_id = ${propositionId}
      `;
      if (existing) {
        return { linkId: existing.link_id as string, created: false };
      }

      // 5. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EvidencePropositionLink', ${linkId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 6. Insert link
      await sqlTx`
        INSERT INTO evidence_proposition_links (
          link_id, tenant_id, workspace_id, evidence_id, proposition_id, created_at
        ) VALUES (
          ${linkId}, ${tenantId}, ${workspaceId ?? null}, ${evidenceId}, ${propositionId}, now()
        )
      `;

      return { linkId, created: true };
    });
  }

  /**
   * Creates an EvidenceAssessment for an EvidencePropositionLink.
   * Implements SPEC03 §47–§55, §118.
   */
  async createEvidenceAssessment(params: CreateEvidenceAssessmentParams): Promise<void> {
    const {
      assessmentId,
      tenantId,
      workspaceId,
      linkId,
      compatibilityStatus,
      relationship,
      assessor = 'AUTOMATED_PIPELINE',
      assessmentMethod = 'AUTOMATED',
      authority = 'STANDARD',
      methodologicalQuality = 'STANDARD',
      directness = 'DIRECT',
      applicability = 'STANDARD',
      populationMatch = 'MATCH',
      contextMatch = 'MATCH',
      freshness = 'FRESH',
      independence = 'INDEPENDENT',
      precision = 'STANDARD',
      limitations = 'None',
      uncertainty = 'NONE',
      assessedAt = new Date(),
      supersedesAssessmentId,
      decisionCycleId,
      fencingContext,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check (SPEC03 §103, §104)
      if (decisionCycleId && !fencingContext) {
        throw new RegistryValidationError(
          'STAGE_EXECUTION_CONTEXT_REQUIRED',
          'Decision-cycle evidence assessment requires valid stage fencing context',
        );
      }
      const effectiveFencingContext: StageFencingContext | undefined = fencingContext || decisionCycleId
        ? {
            decisionCycleId: decisionCycleId ?? fencingContext?.decisionCycleId,
            stageExecutionId: fencingContext?.stageExecutionId,
            fencingToken: fencingContext?.fencingToken,
            leaseOwner: fencingContext?.leaseOwner,
          }
        : undefined;
      await verifyStageFencing(sqlTx, {
        fencingContext: effectiveFencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: !!effectiveFencingContext?.decisionCycleId,
      });

      // 1. Verify link exists and matches tenant/workspace
      const [link] = await sqlTx`
        SELECT link_id, evidence_id, proposition_id, tenant_id, workspace_id
        FROM evidence_proposition_links
        WHERE link_id = ${linkId}
      `;
      if (!link) {
        throw new RegistryValidationError(
          'EVIDENCE_PROPOSITION_LINK_NOT_FOUND',
          `EvidencePropositionLink '${linkId}' does not exist. Support cannot be assessed before link identity exists.`,
        );
      }
      if (link.tenant_id !== tenantId) {
        throw new RegistryValidationError(
          'TENANT_ISOLATION_VIOLATION',
          `EvidencePropositionLink belongs to tenant '${link.tenant_id}', but caller operates as tenant '${tenantId}'. Cross-tenant assessment is prohibited.`,
        );
      }
      if (link.workspace_id && workspaceId && link.workspace_id !== workspaceId) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EvidencePropositionLink belongs to workspace '${link.workspace_id}', not caller workspace '${workspaceId}'.`,
        );
      }

      // 2. If reassessment, enforce supersession invariants (SPEC03 §53)
      if (supersedesAssessmentId) {
        const [prior] = await sqlTx`
          SELECT assessment_id, link_id, assessed_at, tenant_id
          FROM evidence_assessments
          WHERE assessment_id = ${supersedesAssessmentId}
        `;
        if (!prior) {
          throw new RegistryValidationError(
            'SUPERSEDED_ASSESSMENT_NOT_FOUND',
            `Prior assessment '${supersedesAssessmentId}' not found.`,
          );
        }

        if (prior.tenant_id !== tenantId) {
          throw new RegistryValidationError(
            'TENANT_ISOLATION_VIOLATION',
            `Prior assessment '${supersedesAssessmentId}' belongs to tenant '${prior.tenant_id}', not '${tenantId}'.`,
          );
        }

        // Reassessment must be for the EXACT same link (SPEC03 §53)
        if (prior.link_id !== linkId) {
          throw new RegistryValidationError(
            'REASSESSMENT_LINK_MISMATCH',
            `Reassessment '${assessmentId}' specifies supersedes_assessment_id '${supersedesAssessmentId}' which belongs to different link '${prior.link_id}' (expected '${linkId}').`,
          );
        }

        // Temporal ordering: assessed_at must be strictly greater than prior
        if (assessedAt.getTime() <= new Date(prior.assessed_at).getTime()) {
          throw new RegistryValidationError(
            'REASSESSMENT_TEMPORAL_ORDER_VIOLATION',
            `Reassessment assessed_at (${assessedAt.toISOString()}) must be strictly greater than prior assessment (${new Date(prior.assessed_at).toISOString()}).`,
          );
        }
      }

      // 3. Register in ImmutableEntityRegistry
      await sqlTx`
        INSERT INTO immutable_entity_registry (
          entity_type, entity_id, tenant_id, workspace_id, payload_state, created_at
        ) VALUES (
          'EvidenceAssessment', ${assessmentId}, ${tenantId}, ${workspaceId ?? null}, 'AVAILABLE', now()
        )
      `;

      // 4. Insert into evidence_assessments
      await sqlTx`
        INSERT INTO evidence_assessments (
          assessment_id, tenant_id, workspace_id, supersedes_assessment_id, link_id,
          compatibility_status, relationship, assessor, assessment_method, authority,
          methodological_quality, directness, applicability, population_match, context_match,
          freshness, independence, precision, limitations, uncertainty, assessed_at, created_at
        ) VALUES (
          ${assessmentId}, ${tenantId}, ${workspaceId ?? null}, ${supersedesAssessmentId ?? null}, ${linkId},
          ${compatibilityStatus}, ${relationship}, ${assessor}, ${assessmentMethod}, ${authority},
          ${methodologicalQuality}, ${directness}, ${applicability}, ${populationMatch}, ${contextMatch},
          ${freshness}, ${independence}, ${precision}, ${limitations}, ${uncertainty}, ${assessedAt}, now()
        )
      `;
    });
  }
}
