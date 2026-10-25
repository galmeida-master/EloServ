// Responsivo: 390, 768 e 1440 px — sem rolagem horizontal da página, navegação adequada à largura
// e áreas de toque ≥ 44 px em dispositivo de toque emulado.
import { test, expect, comoPersona } from './fixtures.js';

const ROTAS = {
  publico: ['/', '/fornecedores', '/fornecedores/friovale', '/fornecedores/friovale/solicitar', '/ajuda', '/ajuda/como-reagendar', '/entrar', '/cadastro'],
  'u-ana': ['/clientes', '/clientes/solicitacoes', '/clientes/solicitacoes/SOL-1038', '/clientes/agendamentos', '/clientes/perfil'],
  'u-marina': ['/empresas', '/empresas/agenda', '/empresas/solicitacoes', '/empresas/solicitacoes/SOL-1040', '/empresas/ordens/OS-2201', '/empresas/profissionais/p-rafael', '/empresas/servicos', '/empresas/clientes', '/empresas/configuracoes'],
  'u-paulo': ['/admin', '/admin/empresas', '/admin/empresas/gelo-fino', '/admin/usuarios', '/admin/agendamentos', '/admin/auditoria', '/admin/ajuda/como-solicitar-atendimento']
};

const sobra = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const largura of [390, 768, 1440]) {
  test.describe(`Largura ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('nenhuma rota principal tem rolagem horizontal da página', async ({ page }) => {
      for (const [quem, rotas] of Object.entries(ROTAS)) {
        if (quem !== 'publico') await comoPersona(page, quem, rotas[0]);
        for (const rota of rotas) {
          await page.goto(`/?w=${largura}#${rota}`);
          await expect(page.locator('main h1').first()).toBeVisible();
          expect(await sobra(page), `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(0);
        }
      }
    });

    test('navegação adequada à largura', async ({ page }) => {
      await comoPersona(page, 'u-ana', '/clientes');
      const lateral = page.locator('aside.sidebar');
      const inferior = page.getByRole('navigation', { name: 'Navegação rápida' });
      const menu = page.getByRole('button', { name: 'Abrir menu' });
      if (largura >= 1024) {
        await expect(lateral).toBeVisible();
        await expect(menu).toBeHidden();
        await expect(inferior).toBeHidden();
      } else {
        await expect(lateral).toBeHidden();
        await expect(menu).toBeVisible();
        if (largura < 640) await expect(inferior).toBeVisible(); else await expect(inferior).toBeHidden();
        await menu.click();
        const gaveta = page.getByRole('dialog', { name: 'Área do cliente' });
        await expect(gaveta.getByRole('link', { name: 'Meus equipamentos' })).toBeVisible();
        await gaveta.getByRole('link', { name: 'Meus equipamentos' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Meus equipamentos' })).toBeVisible();
      }
      await comoPersona(page, 'u-marina', '/empresas/agenda');
      const visao = largura < 640 ? 'Lista' : 'Dia por profissional';
      await expect(page.getByRole('group', { name: 'Modo de visualização' }).getByRole('button', { name: visao })).toHaveAttribute('aria-pressed', 'true');
    });
  });
}

test.describe('Toque', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Emulação de toque verificada no Chromium');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('áreas de toque de 44 px também no modo compacto', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('eloserv.density', 'compact'));
    for (const [quem, rota] of [['publico', '/fornecedores'], ['u-ana', '/clientes/solicitacoes/SOL-1038'], ['u-marina', '/empresas/agenda']]) {
      if (quem === 'publico') await page.goto('/#' + rota); else await comoPersona(page, quem, rota);
      await expect(page.locator('main h1').first()).toBeVisible();
      const pequenos = await page.evaluate(() => {
        const alvos = [...document.querySelectorAll('button, .btn, .bottom-nav a, .side-nav a, .mobile-nav a, select, input:not([type=checkbox]):not([type=radio]), textarea')];
        return alvos.filter(el => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
          return r.height < 44 && !el.closest('.ag-ev') && !el.classList.contains('ag-ev');
        }).map(el => `${el.tagName} “${(el.getAttribute('aria-label') || el.textContent || el.id).trim().slice(0, 40)}” ${Math.round(el.getBoundingClientRect().height)}px`);
      });
      expect(pequenos, `alvos menores que 44 px em ${rota}`).toEqual([]);
    }
  });
});
