import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { test as base, expect } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

import { MAIL_DIR, ORGS, WEB_URL } from './settings.mjs';

export const [ALFA, BETA] = ORGS as [(typeof ORGS)[number], (typeof ORGS)[number]];

let ipCounter = 0;

/**
 * The API throttles login per client IP (10/min). The panel forwards
 * X-Forwarded-For, so each test gets its own address and the suite never trips it.
 */
export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their dependencies.
  extraHTTPHeaders: async ({}, use) => {
    ipCounter += 1;
    await use({ 'x-forwarded-for': `198.51.100.${(ipCounter % 250) + 1}` });
  },
});
export { expect };

export const unique = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const login = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
};

export const loginAndWait = async (page: Page, email: string, password: string): Promise<void> => {
  await login(page, email, password);
  await page.waitForURL(`${WEB_URL}/`);
  await expect(page.getByTestId('current-user')).toBeVisible();
};

/** Creates a user through the panel's data proxy, as the logged-in admin of `request`. */
export const createUser = async (
  request: APIRequestContext,
  user: { name: string; email: string; role: string; password: string },
): Promise<void> => {
  const response = await request.post('/api/v1/users', {
    data: user,
    headers: { origin: WEB_URL },
  });
  expect(response.status(), await response.text()).toBe(201);
};

export const newPage = async (browser: Browser, ip: string): Promise<Page> => {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ip } });
  return context.newPage();
};

/** The FileMailer writes one .txt per e-mail; returns the newest reset link sent to `to`. */
export const latestResetLink = async (to: string): Promise<string> => {
  const files = (await readdir(MAIL_DIR)).sort().reverse();
  for (const file of files) {
    const text = await readFile(join(MAIL_DIR, file), 'utf8');
    if (text.startsWith(`To: ${to}\n`)) {
      const link = /https?:\/\/\S+\/redefinir-senha\?token=[\w-]+/.exec(text)?.[0];
      if (link) {
        return link;
      }
    }
  }
  throw new Error(`No reset e-mail for ${to}`);
};

/** The form's error message (Next.js also renders an empty role="alert" route announcer). */
export const alertOf = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');

export const menuOf = (page: Page) => page.getByRole('navigation', { name: 'Menu principal' });
