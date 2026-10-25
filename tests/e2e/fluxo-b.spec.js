// Fluxo B · Empresa atende: solicitação → atribuição → proposta → confirmação do cliente → OS → execução
// → conclusão com retorno → resumo imprimível.
import { test, expect, comoPersona, abrirSimulacao, fecharSimulacao } from './fixtures.js';

test('Fluxo B — empresa atende da solicitação à conclusão com próximo retorno', async ({ page }) => {
  await test.step('Gestora abre a solicitação SOL-1040', async () => {
    await comoPersona(page, 'u-marina', '/empresas/solicitacoes');
    await page.getByRole('link', { name: 'Abrir SOL-1040' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Manutenção preventiva' })).toBeVisible();
    await expect(page.getByText(/Reserva temporária válida até/)).toBeVisible();
  });

  await test.step('Atribuição considera elegibilidade e disponibilidade', async () => {
    const grupo = page.getByRole('radiogroup', { name: 'Profissional' });
    await expect(grupo.getByRole('radio', { name: /Rafael T\..*Ocupado/ })).toHaveAttribute('aria-disabled', 'true');
    await grupo.getByRole('radio', { name: /Juliana R\..*Disponível no horário/ }).click();
    await expect(grupo.getByRole('radio', { name: /Juliana R\./ })).toHaveAttribute('aria-checked', 'true');
  });

  await test.step('Envia a proposta com itens, validade e data com fuso', async () => {
    await expect(page.getByText(/Data proposta: Seg, 26\/10\/2026 · 13:30 · Horário de Cuiabá \(UTC−4\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Enviar proposta' }).click();
    await expect(page.getByText('Proposta enviada. A reserva temporária segue até a resposta do cliente.')).toBeVisible();
    await expect(page.getByText('Aguardando o cliente')).toBeVisible();
  });

  await test.step('Cliente confirma (simulação) e a OS é criada', async () => {
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: 'Cliente confirma a proposta' }).click();
    await expect(painel.getByText('Cliente confirma a proposta: concluído.')).toBeVisible();
    await fecharSimulacao(page);
    await expect(page.getByText(/Ordem de serviço OS-2210/)).toBeVisible();
    await page.getByRole('link', { name: 'Abrir ordem de serviço' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Manutenção preventiva' })).toBeVisible();
    await expect(page.getByText('Juliana Rocha')).toBeVisible();
  });

  await test.step('Execução e conclusão exigem o trabalho realizado', async () => {
    await page.getByRole('button', { name: 'Iniciar execução' }).click();
    await expect(page.getByText('Atendimento em execução.')).toBeVisible();
    await page.getByRole('button', { name: 'Concluir atendimento' }).click();
    await expect(page.locator('#os-trabalho-erro')).toHaveText(/Descreva o trabalho realizado para concluir./);
    await page.getByLabel('Trabalho realizado').fill('Limpeza do filtro, verificação do dreno e teste de desligamento automático.');
    await page.getByLabel('Próximo retorno sugerido').selectOption('6');
    await page.getByRole('button', { name: 'Concluir atendimento' }).click();
    await expect(page.getByText('Ordem concluída. Histórico atualizado.')).toBeVisible();
    await expect(page.getByText('abril de 2027', { exact: true })).toBeVisible();
  });

  await test.step('Resumo imprimível', async () => {
    await page.getByRole('button', { name: 'Resumo imprimível' }).click();
    const dlg = page.getByRole('dialog', { name: 'Resumo imprimível' });
    await expect(dlg.getByText('Não é documento fiscal, laudo técnico ou certificação.', { exact: false })).toBeVisible();
    await expect(dlg.getByText('OS-2210')).toBeVisible();
    await dlg.getByRole('button', { name: 'Imprimir' }).click();
    expect(await page.evaluate(() => window.__impressoes)).toBe(1);
  });

  await test.step('Retorno aparece em Histórico e retornos', async () => {
    await page.goto('/#/empresas/historico');
    await expect(page.getByRole('link', { name: /Roberto C\..*OS-2210.*abril de 2027/ })).toBeVisible();
  });
});
