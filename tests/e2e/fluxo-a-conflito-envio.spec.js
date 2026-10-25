// A-conflito-envio · horário ocupado por operação concorrente → mensagem → dados preservados → alternativa → sucesso.
import { test, expect, comoPersona, abrirSimulacao, fecharSimulacao, dados } from './fixtures.js';
import { preencherSolicitacao } from './ajudantes.js';

test('A-conflito-envio — a camada api recusa o horário ocupado e oferece alternativas sem perder dados', async ({ page }) => {
  await test.step('Cliente preenche a solicitação até a revisão', async () => {
    await comoPersona(page, 'u-ana', '/fornecedores/friovale');
    await page.getByRole('button', { name: 'Solicitar este serviço: Higienização de split' }).click();
    await preencherSolicitacao(page);
  });

  await test.step('Outra operação reserva o mesmo horário (todos os profissionais elegíveis)', async () => {
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: /Simular reserva concorrente em Seg, 26\/10\/2026 · 10:00/ }).click();
    await expect(painel.getByText('Reserva concorrente criada: concluído.')).toBeVisible();
    await fecharSimulacao(page);
  });

  await test.step('Envio: o servidor simulado revalida e devolve conflito; nada é gravado', async () => {
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    const alerta = page.locator('#alerta-conflito');
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText('Nada foi enviado e seus dados foram mantidos.');
    await expect(page.getByText('Aparelho da sala pingando água na parede desde ontem.')).toBeVisible();
    const d = await dados(page);
    expect(d.solicitacoes.some(s => s.id === 'SOL-1042')).toBe(false);
    expect(d.auditoria.some(a => a.acao === 'Conflito de reserva')).toBe(true);
  });

  await test.step('Escolhe uma alternativa e envia com sucesso', async () => {
    const alt = page.locator('#alerta-conflito').getByRole('button').first();
    const rotulo = (await alt.innerText()).trim();
    await alt.click();
    await expect(page.getByText(`${rotulo} · Horário de Cuiabá (UTC−4)`)).toBeVisible();
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitação enviada' })).toBeVisible();
    const d = await dados(page);
    expect(d.solicitacoes.filter(s => s.clienteId === 'u-ana' && s.estado === 'enviada')).toHaveLength(1);
  });
});
