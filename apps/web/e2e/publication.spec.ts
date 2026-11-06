import type { Page } from '@playwright/test';

import { WEB_URL } from './settings.mjs';
import { ALFA, expect, loginAndWait, test, unique } from './support';

const QUESTION = {
  id: '0193a000-0000-7000-8000-0000000003a1',
  code: 'P01',
  text: 'Você aprova a gestão do prefeito?',
  required: true,
  type: 'single_choice',
  shuffleOptions: false,
  options: [
    { id: '0193a000-0000-7000-8000-0000000003a2', code: '1', label: 'Aprova' },
    { id: '0193a000-0000-7000-8000-0000000003a3', code: '2', label: 'Desaprova' },
  ],
};

const surveyWithQuestionnaire = async (page: Page, title: string) => {
  const created = await page.request.post('/api/v1/surveys', {
    data: { title, type: 'municipal_evaluation', municipalityCodes: [2916401] },
    headers: { origin: WEB_URL },
  });
  const { id } = (await created.json()) as { id: string };
  const saved = await page.request.put(`/api/v1/surveys/${id}/questionnaire`, {
    data: { revision: 0, content: { introText: 'Bom dia!', questions: [QUESTION] } },
    headers: { origin: WEB_URL },
  });
  expect(saved.status()).toBe(200);
  return id;
};

test.describe('Publicação de versão (spec 015)', () => {
  test('CA-01, CA-03, CA-06, CA-07: publica v1 e v2, imprime e encerra o campo', async ({
    page,
  }) => {
    const title = unique('Avaliação da gestão');
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const id = await surveyWithQuestionnaire(page, title);

    await page.goto(`/pesquisas/${id}/questionario`);
    await expect(page.getByTestId('published-version')).toHaveText('Nunca publicado');
    await page.getByRole('button', { name: 'Publicar versão 1' }).click();
    const dialog = page.getByTestId('publish-dialog');
    await expect(dialog).toContainText('A primeira versão vai para os aparelhos');
    await dialog.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Versão 1 publicada.')).toBeVisible();
    await expect(page.getByTestId('published-version')).toHaveText('Publicado: versão 1');
    await expect(page.getByText('Em campo', { exact: true })).toBeVisible();

    // v2: one new option → comparability warning.
    await page.getByRole('button', { name: /Você aprova a gestão/ }).click();
    await page.getByRole('button', { name: 'Adicionar opção' }).click();
    await page.getByTestId('question-form').getByLabel('Rótulo (Item 3)').fill('Não sabe');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Publicar versão 2' }).click();
    await expect(dialog).toContainText('P01: opção nova "Não sabe"');
    await expect(dialog).toContainText('Atenção à comparabilidade');
    await dialog.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Versão 2 publicada.')).toBeVisible();

    // Versions tab and the printable document.
    await page.getByRole('link', { name: 'Versões' }).click();
    await expect(page.getByTestId('version-row')).toHaveCount(2);
    await expect(page.getByTestId('version-row').first()).toContainText('Versão 2');
    await page
      .getByTestId('version-row')
      .last()
      .getByRole('link', { name: 'Abrir para imprimir' })
      .click();
    const doc = page.getByTestId('version-document');
    await expect(doc).toContainText(title);
    await expect(doc).toContainText('Ficha técnica');
    await expect(doc).toContainText('Itapetinga');
    await expect(doc).toContainText('Bom dia!');
    await expect(doc).toContainText('Desaprova');
    await expect(doc).not.toContainText('Não sabe');
    await expect(page.getByRole('button', { name: 'Imprimir / salvar em PDF' })).toBeVisible();

    // Close and reopen the fieldwork; the type is now fixed.
    await page.goto(`/pesquisas/${id}`);
    await expect(page.getByLabel('Tipo de pesquisa')).toBeDisabled();
    await page.getByRole('button', { name: 'Encerrar campo' }).click();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reabrir campo' }).click();
    await expect(page.getByText('Em campo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toHaveCount(0);
  });

  test('CA-02: pendência impede publicar', async ({ page }) => {
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    const created = await page.request.post('/api/v1/surveys', {
      data: { title: unique('Sem perguntas'), type: 'market' },
      headers: { origin: WEB_URL },
    });
    const { id } = (await created.json()) as { id: string };
    await page.goto(`/pesquisas/${id}/questionario`);
    await page.getByRole('button', { name: 'Publicar versão 1' }).click();
    const dialog = page.getByTestId('publish-dialog');
    await expect(dialog).toContainText('O questionário tem pendências');
    await expect(dialog.getByRole('button', { name: 'Publicar' })).toHaveCount(0);
  });
});
