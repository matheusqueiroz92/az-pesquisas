import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/app-config.js';
import { createLogger, PinoNestLogger } from './logger.js';

const config: AppConfig = {
  nodeEnv: 'test',
  appEnv: 'local',
  appVersion: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'trace',
  corsOrigins: [],
  sentryDsn: undefined,
  databaseUrl: 'postgres://az_app:app@127.0.0.1:1/unused',
  databasePoolMax: 1,
};

const capture = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString('utf8'));
      done();
    },
  });
  return { stream, text: () => lines.join(''), lines };
};

describe('createLogger redaction (AGENTS.md rule 10)', () => {
  it('redacts credentials in request headers', () => {
    const out = capture();
    createLogger(config, out.stream).info({
      req: {
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=secret-cookie',
          'x-device-token': 'secret-device',
          accept: 'application/json',
        },
      },
    });

    expect(out.text()).not.toMatch(/secret-(token|cookie|device)/);
    expect(out.text()).toContain('[REDACTED]');
    expect(out.text()).toContain('application/json');
  });

  it('redacts sensitive fields at the top level and nested two levels deep', () => {
    const out = capture();
    createLogger(config, out.stream).info({
      password: 'p-top',
      body: { pin: '123456', refreshToken: 'rt-1' },
      interview: { payload: { answers: ['a1'], location: { lat: -14.86 } } },
    });

    const text = out.text();
    for (const secret of ['p-top', '123456', 'rt-1', '"a1"', '-14.86']) {
      expect(text).not.toContain(secret);
    }
  });

  it('tags every line with app, environment and version', () => {
    const out = capture();
    createLogger(config, out.stream).info('hello');

    expect(JSON.parse(out.lines[0] ?? '{}')).toMatchObject({
      app: 'az-pesquisas-api',
      env: 'local',
      version: 'test',
      msg: 'hello',
    });
  });
});

describe('PinoNestLogger', () => {
  it('forwards every Nest log level to pino with its context', () => {
    const out = capture();
    const nest = new PinoNestLogger(createLogger(config, out.stream));

    nest.log('l', 'Ctx');
    nest.error('e', 'stack', 'Ctx');
    nest.warn('w', 'Ctx');
    nest.debug('d', 'Ctx');
    nest.verbose('v', 'Ctx');
    nest.fatal('f', 'Ctx');

    const levels = out.lines.map((l) => (JSON.parse(l) as { level: number }).level);
    expect(levels).toEqual([30, 50, 40, 20, 10, 60]);
    expect(out.lines.every((l) => l.includes('"context":"Ctx"'))).toBe(true);
  });
});
