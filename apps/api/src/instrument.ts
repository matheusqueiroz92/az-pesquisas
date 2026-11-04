// Loaded with `node --import ./dist/instrument.js` so Sentry initializes before
// any other module. Without SENTRY_DSN (local, tests) it does nothing.
import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN']?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['APP_ENV'] ?? 'local',
    release: process.env['APP_VERSION'] ?? 'dev',
    // Interview data is personal and political. Sentry 11 collects headers, cookies
    // and request/response bodies by default: switch every category off explicitly.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    tracesSampleRate: 0,
  });
}
