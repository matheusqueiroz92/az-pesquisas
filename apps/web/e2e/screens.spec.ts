import {
  ALFA,
  alertOf,
  createUser,
  expect,
  latestResetLink,
  login,
  loginAndWait,
  menuOf,
  newPage,
  test,
  unique,
} from './support';
import { WEB_URL } from './settings.mjs';

test.describe('Telas (spec 007)', () => {
  test('CA-05: admin cria um coordenador e depois o desativa', async ({ page, browser }) => {
    const email = `${unique('coord')}@alfa.test`;
    const password = 'senha-do-coord-1';
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await menuOf(page).getByRole('link', { name: 'Usuários' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Usuários');

    await page.getByRole('button', { name: 'Novo usuário' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill('Carla Coordenadora');
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByLabel('Papel').selectOption('coordinator');
    await dialog.getByLabel('Senha inicial').fill(password);
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByTestId('user-row').filter({ hasText: email });
    await expect(row).toContainText('Carla Coordenadora');
    await expect(row).toContainText('Coordenador');
    await expect(row).toContainText('Ativo');
    await expect(row).toContainText('Nunca');

    // A duplicate e-mail is refused with a translated message.
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await dialog.getByLabel('Nome').fill('Outra Pessoa');
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByLabel('Senha inicial').fill(password);
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Este e-mail já está em uso.');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    // The coordinator can log in while active.
    const coordinator = await newPage(browser, '198.51.100.252');
    await loginAndWait(coordinator, email, password);

    await row.getByRole('button', { name: /Editar/ }).click();
    await dialog.getByLabel('Situação').selectOption('disabled');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText('Desativado');

    // Disabled: cannot log in again, and the open session is gone too (spec 006).
    await coordinator.context().clearCookies({ name: 'az_at' });
    await coordinator.goto('/');
    await expect(coordinator).toHaveURL(`${WEB_URL}/login`);
    await login(coordinator, email, password);
    await expect(alertOf(coordinator)).toContainText('E-mail ou senha incorretos');
    await coordinator.context().close();
  });

  test('CA-05: o admin não consegue desativar a si mesmo', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await page.goto('/usuarios');
    const self = page.getByTestId('user-row').filter({ hasText: ALFA.adminEmail });
    await self.getByRole('button', { name: /Editar/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Situação')).toBeDisabled();
    await expect(page.getByRole('dialog').getByLabel('Papel')).toBeDisabled();
  });

  test('CA-06: coordenador não vê Usuários e recebe "Sem permissão"', async ({ page, browser }) => {
    const email = `${unique('coord')}@alfa.test`;
    const password = 'senha-do-coord-2';
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await createUser(page.request, {
      name: 'Caio Coordenador',
      email,
      role: 'coordinator',
      password,
    });

    const coordinator = await newPage(browser, '198.51.100.253');
    await loginAndWait(coordinator, email, password);
    const menu = menuOf(coordinator);
    await expect(menu.getByRole('link', { name: 'Início' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Usuários' })).toHaveCount(0);

    await coordinator.goto('/usuarios');
    await expect(coordinator.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
    // And the API refuses the data anyway.
    expect((await coordinator.request.get('/api/v1/users')).status()).toBe(403);
    await coordinator.context().close();
  });

  test('CA-07: esqueci a senha, link do e-mail e senha nova', async ({ page }) => {
    const email = `${unique('esq')}@alfa.test`;
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await createUser(page.request, {
      name: 'Eva Esquecida',
      email,
      role: 'analyst',
      password: 'senha-antiga-1',
    });
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(`${WEB_URL}/login`);

    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page.getByRole('heading', { name: 'Esqueci a senha' })).toBeVisible();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado');

    const link = await latestResetLink(email);
    expect(link.startsWith(`${WEB_URL}/redefinir-senha?token=`)).toBe(true);
    await page.goto(link);
    await page.getByLabel('Senha nova', { exact: true }).fill('senha-nova-123');
    await page.getByLabel('Repita a senha nova').fill('senha-nova-123');
    await page.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');

    // The link works once.
    await page.goto(link);
    await page.getByLabel('Senha nova', { exact: true }).fill('outra-senha-123');
    await page.getByLabel('Repita a senha nova').fill('outra-senha-123');
    await page.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(alertOf(page)).toContainText('inválido ou expirou');

    await login(page, email, 'senha-antiga-1');
    await expect(alertOf(page)).toContainText('E-mail ou senha incorretos');
    await loginAndWait(page, email, 'senha-nova-123');

    await menuOf(page).getByRole('link', { name: 'Minha conta' }).click();
    await page.getByLabel('Senha atual').fill('senha-errada-99');
    await page.getByLabel('Senha nova').fill('mais-uma-senha-1');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(alertOf(page)).toHaveText('A senha atual está incorreta.');

    await page.getByLabel('Senha atual').fill('senha-nova-123');
    await page.getByLabel('Senha nova').fill('mais-uma-senha-1');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');
    // The current session stays open after changing the password.
    await page.reload();
    await expect(page.getByTestId('current-user')).toHaveText('Eva Esquecida');
  });

  test('CA-09: CSP com nonce e cabeçalhos de segurança', async ({ page }) => {
    for (const path of ['/login', '/esqueci-senha']) {
      const response = await page.goto(path);
      const headers = response?.headers() ?? {};
      const csp = headers['content-security-policy'] ?? '';
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce, path).toBeTruthy();
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('unsafe-eval');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-powered-by']).toBeUndefined();

      // Every script Next.js rendered carries this request's nonce.
      const scripts = await page
        .locator('script')
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));
      expect(scripts.length).toBeGreaterThan(0);
      expect(new Set(scripts)).toEqual(new Set([nonce]));
    }
  });
});
