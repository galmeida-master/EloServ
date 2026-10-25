// Passos reutilizados pelos testes de fluxo.
import { expect } from './fixtures.js';

/** Preenche o assistente de solicitação (a partir da etapa Serviço) até a revisão. */
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
