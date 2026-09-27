import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
    },
    // Test categories via workspace-like includes
    typecheck: {
      enabled: false,
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      '@contentos/domain': path.resolve(import.meta.dirname, 'src/domain'),
      '@contentos/application': path.resolve(import.meta.dirname, 'src/application'),
      '@contentos/persistence': path.resolve(import.meta.dirname, 'src/persistence'),
      '@contentos/workflow': path.resolve(import.meta.dirname, 'src/workflow'),
      '@contentos/providers': path.resolve(import.meta.dirname, 'src/providers'),
      '@contentos/events': path.resolve(import.meta.dirname, 'src/events'),
      '@contentos/security': path.resolve(import.meta.dirname, 'src/security'),
      '@contentos/observability': path.resolve(import.meta.dirname, 'src/observability'),
      '@contentos/api': path.resolve(import.meta.dirname, 'src/api'),
    },
  },
});
