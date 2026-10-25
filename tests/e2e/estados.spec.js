// Estados obrigatórios (PRD §8.5): cada item renderiza a mensagem esperada.
import { test, expect, comoPersona, abrirSimulacao, fecharSimulacao, ir } from './fixtures.js';

test.describe('Estados obrigatórios', () => {
  test('empresa sem serviços e em preenchimento', async ({ page }) => {
    await comoPersona(page, 'u-ivete', '/empresas/servicos');
    await expect(page.getByRole('heading', { name: 'Sua empresa ainda não tem serviços' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar primeiro serviço' })).toBeVisible();
    await ir(page, '/empresas');
    await expect(page.getByText('Cadastro em preenchimento').first()).toBeVisible();
  });

  test('empresa aguardando habilitação e empresa suspensa', async ({ page }) => {
    await comoPersona(page, 'u-rogerio', '/empresas');
    await expect(page.getByText('Aguardando habilitação').first()).toBeVisible();
    await expect(page.getByText(/o perfil público fica oculto até a habilitação/)).toBeVisible();
    await comoPersona(page, 'u-otavio', '/empresas');
    await expect(page.getByText('Empresa suspensa')).toBeVisible();
    await expect(page.getByText(/novas solicitações bloqueadas/).first()).toBeVisible();
    await page.goto('/#/fornecedores/pantanal/solicitar');
    await expect(page.getByRole('heading', { level: 1, name: 'Fornecedor indisponível' })).toBeVisible();
  });

  test('cliente sem histórico e agenda sem atendimentos', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/clientes/historico');
    await expect(page.getByRole('heading', { name: 'Você ainda não tem atendimentos concluídos' })).toBeVisible();
    await comoPersona(page, 'u-marina', '/empresas/agenda');
    await page.getByRole('button', { name: 'Próxima semana' }).click();
    await page.getByRole('group', { name: 'Dia da agenda' }).getByRole('button', { name: /03\/11\/2026/ }).click();
    await expect(page.getByRole('heading', { name: 'Agenda sem atendimentos em Ter, 03/11/2026.' })).toBeVisible();
  });

  test('busca sem resultados explica o motivo e sugere alternativas', async ({ page }) => {
    await page.goto('/#/fornecedores?cidade=C%C3%A1ceres');
    await expect(page.getByRole('heading', { name: 'Nenhum fornecedor encontrado' })).toBeVisible();
    await expect(page.getByText('Ainda não há empresas habilitadas que atendam Cáceres.')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await expect(page.getByText('4 empresas encontradas')).toBeVisible();
  });

  test('profissional indisponível e serviço desativado', async ({ page }) => {
    await comoPersona(page, 'u-marina', '/empresas/agenda');
    await page.getByRole('group', { name: 'Dia da agenda' }).getByRole('button', { name: /27\/10\/2026/ }).click();
    await page.getByRole('button', { name: 'Consultar disponibilidade' }).click();
    await page.getByLabel('Serviço').selectOption({ label: 'Instalação de split' });
    await expect(page.locator('#painel-disp')).toContainText('Indisponível · Folga');
    await ir(page, '/empresas/servicos');
    await page.getByRole('button', { name: 'Desativar Diagnóstico técnico' }).click();
    await expect(page.getByText('Serviço desativado. Deixa de aparecer no perfil público.')).toBeVisible();
    await page.goto('/#/fornecedores/friovale');
    await expect(page.getByRole('button', { name: 'Solicitar Diagnóstico técnico' })).toHaveCount(0);
  });

  test('proposta expirada e horário ocupado durante a confirmação', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/clientes/solicitacoes/SOL-1031');
    await expect(page.getByText('Proposta expirada')).toBeVisible();
    await expect(page.getByText(/não pode mais ser confirmado/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pedir nova proposta' })).toBeVisible();
    await ir(page, '/clientes/solicitacoes/SOL-1038');
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: 'Outra operação ocupa este horário' }).click();
    await expect(painel.getByText('Ocupação concorrente criada: concluído.')).toBeVisible();
    await fecharSimulacao(page);
    await page.getByRole('button', { name: 'Confirmar proposta' }).click();
    await page.getByRole('dialog', { name: 'Confirmar proposta' }).getByRole('button', { name: 'Confirmar proposta' }).click();
    const dlg = page.getByRole('alertdialog', { name: 'O horário deixou de estar disponível' });
    await expect(dlg).toContainText('A proposta não foi confirmada e seus dados foram mantidos.');
    await expect(dlg.getByText('Pedir à empresa outro horário')).toBeVisible();
  });

  test('erro de conexão no catálogo e falha no envio', async ({ page }) => {
    await page.goto('/#/');
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: 'Catálogo com erro de conexão' }).click();
    await expect(page.getByText('Não foi possível carregar os fornecedores')).toBeVisible();
    await expect(page.getByText('Verifique sua conexão. Seus filtros foram mantidos.')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText('4 empresas encontradas')).toBeVisible();
    await comoPersona(page, 'u-ana', '/clientes/perfil');
    const p2 = await abrirSimulacao(page);
    await p2.getByLabel('Simular falha de conexão no próximo envio').check();
    await fecharSimulacao(page);
    await page.getByRole('button', { name: 'Adicionar endereço' }).click();
    const dlg = page.getByRole('dialog', { name: 'Adicionar endereço' });
    await dlg.getByLabel('Identificação').fill('Trabalho');
    await dlg.getByLabel('Bairro ou região').fill('Centro');
    await dlg.getByLabel('Cidade').fill('Cuiabá');
    await dlg.getByRole('button', { name: 'Salvar endereço' }).click();
    await expect(dlg.getByText(/Falha de conexão\. Nada foi gravado/)).toBeVisible();
  });

  test('sessão expirada preserva o retorno e permissão insuficiente', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/clientes');
    const painel = await abrirSimulacao(page);
    await painel.getByRole('button', { name: 'Sessão expirada' }).click();
    await page.evaluate(() => { location.hash = '#/clientes/solicitacoes'; });
    await expect(page.getByRole('heading', { level: 1, name: 'Sua sessão expirou' })).toBeVisible();
    await expect(page.getByText(/Rascunhos salvos neste dispositivo continuam disponíveis/)).toBeVisible();
    await page.getByRole('link', { name: 'Entrar novamente' }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitações e orçamentos' })).toBeVisible();
    await comoPersona(page, 'u-carlos', '/empresas/configuracoes');
    await expect(page.getByText('Permissão insuficiente.', { exact: false })).toBeVisible();
  });

  test('texto longo e lista extensa com paginação', async ({ page }) => {
    await comoPersona(page, 'u-marina', '/empresas/clientes');
    await expect(page.getByText(/Condomínio Residencial Parque das Águas — Bloco B/)).toBeVisible();
    await expect(page.getByText('1–10 de 23')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima página' }).click();
    await expect(page.getByText('11–20 de 23')).toBeVisible();
    await page.getByLabel('Itens por página').selectOption('25');
    await expect(page.getByText('1–23 de 23')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test('mudanças não salvas e sucesso após criação e atualização', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/clientes/perfil');
    await page.getByLabel('Telefone').fill('(65) 98888-7777');
    await expect(page.getByText('Você tem alterações não salvas.')).toBeVisible();
    await page.getByRole('link', { name: 'Agendamentos' }).first().click();
    const dlg = page.getByRole('alertdialog', { name: 'Descartar alterações?' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.getByLabel('Telefone')).toHaveValue('(65) 98888-7777');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Perfil atualizado.')).toBeVisible();
    await ir(page, '/clientes/equipamentos');
    await page.getByRole('button', { name: 'Adicionar equipamento' }).click();
    const eq = page.getByRole('dialog', { name: 'Adicionar equipamento' });
    await eq.getByLabel('Tipo').fill('Split hi-wall');
    await eq.getByLabel('Local de instalação').fill('Cozinha');
    await eq.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('Equipamento adicionado.')).toBeVisible();
  });
});
