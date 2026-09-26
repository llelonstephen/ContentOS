import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/persistence/relational/schema/index.ts',
  out: './src/persistence/relational/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://contentos:contentos@localhost:5432/contentos',
  },
  verbose: true,
  strict: true,
});
