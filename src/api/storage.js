// Adaptador de armazenamento: localStorage no navegador, memória nos testes de Node.

const memoria = new Map();
const memoriaStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: k => { memoria.delete(k); },
  clear: () => memoria.clear()
};

let backend = null;
function atual() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      const k = '__eloserv_teste__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      backend = localStorage;
      return backend;
    }
  } catch { /* armazenamento indisponível: usa memória */ }
  backend = memoriaStorage;
  return backend;
}

/** Permite trocar o armazenamento (usado pelos testes). */
export function usarArmazenamento(s) { backend = s; }
export const armazenamentoEmMemoria = () => memoriaStorage;

export const storage = {
  get: k => { try { return atual().getItem(k); } catch { return null; } },
  set: (k, v) => atual().setItem(k, v),
  remove: k => { try { atual().removeItem(k); } catch { /* ignora */ } },
  getJson(k, padrao) {
    const v = this.get(k);
    if (v == null) return padrao;
    try { return JSON.parse(v); } catch { return padrao; }
  },
  setJson(k, v) { this.set(k, JSON.stringify(v)); }
};

export const CHAVES = {
  db: 'eloserv.db.v1',
  sessao: 'eloserv.sessao',
  sim: 'eloserv.sim',
  relogio: 'eloserv.sim.relogio',
  lock: 'eloserv.lock',
  rascunho: 'eloserv.rascunho.solicitacao',
  tema: 'eloserv.theme',
  densidade: 'eloserv.density'
};
