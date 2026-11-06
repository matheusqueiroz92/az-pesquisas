import { ALFA, createUser, expect, loginAndWait, menuOf, newPage, test, unique } from './support';
import { WEB_URL } from './settings.mjs';

test.describe('Clientes e pesquisas (spec 013)', () => {
  test('CA-10: cadastra cliente e pesquisa, arquiva e acha nas arquivadas', async ({ page }) => {
    const clientName = unique('Prefeitura');
    const title = unique('Avaliação municipal');
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);

    // Client
    await menuOf(page).getByRole('link', { name: 'Clientes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clientes');
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill(clientName);
    await dialog.getByLabel('CPF ou CNPJ').fill('11.222.333/0001-82');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Confira os campos destacados.');
    await expect(dialog.getByLabel('CPF ou CNPJ')).toHaveAttribute('aria-invalid', 'true');
    await dialog.getByLabel('CPF ou CNPJ').fill('11.222.333/0001-81');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();
    const clientRow = page.getByTestId('client-row').filter({ hasText: clientName });
    await expect(clientRow).toContainText('11.222.333/0001-81');
    await expect(clientRow).toContainText('0');

    // Survey
    await menuOf(page).getByRole('link', { name: 'Pesquisas' }).click();
    await page.getByRole('link', { name: 'Nova pesquisa' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nova pesquisa');
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Tipo de pesquisa').selectOption('municipal_evaluation');
    await page.getByLabel('Cliente').selectOption({ label: clientName });
    await page.getByLabel('Início do campo').fill('2026-11-10');
    await page.getByLabel('Fim do campo').fill('2026-11-20');
    await page.getByLabel('Meta de entrevistas').fill('600');
    const search = page.getByPlaceholder('Buscar município');
    await search.fill('itapetinga');
    await search.press('Enter');
    await search.fill('Itambé');
    await page.getByLabel('Itambé', { exact: true }).check();
    await expect(page.getByTestId('municipality-picker')).toContainText('2 escolhidos');
    await page.getByLabel('Localização (GPS)').selectOption('required');
    await page.getByRole('button', { name: 'Criar pesquisa' }).click();

    await page.waitForURL(/\/pesquisas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Itapetinga' })).toBeVisible();

    // Electoral, registered at the TSE: the extra section appears and is saved.
    await page.getByLabel('Tipo de pesquisa').selectOption('electoral');
    await page.getByLabel('Pesquisa registrada no TSE (PesqEle)').check();
    await page.getByLabel('Número de registro').fill('BA-01234/2026');
    await page.getByLabel('Valor contratado (R$)').fill('12.500,00');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Número de registro')).toHaveValue('BA-01234/2026');
    await expect(page.getByLabel('Valor contratado (R$)')).toHaveValue('12.500,00');

    // In the list, then archived.
    await page.getByRole('link', { name: 'Pesquisas', exact: true }).first().click();
    await page.getByLabel('Buscar por título').fill(title);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const row = page.getByTestId('survey-row').filter({ hasText: title });
    await expect(row).toContainText(clientName);
    await expect(row).toContainText('10/11/2026 a 20/11/2026');
    await expect(row).toContainText('600');
    await row.getByRole('link', { name: title }).click();

    await page.getByRole('button', { name: 'Arquivar' }).click();
    await expect(
      page.getByText('Pesquisa arquivada. Desarquive para editar ou excluir.'),
    ).toBeVisible();
    await expect(page.getByLabel('Título')).toBeDisabled();

    await page.goto(`/pesquisas?q=${encodeURIComponent(title)}`);
    await expect(page.getByTestId('survey-row')).toHaveCount(0);
    await page.getByRole('link', { name: 'Arquivadas' }).click();
    await expect(page.getByTestId('survey-row').filter({ hasText: title })).toContainText(
      'Arquivada',
    );

    // The client now has a survey and cannot be deleted.
    await page.goto('/clientes');
    await expect(clientRow).toContainText('1');
    await clientRow.getByRole('button', { name: `Excluir ${clientName}` }).click();
    await dialog.getByRole('button', { name: 'Excluir' }).click();
    await expect(dialog.getByRole('alert')).toContainText('não pode ser excluído');
  });

  test('CA-10: duplica e exclui um rascunho', async ({ page }) => {
    const title = unique('Satisfação');
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await page.goto('/pesquisas/nova');
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Tipo de pesquisa').selectOption('satisfaction');
    await page.getByRole('button', { name: 'Criar pesquisa' }).click();
    await page.waitForURL(/\/pesquisas\/[0-9a-f-]{36}$/);

    await page.getByRole('button', { name: 'Duplicar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Cópia de ${title}`);

    await page.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
    await page.waitForURL(`${WEB_URL}/pesquisas`);
    await page.goto(`/pesquisas?q=${encodeURIComponent(title)}`);
    await expect(page.getByTestId('survey-row')).toHaveCount(1);
  });

  test('CA-09: analista não vê Pesquisas nem Clientes', async ({ page, browser }) => {
    const email = `${unique('analista')}@alfa.test`;
    const password = 'senha-do-analista-1';
    await loginAndWait(page, ALFA.adminEmail, ALFA.adminPassword);
    await createUser(page.request, { name: 'Ana Analista', email, role: 'analyst', password });

    const analyst = await newPage(browser, '198.51.100.249');
    await loginAndWait(analyst, email, password);
    await expect(menuOf(analyst).getByRole('link', { name: 'Pesquisas' })).toHaveCount(0);
    await expect(menuOf(analyst).getByRole('link', { name: 'Clientes' })).toHaveCount(0);
    await analyst.goto('/pesquisas');
    await expect(analyst.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
    expect((await analyst.request.get('/api/v1/surveys')).status()).toBe(403);
    await analyst.context().close();
  });
});
