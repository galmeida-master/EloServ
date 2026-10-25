// A-falha-rede · falha simulada → nada gravado → nova tentativa funciona.
import { test, expect, comoPersona, abrirSimulacao, fecharSimulacao, dados } from './fixtures.js';
import { preencherSolicitacao } from './ajudantes.js';

test('A-falha-rede — falha de conexão não grava nada e a nova tentativa envia', async ({ page }) => {
  await comoPersona(page, 'u-ana', '/fornecedores/friovale');
  await page.getByRole('button', { name: 'Solicitar este serviço: Higienização de split' }).click();
  await preencherSolicitacao(page);
  const revAntes = (await dados(page)).meta.rev;

  await test.step('Programa a falha no próximo envio', async () => {
    const painel = await abrirSimulacao(page);
    await painel.getByLabel('Simular falha de conexão no próximo envio').check();
    await fecharSimulacao(page);
  });

  await test.step('Envio falha: dados preservados e nenhuma reserva criada', async () => {
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    const alerta = page.locator('#alerta-falha');
    await expect(alerta).toContainText('Não foi possível enviar a solicitação');
    await expect(alerta).toContainText('Nenhuma reserva foi criada e seus dados foram mantidos.');
    await expect(page.getByText('Aparelho da sala pingando água na parede desde ontem.')).toBeVisible();
    const d = await dados(page);
    expect(d.meta.rev).toBe(revAntes);
    expect(d.solicitacoes.some(s => s.id === 'SOL-1042')).toBe(false);
  });

  await test.step('Nova tentativa funciona', async () => {
    await page.locator('#alerta-falha').getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitação enviada' })).toBeVisible();
    expect((await dados(page)).solicitacoes.some(s => s.id === 'SOL-1042')).toBe(true);
  });
});
