import { defineConfig } from 'drizzle-kit';

// Only `generate` uses this file (it reads the schema, never a database).
// Migrations are applied by `pnpm db:migrate` (src/migrate.ts) as az_owner.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/database/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
