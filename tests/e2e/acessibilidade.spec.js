// Acessibilidade: axe sem violações serious/critical nas rotas principais, nos dois temas; teclado nos fluxos
// A e C; foco preso e Escape nos diálogos.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, comoPersona } from './fixtures.js';

const ROTAS = [
  ['publico', '/'], ['publico', '/fornecedores'], ['publico', '/fornecedores/friovale'], ['publico', '/fornecedores/friovale/solicitar'],
  ['publico', '/ajuda'], ['publico', '/ajuda/privacidade-e-seguranca'], ['publico', '/entrar'], ['publico', '/cadastro'],
  ['u-ana', '/clientes'], ['u-ana', '/clientes/solicitacoes'], ['u-ana', '/clientes/solicitacoes/SOL-1038'], ['u-ana', '/clientes/perfil'],
  ['u-marina', '/empresas'], ['u-marina', '/empresas/agenda'], ['u-marina', '/empresas/solicitacoes/SOL-1040'], ['u-marina', '/empresas/ordens/OS-2201'],
  ['u-marina', '/empresas/profissionais/p-rafael'], ['u-marina', '/empresas/configuracoes'], ['u-marina', '/empresas/clientes'],
  ['u-paulo', '/admin'], ['u-paulo', '/admin/empresas'], ['u-paulo', '/admin/empresas/gelo-fino'], ['u-paulo', '/admin/usuarios'], ['u-paulo', '/admin/auditoria']
];

async function analisar(page, contexto) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const graves = r.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  expect(graves.map(v => `${contexto}: ${v.id} — ${v.help} (${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')})`)).toEqual([]);
}

for (const tema of ['dark', 'light']) {
  test(`axe sem violações serious/critical nas rotas principais — tema ${tema === 'dark' ? 'Escuro' : 'Claro'}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.addInitScript(t => localStorage.setItem('eloserv.theme', t), tema);
    let atual = null;
    for (const [quem, rota] of ROTAS) {
      if (quem !== atual) { if (quem === 'publico') await page.goto('/#/'); else await comoPersona(page, quem, rota); atual = quem; }
      await page.goto(`/?t=${tema}#${rota}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await analisar(page, rota);
    }
  });

  test(`axe com diálogos e painéis abertos — tema ${tema === 'dark' ? 'Escuro' : 'Claro'}`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('eloserv.theme', t), tema);
    await comoPersona(page, 'u-marina', '/empresas/agenda');
    await page.getByRole('button', { name: 'Bloquear período' }).click();
    await analisar(page, 'diálogo de bloqueio');
    await page.getByRole('dialog', { name: 'Bloquear período' }).getByRole('button', { name: 'Como funciona?' }).click();
    await analisar(page, 'painel de ajuda');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Simulação' }).click();
    await analisar(page, 'painel de simulação');
  });
}

test('teclado: fluxo A do catálogo até a revisão', async ({ page, browserName }) => {
  await page.goto('/#/fornecedores');
  // No WebKit (Safari), links só entram na ordem de tabulação com a preferência do sistema ativada.
  if (browserName === 'webkit') await page.getByRole('link', { name: 'Pular para o conteúdo' }).focus();
  else await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('link', { name: 'Ver perfil de FrioVale Climatização' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'FrioVale Climatização' })).toBeFocused();
  await page.getByRole('button', { name: 'Solicitar este serviço: Higienização de split' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Tipo de equipamento').focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Bairro ou região')).toBeVisible();
  await page.getByLabel('Bairro ou região').focus();
  await page.keyboard.type('Centro');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Cidade')).toBeFocused();
  await page.keyboard.type('Cuiabá');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Descreva a necessidade').focus();
  await page.keyboard.type('Aparelho não gela desde o fim de semana.');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Enviar sem horário definido — a empresa proporá um horário').focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Revise sua solicitação' })).toBeVisible();
  await expect(page.getByText('Sem horário definido — a empresa proporá um horário')).toBeVisible();
});

test('teclado: fluxo C — diálogo de bloqueio com foco preso, Escape e retorno do foco', async ({ page }) => {
  await comoPersona(page, 'u-marina', '/empresas/agenda');
  const abrir = page.getByRole('button', { name: 'Bloquear período' });
  await abrir.focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: 'Bloquear período' });
  await expect(dlg).toBeVisible();
  expect(await dlg.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await dlg.evaluate(el => el.contains(document.activeElement)), `foco fora do diálogo após ${i + 1} Tab`).toBe(true);
  }
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab');
  expect(await dlg.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(abrir).toBeFocused();
});

test('Escape não fecha diálogo durante o envio e fecha painéis e menus', async ({ page }) => {
  await comoPersona(page, 'u-ana', '/clientes');
  await page.getByRole('button', { name: /Notificações/ }).click();
  await expect(page.getByRole('region', { name: 'Notificações' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Notificações' })).toBeHidden();
  await page.getByRole('button', { name: 'Ajuda sobre esta tela' }).click();
  await expect(page.getByRole('dialog', { name: 'Ajuda' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Ajuda' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajuda sobre esta tela' })).toBeFocused();
});
