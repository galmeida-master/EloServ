// Fluxo F · Ajuda contextual: dúvida na agenda → ajuda → artigo → retorno ao fluxo sem perder dados.
import { test, expect, comoPersona } from './fixtures.js';

test('Fluxo F — abrir a ajuda durante o bloqueio não perde os campos preenchidos', async ({ page }) => {
  await comoPersona(page, 'u-marina', '/empresas/agenda');
  await page.getByRole('button', { name: 'Bloquear período' }).click();
  const dlg = page.getByRole('dialog', { name: 'Bloquear período' });

  await test.step('Preenche o bloqueio', async () => {
    await dlg.getByLabel('Profissional').selectOption({ label: 'Juliana R.' });
    await dlg.getByLabel('Início').selectOption('08:00');
    await dlg.getByLabel('Fim').selectOption('09:00');
    await dlg.getByLabel(/Motivo interno/).fill('Consulta médica');
  });

  await test.step('Abre o artigo no painel lateral', async () => {
    await dlg.getByRole('button', { name: 'Como funciona?' }).click();
    const ajuda = page.getByRole('dialog', { name: 'Ajuda' });
    await expect(ajuda.getByRole('heading', { name: 'Como bloquear um período na agenda' })).toBeVisible();
    await expect(ajuda.getByText('O formulário que você estava preenchendo continua aberto.', { exact: false })).toBeVisible();
    await ajuda.getByRole('button', { name: 'Voltar ao que eu estava fazendo' }).click();
    await expect(ajuda).toHaveCount(0);
  });

  await test.step('Campos intactos e foco de volta ao formulário', async () => {
    await expect(dlg).toBeVisible();
    await expect(dlg.getByLabel('Profissional')).toHaveValue('p-juliana');
    await expect(dlg.getByLabel('Início')).toHaveValue('08:00');
    await expect(dlg.getByLabel('Fim')).toHaveValue('09:00');
    await expect(dlg.getByLabel(/Motivo interno/)).toHaveValue('Consulta médica');
    await expect(dlg.getByRole('button', { name: 'Como funciona?' })).toBeFocused();
  });
});
