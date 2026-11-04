import { Writable } from 'node:stream';

import {
  ConflictException,
  Controller,
  Get,
  Module,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { Public } from '../src/shared/auth/decorators.js';
import type { AppConfig } from '../src/shared/config/app-config.js';
import type { ReadinessCheck } from '../src/health/readiness.js';

// Test-only routes used to exercise the error filter and the body limit.
@Public()
@Controller('__test')
class TestController {
  @Get('boom')
  boom(): never {
    throw new Error('db password is hunter2');
  }

  @Get('domain-error')
  domainError(): never {
    // Shape used by domain errors from spec 005 onward.
    throw new ConflictException({
      code: 'SURVEY_HAS_INTERVIEWS',
      detail: 'Survey already has interviews',
    });
  }

  @Get('http-5xx')
  http5xx(): never {
    throw new ServiceUnavailableException('redis at 10.0.0.5 is down');
  }

  @Get('throw-string')
  throwString(): never {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- simulating a misbehaving library
    throw 'plain string failure';
  }

  @Post('echo')
  echo(): { received: true } {
    return { received: true };
  }
}

@Module({ controllers: [TestController] })
class TestRoutesModule {}

const baseConfig: AppConfig = {
  nodeEnv: 'test',
  appEnv: 'local',
  appVersion: 'test-1.0.0',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'info',
  corsOrigins: ['https://painel.example.com'],
  sentryDsn: undefined,
  // Never reached: these tests replace the readiness checks and touch no table.
  databaseUrl: 'postgres://az_app:app@127.0.0.1:1/unused',
  databasePoolMax: 1,
  jwtSecret: 'test-secret-with-at-least-32-characters!',
  panelUrl: 'http://localhost:3001',
  mailDir: '.mail-test',
};

class LogCapture extends Writable {
  readonly lines: string[] = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
    this.lines.push(chunk.toString('utf8'));
    done();
  }

  get text(): string {
    return this.lines.join('');
  }
}

let app: NestFastifyApplication | undefined;

const start = async (
  options: { readinessChecks?: ReadinessCheck[]; logs?: LogCapture } = {},
): Promise<NestFastifyApplication> => {
  app = await createApp(baseConfig, {
    readinessChecks: options.readinessChecks ?? [],
    logDestination: options.logs ?? new LogCapture(),
    extraModules: [TestRoutesModule],
  });
  return app;
};

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('API skeleton (spec 003)', () => {
  it('CA-04: liveness answers 200 with the running version', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/health/live' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: 'test-1.0.0' });
  });

  it('CA-05: readiness is 200 when every check passes', async () => {
    const api = await start({
      readinessChecks: [{ name: 'database', check: () => Promise.resolve() }],
    });

    const res = await api.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('CA-05: readiness is 503 and names the failing check', async () => {
    const api = await start({
      readinessChecks: [
        { name: 'database', check: () => Promise.resolve() },
        { name: 'redis', check: () => Promise.reject(new Error('ECONNREFUSED')) },
      ],
    });

    const res = await api.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      status: 'unavailable',
      checks: { database: 'up', redis: 'down' },
    });
  });

  it('CA-06: unknown route returns 404 as Problem Details', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/nao-existe' });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      type: 'urn:az-pesquisas:error:NOT_FOUND',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      instance: '/nao-existe',
    });
    expect(body['requestId']).toBe(res.headers['x-request-id']);
  });

  it('CA-07: an unexpected error returns a generic 500 and leaks nothing', async () => {
    const logs = new LogCapture();
    const api = await start({ logs });

    const res = await api.inject({ method: 'GET', url: '/__test/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
    expect(res.body).not.toContain('hunter2');
    expect(res.body).not.toContain('Error:');
    expect(res.body).not.toContain('.ts');
    // The real cause still reaches the logs for whoever investigates.
    expect(logs.text).toContain('db password is hunter2');
  });

  it('CA-08: reuses a safe incoming x-request-id', async () => {
    const api = await start();

    const res = await api.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'req-12345678' },
    });

    expect(res.headers['x-request-id']).toBe('req-12345678');
  });

  it('CA-08: replaces an unsafe or missing x-request-id', async () => {
    const api = await start();

    const unsafe = await api.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'x'.repeat(200) },
    });
    const missing = await api.inject({ method: 'GET', url: '/health/live' });

    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(missing.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('CA-09: request logs carry the request id and never the authorization header', async () => {
    const logs = new LogCapture();
    const api = await start({ logs });

    await api.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'session=secret-cookie',
        'x-request-id': 'req-abcdefgh',
      },
    });

    expect(logs.text).toContain('req-abcdefgh');
    expect(logs.text).not.toContain('secret-token');
    expect(logs.text).not.toContain('secret-cookie');
  });

  it('CA-10: sends security headers and hides the server stack', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/health/live' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows CORS only for the configured origins', async () => {
    const api = await start();

    const allowed = await api.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'https://painel.example.com' },
    });
    const denied = await api.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://painel.example.com');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('CA-11: rejects bodies above 2 MB with 413 Problem Details', async () => {
    const api = await start();

    const res = await api.inject({
      method: 'POST',
      url: '/__test/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024 + 1) }),
    });

    expect(res.statusCode).toBe(413);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
  });

  it('answers malformed JSON with 400 Problem Details', async () => {
    const api = await start();

    const res = await api.inject({
      method: 'POST',
      url: '/__test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"broken": ',
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });

  it('keeps the stable code and detail of a domain error (HttpException with { code, detail })', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/__test/domain-error' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      type: 'urn:az-pesquisas:error:SURVEY_HAS_INTERVIEWS',
      code: 'SURVEY_HAS_INTERVIEWS',
      detail: 'Survey already has interviews',
      status: 409,
    });
  });

  it('hides the message of a 5xx HttpException', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/__test/http-5xx' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE', detail: 'Unexpected error' });
    expect(res.body).not.toContain('10.0.0.5');
  });

  it('handles values thrown that are not Error instances', async () => {
    const api = await start();

    const res = await api.inject({ method: 'GET', url: '/__test/throw-string' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(res.body).not.toContain('plain string failure');
  });
});
