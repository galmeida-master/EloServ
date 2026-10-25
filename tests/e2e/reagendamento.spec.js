// Reagendamento: pedido → original continua ocupado na agenda da empresa → confirmação → original liberado.
import { test, expect, comoPersona } from './fixtures.js';

async function agendaDoDia(page, dia) {
  await page.goto('/#/empresas/agenda');
  await page.getByRole('group', { name: 'Dia da agenda' }).getByRole('button', { name: new RegExp(dia) }).click();
}

test('Reagendamento nunca libera o horário anterior antes de confirmar o novo', async ({ page }) => {
  await test.step('Cliente pede novo horário para SOL-1027', async () => {
    await comoPersona(page, 'u-ana', '/clientes/solicitacoes/SOL-1027');
    await page.getByRole('button', { name: 'Solicitar reagendamento' }).click();
    const dlg = page.getByRole('dialog', { name: 'Solicitar reagendamento' });
    await expect(dlg.getByText(/Seu horário atual \(Qui, 29\/10\/2026 · 08:00\) continua reservado/)).toBeVisible();
    await dlg.getByRole('group', { name: 'Escolha o novo dia' }).getByRole('button', { name: /30\/10\/2026/ }).click();
    await dlg.getByRole('button', { name: '10:00', exact: true }).click();
    await dlg.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(page.getByText('Pedido de reagendamento enviado. Seu horário atual continua reservado.')).toBeVisible();
    await expect(page.getByText('Reagendamento solicitado para Sex, 30/10/2026 · 10:00')).toBeVisible();
  });

  await test.step('Na agenda da empresa, o original continua ocupado e o novo está reservado', async () => {
    await comoPersona(page, 'u-marina', '/empresas');
    await agendaDoDia(page, '29/10/2026');
    await expect(page.getByRole('link', { name: /08:00–09:30 · Confirmada · OS-2205/ })).toBeVisible();
    await agendaDoDia(page, '30/10/2026');
    await expect(page.getByRole('link', { name: /10:00–11:30 · Reserva temporária · SOL-1027.*Novo horário pedido/ })).toBeVisible();
  });

  await test.step('Empresa confirma a troca: original liberado', async () => {
    await page.goto('/#/empresas/solicitacoes/SOL-1027');
    await page.getByRole('button', { name: 'Confirmar troca' }).click();
    await expect(page.getByText('Reagendamento confirmado. Horário anterior liberado.')).toBeVisible();
    await agendaDoDia(page, '29/10/2026');
    await expect(page.getByRole('link', { name: /OS-2205/ })).toHaveCount(0);
    await agendaDoDia(page, '30/10/2026');
    await expect(page.getByRole('link', { name: /10:00–11:30 · Confirmada · OS-2205/ })).toBeVisible();
  });

  await test.step('Histórico registra cada alteração', async () => {
    await comoPersona(page, 'u-ana', '/clientes/solicitacoes/SOL-1027');
    await expect(page.getByText(/Reagendamento confirmado\. Novo horário: Sex, 30\/10\/2026 · 10:00\. Horário anterior \(Qui, 29\/10\/2026 · 08:00\) liberado\./)).toBeVisible();
  });
});
