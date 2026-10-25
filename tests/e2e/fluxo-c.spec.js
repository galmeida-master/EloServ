// Fluxo C · Empresa organiza a agenda: jornada → duração/preparo → bloqueio conflitante → orientação →
// janela alternativa → bloqueio salvo; a agenda pública mostra só “Indisponível”, sem nomes ou motivos.
import { test, expect, comoPersona } from './fixtures.js';

test('Fluxo C — configuração, conflito de bloqueio, alternativa e agenda pública sem dados sensíveis', async ({ page }) => {
  await test.step('Jornadas e regras de reserva nas configurações', async () => {
    await comoPersona(page, 'u-marina', '/empresas/configuracoes');
    await expect(page.getByText('Seg, Ter, Qua, Qui, Sex · 07:30–17:30 · intervalo 12:00–13:00').first()).toBeVisible();
    await page.getByLabel('Preparo/deslocamento entre atendimentos').selectOption('45');
    await page.getByLabel('Manutenção preventiva (min)').fill('120');
    await page.getByRole('button', { name: 'Salvar configurações' }).click();
    await expect(page.getByText('Configurações salvas. Novas disponibilidades já consideram as regras.')).toBeVisible();
  });

  await test.step('Consulta de disponibilidade mostra o que o cliente verá', async () => {
    await page.goto('/#/empresas/agenda');
    await page.getByRole('button', { name: 'Consultar disponibilidade' }).click();
    const painel = page.locator('#painel-disp');
    await expect(painel).toContainText('preparo/deslocamento 45 min');
    await expect(painel).toContainText('Exibido ao cliente');
  });

  await test.step('Bloqueio conflitante não é salvo e há orientação', async () => {
    await page.getByRole('button', { name: 'Bloquear período' }).click();
    const dlg = page.getByRole('dialog', { name: 'Bloquear período' });
    await dlg.getByLabel('Profissional').selectOption({ label: 'Carlos M.' });
    await dlg.getByLabel('Início').selectOption('13:00');
    await dlg.getByLabel('Fim').selectOption('15:00');
    await dlg.getByLabel(/Motivo interno/).fill('Manutenção do veículo');
    await dlg.getByRole('button', { name: 'Salvar bloqueio' }).click();
    const conflito = dlg.locator('#blq-conflito');
    await expect(conflito).toContainText('O período conflita com atendimentos existentes');
    await expect(conflito).toContainText('SOL-1040 · 13:30–15:30 · Reserva temporária');
    await expect(conflito).toContainText('O bloqueio não foi salvo.');
  });

  await test.step('Usa a janela alternativa sugerida e salva', async () => {
    const dlg = page.getByRole('dialog', { name: 'Bloquear período' });
    await dlg.getByRole('button', { name: 'Usar 09:30–11:30' }).click();
    await expect(dlg.getByLabel('Início')).toHaveValue('09:30');
    await dlg.getByRole('button', { name: 'Salvar bloqueio' }).click();
    await expect(page.getByText(/Período bloqueado \(BLQ-09\)/)).toBeVisible();
    await expect(page.getByRole('button', { name: /09:30–11:30 · Bloqueio interno · BLQ-09/ })).toBeVisible();
  });

  await test.step('Agenda pública: só horários e “Indisponível”, sem nomes, ordens ou motivos', async () => {
    await page.goto('/#/fornecedores/friovale');
    const secao = page.locator('section', { has: page.getByRole('heading', { name: 'Horários para solicitação' }) });
    await secao.getByLabel('Serviço').selectOption({ label: 'Instalação de split' });
    await expect(secao.getByText('Indisponível').first()).toBeVisible();
    const texto = await secao.innerText();
    for (const proibido of ['Manutenção do veículo', 'BLQ', 'OS-', 'SOL-', 'Pedro', 'Luíza', 'Carlos', 'Rafael', 'Juliana', 'Bloqueio']) {
      expect(texto, `a agenda pública não deve mostrar “${proibido}”`).not.toContain(proibido);
    }
  });
});
