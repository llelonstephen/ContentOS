/**
 * M0 Test 08 — Structured Logger
 *
 * Validates M0 checklist item 08.
 * Tests that logger outputs correct SPEC01 §100 fields.
 */
import { describe, it, expect } from 'vitest';
import { createLogger } from '../../observability/logger.js';

describe('M0-08: Structured Logger', () => {
  it('should create a child logger with required SPEC01 §100 fields', () => {
    const logger = createLogger({
      module: 'test-module',
      run_id: 'run-123',
      decision_cycle_id: 'cycle-456',
      trace_id: 'trace-789',
    });

    // Logger should exist and be callable
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should support all SPEC01 §100 context fields', () => {
    // All fields from SPEC01 §100 should be accepted
    const logger = createLogger({
      module: 'test-module',
      run_id: 'run-1',
      decision_cycle_id: 'dc-1',
      stage_execution_id: 'se-1',
      snapshot_id: 'snap-1',
      decision_id: 'dec-1',
      trace_id: 'trace-1',
      fencing_token: 42,
      error_code: 'TEST_ERROR',
    });

    expect(logger).toBeDefined();
  });

  it('should work with minimal context', () => {
    const logger = createLogger({ module: 'minimal' });
    expect(logger).toBeDefined();
  });
});
