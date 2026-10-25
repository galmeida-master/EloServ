// Fixtures dos testes E2E: relógio fixo (sáb, 24/10/2026, 10:00 em Cuiabá), latência curta e falha
// automática do teste em qualquer console.error ou erro de página.
import { test as base, expect } from '@playwright/test';

export const AGORA = new Date('2026-10-24T10:00:00-04:00');
export const DIAS = { seg: '26/10', ter: '27/10', qua: '28/10', qui: '29/10', sex: '30/10' };

function vigiar(page, erros) {
  page.on('console', m => { if (m.type() === 'error') erros.push(`[console] ${m.text()}`); });
  page.on('pageerror', e => erros.push(`[pageerror] ${e.message}`));
}

export const test = base.extend({
  latencia: ['rapida', { option: true }],
  context: async ({ context, latencia }, use) => {
    await context.clock.setFixedTime(AGORA);
    await context.addInitScript(l => {
      try {
        if (!localStorage.getItem('eloserv.sim')) localStorage.setItem('eloserv.sim', JSON.stringify({ latencia: l }));
        window.print = () => { window.__impressoes = (window.__impressoes || 0) + 1; };
      } catch { /* armazenamento indisponível */ }
    }, latencia);
    await use(context);
  },
  erros: async ({ context }, use) => {
    const erros = [];
    context.on('page', p => vigiar(p, erros));
    await use(erros);
  },
  page: async ({ context, erros }, use) => {
    const page = context.pages()[0] || await context.newPage();
    if (!page.__vigiada) { vigiar(page, erros); page.__vigiada = true; }
    await use(page);
    expect(erros, 'Não deve haver erros no console durante o teste').toEqual([]);
  }
});

export { expect };

/** Abre a aplicação já autenticada como a persona indicada (mesma lógica do painel de simulação). */
export async function comoPersona(page, usuarioId, rota = null) {
  if (!page.url().startsWith('http')) await page.goto('/#/');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-pronto') === 'true');
  const ambiente = await page.evaluate(async id => {
    const auth = await import('/src/api/auth.js');
    return auth.entrarComoPersona(id);
  }, usuarioId);
  const destino = rota || (ambiente === 'empresas' ? '/empresas' : ambiente === 'admin' ? '/admin' : '/clientes');
  await page.goto(`/?persona=${encodeURIComponent(usuarioId)}#${destino}`);
  await page.waitForFunction(() => document.documentElement.getAttribute('data-pronto') === 'true');
  return ambiente;
}

/** Navega por âncora sem recarregar a página. */
export async function ir(page, rota) {
  await page.evaluate(r => { location.hash = '#' + r; }, rota);
  await page.waitForFunction(r => location.hash === '#' + r, rota);
}

/** Abre o painel de simulação. */
export async function abrirSimulacao(page) {
  await page.getByRole('button', { name: 'Simulação' }).click();
  const painel = page.getByRole('dialog', { name: 'Simulação (demonstração)' });
  await expect(painel).toBeVisible();
  return painel;
}

export async function fecharSimulacao(page) {
  await page.getByRole('dialog', { name: 'Simulação (demonstração)' }).getByRole('button', { name: 'Fechar painel' }).click();
}

/** Lê o estado de dados atual (somente para verificações dos testes). */
export async function dados(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('eloserv.db.v1')));
}
