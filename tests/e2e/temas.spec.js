// Temas (Sistema, Claro, Escuro) e densidades (Conforto, Compacto): independentes, persistidos e sem flash.
import { test, expect, comoPersona } from './fixtures.js';

const tema = page => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const densidade = page => page.evaluate(() => document.documentElement.getAttribute('data-density'));

test.describe('Temas e densidade', () => {
  test('primeira visita em Escuro; escolha persistida após recarregar', async ({ page }) => {
    await page.goto('/#/');
    expect(await tema(page)).toBe('dark');
    expect(await densidade(page)).toBe('comfort');
    await page.getByRole('button', { name: 'Aparência' }).click();
    const pop = page.getByRole('region', { name: 'Aparência' });
    await pop.getByRole('button', { name: 'Claro' }).click();
    await pop.getByRole('button', { name: 'Compacto' }).click();
    expect(await tema(page)).toBe('light');
    expect(await densidade(page)).toBe('compact');
    await page.reload();
    expect(await tema(page)).toBe('light');
    expect(await densidade(page)).toBe('compact');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 250, 252)');
  });

  test('tema e densidade são independentes e valem em todos os ambientes', async ({ page }) => {
    await comoPersona(page, 'u-ana', '/clientes/preferencias');
    await page.getByRole('group', { name: 'Densidade' }).getByRole('button', { name: 'Compacto' }).click();
    expect(await tema(page)).toBe('dark');
    expect(await densidade(page)).toBe('compact');
    await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Claro' }).click();
    expect(await densidade(page)).toBe('compact');
    await comoPersona(page, 'u-paulo', '/admin');
    expect(await tema(page)).toBe('light');
    expect(await densidade(page)).toBe('compact');
    const altura = await page.getByRole('button', { name: 'Simulação' }).evaluate(el => el.getBoundingClientRect().height);
    expect(altura).toBeGreaterThanOrEqual(32);
  });

  test('“Sistema” acompanha prefers-color-scheme emulado', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Aparência' }).click();
    await page.getByRole('region', { name: 'Aparência' }).getByRole('button', { name: 'Sistema' }).click();
    expect(await tema(page)).toBe('light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => tema(page)).toBe('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    expect(await tema(page)).toBe('light');
  });

  test('sem flash: o tema é aplicado antes do primeiro paint, sem depender do JavaScript da aplicação', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('eloserv.theme', 'light'); localStorage.setItem('eloserv.density', 'compact'); });
    let liberar;
    const espera = new Promise(r => { liberar = r; });
    await page.route('**/src/main.js', async rota => { await espera; await rota.continue(); });
    await page.goto('/#/', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState !== 'loading' && document.body);
    expect(await tema(page)).toBe('light');
    expect(await densidade(page)).toBe('compact');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 250, 252)');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-pronto'))).toBeNull();
    liberar();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-pronto') === 'true');
  });
});
