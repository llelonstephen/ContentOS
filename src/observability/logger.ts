/**
 * ContentOS — Structured Logger
 *
 * Implements SPEC01 §100 structured logging fields.
 * Operational logs are NOT canonical truth (SPEC01 §100).
 * Uses pino for fast structured JSON logging.
 */
import pino from 'pino';

/**
 * SPEC01 §100 required structured fields:
 *   timestamp, level, module, run_id?, decision_cycle_id?,
 *   stage_execution_id?, snapshot_id?, decision_id?,
 *   trace_id, fencing_token?, error_code?
 */
export interface LogContext {
  readonly module: string;
  readonly run_id?: string;
  readonly decision_cycle_id?: string;
  readonly stage_execution_id?: string;
  readonly snapshot_id?: string;
  readonly decision_id?: string;
  readonly trace_id?: string;
  readonly fencing_token?: number;
  readonly error_code?: string;
}

/**
 * Create a child logger bound to specific context fields.
 * All SPEC01 §100 fields are included in every log line.
 */
export function createLogger(context: LogContext): pino.Logger {
  return baseLogger.child(context);
}

/** Base logger instance — module-level singleton */
const baseLogger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  // SPEC01 §101: prefer entity IDs, hashes, metadata
  // Redaction configured per deployment
  redact: {
    paths: ['secret', 'password', 'token', 'api_key'],
    censor: '[REDACTED]',
  },
});

export { baseLogger };
