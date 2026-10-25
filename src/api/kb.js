// Base de conhecimento: consulta pública e contextual; edição pela administração.
import { ok, falhar, ler } from './db.js';
import { executar } from './comum.js';
import { pode, vinculoAdmin } from '../domain/permissoes.js';
import { validarArtigo } from '../domain/validacao.js';
import { CATEGORIAS_AJUDA, PUBLICOS_AJUDA } from './seed-artigos.js';

export { CATEGORIAS_AJUDA, PUBLICOS_AJUDA };

const publicados = () => ler().artigos.filter(a => a.situacao === 'publicado');

export function listarArtigos({ q = '', categoria = '', publico = '' } = {}) {
  const t = q.trim().toLowerCase();
  return publicados().filter(a => (!t || (a.titulo + ' ' + a.resumo + ' ' + a.passos.join(' ')).toLowerCase().includes(t))
    && (!categoria || a.categoria === categoria)
    && (!publico || a.publico === publico || a.publico === 'Clientes e empresas'));
}

export function contarPorCategoria() {
  const out = {};
  for (const c of CATEGORIAS_AJUDA) out[c] = 0;
  for (const a of publicados()) out[a.categoria] = (out[a.categoria] || 0) + 1;
  return out;
}

export function artigo(slug) {
  const a = publicados().find(x => x.slug === slug);
  if (!a) return null;
  return { ...a, relacionadosArtigos: a.relacionados.map(s => publicados().find(x => x.slug === s)).filter(Boolean) };
}

/** Solicitação de suporte (atendimento humano em horário comercial; sem chatbot). */
export function abrirSuporte({ assunto, texto }, opcoes = {}) {
  return executar('abrirSuporte', tx => {
    const erros = {};
    if (!String(assunto || '').trim()) erros.assunto = 'Informe o assunto.';
    if (String(texto || '').trim().length < 10) erros.texto = 'Descreva a dúvida com pelo menos 10 caracteres.';
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos.', { campos: erros });
    const n = tx.seq('suporte') + 118;
    const origem = tx.ator ? ((tx.ator.vinculos || []).some(v => v.tipo === 'empresa') ? 'Empresa' : 'Cliente') : 'Visitante';
    tx.inserir('suporte', { id: 'SUP-' + n, assunto: assunto.trim().slice(0, 120), origem, situacao: 'aberta', criadoEm: new Date(tx.agora).toISOString() });
    return ok({ id: 'SUP-' + n });
  }, opcoes);
}

// ---------- Administração ----------
export function todosArtigos(usuario) {
  if (!vinculoAdmin(usuario)) return [];
  return ler().artigos.slice().sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}
export function artigoAdmin(usuario, slug) {
  if (!vinculoAdmin(usuario)) return null;
  return ler().artigos.find(a => a.slug === slug) || null;
}

function exigirEditor(tx) {
  const ator = tx.exigirAtor();
  if (!pode(ator, 'artigos.publicar')) throw falhar('ACESSO_NEGADO', 'Apenas a administração publica artigos de ajuda.');
  return ator;
}

const normalizar = d => ({
  titulo: String(d.titulo || '').trim(), resumo: String(d.resumo || '').trim(),
  categoria: CATEGORIAS_AJUDA.includes(d.categoria) ? d.categoria : CATEGORIAS_AJUDA[0],
  publico: PUBLICOS_AJUDA.includes(d.publico) ? d.publico : PUBLICOS_AJUDA[0],
  passos: (Array.isArray(d.passos) ? d.passos : String(d.passos || '').split('\n')).map(x => x.trim()).filter(Boolean),
  observacoes: (Array.isArray(d.observacoes) ? d.observacoes : String(d.observacoes || '').split('\n')).map(x => x.trim()).filter(Boolean)
});

export function novoArtigo(opcoes = {}) {
  return executar('novoArtigo', tx => {
    exigirEditor(tx);
    const slug = 'novo-artigo-' + tx.seq('artigo');
    tx.inserir('artigos', { id: slug, slug, titulo: '', resumo: '', categoria: CATEGORIAS_AJUDA[0], publico: PUBLICOS_AJUDA[0], passos: [], observacoes: [], relacionados: [], situacao: 'rascunho', atualizadoEm: new Date(tx.agora).toISOString() });
    return ok({ slug });
  }, opcoes);
}

export function salvarRascunho(d, opcoes = {}) {
  return executar('salvarRascunho', tx => {
    exigirEditor(tx);
    const a = tx.exigir('artigos', d.slug);
    tx.exigirVersao(a, d.versao);
    tx.alterar('artigos', a, { ...normalizar(d), atualizadoEm: new Date(tx.agora).toISOString() });
    return ok();
  }, opcoes);
}

/** Publica com validação de campos obrigatórios. */
export function publicarArtigo(d, opcoes = {}) {
  return executar('publicarArtigo', tx => {
    exigirEditor(tx);
    const a = tx.exigir('artigos', d.slug);
    tx.exigirVersao(a, d.versao);
    const dados = normalizar(d);
    const erros = validarArtigo(dados);
    if (erros.length) throw falhar('VALIDACAO', 'Antes de publicar: ' + erros.join(' '), { lista: erros });
    tx.alterar('artigos', a, { ...dados, situacao: 'publicado', atualizadoEm: new Date(tx.agora).toISOString() });
    tx.auditar({ entidade: `Artigo “${dados.titulo}”`, acao: 'Artigo publicado', tipo: 'artigo' });
    return ok();
  }, opcoes);
}

export function arquivarArtigo({ slug }, opcoes = {}) {
  return executar('arquivarArtigo', tx => {
    exigirEditor(tx);
    const a = tx.exigir('artigos', slug);
    tx.alterar('artigos', a, { situacao: 'arquivado', atualizadoEm: new Date(tx.agora).toISOString() });
    tx.auditar({ entidade: `Artigo “${a.titulo || a.slug}”`, acao: 'Artigo arquivado', tipo: 'artigo' });
    return ok();
  }, opcoes);
}

export function chamadosSuporte(usuario) {
  if (!pode(usuario, 'suporte.consultar')) return [];
  return ler().suporte.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
