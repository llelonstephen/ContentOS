/**
 * M0 Test 08 — Structured Logger & Serialized Log Contract
 *
 * Validates M0 checklist item 08 & SPEC01 §100:
 *   - Structured logging fields
 *   - Proves every emitted operational log has timestamp, level, module, and trace_id
 *     by inspecting actual serialized JSON output.
 *   - Proves trace_id is automatically generated if omitted in minimal context.
 *   - Proves raw baseLogger is private and NOT publicly exported (sole boundary is createLogger).
 */
import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import * as loggerModule from '../../observability/logger.js';
import { createLogger } from '../../observability/logger.js';

describe('M0-08: Structured Logger & Serialized Log Contract', () => {
  describe('Public API Boundary Enforcement', () => {
    it('must NOT publicly export raw baseLogger (prevents bypassing createLogger)', () => {
      expect(loggerModule).not.toHaveProperty('baseLogger');
      expect((loggerModule as Record<string, unknown>)['baseLogger']).toBeUndefined();
      // createLogger must be the sole operational logging entrypoint
      expect(typeof loggerModule.createLogger).toBe('function');
    });
  });

  describe('Serialized Output Contract', () => {
    it('should include timestamp, level, module, and trace_id in serialized JSON output', async () => {
      let captured = '';
      const dest = new Writable({
        write(chunk, _encoding, callback) {
          captured += chunk.toString();
          callback();
        },
      });

      const logger = createLogger(
        {
          module: 'test-execution',
          trace_id: 'explicit-trace-12345',
          run_id: 'run-99',
        },
        dest,
      );

      logger.info({ action: 'process_item' }, 'Operational execution step');

      expect(captured.trim()).not.toBe('');
      const parsed = JSON.parse(captured.trim());

      // SPEC01 §100 required fields in serialized output:
      expect(parsed).toHaveProperty('time');
      expect(new Date(parsed.time).toISOString()).toBe(parsed.time); // Valid ISO timestamp
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('module', 'test-execution');
      expect(parsed).toHaveProperty('trace_id', 'explicit-trace-12345');
      expect(parsed).toHaveProperty('run_id', 'run-99');
      expect(parsed).toHaveProperty('msg', 'Operational execution step');
    });

    it('should automatically generate non-empty trace_id when omitted in minimal context', async () => {
      let captured = '';
      const dest = new Writable({
        write(chunk, _encoding, callback) {
          captured += chunk.toString();
          callback();
        },
      });

      // Minimal context: trace_id NOT provided
      const logger = createLogger({ module: 'minimal-worker' }, dest);
      logger.warn('Warning event');

      expect(captured.trim()).not.toBe('');
      const parsed = JSON.parse(captured.trim());

      // trace_id must NEVER silently disappear
      expect(parsed).toHaveProperty('trace_id');
      expect(typeof parsed.trace_id).toBe('string');
      expect(parsed.trace_id.length).toBeGreaterThan(0);
      expect(parsed.module).toBe('minimal-worker');
      expect(parsed.level).toBe('warn');
      expect(parsed).toHaveProperty('time');
    });

    it('should accept all SPEC01 §100 context fields', () => {
      const logger = createLogger({
        module: 'full-context',
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
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});
