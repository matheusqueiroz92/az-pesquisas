// `pnpm db:migrate`: applies pending migrations as az_owner, then exits.
// In production it runs as a one-off container before the new API starts (spec 010).
import { runMigrations } from './shared/database/migrator.js';

const url = process.env['DATABASE_MIGRATION_URL']?.trim();

if (!url) {
  process.stderr.write('DATABASE_MIGRATION_URL is not set. Check apps/api/.env.example.\n');
  process.exit(1);
}

runMigrations(url).then(
  () => {
    process.stdout.write('Migrations applied.\n');
  },
  (error: unknown) => {
    // Driver errors can embed the connection string: print only the message class and code.
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? ` ${error.code}`
        : '';
    const name = error instanceof Error ? error.name : 'Error';
    process.stderr.write(`Migration failed (${name}${code}).\n`);
    // Drizzle wraps the driver error: the Postgres reason (e.g. permission denied) is in `cause`.
    for (const e of [error, error instanceof Error ? error.cause : undefined]) {
      if (e instanceof Error && e.message && !e.message.includes('://')) {
        process.stderr.write(`${e.message}\n`);
      }
    }
    process.exit(1);
  },
);
