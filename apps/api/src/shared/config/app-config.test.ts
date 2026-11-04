import { describe, expect, it } from 'vitest';

import { loadConfig } from './app-config.js';

describe('loadConfig', () => {
  it('CA-01: uses the documented defaults when nothing is set', () => {
    const result = loadConfig({});

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
    });
  });

  it('treats empty strings as unset (so SENTRY_DSN= in .env disables Sentry)', () => {
    const result = loadConfig({ SENTRY_DSN: '', CORS_ORIGINS: '', PORT: '' });

    expect(result.ok && result.value.sentryDsn).toBeUndefined();
    expect(result.ok && result.value.corsOrigins).toEqual([]);
    expect(result.ok && result.value.port).toBe(3000);
  });

  it('CA-02: fails listing the invalid variable names without echoing their values', () => {
    const result = loadConfig({ PORT: 'abc', LOG_LEVEL: 'verbose' });

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
    const result = loadConfig({ PORT: port });

    expect(!result.ok && result.error.variables).toEqual(['PORT']);
  });

  it('rejects an invalid CORS origin without echoing it', () => {
    const result = loadConfig({ CORS_ORIGINS: 'https://ok.example.com,not a url' });

    expect(!result.ok && result.error.variables).toEqual(['CORS_ORIGINS']);
    expect(!result.ok && result.error.message).not.toContain('not a url');
  });

  it('rejects a malformed SENTRY_DSN without echoing it (a DSN is a secret)', () => {
    const result = loadConfig({ SENTRY_DSN: 'secret-but-not-a-url' });

    expect(!result.ok && result.error.variables).toEqual(['SENTRY_DSN']);
    expect(!result.ok && result.error.message).not.toContain('secret-but-not-a-url');
  });

  it('CA-03: APP_ENV=production requires NODE_ENV=production', () => {
    const result = loadConfig({ APP_ENV: 'production', NODE_ENV: 'development' });

    expect(!result.ok && result.error.variables).toEqual(['NODE_ENV']);
  });
});
