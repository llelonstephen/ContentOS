/**
 * M0 Test 01 — Project Builds with Zero TypeScript Errors
 *
 * Validates M0 checklist item 01.
 * Runs tsc --noEmit and expects exit code 0.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('M0-01: TypeScript Build', () => {
  it('should compile with zero errors under strict mode', () => {
    // Run tsc --noEmit from project root
    const result = execSync('npx tsc --noEmit 2>&1', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    // tsc output should be empty on success
    expect(result.trim()).toBe('');
  });
});
