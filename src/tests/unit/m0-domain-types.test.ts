/**
 * M0 Test — Domain Shared Types
 *
 * Validates that all Blueprint/SPEC01 core types are correctly defined.
 */
import { describe, it, expect } from 'vitest';
import {
  DeploymentMode,
  DataScope,
  PrincipalType,
  RetryCategory,
  NON_RETRYABLE_CATEGORIES,
  ContentOSError,
  type ImmutableEntityRef,
  type RevisionRef,
  type ErrorEnvelope,
  type Principal,
} from '../../domain/shared/types.js';

describe('M0: Domain Shared Types', () => {
  describe('ImmutableEntityRef (Blueprint §3)', () => {
    it('should accept entity_type and entity_id', () => {
      const ref: ImmutableEntityRef = {
        entity_type: 'Proposition',
        entity_id: 'prop-001',
      };
      expect(ref.entity_type).toBe('Proposition');
      expect(ref.entity_id).toBe('prop-001');
    });
  });

  describe('RevisionRef (Blueprint §4)', () => {
    it('should accept entity_type, stable_id, and revision_id', () => {
      const ref: RevisionRef = {
        entity_type: 'MetricDefinition',
        stable_id: 'CTR',
        revision_id: 'CTR_REV_004',
      };
      expect(ref.entity_type).toBe('MetricDefinition');
      expect(ref.stable_id).toBe('CTR');
      expect(ref.revision_id).toBe('CTR_REV_004');
    });
  });

  describe('DeploymentMode (SPEC01 §89)', () => {
    it('should have exactly SINGLE_TENANT and MULTI_TENANT', () => {
      expect(DeploymentMode.SINGLE_TENANT).toBe('SINGLE_TENANT');
      expect(DeploymentMode.MULTI_TENANT).toBe('MULTI_TENANT');
      expect(Object.keys(DeploymentMode)).toHaveLength(2);
    });
  });

  describe('DataScope (Blueprint §13B)', () => {
    it('should have all four canonical scopes', () => {
      expect(DataScope.TENANT_PRIVATE).toBe('TENANT_PRIVATE');
      expect(DataScope.WORKSPACE_SHARED).toBe('WORKSPACE_SHARED');
      expect(DataScope.AUTHORIZED_AGGREGATE).toBe('AUTHORIZED_AGGREGATE');
      expect(DataScope.GLOBAL_PUBLIC).toBe('GLOBAL_PUBLIC');
      expect(Object.keys(DataScope)).toHaveLength(4);
    });
  });

  describe('PrincipalType (SPEC01 §97)', () => {
    it('should have all five canonical principal types', () => {
      expect(PrincipalType.USER).toBe('USER');
      expect(PrincipalType.SERVICE).toBe('SERVICE');
      expect(PrincipalType.SYSTEM_WORKER).toBe('SYSTEM_WORKER');
      expect(PrincipalType.REVIEWER).toBe('REVIEWER');
      expect(PrincipalType.ADMIN).toBe('ADMIN');
      expect(Object.keys(PrincipalType)).toHaveLength(5);
    });
  });

  describe('RetryCategory (SPEC01 §82-83)', () => {
    it('should have all 11 canonical retry categories', () => {
      expect(Object.keys(RetryCategory)).toHaveLength(11);
    });

    it('should mark DOMAIN_INVARIANT_FAILED as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.DOMAIN_INVARIANT_FAILED)).toBe(true);
    });

    it('should mark STALE_DECISION_CYCLE as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.STALE_DECISION_CYCLE)).toBe(true);
    });

    it('should mark STALE_FENCING_TOKEN as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.STALE_FENCING_TOKEN)).toBe(true);
    });

    it('should mark AUTHORIZATION_FAILED as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.AUTHORIZATION_FAILED)).toBe(true);
    });

    it('should mark TRANSIENT as retryable', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.TRANSIENT)).toBe(false);
    });
  });

  describe('ContentOSError', () => {
    it('should set retryable=false for non-retryable categories', () => {
      const err = new ContentOSError({
        error_code: 'STALE_CYCLE',
        message: 'Cycle is stale',
        category: RetryCategory.STALE_DECISION_CYCLE,
      });
      expect(err.retryable).toBe(false);
      expect(err.error_code).toBe('STALE_CYCLE');
      expect(err.category).toBe(RetryCategory.STALE_DECISION_CYCLE);
    });

    it('should set retryable=true for retryable categories', () => {
      const err = new ContentOSError({
        error_code: 'PROVIDER_DOWN',
        message: 'Provider unavailable',
        category: RetryCategory.DEPENDENCY_UNAVAILABLE,
      });
      expect(err.retryable).toBe(true);
    });
  });

  describe('ErrorEnvelope (SPEC01 §96)', () => {
    it('should accept all required fields', () => {
      const envelope: ErrorEnvelope = {
        error_code: 'VALIDATION_FAILED',
        message: 'Input is invalid',
        retryable: false,
        trace_id: 'trace-001',
        validation_failures: [
          { field: 'name', code: 'REQUIRED', message: 'Name is required' },
        ],
      };
      expect(envelope.error_code).toBe('VALIDATION_FAILED');
      expect(envelope.validation_failures).toHaveLength(1);
    });
  });

  describe('Principal (SPEC01 §97-98)', () => {
    it('should require principal_type, principal_id, and tenant_id', () => {
      const p: Principal = {
        principal_type: PrincipalType.USER,
        principal_id: 'user-001',
        tenant_id: 'tenant-001' as any, // branded type
      };
      expect(p.principal_type).toBe('USER');
    });
  });
});
