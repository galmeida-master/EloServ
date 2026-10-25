// Usuários: perfil e privacidade do cliente, equipamentos e endereços; acessos administrativos.
import { ok, falhar, ler } from './db.js';
import { executar } from './comum.js';
import { pode, vinculoAdmin, podeAlterarPapel, podeSuspenderUsuario, principaisAtivos, NIVEIS_ADMIN } from '../domain/permissoes.js';
import { validarEmailDemo, validarTelefone, validarJustificativa, mascararEmail } from '../domain/validacao.js';
import { DIA } from '../domain/datas.js';

const iso = ms => new Date(ms).toISOString();

// ---------- Cliente ----------
export const equipamentosDe = usuario => (usuario ? ler().equipamentos.filter(e => e.clienteId === usuario.id) : []);
export const enderecosDe = usuario => (usuario ? ler().enderecos.filter(e => e.clienteId === usuario.id) : []);

export function salvarEquipamento(d, opcoes = {}) {
  return executar('salvarEquipamento', tx => {
    const ator = tx.exigirAtor();
    if (!String(d.tipo || '').trim()) throw falhar('VALIDACAO', 'Informe o tipo do equipamento.', { campos: { tipo: 'Informe o tipo do equipamento.' } });
    const dados = { tipo: d.tipo.trim(), capacidade: String(d.capacidade || '').trim(), marca: String(d.marca || '').trim(), local: String(d.local || '').trim() };
    if (d.id) {
      const e = tx.exigir('equipamentos', d.id);
      if (e.clienteId !== ator.id) throw falhar('NAO_ENCONTRADO', 'Equipamento não encontrado.');
      tx.exigirVersao(e, d.versao);
      tx.alterar('equipamentos', e, dados);
      return ok({ id: e.id });
    }
    const n = tx.estado.equipamentos.filter(e => e.clienteId === ator.id).length + 1;
    return ok({ id: tx.inserir('equipamentos', { id: 'EQ-' + String(tx.seq('eq') + 3).padStart(2, '0'), clienteId: ator.id, ...dados, ordem: n }).id });
  }, opcoes);
}

export function salvarEndereco(d, opcoes = {}) {
  return executar('salvarEndereco', tx => {
    const ator = tx.exigirAtor();
    const erros = {};
    if (!String(d.rotulo || '').trim()) erros.rotulo = 'Informe uma identificação (ex.: Casa, Trabalho).';
    if (!String(d.bairro || '').trim()) erros.bairro = 'Informe o bairro ou região.';
    if (!String(d.cidade || '').trim()) erros.cidade = 'Informe a cidade.';
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos do endereço.', { campos: erros });
    const dados = { rotulo: d.rotulo.trim(), bairro: d.bairro.trim(), cidade: d.cidade.trim(), referencia: String(d.referencia || '').trim() };
    if (d.id) {
      const e = tx.exigir('enderecos', d.id);
      if (e.clienteId !== ator.id) throw falhar('NAO_ENCONTRADO', 'Endereço não encontrado.');
      tx.alterar('enderecos', e, dados);
      return ok({ id: e.id });
    }
    return ok({ id: tx.inserir('enderecos', { id: 'END-' + String(tx.seq('end') + 2).padStart(2, '0'), clienteId: ator.id, ...dados }).id });
  }, opcoes);
}

export function salvarPerfil(d, opcoes = {}) {
  return executar('salvarPerfil', tx => {
    const ator = tx.exigirAtor();
    const u = tx.exigir('usuarios', ator.id);
    tx.exigirVersao(u, d.versao);
    const erros = {};
    if (!String(d.nome || '').trim()) erros.nome = 'Informe seu nome.';
    const t = validarTelefone(d.telefone, true); if (t) erros.telefone = t;
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos destacados.', { campos: erros });
    tx.alterar('usuarios', u, { nome: d.nome.trim(), telefone: d.telefone.trim(), preferencias: { emailAtendimentos: Boolean(d.emailAtendimentos), marketing: Boolean(d.marketing) } });
    return ok();
  }, opcoes);
}

/** Pedidos de exportação e de exclusão: apenas registrados, conforme a política aplicável. */
export function pedirPrivacidade({ tipo, confirmacao }, opcoes = {}) {
  return executar('pedirPrivacidade', tx => {
    const ator = tx.exigirAtor();
    if (tipo === 'exclusao' && confirmacao !== 'EXCLUIR') throw falhar('VALIDACAO', 'Digite EXCLUIR para confirmar.', { campos: { confirmacao: 'Digite EXCLUIR para confirmar.' } });
    if (!['exportacao', 'exclusao'].includes(tipo)) throw falhar('VALIDACAO', 'Tipo de pedido inválido.');
    tx.inserir('pedidosPrivacidade', { id: tx.id('PRV'), usuarioId: ator.id, tipo, situacao: 'registrado', criadoEm: iso(tx.agora) });
    tx.auditar({ entidade: 'Conta de cliente', acao: tipo === 'exclusao' ? 'Pedido de exclusão registrado' : 'Pedido de exportação registrado', tipo: 'privacidade' });
    return ok();
  }, opcoes);
}

// ---------- Administração: usuários e acessos ----------
const PAPEL_EMPRESA = { gestor: 'Gestão', tecnico: 'Técnico' };

export function usuariosAdmin(usuario) {
  if (!vinculoAdmin(usuario)) return { lista: [], principais: 0 };
  const e = ler();
  const nomeEmp = id => (e.empresas.find(x => x.id === id) || {}).nome || id;
  const lista = e.usuarios.map(u => {
    const adm = (u.vinculos || []).find(v => v.tipo === 'admin');
    const emps = (u.vinculos || []).filter(v => v.tipo === 'empresa');
    const cli = (u.vinculos || []).some(v => v.tipo === 'cliente');
    const papeis = [];
    if (adm) papeis.push('Administração · ' + NIVEIS_ADMIN[adm.nivel]);
    for (const v of emps) papeis.push(`${PAPEL_EMPRESA[v.papel]} · ${nomeEmp(v.empresaId)}${v.situacao !== 'ativo' ? ' (' + (v.situacao === 'revogado' ? 'vínculo revogado' : 'vínculo suspenso') + ')' : ''}`);
    if (cli) papeis.push(emps.length || adm ? 'Também cliente (conta pessoal)' : 'Cliente');
    return { id: u.id, nome: u.nome, emailMascarado: mascararEmail(u.email), situacao: u.situacao, papeis, admin: adm ? adm.nivel : null, voce: u.id === usuario.id };
  });
  return { lista, principais: principaisAtivos(e.usuarios) };
}

function exigirAdmin(tx) {
  const ator = tx.exigirAtor();
  if (!vinculoAdmin(ator)) throw falhar('ACESSO_NEGADO', 'Apenas a administração da plataforma pode realizar esta ação.');
  return ator;
}

export function suspenderUsuario({ usuarioId, justificativa }, opcoes = {}) {
  return executar('suspenderUsuario', tx => {
    const ator = exigirAdmin(tx);
    const alvo = tx.exigir('usuarios', usuarioId);
    const r = podeSuspenderUsuario(ator, alvo, tx.estado.usuarios);
    if (!r.ok) throw falhar(r.code, r.message);
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    tx.alterar('usuarios', alvo, { situacao: 'suspenso' });
    tx.auditar({ entidade: 'Usuário ' + alvo.nome, acao: 'Acesso suspenso', tipo: 'suspensao', justificativa: justificativa.trim() });
    return ok();
  }, opcoes);
}

export function reativarUsuario({ usuarioId, justificativa }, opcoes = {}) {
  return executar('reativarUsuario', tx => {
    const ator = exigirAdmin(tx);
    if (!pode(ator, 'usuarios.gerir')) throw falhar('PERMISSAO_INSUFICIENTE', 'Seu nível de administração não permite reativar acessos.');
    const alvo = tx.exigir('usuarios', usuarioId);
    if (alvo.situacao !== 'suspenso') throw falhar('TRANSICAO_INVALIDA', 'Este acesso não está suspenso.');
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    tx.alterar('usuarios', alvo, { situacao: 'ativo' });
    tx.auditar({ entidade: 'Usuário ' + alvo.nome, acao: 'Acesso reativado', tipo: 'reativacao', justificativa: justificativa.trim() });
    return ok();
  }, opcoes);
}

/** Alteração de nível de administrador: sem autoelevação; último principal protegido. */
export function alterarPapel({ usuarioId, nivel, justificativa }, opcoes = {}) {
  return executar('alterarPapel', tx => {
    const ator = exigirAdmin(tx);
    const alvo = tx.exigir('usuarios', usuarioId);
    const r = podeAlterarPapel(ator, alvo, nivel, tx.estado.usuarios);
    if (!r.ok) throw falhar(r.code, r.message);
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    tx.alterar('usuarios', alvo, { vinculos: alvo.vinculos.map(v => (v.tipo === 'admin' ? { ...v, nivel } : v)), rotuloPapel: 'admin ' + NIVEIS_ADMIN[nivel].toLowerCase() });
    tx.auditar({ entidade: 'Usuário ' + alvo.nome, acao: 'Alteração de papel: ' + NIVEIS_ADMIN[nivel], tipo: 'papel', justificativa: justificativa.trim() });
    tx.notificar(alvo.id, { titulo: 'Alteração de acesso', texto: 'Seu nível de administração foi alterado para ' + NIVEIS_ADMIN[nivel] + '.', href: '#/admin', icone: 'shield-check' });
    return ok();
  }, opcoes);
}

export function convidarAdmin({ email, nivel = 'suporte' }, opcoes = {}) {
  return executar('convidarAdmin', tx => {
    const ator = exigirAdmin(tx);
    if (!pode(ator, 'usuarios.gerir')) throw falhar('PERMISSAO_INSUFICIENTE', 'Seu nível de administração não permite convidar.');
    const m = validarEmailDemo(email);
    if (m) throw falhar('VALIDACAO', m, { campos: { email: m } });
    if (nivel === 'principal' && ator.vinculos.find(v => v.tipo === 'admin').nivel !== 'principal') throw falhar('NIVEL_INSUFICIENTE', 'Somente o nível Principal pode convidar com nível Principal.');
    const e = email.trim().toLowerCase();
    if (tx.estado.usuarios.some(u => u.email === e)) throw falhar('VALIDACAO', 'Já existe uma conta com este e-mail.', { campos: { email: 'Já existe uma conta com este e-mail.' } });
    tx.inserir('usuarios', { id: tx.id('u'), nome: 'Convite pendente', email: e, telefone: '', situacao: 'convite', vinculos: [{ tipo: 'admin', nivel }], rotuloPapel: 'admin ' + NIVEIS_ADMIN[nivel].toLowerCase(), criadoEm: iso(tx.agora), conviteExpiraEm: iso(tx.agora + 7 * DIA), preferencias: {} });
    tx.auditar({ entidade: 'Convite ' + mascararEmail(e), acao: 'Convite de administrador criado (' + NIVEIS_ADMIN[nivel] + ')', tipo: 'convite' });
    return ok();
  }, opcoes);
}

export function revogarConviteAdmin({ usuarioId }, opcoes = {}) {
  return executar('revogarConviteAdmin', tx => {
    const ator = exigirAdmin(tx);
    if (!pode(ator, 'usuarios.gerir')) throw falhar('PERMISSAO_INSUFICIENTE', 'Seu nível de administração não permite revogar convites.');
    const alvo = tx.exigir('usuarios', usuarioId);
    if (alvo.situacao !== 'convite') throw falhar('TRANSICAO_INVALIDA', 'Não há convite pendente.');
    tx.alterar('usuarios', alvo, { situacao: 'revogado' });
    tx.auditar({ entidade: 'Convite ' + mascararEmail(alvo.email), acao: 'Convite revogado', tipo: 'revogacao' });
    return ok();
  }, opcoes);
}


