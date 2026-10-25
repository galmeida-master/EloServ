// Fluxo A · Cliente contrata: catálogo → perfil → solicitação (visitante, login no meio preservando dados)
// → revisão → envio → proposta simulada → confirmação → acompanhamento.
import { test, expect, abrirSimulacao, fecharSimulacao } from './fixtures.js';

export async function preencherSolicitacao(page, { horario = '10:00' } = {}) {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Tipo de equipamento').selectOption('Split hi-wall');
  await page.getByLabel('Capacidade').selectOption('12.000 BTUs');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Bairro ou região').fill('Jardim Itália');
  await page.getByLabel('Cidade').fill('Cuiabá');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Descreva a necessidade').fill('Aparelho da sala pingando água na parede desde ontem.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('group', { name: 'Escolha o dia' })).toBeVisible();
  await page.getByRole('group', { name: /Horários em 26\/10\/2026/ }).getByRole('button', { name: horario, exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
}

test('Fluxo A — cliente contrata do catálogo ao agendamento confirmado', async ({ page }) => {
  await test.step('Catálogo → perfil do fornecedor', async () => {
    await page.goto('/#/fornecedores');
    await page.getByRole('link', { name: 'Ver perfil de FrioVale Climatização' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'FrioVale Climatização' })).toBeVisible();
    await expect(page.getByText('Escolher um horário envia uma solicitação. O agendamento será concluído após a confirmação.')).toBeVisible();
  });

  await test.step('Visitante preenche a solicitação', async () => {
    await page.getByRole('button', { name: 'Solicitar Higienização de split' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitar atendimento' })).toBeVisible();
    await preencherSolicitacao(page);
    await expect(page.getByText('Seg, 26/10/2026 · 10:00 · Horário de Cuiabá (UTC−4)')).toBeVisible();
    await expect(page.getByText('Preço fixo · R$ 180,00')).toBeVisible();
  });

  await test.step('Envio pede login e preserva os dados', async () => {
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    const aviso = page.locator('.alert', { hasText: 'Entre ou crie uma conta para enviar' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('link', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Depois de entrar, você volta para a revisão da solicitação com os dados preservados.')).toBeVisible();
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
    await expect(page.getByText('Aparelho da sala pingando água na parede desde ontem.')).toBeVisible();
    await expect(page.getByText('Casa · Jardim Itália · Cuiabá')).toBeVisible();
  });

  await test.step('Envio confirmado pelo servidor: ainda não é um agendamento', async () => {
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitação enviada' })).toBeVisible();
    await expect(page.getByText('Isto ainda não é um agendamento.')).toBeVisible();
    await expect(page.getByText(/SOL-1042/)).toBeVisible();
    await expect(page.getByText(/Reserva temporária do horário Seg, 26\/10\/2026 · 10:00 até/)).toBeVisible();
  });

  await test.step('Acompanhamento com as três situações independentes', async () => {
    await page.getByRole('link', { name: 'Acompanhar solicitação' }).click();
    const trilhas = page.getByLabel('Situações da solicitação');
    await expect(trilhas.getByText('Enviada')).toBeVisible();
    await expect(trilhas.getByText('Reserva temporária')).toBeVisible();
    await expect(trilhas.getByText('Aguardando confirmação')).toBeVisible();
  });

  await test.step('Empresa envia a proposta (simulação)', async () => {
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: 'Empresa envia proposta' }).click();
    await expect(painel.getByText('Empresa envia proposta: concluído.')).toBeVisible();
    await fecharSimulacao(page);
    await expect(page.getByRole('heading', { name: 'Proposta da empresa' })).toBeVisible();
  });

  await test.step('Cliente confirma: horário revalidado e agendamento confirmado', async () => {
    await page.getByRole('button', { name: 'Confirmar proposta' }).click();
    const dlg = page.getByRole('dialog', { name: 'Confirmar proposta' });
    await expect(dlg.getByText('Ao confirmar, o sistema verifica novamente a disponibilidade do horário.', { exact: false })).toBeVisible();
    await dlg.getByRole('button', { name: 'Confirmar proposta' }).click();
    await expect(page.getByText('Agendamento confirmado.')).toBeVisible();
    const trilhas = page.getByLabel('Situações da solicitação');
    await expect(trilhas.getByText('Aceita')).toBeVisible();
    await expect(trilhas.getByText('Confirmada')).toBeVisible();
    await expect(trilhas.getByText('Agendada')).toBeVisible();
  });

  await test.step('Agendamentos mostram apenas confirmados', async () => {
    await page.getByRole('link', { name: 'Agendamentos' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Agendamentos' })).toBeVisible();
    await expect(page.getByText(/Seg, 26\/10\/2026 · 10:00–11:30/)).toBeVisible();
  });

  await test.step('Falha no e-mail não desfaz a reserva confirmada', async () => {
    const painel = await abrirSimulacao(page);
    await painel.getByLabel('Simular falha no envio de e-mail').check();
    await painel.getByRole('button', { name: 'Processar fila de e-mail' }).click();
    await expect(painel.getByText('Falhou').first()).toBeVisible();
    await fecharSimulacao(page);
    await page.goto('/#/clientes/solicitacoes/SOL-1042');
    await expect(page.getByLabel('Situações da solicitação').getByText('Confirmada')).toBeVisible();
  });
});
