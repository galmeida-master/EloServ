// Fluxo D · Admin habilita empresa: pendente → análise cadastral → habilitação → auditoria → perfil público disponível.
import { test, expect, comoPersona } from './fixtures.js';

test('Fluxo D — habilitação com justificativa, auditoria e empresa no catálogo público', async ({ page }) => {
  await test.step('Empresa pendente não aparece no catálogo', async () => {
    await page.goto('/#/fornecedores');
    await expect(page.getByText('4 empresas encontradas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gelo Fino Refrigeração' })).toHaveCount(0);
  });

  await test.step('Admin analisa o cadastro', async () => {
    await comoPersona(page, 'u-paulo', '/admin');
    await page.getByRole('link', { name: /Gelo Fino Refrigeração/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gelo Fino Refrigeração' })).toBeVisible();
    const habilitar = page.getByRole('button', { name: 'Habilitar empresa' });
    await expect(habilitar).toBeDisabled();
    for (const item of ['CNPJ informado', 'Responsável confirmou', 'Ao menos um serviço', 'Políticas de atendimento', 'Conteúdo público sem promessas']) {
      await page.getByLabel(new RegExp(item)).check();
    }
    await expect(page.getByText('5 de 5 verificados')).toBeVisible();
    await expect(habilitar).toBeEnabled();
  });

  await test.step('Habilitar exige justificativa', async () => {
    await page.getByRole('button', { name: 'Habilitar empresa' }).click();
    const dlg = page.getByRole('dialog', { name: 'Habilitar Gelo Fino Refrigeração?' });
    await dlg.getByLabel('Justificativa').fill('ok');
    await dlg.getByRole('button', { name: 'Habilitar e registrar' }).click();
    await expect(dlg.getByText(/mínimo de 10 caracteres/)).toBeVisible();
    await dlg.getByLabel('Justificativa').fill('Análise cadastral concluída sem pendências.');
    await dlg.getByRole('button', { name: 'Habilitar e registrar' }).click();
    await expect(page.getByText('Empresa habilitada. Perfil público disponível e registro de auditoria criado.')).toBeVisible();
    await expect(page.locator('.page-head').getByText('Ativa')).toBeVisible();
  });

  await test.step('Auditoria registrada', async () => {
    await page.goto('/#/admin/auditoria');
    await page.getByLabel('Tipo de alteração').selectOption('habilitacao');
    const linha = page.getByRole('row', { name: /Empresa habilitada/ }).filter({ hasText: 'Gelo Fino' });
    await expect(linha).toContainText('Paulo Lemos (admin operações)');
    await expect(linha).toContainText('Análise cadastral concluída sem pendências.');
  });

  await test.step('Perfil público disponível no catálogo', async () => {
    await page.goto('/#/fornecedores');
    await expect(page.getByRole('heading', { name: 'Gelo Fino Refrigeração' })).toBeVisible();
    await expect(page.getByText('Habilitada recentemente')).toBeVisible();
    await page.getByRole('link', { name: 'Ver perfil de Gelo Fino Refrigeração' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gelo Fino Refrigeração' })).toBeVisible();
  });
});
