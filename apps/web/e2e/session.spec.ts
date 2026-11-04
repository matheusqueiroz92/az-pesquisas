import {
  ALFA,
  alertOf,
  BETA,
  createUser,
  expect,
  login,
  loginAndWait,
  newPage,
  test,
  unique,
} from './support';
import { WEB_URL } from './settings.mjs';

test.describe('Sessão (spec 007)', () => {
  test('CA-01: sem sessão, as páginas internas levam ao login', async ({ page }) => {
    for (const path of ['/', '/usuarios', '/minha-conta']) {
      await page.goto(path);
      await expect(page).toHaveURL(`${WEB_URL}/login`);
    }
  });

  test('CA-02: login com senha errada mostra erro genérico; com a certa, o início', async ({
    page,
  }) => {
    await login(page, ALFA.adminEmail, 'senha-errada-000');
    await expect(alertOf(page)).toContainText('E-mail ou senha incorretos');
    await expect(alertOf(page)).toContainText('15 minutos');
    await expect(page).toHaveURL(`${WEB_URL}/login`);

    // An unknown e-mail looks exactly the same (no account enumeration).
    await login(page, 'ninguem@alfa.test', 'senha-errada-000');
    await expect(alertOf(page)).toContainText('E-mail ou senha incorretos');

    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Ana!');
    await expect(page.getByTestId('current-user')).toHaveText(ALFA.adminName);
  });

  test('CA-03: tokens só em cookies httpOnly, nunca no HTML nem no JavaScript', async ({
    page,
    context,
  }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const cookies = await context.cookies();
    const tokens = cookies.filter((c) => c.name === 'az_at' || c.name === 'az_rt');
    expect(tokens.map((c) => c.name).sort()).toEqual(['az_at', 'az_rt']);
    for (const cookie of tokens) {
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.sameSite, cookie.name).toBe('Lax');
      expect(cookie.path, cookie.name).toBe('/');
    }

    for (const path of ['/', '/usuarios', '/minha-conta']) {
      await page.goto(path);
      const html = await page.content();
      for (const cookie of tokens) {
        expect(html, `${cookie.name} in ${path}`).not.toContain(cookie.value);
      }
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain('az_');

    // The login response itself carries the user, never the tokens.
    const body = await page.request.post('/api/auth/login', {
      data: { email: ALFA.adminEmail, password: ALFA.adminPassword },
      headers: { origin: WEB_URL },
    });
    expect(Object.keys((await body.json()) as object)).toEqual(['user']);
  });

  test('CA-04: três abas com o access token vencido renovam uma vez só', async ({
    page,
    context,
  }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const before = (await context.cookies()).find((c) => c.name === 'az_rt')?.value;

    // Simulates the 15-minute expiry: the cookie disappears together with the token.
    await context.clearCookies({ name: 'az_at' });
    const tabs = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    await Promise.all(tabs.map((tab, i) => tab.goto(['/', '/usuarios', '/minha-conta'][i] ?? '/')));
    for (const tab of tabs) {
      await expect(tab).not.toHaveURL(/\/login$/);
      await expect(tab.getByTestId('current-user')).toHaveText(ALFA.adminName);
    }

    const after = (await context.cookies()).find((c) => c.name === 'az_rt')?.value;
    expect(after).toBeDefined();
    expect(after).not.toBe(before);

    // The session survived: the rotated token still renews (no reuse detection fired).
    await context.clearCookies({ name: 'az_at' });
    await page.goto('/minha-conta');
    await expect(page.getByTestId('current-user')).toHaveText(ALFA.adminName);
  });

  test('CA-04: chamadas do navegador com o token vencido também renovam', async ({
    page,
    context,
  }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await context.clearCookies({ name: 'az_at' });
    const responses = await Promise.all([1, 2, 3].map(() => page.request.get('/api/v1/auth/me')));
    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
    await page.goto('/');
    await expect(page.getByTestId('current-user')).toHaveText(ALFA.adminName);
  });

  test('CA-08: sair encerra a sessão', async ({ page, context }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const refreshToken = (await context.cookies()).find((c) => c.name === 'az_rt')?.value;
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(`${WEB_URL}/login`);
    expect((await context.cookies()).filter((c) => c.name.startsWith('az_'))).toEqual([]);

    await page.goto('/');
    await expect(page).toHaveURL(`${WEB_URL}/login`);

    // The refresh token was revoked in the API, not just forgotten by the browser.
    await context.addCookies([
      { name: 'az_rt', value: refreshToken ?? '', url: WEB_URL, httpOnly: true },
    ]);
    await page.goto('/');
    await expect(page).toHaveURL(`${WEB_URL}/login`);
  });

  test('regra 6: rotas que mudam dados recusam outra origem', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    for (const path of ['/api/v1/users', '/api/auth/logout', '/api/auth/login']) {
      const response = await page.request.post(path, {
        data: {},
        headers: { origin: 'https://evil.example' },
      });
      expect(response.status(), path).toBe(403);
    }
    // Paths outside the allowlist never reach the API (tokens only via /api/auth/*).
    const refresh = await page.request.post('/api/v1/auth/refresh', {
      data: {},
      headers: { origin: WEB_URL },
    });
    expect(refresh.status()).toBe(404);
  });

  test('organizações não se enxergam', async ({ page, browser }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const email = `${unique('so-alfa')}@alfa.test`;
    await createUser(page.request, {
      name: 'Só da Alfa',
      email,
      role: 'analyst',
      password: 'senha-123456',
    });

    const beta = await newPage(browser, '198.51.100.251');
    await loginAndWait(beta, BETA.adminEmail, BETA.adminPassword);
    await beta.goto('/usuarios');
    await expect(beta.getByTestId('user-row')).toHaveCount(1);
    await expect(beta.getByText(email)).toHaveCount(0);
    await beta.context().close();
  });
});
