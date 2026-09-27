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
import { createHash } from 'crypto';
import { validateSafeSourceBoundary } from '../../../domain/knowledge/safe-source-boundary.js';
import { validatePerformanceEvidenceFirewall } from '../../../domain/knowledge/performance-evidence-firewall.js';
import { validateEvidenceExtractionFidelity } from '../../../domain/knowledge/evidence-extraction-validator.js';
import {
  verifyStageFencing,
  type StageFencingContext,
  type WriteMode,
} from './stage-fencing-coordinator.js';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import { getDefaultObjectStore } from '../../objects/default-object-store.js';

const SHA256_REGEX = /^[0-9a-f]{64}$/;

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
  writeMode?: WriteMode;
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
  writeMode?: WriteMode;
}

export interface CreateEvidenceLinkParams {
  linkId: string;
  evidenceId: string;
  propositionId: string;
  tenantId: string;
  workspaceId?: string | null;
  fencingContext?: StageFencingContext | null;
  writeMode?: WriteMode;
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
  writeMode?: WriteMode;
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
      writeMode,
    } = params;

    if (contentHash && !SHA256_REGEX.test(contentHash)) {
      throw new RegistryValidationError(
        'INVALID_CONTENT_HASH',
        `Provided content_hash '${contentHash}' is not a valid 64-character lowercase SHA-256 hex string.`,
      );
    }

    let calculatedHash: string | undefined;
    if (rawText) {
      validateSafeSourceBoundary({ sourceId, rawText });
      calculatedHash = createHash('sha256').update(Buffer.from(rawText, 'utf-8')).digest('hex');
      if (contentHash && calculatedHash !== contentHash) {
        throw new RegistryValidationError(
          'HASH_MISMATCH',
          `Raw source text hash '${calculatedHash}' does not match provided content_hash '${contentHash}'.`,
        );
      }
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check if operating in cycle context
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: writeMode === 'DECISION_CYCLE' || !!fencingContext?.decisionCycleId,
        writeMode,
      });

      // 1. Verify snapshot reference exists and is AVAILABLE in ObjectRegistry (SPEC02 §30)
      const [obj] = await sqlTx`
        SELECT object_id, tenant_id, content_hash, object_key, state FROM object_registry WHERE object_id = ${snapshotReference} FOR UPDATE
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

      if (!SHA256_REGEX.test(obj.content_hash)) {
        throw new RegistryValidationError(
          'INVALID_CONTENT_HASH',
          `ObjectRegistry content_hash '${obj.content_hash}' is not a valid 64-character lowercase SHA-256 hex string.`,
        );
      }

      if (contentHash && obj.content_hash !== contentHash) {
        throw new RegistryValidationError(
          'OBJECT_INTEGRITY_FAILURE',
          `SourceArtifact content_hash '${contentHash}' does not match ObjectRegistry content_hash '${obj.content_hash}'.`,
        );
      }

      // Resolve immutable bytes through canonical ObjectStore abstraction using exact object_key contract
      let objectBytes: Buffer;
      try {
        objectBytes = await getDefaultObjectStore().get(obj.object_key);
      } catch {
        throw new RegistryValidationError(
          'SNAPSHOT_OBJECT_DATA_UNAVAILABLE',
          `Authoritative source object data for key '${obj.object_key}' is unavailable in ObjectStore.`,
        );
      }

      const actualBytesHash = createHash('sha256').update(objectBytes).digest('hex');
      if (actualBytesHash !== obj.content_hash) {
        throw new RegistryValidationError(
          'OBJECT_INTEGRITY_FAILURE',
          `Object bytes hash '${actualBytesHash}' does not match ObjectRegistry content_hash '${obj.content_hash}'. Object corrupted or tampered.`,
        );
      }

      if (rawText && objectBytes.toString('utf-8') !== rawText) {
        throw new RegistryValidationError(
          'SOURCE_CONTENT_TAMPERED',
          'Provided rawText does not match authoritative immutable object bytes in ObjectStore.',
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
      writeMode,
    } = params;

    // Validate origin type (SPEC03 §18: exactly SOURCE_ARTIFACT or PERFORMANCE_OBSERVATION)
    if (originType !== 'SOURCE_ARTIFACT' && originType !== 'PERFORMANCE_OBSERVATION') {
      throw new RegistryValidationError(
        'UNSUPPORTED_EVIDENCE_ORIGIN_TYPE',
        `Unsupported evidence origin type '${originType}'. Only SOURCE_ARTIFACT and PERFORMANCE_OBSERVATION are admitted in V1.`,
      );
    }

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: writeMode === 'DECISION_CYCLE' || !!fencingContext?.decisionCycleId,
        writeMode,
      });

      // 1. Origin existence & discriminator verification (SPEC03 §18)
      if (originType === 'SOURCE_ARTIFACT') {
        const [source] = await sqlTx`
          SELECT source_id, tenant_id, workspace_id, data_scope, content_hash, snapshot_reference
          FROM source_artifacts
          WHERE source_id = ${originId}
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
        if (source.workspace_id && (!workspaceId || source.workspace_id !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `Origin SourceArtifact is scoped to workspace '${source.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
          );
        }

        // Verify snapshot reference in object_registry is AVAILABLE (SPEC02 §30)
        const [obj] = await sqlTx`
          SELECT object_id, content_hash, object_key, state FROM object_registry WHERE object_id = ${source.snapshot_reference} FOR UPDATE
        `;
        if (!obj) {
          throw new RegistryValidationError(
            'SNAPSHOT_REFERENCE_NOT_FOUND',
            `SourceArtifact snapshot_reference '${source.snapshot_reference}' does not exist in ObjectRegistry.`,
          );
        }
        if (obj.state === 'DELETED') {
          throw new RegistryValidationError(
            'CANONICAL_REFERENCE_REJECTED_DELETED',
            `SourceArtifact snapshot_reference '${source.snapshot_reference}' is in DELETED state. Cannot create evidence from deleted object.`,
          );
        }
        if (obj.state === 'GC_CLAIMED') {
          throw new RegistryValidationError(
            'OBJECT_NOT_AVAILABLE_FOR_REFERENCE',
            `SourceArtifact snapshot_reference '${source.snapshot_reference}' is currently GC_CLAIMED. Cannot create canonical reference.`,
          );
        }
        if (obj.state !== 'AVAILABLE') {
          throw new RegistryValidationError(
            'OBJECT_NOT_AVAILABLE_FOR_REFERENCE',
            `SourceArtifact snapshot_reference '${source.snapshot_reference}' is in '${obj.state}' state (expected 'AVAILABLE').`,
          );
        }

        if (!SHA256_REGEX.test(obj.content_hash)) {
          throw new RegistryValidationError(
            'INVALID_CONTENT_HASH',
            `ObjectRegistry content_hash '${obj.content_hash}' is not a valid 64-character lowercase SHA-256 hex string.`,
          );
        }

        if (source.content_hash !== obj.content_hash) {
          throw new RegistryValidationError(
            'OBJECT_INTEGRITY_FAILURE',
            `SourceArtifact content_hash '${source.content_hash}' does not match ObjectRegistry content_hash '${obj.content_hash}'.`,
          );
        }

        // Load authoritative immutable payload from ObjectStore bound to obj.object_key
        let objectBytes: Buffer;
        try {
          objectBytes = await getDefaultObjectStore().get(obj.object_key);
        } catch {
          throw new RegistryValidationError(
            'SNAPSHOT_OBJECT_DATA_UNAVAILABLE',
            `Authoritative source object data for key '${obj.object_key}' (hash: '${obj.content_hash}') is unavailable in ObjectStore.`,
          );
        }

        const actualHash = createHash('sha256').update(objectBytes).digest('hex');
        if (actualHash !== obj.content_hash) {
          throw new RegistryValidationError(
            'OBJECT_INTEGRITY_FAILURE',
            `Loaded object bytes hash '${actualHash}' does not match ObjectRegistry content_hash '${obj.content_hash}'. Object corrupted or tampered.`,
          );
        }

        const canonicalPayload = objectBytes.toString('utf-8');

        if (sourceContent && sourceContent !== canonicalPayload) {
          throw new RegistryValidationError(
            'SOURCE_CONTENT_TAMPERED',
            'Caller-supplied sourceContent does not match authoritative source payload bound to snapshot_reference.',
          );
        }

        validateEvidenceExtractionFidelity({
          sourceContent: canonicalPayload,
          extractedStatement: statement,
          qualifiers,
          conditions,
          populationScope,
          jurisdictionScope,
          measurementBasis,
        });
      } else if (originType === 'PERFORMANCE_OBSERVATION') {
        const [obs] = await sqlTx`
          SELECT observation_id, tenant_id, workspace_id FROM performance_observations WHERE observation_id = ${originId}
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
        if (obs.workspace_id && (!workspaceId || obs.workspace_id !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `Origin PerformanceObservation is scoped to workspace '${obs.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
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
    const { linkId, evidenceId, propositionId, tenantId, workspaceId, fencingContext, writeMode } = params;

    return await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check
      await verifyStageFencing(sqlTx, {
        fencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: writeMode === 'DECISION_CYCLE' || !!fencingContext?.decisionCycleId,
        writeMode,
      });

      // 1. Verify EvidenceItem exists and matches tenant/workspace
      const [ev] = await sqlTx`
        SELECT evidence_id, tenant_id, workspace_id, origin_type, origin_id, evidence_domain
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
      if (ev.workspace_id && (!workspaceId || ev.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EvidenceItem is scoped to workspace '${ev.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
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
      if (prop.workspace_id && (!workspaceId || prop.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Proposition is scoped to workspace '${prop.workspace_id}', which does not match caller workspace '${workspaceId || 'NONE'}'.`,
        );
      }

      // Cross-entity workspace check between evidence and proposition
      if (ev.workspace_id && prop.workspace_id && ev.workspace_id !== prop.workspace_id) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `Cannot link EvidenceItem scoped to workspace '${ev.workspace_id}' to Proposition scoped to workspace '${prop.workspace_id}'.`,
        );
      }

      // DataScope validation if origin is SOURCE_ARTIFACT
      if (ev.origin_type === 'SOURCE_ARTIFACT') {
        const [source] = await sqlTx`
          SELECT source_id, data_scope, workspace_id FROM source_artifacts WHERE source_id = ${ev.origin_id}
        `;
        if (source && source.data_scope === 'TENANT_PRIVATE') {
          if (source.workspace_id && (!workspaceId || source.workspace_id !== workspaceId)) {
            throw new RegistryValidationError(
              'WORKSPACE_ISOLATION_VIOLATION',
              `SourceArtifact has TENANT_PRIVATE data scope in workspace '${source.workspace_id}', inaccessible to caller workspace '${workspaceId || 'NONE'}'.`,
            );
          }
          if (prop.workspace_id && source.workspace_id && prop.workspace_id !== source.workspace_id) {
            throw new RegistryValidationError(
              'WORKSPACE_ISOLATION_VIOLATION',
              `SourceArtifact has TENANT_PRIVATE data scope in workspace '${source.workspace_id}', cannot link to Proposition in workspace '${prop.workspace_id}'.`,
            );
          }
        }
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
      writeMode,
    } = params;

    await this.sql.begin(async (sqlTx) => {
      // 0. Stage fencing check (SPEC03 §103, §104)
      const isCycle = writeMode === 'DECISION_CYCLE' || Boolean(decisionCycleId || fencingContext?.decisionCycleId);
      if (isCycle && (!fencingContext || !fencingContext.decisionCycleId) && !decisionCycleId) {
        throw new RegistryValidationError(
          'DECISION_CYCLE_CONTEXT_REQUIRED',
          'Canonical decision-cycle evidence assessment requires an explicit DecisionCycle context. Omitting stage authorization fails closed.',
        );
      }
      if (isCycle && !fencingContext?.stageExecutionId) {
        throw new RegistryValidationError(
          'STAGE_EXECUTION_CONTEXT_REQUIRED',
          'Decision-cycle evidence assessment requires valid stage fencing context. Omitting stage authorization fails closed.',
        );
      }
      if (isCycle && (fencingContext?.fencingToken === undefined || fencingContext?.fencingToken === null)) {
        throw new RegistryValidationError(
          'FENCING_TOKEN_REQUIRED',
          'Decision-cycle evidence assessment requires fencingToken. Omitting fencing token fails closed.',
        );
      }

      const effectiveCycleId = decisionCycleId ?? fencingContext?.decisionCycleId;
      const effectiveFencingContext: StageFencingContext | undefined = effectiveCycleId && fencingContext?.stageExecutionId
        ? {
            decisionCycleId: effectiveCycleId,
            stageExecutionId: fencingContext.stageExecutionId,
            fencingToken: fencingContext.fencingToken,
            leaseOwner: fencingContext.leaseOwner,
          }
        : undefined;

      await verifyStageFencing(sqlTx, {
        fencingContext: effectiveFencingContext,
        tenantId,
        workspaceId,
        requireCycleContext: isCycle,
        writeMode,
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
      if (link.workspace_id && (!workspaceId || link.workspace_id !== workspaceId)) {
        throw new RegistryValidationError(
          'WORKSPACE_ISOLATION_VIOLATION',
          `EvidencePropositionLink belongs to workspace '${link.workspace_id}', not caller workspace '${workspaceId || 'NONE'}'.`,
        );
      }

      // 2. If reassessment, enforce supersession invariants (SPEC03 §53)
      if (supersedesAssessmentId) {
        const [prior] = await sqlTx`
          SELECT assessment_id, link_id, assessed_at, tenant_id, workspace_id
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

        if (prior.workspace_id && (!workspaceId || prior.workspace_id !== workspaceId)) {
          throw new RegistryValidationError(
            'WORKSPACE_ISOLATION_VIOLATION',
            `Prior assessment '${supersedesAssessmentId}' belongs to workspace '${prior.workspace_id}', not '${workspaceId || 'NONE'}'.`,
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

  /**
   * Explicit decision-cycle EvidenceItem extraction. Requires valid stage fencing context.
   */
  async extractEvidenceItemForDecisionCycle(params: ExtractEvidenceItemParams): Promise<void> {
    return this.extractEvidenceItem({ ...params, writeMode: 'DECISION_CYCLE' });
  }

  /**
   * Explicit decision-cycle evidence-to-proposition linking. Requires valid stage fencing context.
   */
  async linkEvidenceToPropositionForDecisionCycle(params: CreateEvidenceLinkParams): Promise<{ linkId: string; created: boolean }> {
    return this.linkEvidenceToProposition({ ...params, writeMode: 'DECISION_CYCLE' });
  }

  /**
   * Explicit decision-cycle evidence assessment creation. Requires valid stage fencing context.
   */
  async createEvidenceAssessmentForDecisionCycle(params: CreateEvidenceAssessmentParams): Promise<void> {
    return this.createEvidenceAssessment({ ...params, writeMode: 'DECISION_CYCLE' });
  }
}
