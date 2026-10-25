import { test, expect } from './fixtures.js';

test.describe('Fumaça', () => {
  test('a página inicial carrega com a faixa de demonstração e as chamadas principais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Organize seus serviços. Facilite o próximo atendimento.' })).toBeVisible();
    await expect(page.getByText('Demonstração — dados fictícios, salvos neste navegador.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Encontrar um fornecedor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cadastrar minha empresa' }).first()).toBeVisible();
  });

  test('rotas principais dos três ambientes existem e o catálogo público não se confunde com /empresas', async ({ page }) => {
    await page.goto('/#/fornecedores');
    await expect(page.getByRole('heading', { level: 1, name: 'Fornecedores' })).toBeVisible();
    await page.goto('/#/empresas');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await expect(page).toHaveURL(/#\/entrar\?volta=%2Fempresas/);
    await page.goto('/#/rota-inexistente');
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  });
});
