// Fluxo E · Revogação de acesso: profissional → atendimentos futuros → reatribuição → revogação → histórico preservado.
import { test, expect, comoPersona } from './fixtures.js';

test('Fluxo E — revogar técnico exige tratar cada atendimento futuro', async ({ page }) => {
  await test.step('Abre a revogação de Rafael T.', async () => {
    await comoPersona(page, 'u-marina', '/empresas/profissionais');
    await page.getByRole('link', { name: 'Abrir Rafael Teixeira' }).click();
    await page.getByRole('button', { name: 'Revogar acesso' }).click();
    await expect(page.getByRole('heading', { name: 'Revogar acesso de Rafael T.' })).toBeVisible();
  });

  const confirmar = page.locator('#btn-confirmar-encerramento');
  await test.step('Botão bloqueado até tratar todos os atendimentos', async () => {
    await expect(confirmar).toBeDisabled();
    await expect(page.locator('#enc-dica')).toHaveText('Defina o tratamento de todos os atendimentos futuros (3 pendentes).');
    const opcoes = await page.getByLabel('Tratamento para OS-2203').locator('option').allTextContents();
    expect(opcoes.some(o => o.includes('Juliana R. — não executa este serviço'))).toBe(true);
    await expect(page.getByLabel('Tratamento para OS-2203').locator('option', { hasText: 'Juliana R. — não executa este serviço' })).toBeDisabled();
  });

  await test.step('Reatribui ou combina novo horário para cada atendimento', async () => {
    await page.getByLabel('Tratamento para OS-2203').selectOption('combinar');
    await page.getByLabel('Tratamento para OS-2207').selectOption({ label: 'Reatribuir a Carlos M. — disponível' });
    await page.getByLabel('Tratamento para OS-2208').selectOption({ label: 'Reatribuir a Juliana R. — disponível' });
    await expect(page.locator('#enc-dica')).toHaveText('Informe a justificativa (mínimo de 10 caracteres).');
    await expect(confirmar).toBeDisabled();
    await page.getByLabel('Justificativa').fill('Encerramento do vínculo com a empresa.');
    await expect(confirmar).toBeEnabled();
  });

  await test.step('Revoga e preserva o histórico', async () => {
    await confirmar.click();
    await expect(page.getByText('Acesso de Rafael T. revogado. Histórico preservado e atendimentos tratados.')).toBeVisible();
    await expect(page.locator('.page-head').getByText('Acesso revogado')).toBeVisible();
    await page.goto('/#/empresas/ordens/OS-2207');
    await expect(page.getByText('Carlos Mendes')).toBeVisible();
    await expect(page.getByText(/Reatribuída para Carlos M\. antes da revogação de acesso de Rafael T\./)).toBeVisible();
    await page.goto('/#/empresas/ordens/OS-2203');
    await expect(page.getByText('Atendimento a reatribuir')).toBeVisible();
    await expect(page.getByText(/Profissional desvinculado \(Rafael T\.\)/)).toBeVisible();
  });

  await test.step('Técnico perde o acesso e a auditoria registra a revogação', async () => {
    await comoPersona(page, 'u-rafael', '/empresas/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Você não tem permissão para acessar esta área' })).toBeVisible();
    await expect(page.getByText(/Seu acesso a esta empresa está suspenso ou foi revogado/)).toBeVisible();
    await comoPersona(page, 'u-lucia', '/admin/auditoria');
    await expect(page.getByRole('row', { name: /Acesso revogado/ }).filter({ hasText: 'Rafael T.' })).toContainText('Encerramento do vínculo com a empresa.');
  });
});
