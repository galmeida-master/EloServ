// A-duplo-clique · clique duplo em “Enviar” cria uma única solicitação.
import { test, expect, comoPersona, dados } from './fixtures.js';
import { preencherSolicitacao } from './ajudantes.js';

test.use({ latencia: 'padrao' });

test('A-duplo-clique — botão ocupado (aria-busy) e idempotência evitam duplicidade', async ({ page }) => {
  await comoPersona(page, 'u-ana', '/fornecedores/friovale');
  await page.getByRole('button', { name: 'Solicitar este serviço: Higienização de split' }).click();
  await preencherSolicitacao(page);
  const antes = (await dados(page)).solicitacoes.length;
  const botao = page.locator('#sol-enviar');
  await botao.dblclick();
  await expect(botao).toHaveAttribute('aria-busy', 'true');
  await expect(botao).toBeDisabled();
  await expect(page.getByRole('heading', { level: 1, name: 'Solicitação enviada' })).toBeVisible();
  const d = await dados(page);
  expect(d.solicitacoes.length).toBe(antes + 1);
  expect(d.ocupacoes.filter(o => o.solicitacaoId === 'SOL-1042')).toHaveLength(1);
  expect(d.solicitacoes.some(s => s.id === 'SOL-1043')).toBe(false);
});
