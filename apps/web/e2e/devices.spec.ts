import type { APIRequestContext } from '@playwright/test';

import { API_URL, WEB_URL } from './settings.mjs';
import { ALFA, BETA, createUser, expect, loginAndWait, test, unique } from './support';

const pairFromApp = async (request: APIRequestContext, code: string, model: string) =>
  request.post(`${API_URL}/v1/devices/pair`, {
    data: {
      code,
      device: { platform: 'android', model, osVersion: '14', appVersion: '0.1.0' },
    },
  });

test.describe('Dispositivos e equipe (spec 016)', () => {
  test('CA-01..CA-05, CA-07: vincula, renomeia, monta a equipe e revoga', async ({
    page,
    browser,
  }) => {
    const model = unique('Galaxy');
    const nickname = unique('Tablet');
    const interviewer = unique('Paula');
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await createUser(page.request, {
      name: interviewer,
      email: `${interviewer.toLowerCase()}@alfa.test`,
      role: 'interviewer',
      password: 'senha-da-paula-123',
    });

    // CA-01: the panel shows a code; the app redeems it once.
    await page.goto('/dispositivos');
    await page.getByRole('button', { name: 'Vincular dispositivo' }).click();
    const dialog = page.getByTestId('pair-dialog');
    const code = (await page.getByTestId('pairing-code').innerText()).replace(/\D/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // CA-02: a wrong code looks like any other invalid code.
    const wrong = await pairFromApp(page.request, code === '000000' ? '111111' : '000000', model);
    expect(wrong.status()).toBe(422);
    expect(((await wrong.json()) as { code: string }).code).toBe('PAIRING_CODE_INVALID');

    const paired = await pairFromApp(page.request, code, model);
    expect(paired.status(), await paired.text()).toBe(201);
    const { deviceToken } = (await paired.json()) as { deviceToken: string };
    await expect(dialog).toContainText(`(${model})`, { timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Fechar' }).click();

    // The same code never works twice.
    expect((await pairFromApp(page.request, code, model)).status()).toBe(422);

    // CA-03: the device token works for the heartbeat.
    const beat = await page.request.post(`${API_URL}/v1/device/heartbeat`, {
      headers: { authorization: `Bearer ${deviceToken}` },
      data: {
        appVersion: '0.1.0',
        batteryLevel: 0.8,
        pendingInterviews: 0,
        pendingMediaBytes: 0,
        storageFreeBytes: null,
        lastSyncError: null,
      },
    });
    expect(beat.status(), await beat.text()).toBe(200);

    // Rename.
    const row = page.getByTestId('device-row').filter({ hasText: model });
    await expect(row).toContainText('Ativo');
    await row.getByRole('button', { name: /^Renomear/ }).click();
    await page.getByLabel('Apelido').fill(nickname);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByTestId('device-row').filter({ hasText: nickname })).toBeVisible();

    // CA-05: the survey team.
    const created = await page.request.post('/api/v1/surveys', {
      data: { title: unique('Equipe'), type: 'municipal_evaluation', municipalityCodes: [2916401] },
      headers: { origin: WEB_URL },
    });
    const { id } = (await created.json()) as { id: string };
    await page.goto(`/pesquisas/${id}/equipe`);
    await page.getByTestId('team-devices').getByText(nickname, { exact: true }).click();
    await page.getByTestId('team-interviewers').getByText(interviewer, { exact: true }).click();
    await page.getByRole('button', { name: 'Salvar equipe' }).click();
    await expect(page.getByText('Equipe salva.')).toBeVisible();
    await page.reload();
    await expect(
      page.getByTestId('team-devices').getByRole('checkbox', { checked: true }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId('team-interviewers').getByRole('checkbox', { checked: true }),
    ).toHaveCount(1);
    await page.goto('/dispositivos');
    await expect(page.getByTestId('device-row').filter({ hasText: nickname })).toContainText(
      'Equipe-',
    );

    // CA-07: another organization never sees the device.
    const other = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.9' },
    });
    const beta = await other.newPage();
    await loginAndWait(beta, BETA.adminEmail, BETA.adminPassword);
    await beta.goto('/dispositivos');
    await expect(beta.getByTestId('device-row').filter({ hasText: model })).toHaveCount(0);
    await other.close();

    // CA-04: revoke → the token stops working and the device leaves the team.
    const revokedRow = page.getByTestId('device-row').filter({ hasText: nickname });
    await revokedRow.getByRole('button', { name: /^Revogar/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revogar' }).click();
    await expect(revokedRow).toContainText('Revogado');
    const after = await page.request.post(`${API_URL}/v1/device/heartbeat`, {
      headers: { authorization: `Bearer ${deviceToken}` },
      data: {
        appVersion: '0.1.0',
        batteryLevel: null,
        pendingInterviews: 0,
        pendingMediaBytes: 0,
        storageFreeBytes: null,
        lastSyncError: null,
      },
    });
    expect(after.status()).toBe(401);
    await page.goto(`/pesquisas/${id}/equipe`);
    await expect(page.getByTestId('team-devices').getByText(nickname)).toHaveCount(0);
  });
});
