/**
 * ContentOS — Safe Source Boundary
 *
 * Implements SPEC03 §15:
 * - Untrusted source data isolation
 * - Instruction / data separation
 * - Defense against prompt injection / control plane override via source text
 */
import { RegistryValidationError } from '../services/registry-validator.js';

const INJECTION_PATTERNS = [
  /system\s+instruction/i,
  /system\s+prompt\s+override/i,
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior\s+instructions/i,
  /set\s+role\s+/i,
  /grant\s+all\s+/i,
  /modify\s+control\s+plane/i,
  /declare\s+authority/i,
  /authorize\s+publication/i,
];

export interface IngestedSourceContent {
  sourceId: string;
  rawText: string;
  extractedStatements?: string[];
}

/**
 * Validates untrusted source content across the safe source boundary.
 * Implements SPEC03 §15.
 */
export function validateSafeSourceBoundary(content: IngestedSourceContent): {
  isSafe: boolean;
  sanitizedStatements: string[];
} {
  const { rawText, extractedStatements } = content;

  // Check raw text for hostile injection attacks
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(rawText)) {
      throw new RegistryValidationError(
        'SOURCE_INSTRUCTION_INJECTION_DETECTED',
        `External source content contains prohibited instruction injection pattern '${pattern.source}'. Untrusted source text cannot issue system instructions or alter control plane permissions.`,
      );
    }
  }

  // Ensure statements are structured and extracted as pure data, not instructions
  const statements = extractedStatements ?? [rawText];
  for (const stmt of statements) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(stmt)) {
        throw new RegistryValidationError(
          'SOURCE_INSTRUCTION_INJECTION_DETECTED',
          `Extracted statement contains prohibited instruction injection pattern '${pattern.source}'.`,
        );
      }
    }
  }

  return {
    isSafe: true,
    sanitizedStatements: statements,
  };
}
