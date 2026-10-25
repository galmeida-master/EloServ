// A-conflito-confirmação · duas abas: a aba 2 confirma antes; a aba 1 recebe conflito real produzido pela camada api.
import { test, expect, comoPersona, dados } from './fixtures.js';

test('A-conflito-confirmação — a aba desatualizada recebe CONFLITO_ATUALIZACAO e nada é gravado', async ({ page, context }) => {
  await test.step('Aba 1 abre a confirmação da proposta de SOL-1038', async () => {
    await comoPersona(page, 'u-ana', '/clientes/solicitacoes/SOL-1038');
    await page.getByRole('button', { name: 'Confirmar proposta' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar proposta' })).toBeVisible();
  });

  const aba2 = await context.newPage();
  await test.step('Aba 2 confirma o mesmo horário primeiro', async () => {
    await aba2.goto('/#/clientes/solicitacoes/SOL-1038');
    await aba2.getByRole('button', { name: 'Confirmar proposta' }).click();
    await aba2.getByRole('dialog', { name: 'Confirmar proposta' }).getByRole('button', { name: 'Confirmar proposta' }).click();
    await expect(aba2.getByText('Agendamento confirmado.')).toBeVisible();
  });

  await test.step('Aba 1 tenta confirmar e recebe o conflito da camada api', async () => {
    const dlg = page.getByRole('dialog', { name: 'Confirmar proposta' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Confirmar proposta' }).click();
    await expect(dlg.getByText('A proposta mudou desde que você abriu esta tela')).toBeVisible();
    await expect(dlg.getByText(/Nada foi gravado/)).toBeVisible();
    const d = await dados(page);
    expect(d.ordens.filter(o => o.solicitacaoId === 'SOL-1038')).toHaveLength(1);
    await dlg.getByRole('button', { name: 'Fechar e ver a situação atual' }).click();
    await expect(page.getByLabel('Situações da solicitação').getByText('Aceita')).toBeVisible();
  });
  await aba2.close();
});
