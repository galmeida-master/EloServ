// Utilitários compartilhados pelos módulos da API simulada.
import { transacao, ler, falhar, MENSAGENS } from './db.js';
import { lerSessao } from './auth.js';
import { rotulo, estadoOcupacaoExibicao } from '../domain/estados.js';
import { formatarDataHora, formatarIntervalo, rotuloFuso, emMs, formatarPrazo } from '../domain/datas.js';
import { vinculoEmpresa } from '../domain/permissoes.js';
import { ocupacaoAtiva } from '../domain/agenda.js';
import { agora } from './clock.js';

/**
 * Executa uma operação de escrita como o usuário da sessão (ou `opcoes.ator`, usado pela simulação).
 * Sessão expirada devolve SESSAO_EXPIRADA sem gravar nada.
 */
export function executar(nome, fn, opcoes = {}) {
  let ator = opcoes.ator;
  if (ator === undefined) {
    const s = lerSessao();
    if (s && s.expirada) return Promise.resolve({ ok: false, code: 'SESSAO_EXPIRADA', message: MENSAGENS.SESSAO_EXPIRADA });
    ator = s ? s.usuarioId : null;
  }
  return transacao(nome, fn, { ...opcoes, ator });
}

/** Garante que o ator é gestor da empresa; caso contrário responde como “não encontrado” (não revela dados de outra empresa). */
export function exigirGestor(tx, empresaId) {
  const ator = tx.exigirAtor();
  const v = vinculoEmpresa(ator, empresaId);
  if (!v || v.papel !== 'gestor') throw falhar('NAO_ENCONTRADO', MENSAGENS.NAO_ENCONTRADO);
  return ator;
}

export function gestoresDa(estado, empresaId) {
  return estado.usuarios.filter(u => u.situacao === 'ativo' && (u.vinculos || []).some(v => v.tipo === 'empresa' && v.empresaId === empresaId && v.papel === 'gestor' && v.situacao === 'ativo'));
}

export const empresaDe = (estado, id) => estado.empresas.find(e => e.id === id) || null;
export const servicoDe = (estado, id) => estado.servicos.find(s => s.id === id) || null;
export const profissionalDe = (estado, id) => estado.profissionais.find(p => p.id === id) || null;
export const ocupacaoDe = (estado, id) => (id ? estado.ocupacoes.find(o => o.id === id) || null : null);
export const ordemDe = (estado, id) => (id ? estado.ordens.find(o => o.id === id) || null : null);

export function badge(maquina, estado) { return rotulo(maquina, estado); }

/** Estado de exibição da ocupação (temporária vencida aparece como liberada até a rotina de expiração rodar). */
export function estadoOcupacao(o, t = agora()) {
  if (!o) return estadoOcupacaoExibicao(null);
  if (o.estado === 'temporaria' && !ocupacaoAtiva(o, t)) return 'liberada';
  return o.estado;
}

export const fusoDe = (estado, empresaId) => (empresaDe(estado, empresaId) || {}).fuso || 'America/Cuiaba';
export const quando = (iso, fuso) => (iso ? formatarDataHora(iso, fuso) : 'Sem horário definido');
export const intervalo = (ini, fim, fuso) => formatarIntervalo(ini, fim, fuso);
export const prazo = (iso, fuso) => formatarPrazo(iso, fuso);
export const fusoRotulo = (fuso, instante) => rotuloFuso(fuso, instante ? emMs(instante) : agora());

/** Entrada de linha do tempo (evita “..” quando a frase termina em nome abreviado, ex.: “Marina D.”). */
export function linha(tx, texto) { return { quando: new Date(tx.agora).toISOString(), texto: texto.replace(/\.\.(?!\.)/g, '.') }; }

export { ler, falhar };
