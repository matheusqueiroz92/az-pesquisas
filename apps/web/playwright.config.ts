import { defineConfig, devices } from '@playwright/test';

import {
  API_PORT,
  API_URL,
  DATABASE_APP_URL,
  JWT_SECRET,
  MAIL_DIR,
  WEB_PORT,
  WEB_URL,
} from './e2e/settings.mjs';

// Run with `pnpm test:e2e` after `pnpm build`: e2e/prepare.mjs creates the
// database first. Real API, real panel, real Postgres (design 007).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --import ./dist/instrument.js dist/main.js',
      cwd: '../api',
      url: `${API_URL}/health/ready`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'local',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL: DATABASE_APP_URL,
        JWT_SECRET,
        PANEL_URL: WEB_URL,
        MAIL_DIR,
        CORS_ORIGINS: '',
      },
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_URL, APP_ENV: 'local', NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
