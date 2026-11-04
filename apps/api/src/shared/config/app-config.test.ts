import { describe, expect, it } from 'vitest';

import { loadConfig } from './app-config.js';

const DB = 'postgres://az_app:app@127.0.0.1:5433/az_pesquisas';
const SECRET = 'a-secret-with-at-least-32-characters!!';
const REQUIRED = { DATABASE_URL: DB, JWT_SECRET: SECRET };

describe('loadConfig', () => {
  it('CA-01: uses the documented defaults when only DATABASE_URL is set', () => {
    const result = loadConfig(REQUIRED);

    expect(result).toEqual({
      ok: true,
      value: {
        nodeEnv: 'development',
        appEnv: 'local',
        appVersion: 'dev',
        host: '0.0.0.0',
        port: 3000,
        logLevel: 'info',
        corsOrigins: [],
        sentryDsn: undefined,
        databaseUrl: DB,
        databasePoolMax: 10,
        jwtSecret: SECRET,
        panelUrl: 'http://localhost:3001',
        mailDir: '.mail',
      },
    });
  });

  it('reads and converts every variable', () => {
    const result = loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      APP_VERSION: 'a1b2c3d',
      HOST: '127.0.0.1',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS:
        'https://pesquisas.azworkcenter.com.br, https://hml-pesquisas.azworkcenter.com.br',
      SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1',
      DATABASE_URL: DB,
      DATABASE_POOL_MAX: '25',
      JWT_SECRET: SECRET,
      PANEL_URL: 'https://pesquisas.azworkcenter.com.br',
      MAIL_DIR: '/var/mail/az',
    });

    expect(result.ok && result.value).toEqual({
      nodeEnv: 'production',
      appEnv: 'production',
      appVersion: 'a1b2c3d',
      host: '127.0.0.1',
      port: 8080,
      logLevel: 'warn',
      corsOrigins: [
        'https://pesquisas.azworkcenter.com.br',
        'https://hml-pesquisas.azworkcenter.com.br',
      ],
      sentryDsn: 'https://abc@o1.ingest.sentry.io/1',
      databaseUrl: DB,
      databasePoolMax: 25,
      jwtSecret: SECRET,
      panelUrl: 'https://pesquisas.azworkcenter.com.br',
      mailDir: '/var/mail/az',
    });
  });

  it('treats empty strings as unset (so SENTRY_DSN= in .env disables Sentry)', () => {
    const result = loadConfig({ ...REQUIRED, SENTRY_DSN: '', CORS_ORIGINS: '', PORT: '' });

    expect(result.ok && result.value.sentryDsn).toBeUndefined();
    expect(result.ok && result.value.corsOrigins).toEqual([]);
    expect(result.ok && result.value.port).toBe(3000);
  });

  it('CA-02: fails listing the invalid variable names without echoing their values', () => {
    const result = loadConfig({ ...REQUIRED, PORT: 'abc', LOG_LEVEL: 'verbose' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.variables).toEqual(['LOG_LEVEL', 'PORT']);
    expect(result.error.message).toContain('PORT');
    expect(result.error.message).toContain('LOG_LEVEL');
    expect(result.error.message).not.toContain('abc');
    expect(result.error.message).not.toContain('verbose');
  });

  it.each([['0'], ['65536'], ['3000.5'], ['-1']])('rejects PORT=%s', (port) => {
    const result = loadConfig({ ...REQUIRED, PORT: port });

    expect(!result.ok && result.error.variables).toEqual(['PORT']);
  });

  it('rejects an invalid CORS origin without echoing it', () => {
    const result = loadConfig({
      ...REQUIRED,
      CORS_ORIGINS: 'https://ok.example.com,not a url',
    });

    expect(!result.ok && result.error.variables).toEqual(['CORS_ORIGINS']);
    expect(!result.ok && result.error.message).not.toContain('not a url');
  });

  it('rejects a malformed SENTRY_DSN without echoing it (a DSN is a secret)', () => {
    const result = loadConfig({ ...REQUIRED, SENTRY_DSN: 'secret-but-not-a-url' });

    expect(!result.ok && result.error.variables).toEqual(['SENTRY_DSN']);
    expect(!result.ok && result.error.message).not.toContain('secret-but-not-a-url');
  });

  it('CA-03: APP_ENV=production requires NODE_ENV=production', () => {
    const result = loadConfig({ ...REQUIRED, APP_ENV: 'production', NODE_ENV: 'development' });

    expect(!result.ok && result.error.variables).toEqual(['NODE_ENV']);
  });

  it('CA-08: DATABASE_URL and JWT_SECRET are required', () => {
    const result = loadConfig({});

    expect(!result.ok && result.error.variables).toEqual(['DATABASE_URL', 'JWT_SECRET']);
  });

  it('rejects a JWT_SECRET shorter than 32 characters without echoing it', () => {
    const result = loadConfig({ ...REQUIRED, JWT_SECRET: 'curto-demais' });

    expect(!result.ok && result.error.variables).toEqual(['JWT_SECRET']);
    expect(!result.ok && result.error.message).not.toContain('curto-demais');
  });

  it('CA-08: rejects a non-Postgres DATABASE_URL without echoing it (it holds a password)', () => {
    const result = loadConfig({ ...REQUIRED, DATABASE_URL: 'mysql://root:s3cr3t@db/x' });

    expect(!result.ok && result.error.variables).toEqual(['DATABASE_URL']);
    expect(!result.ok && result.error.message).not.toContain('s3cr3t');
  });

  it.each([['0'], ['101'], ['ten']])('rejects DATABASE_POOL_MAX=%s', (value) => {
    const result = loadConfig({ ...REQUIRED, DATABASE_POOL_MAX: value });

    expect(!result.ok && result.error.variables).toEqual(['DATABASE_POOL_MAX']);
  });
});
