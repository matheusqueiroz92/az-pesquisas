import type { Page } from '@playwright/test';

import { WEB_URL } from './settings.mjs';
import { ALFA, expect, loginAndWait, test, unique } from './support';

const createSurvey = async (page: Page, body: Record<string, unknown> = {}) => {
  const res = await page.request.post('/api/v1/surveys', {
    data: { title: unique('Questionário'), type: 'public_opinion', ...body },
    headers: { origin: WEB_URL },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
};

const addQuestion = async (page: Page, type: string) => {
  await page.getByLabel('Tipo da nova pergunta').selectOption(type);
  await page.getByRole('button', { name: 'Adicionar pergunta' }).click();
};

const form = (page: Page) => page.getByTestId('question-form');
const saved = (page: Page) =>
  expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });
const codes = (page: Page) => page.getByTestId('question-code');

test.describe('Editor de questionário (spec 014)', () => {
  test('CA-01, CA-02, CA-03: monta, reordena, condiciona e salva sozinho', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const id = await createSurvey(page);
    await page.goto(`/pesquisas/${id}`);
    await page.getByRole('link', { name: 'Questionário' }).click();
    await expect(page.getByText('Comece adicionando a primeira pergunta.')).toBeVisible();
    await expect(page.getByTestId('issues')).toContainText('O questionário não tem perguntas.');

    // P01: single choice Sim/Não
    await addQuestion(page, 'single_choice');
    await form(page).getByLabel('Enunciado').fill('Você vai votar?');
    await form(page).getByLabel('Rótulo (Item 1)').fill('Sim');
    await form(page).getByLabel('Rótulo (Item 2)').fill('Não');
    await expect(page.getByTestId('phone-preview')).toContainText('Você vai votar?');
    await expect(page.getByTestId('phone-preview')).toContainText('Não');

    // P02: number 16–120
    await addQuestion(page, 'number');
    await form(page).getByLabel('Enunciado').fill('Qual a sua idade?');
    await form(page).getByLabel('Mínimo').fill('16');
    await form(page).getByLabel('Máximo').fill('120');

    // P03: text shown only if P01 = Sim
    await addQuestion(page, 'text');
    await form(page).getByLabel('Enunciado').fill('Por quê?');
    await form(page).getByRole('button', { name: 'Adicionar condição' }).click();
    await form(page).getByLabel('Pergunta 1').selectOption('P01');
    await form(page).getByLabel('Comparação 1').selectOption('eq');
    await expect(form(page).getByLabel('Valor 1')).toHaveValue('1');
    await saved(page);
    await expect(page.getByTestId('issues')).toContainText('Nenhuma pendência');

    // Renaming P01 renames the condition (CA-03).
    await page
      .getByTestId('question-row')
      .filter({ hasText: 'Você vai votar?' })
      .getByRole('button', { name: /Você vai votar/ })
      .click();
    await form(page).getByLabel('Código', { exact: true }).fill('P01_VOTA');
    await saved(page);

    await page.reload();
    await expect(codes(page)).toHaveText(['P01_VOTA', 'P02', 'P03']);
    await page.getByRole('button', { name: /Por quê\?/ }).click();
    await expect(form(page).getByLabel('Pergunta 1')).toHaveValue('P01_VOTA');

    // Reordering (CA-02): P03 before P01 makes its condition pending.
    await page.getByRole('button', { name: 'Subir P03' }).click();
    await page.getByRole('button', { name: 'Subir P03' }).click();
    await expect(codes(page)).toHaveText(['P03', 'P01_VOTA', 'P02']);
    await expect(page.getByTestId('issues')).toContainText('1 pendência para publicar');
    await saved(page);
    await page.reload();
    await expect(codes(page)).toHaveText(['P03', 'P01_VOTA', 'P02']);
    await page.getByRole('button', { name: 'Descer P03' }).click();
    await page.getByRole('button', { name: 'Descer P03' }).click();
    await expect(page.getByTestId('issues')).toContainText('Nenhuma pendência');
    await saved(page);
  });

  test('CA-06: a segunda aba não sobrescreve a primeira', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const id = await createSurvey(page);
    const other = await page.context().newPage();
    await page.goto(`/pesquisas/${id}/questionario`);
    await other.goto(`/pesquisas/${id}/questionario`);

    await addQuestion(page, 'signature');
    await saved(page);

    await addQuestion(other, 'photo');
    await expect(other.getByText('Suas últimas alterações não foram salvas.')).toBeVisible({
      timeout: 10_000,
    });
    await other.getByRole('button', { name: 'Recarregar' }).click();
    await expect(codes(other)).toHaveText(['P01']);
    await expect(other.getByTestId('question-row')).toContainText('Assinatura');
    await other.close();
  });

  test('CA-07: pesquisa registrada no TSE abre só para leitura', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const id = await createSurvey(page, {
      type: 'electoral',
      tse: { registrationNumber: 'BA-07777/2026' },
    });
    await page.goto(`/pesquisas/${id}/questionario`);
    await expect(page.getByText('Pesquisa registrada no TSE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar pergunta' })).toHaveCount(0);
  });

  test('014.1: insere o bloco de perfil básico pronto e editável', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const id = await createSurvey(page);
    await page.goto(`/pesquisas/${id}/questionario`);
    await addQuestion(page, 'signature');
    await page.getByLabel('Bloco').selectOption('basic');
    await page.getByLabel('Onde inserir').selectOption('start');
    await page.getByRole('button', { name: 'Inserir bloco' }).click();
    await expect(page.getByText('3 perguntas inseridas.')).toBeVisible();
    await expect(codes(page)).toHaveText(['SEXO', 'FAIXA_ETARIA', 'ESCOLARIDADE', 'P01']);
    await expect(page.getByTestId('profile-badge')).toContainText('Variável de perfil: Sexo');

    await page.getByRole('button', { name: /Qual a sua idade\?/ }).click();
    await expect(form(page).getByLabel('Rótulo (Item 5)')).toHaveValue('60 anos ou mais');
    await form(page).getByLabel('Rótulo (Item 5)').fill('60 anos e mais');
    await saved(page);

    await page.getByLabel('Bloco').selectOption('basic');
    await page.getByRole('button', { name: 'Inserir bloco' }).click();
    await expect(
      page.getByText('Todas as perguntas deste bloco já estão no questionário.'),
    ).toBeVisible();
    await page.reload();
    await expect(codes(page)).toHaveText(['SEXO', 'FAIXA_ETARIA', 'ESCOLARIDADE', 'P01']);
  });
});
