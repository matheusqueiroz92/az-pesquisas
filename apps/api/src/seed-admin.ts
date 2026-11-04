// `pnpm seed:admin`: creates an organization and its first admin (spec 005 rule 19).
// Reads SEED_* variables (see .env.example); never prints the password.
import { CreateUserRequest } from '@az-pesquisas/contracts';
import { z } from 'zod';

import { createOrganizationWithAdmin } from './modules/identity/application/organization-setup.js';
import { createIdentityDeps } from './modules/identity/infrastructure/identity-deps.factory.js';
import { createFileMailer } from './modules/identity/infrastructure/security-adapters.js';
import { loadConfig } from './shared/config/app-config.js';
import { createDatabase } from './shared/database/database.js';

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const SeedInput = z.object({
  SEED_ORG_NAME: z.string().trim().min(2).max(120),
  SEED_ORG_SLUG: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/),
  SEED_ADMIN_NAME: CreateUserRequest.shape.name,
  SEED_ADMIN_EMAIL: CreateUserRequest.shape.email,
  SEED_ADMIN_PASSWORD: CreateUserRequest.shape.password,
});

const main = async (): Promise<void> => {
  const config = loadConfig(process.env);
  if (!config.ok) {
    fail(config.error.message);
    return;
  }
  const input = SeedInput.safeParse(process.env);
  if (!input.success) {
    const names = [...new Set(input.error.issues.map((i) => String(i.path[0])))].sort();
    fail(`Invalid or missing: ${names.join(', ')}. Check apps/api/.env.example.`);
    return;
  }

  const database = createDatabase({ url: config.value.databaseUrl, poolMax: 1 });
  try {
    const deps = createIdentityDeps({
      database,
      jwtSecret: config.value.jwtSecret,
      panelUrl: config.value.panelUrl,
      mailer: createFileMailer(config.value.mailDir),
    });
    const result = await createOrganizationWithAdmin(deps, {
      organizationName: input.data.SEED_ORG_NAME,
      slug: input.data.SEED_ORG_SLUG,
      adminName: input.data.SEED_ADMIN_NAME,
      adminEmail: input.data.SEED_ADMIN_EMAIL,
      adminPassword: input.data.SEED_ADMIN_PASSWORD,
    });
    if (!result.ok) {
      fail(`Not created: ${result.error}.`);
      return;
    }
    process.stdout.write(
      `Organization "${input.data.SEED_ORG_NAME}" created (${result.value.organizationId}).\n` +
        `Admin: ${input.data.SEED_ADMIN_EMAIL}\n`,
    );
  } finally {
    await database.close();
  }
};

void main();
