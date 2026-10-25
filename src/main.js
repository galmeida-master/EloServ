// Inicialização: dados demonstrativos, tema, roteamento, renderização, foco e sincronização entre abas.
import { mount } from './ui/h.js';
import { ui, render, definirRenderizador, limparSujo, navegar } from './store.js';
import { lerAncora, resolver } from './router.js';
import { garantirDados, aoMudar } from './api/db.js';
import * as auth from './api/auth.js';
import { expirarReservas } from './api/agenda.js';
import { aplicar as aplicarTema, observarSistema } from './ui/tema.js';
import { LayoutPublico, LayoutAmbiente, PainelAjuda, Toasts, DialogoSairSemSalvar } from './views/shell.js';
import { PainelSimulacao } from './views/sim-panel.js';
import { VIEWS, TITULOS } from './views/index.js';
import { PermissaoInsuficiente, AcessoNegadoConteudo, NaoEncontrada } from './views/public/acesso.js';
import { h } from './ui/components.js';

const raiz = document.getElementById('app');
let focarTitulo = false;

function rotaAtual() {
  const { caminho, query, completo } = lerAncora();
  return { caminho, query, completo, r: resolver(caminho) };
}

/** Guardas: sem sessão → entrar (com retorno); sessão expirada → aviso (rascunhos preservados). */
function aplicarGuardas() {
  const { r, completo } = rotaAtual();
  if (!r.ambiente) return true;
  const a = auth.verificarAcesso(r.ambiente, r.secao);
  if (a.status === 'login') { location.replace('#/entrar?volta=' + encodeURIComponent(completo)); return false; }
  if (a.status === 'expirada') { location.replace('#/sessao-expirada?volta=' + encodeURIComponent(completo)); return false; }
  return true;
}

function aoTrocarAncora() {
  const { caminho, query, completo } = lerAncora();
  if (ui.sujo && !ui.descartar && caminho !== ui.rota) {
    history.replaceState(null, '', '#' + ui.rotaCompleta);
    ui.navegacaoPendente = completo;
    render();
    return;
  }
  if (ui.descartar || caminho !== ui.rota) {
    for (const k of Object.keys(ui.views)) {
      if (k.startsWith('form:')) delete ui.views[k];
      else if (ui.views[k] && typeof ui.views[k] === 'object' && 'dlg' in ui.views[k]) ui.views[k].dlg = null;
    }
  }
  ui.descartar = false;
  limparSujo();
  if (!aplicarGuardas()) return;
  const mudou = caminho !== ui.rota;
  ui.rota = caminho;
  ui.rotaCompleta = completo;
  ui.query = query;
  ui.popover = null;
  ui.menuAberto = false;
  ui.contextoSim = null;
  if (mudou) { focarTitulo = Boolean(ui.iniciado); ui.visita = (ui.visita || 0) + 1; window.scrollTo(0, 0); }
  ui.iniciado = true;
  render();
}

function App() {
  const r = resolver(ui.rota);
  const usuario = auth.usuarioAtual();
  const sessao = auth.lerSessao();
  const ctx = { params: r.params, query: ui.query, usuario, sessao, rota: ui.rota };
  let corpo;
  if (!r.ambiente) {
    const view = VIEWS[r.view] || NaoEncontrada;
    corpo = LayoutPublico(view(ctx));
  } else {
    const a = auth.verificarAcesso(r.ambiente, r.secao);
    if (a.status === 'login' || a.status === 'expirada') {
      queueMicrotask(aplicarGuardas);
      corpo = LayoutPublico(h('p', { class: 'muted' }, 'Redirecionando…'));
    } else if (a.status === 'negado') {
      corpo = LayoutPublico(AcessoNegadoConteudo({ ...ctx, motivo: a.motivo }));
    } else {
      const amb = r.ambiente;
      const conteudo = a.status === 'insuficiente' ? PermissaoInsuficiente(ctx) : (VIEWS[r.view] || NaoEncontrada)({ ...ctx, empresaId: a.vinculo ? a.vinculo.empresaId : null, vinculo: a.vinculo || null });
      corpo = LayoutAmbiente({ ambiente: amb, conteudo, usuario, sessao: { ...sessao, empresaId: a.vinculo ? a.vinculo.empresaId : sessao.empresaId }, migalha: a.status === 'insuficiente' ? 'Acesso restrito' : TITULOS[r.view] || '' });
    }
  }
  const titulo = TITULOS[r.view];
  document.title = (titulo ? titulo + ' · ' : '') + 'EloServ';
  return h('div', { id: 'app-root', class: ui.largura < 640 ? 'is-mob' : '' }, corpo, PainelAjuda(), PainelSimulacao(ctx), DialogoSairSemSalvar(), Toasts());
}

// ---------- Foco e sobreposições (diálogos e painéis) ----------
let pilha = [];
const retornos = {};
// No Safari, clicar não move o foco para o botão: guardamos o último controle acionado para devolver o foco.
let ultimoAcionado = null;
let viaPonteiro = false;
document.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('button, a[href], [tabindex]:not([tabindex="-1"])'); ultimoAcionado = c || null; viaPonteiro = Boolean(c); }, true);
document.addEventListener('keydown', () => { viaPonteiro = false; }, true);
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function aposRenderizar() {
  const abertos = [...document.querySelectorAll('[data-overlay]')];
  const ids = abertos.map(el => el.getAttribute('data-overlay'));
  for (const el of abertos) {
    const id = el.getAttribute('data-overlay');
    if (pilha.includes(id)) continue;
    const ativo = document.activeElement;
    retornos[id] = viaPonteiro && ultimoAcionado ? ultimoAcionado : ativo && ativo !== document.body && !el.contains(ativo) ? ativo : ultimoAcionado;
    const alvo = el.querySelector('[data-autofocus]') || el.querySelector('.dialog-body input, .dialog-body select, .dialog-body textarea') || el.querySelector('.drawer-body ' + FOCAVEIS) || el.querySelector(FOCAVEIS);
    if (alvo) alvo.focus();
  }
  for (const id of pilha) {
    if (ids.includes(id)) continue;
    const volta = retornos[id];
    delete retornos[id];
    if (volta && document.contains(volta)) volta.focus();
    else { const t = document.querySelector('main h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); } }
  }
  pilha = ids;
  document.body.style.overflow = ids.length ? 'hidden' : '';
  const alerta = document.querySelector('[data-foco]:not([data-focado])');
  if (alerta) { alerta.setAttribute('data-focado', '1'); alerta.focus(); }
  if (focarTitulo && !ids.length) {
    focarTitulo = false;
    const t = document.querySelector('main h1');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
}

function desenhar() {
  mount(raiz, App());
  aposRenderizar();
}

function topo() {
  const els = document.querySelectorAll('[data-overlay]');
  return els.length ? els[els.length - 1] : null;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (ui.popover) { ui.popover = null; render(); const b = document.activeElement; if (b && b.blur) b.blur(); return; }
    const t = topo();
    if (t) { e.preventDefault(); t.dispatchEvent(new CustomEvent('fechar')); }
    return;
  }
  if (e.key === 'Tab') {
    const t = topo();
    if (!t) return;
    const f = [...t.querySelectorAll(FOCAVEIS)].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    const primeiro = f[0], ultimo = f[f.length - 1];
    if (!t.contains(document.activeElement)) { e.preventDefault(); primeiro.focus(); }
    else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }
});

document.addEventListener('click', e => {
  if (ui.popover && !e.target.closest('.pop-wrap')) { ui.popover = null; render(); }
  auth.registrarAtividade();
}, true);
document.addEventListener('keydown', () => auth.registrarAtividade(), true);
window.addEventListener('beforeunload', e => { if (ui.sujo) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('resize', () => { const w = window.innerWidth; if (w !== ui.largura) { ui.largura = w; render(); } });
window.addEventListener('hashchange', aoTrocarAncora);

// ---------- Inicialização ----------
aplicarTema();
observarSistema(render);
garantirDados();
definirRenderizador(desenhar);
aoMudar(msg => { if (msg.remoto) ui.atualizadoRemoto = true; render(); });
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('eloserv.')) render(); });

expirarReservas().then(render);
setInterval(() => {
  expirarReservas().then(r => { if (r && r.data && r.data.alteradas) render(); });
  const { r } = rotaAtual();
  if (r.ambiente && auth.verificarAcesso(r.ambiente, r.secao).status === 'expirada') aplicarGuardas();
}, 60000);

aoTrocarAncora();
if (!location.hash) history.replaceState(null, '', '#/');
document.documentElement.setAttribute('data-pronto', 'true');
export { navegar };
