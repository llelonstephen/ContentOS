/**
 * M0 Test 09 — AST-Based Dependency Direction Verification
 *
 * Validates M0 checklist item 09.
 * Enforces SPEC01 §132: Domain cannot import from infrastructure.
 *
 * Uses the TypeScript compiler AST (ts.createSourceFile) to inspect all
 * domain source files for static, dynamic, and type-level imports.
 *
 * Dependency direction:
 *   API → Application → Domain ← Infrastructure
 *
 * Domain modules MUST NOT import from:
 *   - persistence layer
 *   - api layer
 *   - events layer
 *   - providers layer
 *   - workflow layer
 *   - security layer
 *   - observability layer
 *   - infrastructure packages (fastify, drizzle-orm, bullmq, ioredis, postgres, pino)
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const DOMAIN_DIR = path.resolve(import.meta.dirname, '../../domain');

const FORBIDDEN_LAYER_PATTERNS = [
  '/persistence',
  '/api',
  '/events',
  '/providers',
  '/workflow',
  '/security',
  '/observability',
  '@contentos/persistence',
  '@contentos/api',
  '@contentos/events',
  '@contentos/providers',
  '@contentos/workflow',
  '@contentos/security',
  '@contentos/observability',
];

const FORBIDDEN_INFRA_PACKAGES = [
  'fastify',
  '@fastify',
  'drizzle-orm',
  'drizzle-kit',
  'bullmq',
  'ioredis',
  'postgres',
  'pino',
];

interface DiscoveredImport {
  readonly file: string;
  readonly specifier: string;
  readonly kind: 'static-import' | 'static-export' | 'dynamic-import' | 'require' | 'import-type';
  readonly line: number;
}

/**
 * Recursively find all .ts files in a directory.
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extracts all imports from a TypeScript file using AST traversal.
 */
function extractAstImports(filePath: string, sourceText?: string): DiscoveredImport[] {
  const text = sourceText ?? fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
  );

  const imports: DiscoveredImport[] = [];

  function recordImport(specifier: string, kind: DiscoveredImport['kind'], pos: number) {
    const line = sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
    imports.push({ file: filePath, specifier, kind, line });
  }

  function visit(node: ts.Node) {
    // 1. Static import: import ... from 'specifier';
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        recordImport(node.moduleSpecifier.text, 'static-import', node.getStart());
      }
    }
    // 2. Static re-export: export ... from 'specifier';
    else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        recordImport(node.moduleSpecifier.text, 'static-export', node.getStart());
      }
    }
    // 3. Dynamic import: import('specifier')
    else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          recordImport(arg.text, 'dynamic-import', node.getStart());
        }
      }
      // 4. CommonJS require: require('specifier')
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          recordImport(arg.text, 'require', node.getStart());
        }
      }
    }
    // 5. Type import: type X = import('specifier').X;
    else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) {
        recordImport(argument.literal.text, 'import-type', node.getStart());
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

describe('M0-09: AST-Based Dependency Direction (SPEC01 §132)', () => {
  const domainFiles = findTsFiles(DOMAIN_DIR);

  it('should find domain source files to inspect', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  it('AST inspection: domain must not import from forbidden architectural layers', () => {
    const violations: DiscoveredImport[] = [];

    for (const file of domainFiles) {
      const imports = extractAstImports(file);
      for (const imp of imports) {
        for (const pattern of FORBIDDEN_LAYER_PATTERNS) {
          if (imp.specifier.includes(pattern)) {
            violations.push(imp);
          }
        }
      }
    }

    expect(
      violations,
      `Forbidden layer imports discovered in domain files:\n${violations
        .map((v) => `  ${path.relative(DOMAIN_DIR, v.file)}:${v.line} (${v.kind}) -> ${v.specifier}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('AST inspection: domain must not import infrastructure packages', () => {
    const violations: DiscoveredImport[] = [];

    for (const file of domainFiles) {
      const imports = extractAstImports(file);
      for (const imp of imports) {
        for (const pkg of FORBIDDEN_INFRA_PACKAGES) {
          if (imp.specifier === pkg || imp.specifier.startsWith(`${pkg}/`)) {
            violations.push(imp);
          }
        }
      }
    }

    expect(
      violations,
      `Forbidden infrastructure package imports discovered in domain files:\n${violations
        .map((v) => `  ${path.relative(DOMAIN_DIR, v.file)}:${v.line} (${v.kind}) -> ${v.specifier}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('AST inspection adversarial verification: parser must detect all static, dynamic, and export violations in synthetic AST', () => {
    const syntheticCode = `
      import { x } from '../persistence/client.js';
      export { y } from '../../api/server.js';
      const fastify = require('fastify');
      async function load() {
        const mod = await import('drizzle-orm');
      }
      type T = import('@contentos/workflow').Task;
    `;

    const discovered = extractAstImports('synthetic-test.ts', syntheticCode);
    const specifiers = discovered.map((d) => d.specifier);

    expect(specifiers).toContain('../persistence/client.js');
    expect(specifiers).toContain('../../api/server.js');
    expect(specifiers).toContain('fastify');
    expect(specifiers).toContain('drizzle-orm');
    expect(specifiers).toContain('@contentos/workflow');
  });
});
