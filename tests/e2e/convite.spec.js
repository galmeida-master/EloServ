// Convite para a equipe: aceite com vínculo de técnico e estado “convite expirado” (RF-ACS-03, RF-EMP-04).
import { test, expect, comoPersona, abrirSimulacao, fecharSimulacao } from './fixtures.js';

test.describe('Convite para a equipe', () => {
  test('profissional aceita o convite e passa a ver apenas a própria agenda', async ({ page }) => {
    await comoPersona(page, 'u-marina', '/empresas/profissionais/p-bruno');
    await expect(page.getByText(/Convite enviado em .*ainda não aceito/)).toBeVisible();
    await page.getByRole('link', { name: 'abrir a tela de aceite' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Convite para a equipe' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(page.locator('#conv-termos-erro')).toBeVisible();
    await page.getByLabel('Crie uma credencial').fill('demonstracao');
    await page.getByLabel(/Li e aceito os termos/).check();
    await page.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Minha agenda' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Agenda de Bruno L.' })).toBeVisible();
  });

  test('convite vencido mostra “Convite expirado”', async ({ page }) => {
    await page.goto('/#/convite/convite-inexistente');
    await expect(page.getByRole('heading', { level: 1, name: 'Convite inválido ou expirado' })).toBeVisible();
    const painel = await abrirSimulacao(page);
    for (let i = 0; i < 4; i++) await painel.getByRole('button', { name: '+1 dia' }).click();
    await fecharSimulacao(page);
    await page.goto('/#/convite/p-bruno');
    await expect(page.getByRole('heading', { level: 1, name: 'Convite expirado' })).toBeVisible();
    await expect(page.getByText(/Peça ao responsável pela empresa que reenvie o convite/)).toBeVisible();
  });
});
