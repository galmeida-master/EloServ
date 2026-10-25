// Estado da interface em memória + agendamento de renderização.
// Dados de negócio NÃO ficam aqui: as telas leem pela camada api/ (que lê o armazenamento)
// e escrevem somente por ela. Mudanças de outras abas chegam pelo BroadcastChannel (api/db.js).

export const ui = {
  rota: '/',
  caminho: [],
  query: {},
  toasts: [],
  ajuda: null,          // slug do artigo aberto no painel lateral de ajuda contextual
  simAberto: false,
  menuAberto: false,    // menu recolhível (tablet/celular)
  popover: null,        // 'notificacoes' | 'usuario' | 'aparencia' | null
  views: {},            // estado local de cada tela, por chave
  sujo: null,           // { mensagem } quando há alterações não salvas na tela atual
  navegacaoPendente: null,
  largura: typeof window !== 'undefined' ? window.innerWidth : 1280,
  atualizadoRemoto: false,
  visita: 0,            // incrementa a cada troca de rota (telas recarregam dados remotos)
  contextoSim: null     // contexto para o painel de simulação (horário escolhido, solicitação aberta)
};

let agendado = false;
let renderizador = null;
export function definirRenderizador(fn) { renderizador = fn; }

/** Agenda uma renderização (agrupa várias mudanças no mesmo ciclo). */
export function render() {
  if (agendado || !renderizador) return;
  agendado = true;
  queueMicrotask(() => { agendado = false; renderizador(); });
}

/** Estado local de uma tela (persistente enquanto a aba estiver aberta). */
export function estadoView(chave, inicial) {
  if (!(chave in ui.views)) ui.views[chave] = typeof inicial === 'function' ? inicial() : { ...inicial };
  return ui.views[chave];
}
export function limparView(chave) { delete ui.views[chave]; }

/** Aplica mudanças a um objeto de estado e renderiza. */
export function set(obj, patch) {
  Object.assign(obj, patch);
  render();
}

let idToast = 0;
/** Toasts apenas para confirmações; erros que exigem ação ficam no contexto da tela. */
export function toast(mensagem, tipo = 'ok') {
  const id = ++idToast;
  ui.toasts = [...ui.toasts, { id, mensagem, tipo }];
  render();
  setTimeout(() => { ui.toasts = ui.toasts.filter(t => t.id !== id); render(); }, 6000);
}

export function navegar(rota) {
  const alvo = rota.startsWith('#') ? rota : '#' + rota;
  if (location.hash === alvo) render();
  else location.hash = alvo;
}

/** Marca a tela atual com alterações não salvas (aviso antes de sair). */
export function marcarSujo(mensagem = 'Você tem alterações não salvas.') { ui.sujo = { mensagem }; }
export function limparSujo() { ui.sujo = null; }

/** Chave aleatória para idempotência de uma tentativa de envio. */
export function novaChave() {
  try { return crypto.randomUUID(); } catch { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
}
