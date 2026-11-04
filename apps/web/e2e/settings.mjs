// Shared by e2e/prepare.mjs and playwright.config.ts. Test-only values, not secrets.
import { fileURLToPath } from 'node:url';

export const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/postgres';
export const DATABASE = 'az_e2e';
export const OWNER_PASSWORD = 'owner';
export const APP_PASSWORD = 'app';

export const API_PORT = 3100;
export const WEB_PORT = 3101;
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const JWT_SECRET = 'e2e-only-secret-0123456789-abcdefghijklmnop';
export const MAIL_DIR = fileURLToPath(new URL('./.mail', import.meta.url));

const withDatabase = (url, user, password) => {
  const parsed = new URL(url);
  parsed.pathname = `/${DATABASE}`;
  if (user) {
    parsed.username = user;
    parsed.password = password;
  }
  return parsed.toString();
};

export const DATABASE_ADMIN_URL = withDatabase(ADMIN_URL);
export const DATABASE_OWNER_URL = withDatabase(ADMIN_URL, 'az_owner', OWNER_PASSWORD);
export const DATABASE_APP_URL = withDatabase(ADMIN_URL, 'az_app', APP_PASSWORD);

/** Two organizations: tests also check that one never sees the other. */
export const ORGS = [
  {
    name: 'Instituto Alfa',
    slug: 'alfa',
    adminName: 'Ana Admin',
    adminEmail: 'ana@alfa.test',
    adminPassword: 'senha-da-ana-123',
  },
  {
    name: 'Instituto Beta',
    slug: 'beta',
    adminName: 'Bruno Admin',
    adminEmail: 'bruno@beta.test',
    adminPassword: 'senha-do-bruno-123',
  },
];
