/**
 * M0 Test 09 — Dependency Direction Verification
 *
 * Validates M0 checklist item 09.
 * Enforces SPEC01 §132: Domain cannot import from infrastructure.
 *
 * Dependency direction:
 *   API → Application → Domain ← Infrastructure
 *
 * Domain modules MUST NOT import from:
 *   - HTTP framework
 *   - database driver
 *   - cloud SDK
 *   - LLM provider SDK
 *   - queue vendor SDK
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('M0-09: Dependency Direction', () => {
  it('should not have domain/ importing from persistence/', () => {
    const result = execSync(
      'grep -r "from.*persistence" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from api/', () => {
    const result = execSync(
      'grep -r "from.*api/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from events/', () => {
    const result = execSync(
      'grep -r "from.*events/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from providers/', () => {
    const result = execSync(
      'grep -r "from.*providers/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from workflow/', () => {
    const result = execSync(
      'grep -r "from.*workflow/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing specific infra packages (SPEC01 §132)', () => {
    // drizzle, fastify, bullmq, ioredis, postgres driver
    const forbiddenImports = ['drizzle', 'fastify', 'bullmq', 'ioredis', 'postgres'];
    for (const pkg of forbiddenImports) {
      const result = execSync(
        `grep -r "from.*${pkg}" src/domain/ 2>/dev/null || true`,
        { cwd: ROOT, encoding: 'utf-8' },
      );
      expect(result.trim(), `domain/ must not import ${pkg}`).toBe('');
    }
  });
});
