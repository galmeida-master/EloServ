// “Servidor simulado”: única porta de escrita dos dados da demonstração.
// Cada escrita roda numa transação local que:
//  1. lê o estado mais recente do armazenamento (não o cache da tela);
//  2. executa a regra de negócio;
//  3. verifica a versão dos registros tocados (controle otimista) → CONFLITO_ATUALIZACAO;
//  4. grava atomicamente (uma única chave) e incrementa as versões;
//  5. avisa as outras abas via BroadcastChannel('eloserv').
// Escritas são serializadas entre abas com Web Locks (fallback: trava em localStorage com expiração).
// ATENÇÃO: isto é uma simulação. A aplicação final deve validar e gravar no backend.

import { storage, CHAVES } from './storage.js';
import { agora as relogio } from './clock.js';
import { atraso, consumirFalhaEnvio, lerSim } from './sim.js';
import { versoesAlteradas, buscarIdempotente, registrarIdempotente, MENSAGEM_CONFLITO } from '../domain/concorrencia.js';
import { criarDadosDemonstrativos, VERSAO_DADOS } from './seed.js';
import { mascararEmail } from '../domain/validacao.js';

export const COLECOES = ['empresas', 'servicos', 'produtos', 'profissionais', 'usuarios', 'ocupacoes', 'solicitacoes', 'ordens',
  'equipamentos', 'enderecos', 'clientesOp', 'notificacoes', 'emails', 'auditoria', 'artigos', 'categorias', 'suporte',
  'pedidosPrivacidade', 'acessosTemporarios', 'consultas'];

// ---------- Resultados ----------
export const ok = (data = null) => ({ ok: true, data });
export class ErroApi extends Error {
  constructor(code, message, details) { super(message); this.resultado = { ok: false, code, message, details }; }
}
export const falhar = (code, message, details) => new ErroApi(code, message, details);
export const MENSAGENS = {
  FALHA_CONEXAO: 'Falha de conexão. Nada foi gravado e seus dados foram mantidos. Tente novamente.',
  SESSAO_EXPIRADA: 'Sua sessão expirou. Entre novamente para continuar; os rascunhos deste dispositivo foram mantidos.',
  NAO_AUTENTICADO: 'Entre na sua conta para continuar.',
  ACESSO_NEGADO: 'Você não tem permissão para esta ação.',
  NAO_ENCONTRADO: 'Registro não encontrado ou indisponível para a sua conta.'
};

// ---------- Leitura (com cache pela string armazenada) ----------
let cacheTexto = null;
let cacheEstado = null;

export function garantirDados() {
  const texto = storage.get(CHAVES.db);
  if (texto) {
    try {
      const e = JSON.parse(texto);
      if (e && e.meta && e.meta.versao === VERSAO_DADOS) return;
    } catch { /* dados corrompidos: recria */ }
  }
  storage.set(CHAVES.db, JSON.stringify(criarDadosDemonstrativos(relogio())));
}

/** Estado atual (somente leitura). Não altere o objeto devolvido. */
export function ler() {
  let texto = storage.get(CHAVES.db);
  if (!texto) { garantirDados(); texto = storage.get(CHAVES.db); }
  if (texto !== cacheTexto) {
    cacheEstado = JSON.parse(texto);
    cacheTexto = texto;
  }
  return cacheEstado;
}

export function restaurarDemonstracao() {
  storage.set(CHAVES.db, JSON.stringify(criarDadosDemonstrativos(relogio())));
  avisar({ tipo: 'restaurado' });
}

// ---------- Avisos entre abas ----------
const ouvintes = new Set();
let canal = null;
function obterCanal() {
  if (canal || typeof BroadcastChannel === 'undefined') return canal;
  canal = new BroadcastChannel('eloserv');
  if (canal.unref) canal.unref();
  canal.onmessage = ev => { cacheTexto = null; ouvintes.forEach(f => f({ ...ev.data, remoto: true })); };
  return canal;
}
export function aoMudar(fn) { obterCanal(); ouvintes.add(fn); return () => ouvintes.delete(fn); }
function avisar(msg) {
  const c = obterCanal();
  if (c) { try { c.postMessage(msg); } catch { /* aba fechando */ } }
  ouvintes.forEach(f => f({ ...msg, remoto: false }));
}

// ---------- Trava entre abas ----------
const fila = { atual: Promise.resolve() };
function travaLocal(fn) {
  const exec = fila.atual.then(fn, fn);
  fila.atual = exec.catch(() => {});
  return exec;
}
async function travaArmazenamento(fn) {
  const dono = Math.random().toString(36).slice(2);
  const limite = Date.now() + 3000;
  for (;;) {
    const t = storage.getJson(CHAVES.lock, null);
    if (!t || t.expira < Date.now() || Date.now() > limite) {
      storage.setJson(CHAVES.lock, { dono, expira: Date.now() + 5000 });
      if (storage.getJson(CHAVES.lock, {}).dono === dono) break;
    }
    await new Promise(r => setTimeout(r, 30));
  }
  try { return await fn(); } finally { if (storage.getJson(CHAVES.lock, {}).dono === dono) storage.remove(CHAVES.lock); }
}
function comTrava(fn) {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (nav && nav.locks && typeof nav.locks.request === 'function') return nav.locks.request('eloserv-dados', { mode: 'exclusive' }, fn);
  return travaLocal(() => travaArmazenamento(fn));
}

// ---------- Transação ----------
const chave = (col, id) => col + '/' + id;

class Tx {
  constructor(estado, atorId, agora) {
    this.estado = estado;
    this.agora = agora;
    this.lidos = {};
    this.tocados = new Set();
    this.alterado = false;
    this.ator = atorId ? (estado.usuarios.find(u => u.id === atorId) || null) : null;
  }
  todos(col) { return this.estado[col]; }
  get(col, id) {
    const r = this.estado[col].find(x => x.id === id) || null;
    if (r) this.lidos[chave(col, id)] = r.v;
    return r;
  }
  exigir(col, id, mensagem) {
    const r = this.get(col, id);
    if (!r) throw falhar('NAO_ENCONTRADO', mensagem || MENSAGENS.NAO_ENCONTRADO);
    return r;
  }
  /** Controle otimista: a tela informa a versão que viu. */
  exigirVersao(registro, versaoEsperada) {
    if (versaoEsperada != null && registro.v !== versaoEsperada) {
      throw falhar('CONFLITO_ATUALIZACAO', MENSAGEM_CONFLITO, { esperada: versaoEsperada, atual: registro.v });
    }
  }
  exigirAtor() {
    if (!this.ator) throw falhar('NAO_AUTENTICADO', MENSAGENS.NAO_AUTENTICADO);
    if (this.ator.situacao !== 'ativo') throw falhar('ACESSO_NEGADO', 'Seu acesso está suspenso.');
    return this.ator;
  }
  inserir(col, rec) {
    const r = { ...rec, v: 1 };
    this.estado[col].push(r);
    this.alterado = true;
    return r;
  }
  /** Altera um registro (o objeto é mutado; a versão sobe na gravação). */
  alterar(col, registro, patch) {
    if (!(chave(col, registro.id) in this.lidos)) this.lidos[chave(col, registro.id)] = registro.v;
    if (patch) Object.assign(registro, patch);
    this.tocados.add(chave(col, registro.id));
    this.alterado = true;
    return registro;
  }
  remover(col, id) {
    const i = this.estado[col].findIndex(x => x.id === id);
    if (i >= 0) { this.lidos[chave(col, id)] = this.estado[col][i].v; this.estado[col].splice(i, 1); this.alterado = true; }
  }
  seq(nome) {
    this.estado.meta.seq[nome] = (this.estado.meta.seq[nome] || 0) + 1;
    this.alterado = true;
    return this.estado.meta.seq[nome];
  }
  id(prefixo) { return prefixo + '-' + this.seq('id_' + prefixo); }
  nomeAtor() {
    const a = this.ator;
    if (!a) return 'Sistema (expiração automática)';
    return `${a.nome} (${a.rotuloPapel || 'usuário'})`;
  }
  /** Auditoria: quem, quando, entidade, tipo de alteração e justificativa — sem segredos ou dados pessoais desnecessários. */
  auditar({ entidade, acao, tipo, justificativa = '', empresaId = null }) {
    this.inserir('auditoria', { id: this.id('AUD'), quem: this.nomeAtor(), quando: new Date(this.agora).toISOString(), entidade, acao, tipo, justificativa, empresaId });
  }
  /** Notificação na aplicação (sem dados pessoais sensíveis). */
  notificar(usuarioId, { titulo, texto, href, icone = 'bell' }) {
    if (!usuarioId) return;
    this.inserir('notificacoes', { id: this.id('NOT'), usuarioId, titulo, texto, href, icone, lida: false, criadaEm: new Date(this.agora).toISOString() });
  }
  /** Fila de e-mail simulada: desacoplada da transação de negócio (falha não desfaz reservas). */
  email(usuarioId, assunto) {
    const u = this.estado.usuarios.find(x => x.id === usuarioId);
    if (!u) return;
    this.inserir('emails', { id: this.id('EML'), para: mascararEmail(u.email), assunto, situacao: 'pendente', tentativas: 0, criadoEm: new Date(this.agora).toISOString() });
  }
  idempotente(chaveIdem) { return buscarIdempotente(this.estado.idem, chaveIdem, this.agora); }
  guardarIdempotente(chaveIdem, resultado) {
    if (!chaveIdem) return;
    this.estado.idem = registrarIdempotente(this.estado.idem, chaveIdem, resultado, this.agora);
    this.alterado = true;
  }
}

function versoesAtuais(estado, chaves) {
  const out = {};
  for (const k of chaves) {
    const [col, ...resto] = k.split('/');
    const id = resto.join('/');
    const r = (estado[col] || []).find(x => x.id === id);
    out[k] = r ? r.v : undefined;
  }
  return out;
}

/**
 * Executa `fn(tx)` como transação. `fn` devolve ok(...) ou lança falhar(...).
 * Opções: ator (id do usuário), idempotencyKey, falhavel (aplica falha simulada), semAtraso.
 */
export async function transacao(nome, fn, { ator = null, idempotencyKey = null, falhavel = true, semAtraso = false } = {}) {
  if (!semAtraso) await atraso();
  if (falhavel && consumirFalhaEnvio()) return { ok: false, code: 'FALHA_CONEXAO', message: MENSAGENS.FALHA_CONEXAO };
  return comTrava(async () => {
    garantirDados();
    const texto = storage.get(CHAVES.db);
    const estado = JSON.parse(texto);
    const tx = new Tx(estado, ator, relogio());
    if (idempotencyKey) {
      const anterior = tx.idempotente(idempotencyKey);
      if (anterior) return { ...anterior, repetida: true };
    }
    let r;
    try {
      r = fn(tx);
    } catch (e) {
      if (e instanceof ErroApi) return e.resultado;
      throw e;
    }
    if (!r || !r.ok) return r;
    if (idempotencyKey) tx.guardarIdempotente(idempotencyKey, r);
    if (!tx.alterado) return r;
    // Verificação final de versão (protege contra gravações concorrentes fora da trava).
    const atual = JSON.parse(storage.get(CHAVES.db));
    if (atual.meta.rev !== estado.meta.rev || versoesAlteradas(tx.lidos, versoesAtuais(atual, Object.keys(tx.lidos))).length) {
      return { ok: false, code: 'CONFLITO_ATUALIZACAO', message: MENSAGEM_CONFLITO };
    }
    for (const k of tx.tocados) {
      const [col, ...resto] = k.split('/');
      const reg = estado[col].find(x => x.id === resto.join('/'));
      if (reg) reg.v = (reg.v || 0) + 1;
    }
    estado.meta.rev += 1;
    estado.meta.ultimaOperacao = nome;
    storage.set(CHAVES.db, JSON.stringify(estado));
    avisar({ tipo: 'db', rev: estado.meta.rev, operacao: nome });
    return r;
  });
}

/** Leitura simulada com atraso (catálogo), sujeita à falha de leitura configurada no painel. */
export async function leituraRemota(fn, { falha = () => false } = {}) {
  await atraso();
  if (falha()) return { ok: false, code: 'FALHA_CONEXAO', message: 'Não foi possível carregar os dados. Verifique sua conexão.' };
  return ok(fn(ler()));
}

export const latenciaAtual = () => lerSim().latencia;
