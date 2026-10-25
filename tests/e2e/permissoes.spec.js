// Permissões: técnico e cliente em URLs de outros ambientes recebem “acesso negado”; empresa A não vê dados da empresa B.
import { test, expect, comoPersona } from './fixtures.js';

const NEGADO = 'Você não tem permissão para acessar esta área';

test.describe('Permissões e isolamento', () => {
  test('visitante é levado a entrar ao acessar área autenticada', async ({ page }) => {
    await page.goto('/#/clientes/solicitacoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await expect(page).toHaveURL(/volta=%2Fclientes%2Fsolicitacoes/);
  });

  test('técnico: só a própria agenda, atendimentos e ajuda; demais seções mostram permissão insuficiente', async ({ page }) => {
    await comoPersona(page, 'u-carlos', '/empresas/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Minha agenda' })).toBeVisible();
    const colunas = page.getByRole('region', { name: /Grade da agenda/ }).getByRole('group');
    await expect(colunas).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Agenda de Carlos M.' })).toBeVisible();
    for (const rota of ['/empresas/clientes', '/empresas/configuracoes', '/empresas/profissionais', '/empresas/solicitacoes/SOL-1040']) {
      await page.goto('/#' + rota);
      await expect(page.getByRole('heading', { level: 1, name: 'Seu papel não permite acessar esta área' })).toBeVisible();
    }
    await page.goto('/#/empresas/ordens/OS-2202');
    await expect(page.getByRole('heading', { level: 1, name: 'Ordem não disponível' })).toBeVisible();
    await page.goto('/#/admin');
    await expect(page.getByRole('heading', { level: 1, name: NEGADO })).toBeVisible();
    await page.goto('/#/clientes');
    await expect(page.getByRole('heading', { level: 1, name: NEGADO })).toBeVisible();
  });

  test('cliente digitando URLs de empresa ou administração recebe acesso negado', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/empresas/agenda');
    await expect(page.getByRole('heading', { level: 1, name: NEGADO })).toBeVisible();
    await expect(page.getByText('Alterar o endereço da página não concede autorização.', { exact: false })).toBeVisible();
    await page.goto('/#/admin/usuarios');
    await expect(page.getByRole('heading', { level: 1, name: NEGADO })).toBeVisible();
    await page.goto('/#/clientes/solicitacoes/SOL-1040');
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitação não encontrada' })).toBeVisible();
  });

  test('empresa A não vê dados da empresa B', async ({ page }) => {
    await comoPersona(page, 'u-diego', '/empresas/solicitacoes');
    await expect(page.getByText('Polar Norte Refrigeração').first()).toBeVisible();
    await expect(page.getByText('SOL-1040')).toHaveCount(0);
    await page.goto('/#/empresas/solicitacoes/SOL-1040');
    await expect(page.getByRole('heading', { level: 1, name: 'Solicitação não encontrada nesta empresa' })).toBeVisible();
    await page.goto('/#/empresas/ordens/OS-2201');
    await expect(page.getByRole('heading', { level: 1, name: 'Ordem não disponível' })).toBeVisible();
    await page.goto('/#/empresas/profissionais/p-carlos');
    await expect(page.getByRole('heading', { level: 1, name: 'Profissional não encontrado' })).toBeVisible();
  });

  test('seletor de ambiente aparece para quem tem mais de um vínculo', async ({ page }) => {
    await comoPersona(page, 'u-marina', '/empresas');
    await page.getByRole('button', { name: 'Menu do usuário: Marina Duarte' }).click();
    const grupo = page.getByRole('group', { name: 'Trocar ambiente' });
    await expect(grupo.getByRole('button')).toHaveCount(2);
    await grupo.getByRole('button', { name: 'Cliente · conta pessoal' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Olá, Marina' })).toBeVisible();
    await comoPersona(page, 'u-ana', '/clientes');
    await page.getByRole('button', { name: 'Menu do usuário: Ana Ribeiro' }).click();
    await expect(page.getByText('Esta conta tem um único vínculo.', { exact: false })).toBeVisible();
  });

  test('administração: último principal protegido e autoelevação bloqueada', async ({ page }) => {
    await comoPersona(page, 'u-paulo', '/admin/usuarios');
    await page.getByRole('button', { name: 'Suspender Lúcia Prado' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Ação bloqueada' })).toContainText('única pessoa com nível Principal');
    await page.getByRole('button', { name: 'Entendi' }).click();
    await page.getByRole('button', { name: 'Editar papel de Paulo Lemos' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Você não pode alterar o próprio papel' })).toContainText('Autoelevação de privilégio não é permitida.');
    await page.getByRole('button', { name: 'Entendi' }).click();
    await expect(page.getByText(/pa•••@exemplo\.invalid/)).toBeVisible();
  });
});
