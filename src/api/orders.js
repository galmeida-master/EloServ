// Ordens de serviço: execução, conclusão (exige “trabalho realizado”), reatribuição e cancelamento.
import { ok, falhar, ler } from './db.js';
import { executar, exigirGestor, empresaDe, servicoDe, profissionalDe, ocupacaoDe, linha } from './comum.js';
import { liberarNoTx, contextoEmpresa } from './agenda.js';
import { agora } from './clock.js';
import { transitar } from '../domain/estados.js';
import { pode, vinculoEmpresa } from '../domain/permissoes.js';
import { verificarProfissional, MOTIVOS } from '../domain/agenda.js';
import { somarMeses, dataLocal, formatarDataHora, rotuloMes, emMs } from '../domain/datas.js';
import { nomeCurto } from '../domain/validacao.js';

function exigirExecutor(tx, ordem) {
  const ator = tx.exigirAtor();
  if (!pode(ator, 'os.atualizar', { empresaId: ordem.empresaId, profissionalId: ordem.profissionalId })) {
    throw falhar('NAO_ENCONTRADO', 'Ordem não disponível: ela não existe ou não está atribuída a você.');
  }
  return ator;
}

function mudar(ordem, para) {
  const t = transitar('execucao', ordem.estado, para);
  if (!t.ok) throw falhar(t.code, t.message);
}

function anotarSolicitacao(tx, ordem, texto) {
  if (!ordem.solicitacaoId) return;
  const s = tx.get('solicitacoes', ordem.solicitacaoId);
  if (s) tx.alterar('solicitacoes', s, { linhaDoTempo: [...s.linhaDoTempo, linha(tx, texto)] });
}

export function iniciarExecucao({ ordemId, versao }, opcoes = {}) {
  return executar('iniciarExecucao', tx => {
    const o = tx.exigir('ordens', ordemId);
    const ator = exigirExecutor(tx, o);
    tx.exigirVersao(o, versao);
    mudar(o, 'execucao');
    tx.alterar('ordens', o, { estado: 'execucao', historico: [...o.historico, linha(tx, `Execução iniciada por ${nomeCurto(ator.nome)}.`)] });
    anotarSolicitacao(tx, o, 'Atendimento em execução.');
    if (o.clienteId) tx.notificar(o.clienteId, { titulo: 'Atendimento em execução', texto: o.id, href: '#/clientes/solicitacoes/' + (o.solicitacaoId || ''), icone: 'wrench' });
    return ok();
  }, opcoes);
}

/** Salva rascunho de trabalho realizado e observações sem concluir. */
export function salvarOrdem({ ordemId, trabalho, observacoes, versao }, opcoes = {}) {
  return executar('salvarOrdem', tx => {
    const o = tx.exigir('ordens', ordemId);
    exigirExecutor(tx, o);
    tx.exigirVersao(o, versao);
    if (['concluida', 'cancelada'].includes(o.estado)) throw falhar('TRANSICAO_INVALIDA', 'Ordem encerrada: não é possível alterar.');
    tx.alterar('ordens', o, { trabalho: String(trabalho || ''), observacoes: String(observacoes || ''), historico: [...o.historico, linha(tx, 'Observações atualizadas.')] });
    return ok();
  }, opcoes);
}

export function concluirOrdem({ ordemId, trabalho, observacoes, retornoMeses, versao }, opcoes = {}) {
  return executar('concluirOrdem', tx => {
    const o = tx.exigir('ordens', ordemId);
    const ator = exigirExecutor(tx, o);
    tx.exigirVersao(o, versao);
    if (!String(trabalho || '').trim()) throw falhar('VALIDACAO', 'Descreva o trabalho realizado para concluir.', { campos: { trabalho: 'Descreva o trabalho realizado para concluir.' } });
    mudar(o, 'concluida');
    const empresa = empresaDe(tx.estado, o.empresaId);
    const meses = Number(retornoMeses) || 0;
    const retorno = meses ? somarMeses(dataLocal(tx.agora, empresa.fuso), meses) : '';
    const txtRet = retorno ? `Próximo retorno sugerido: ${rotuloMes(retorno)}.` : 'Sem retorno previsto.';
    tx.alterar('ordens', o, { estado: 'concluida', trabalho: trabalho.trim(), observacoes: String(observacoes || '').trim(), proximoRetorno: retorno, concluidaEm: new Date(tx.agora).toISOString(), historico: [...o.historico, linha(tx, `Concluída por ${nomeCurto(ator.nome)}. ${txtRet}`)] });
    anotarSolicitacao(tx, o, `Atendimento concluído. ${txtRet}`);
    if (o.clienteId) { tx.notificar(o.clienteId, { titulo: 'Atendimento concluído', texto: `${o.id} · ${txtRet}`, href: '#/clientes/historico', icone: 'check-circle' }); tx.email(o.clienteId, 'Atendimento concluído'); }
    return ok({ proximoRetorno: retorno });
  }, opcoes);
}

/** Reatribui a ordem a outro profissional elegível e livre (revalidado na transação). */
export function reatribuirOrdem({ ordemId, profissionalId, versao }, opcoes = {}) {
  return executar('reatribuirOrdem', tx => {
    const o = tx.exigir('ordens', ordemId);
    exigirGestor(tx, o.empresaId);
    tx.exigirVersao(o, versao);
    if (o.estado !== 'agendada') throw falhar('TRANSICAO_INVALIDA', 'Só é possível reatribuir ordens agendadas.');
    const p = tx.exigir('profissionais', profissionalId);
    const oc = ocupacaoDe(tx.estado, o.ocupacaoId);
    const empresa = empresaDe(tx.estado, o.empresaId);
    const v = verificarProfissional({ profissional: p, empresa, servico: servicoDe(tx.estado, o.servicoId), inicio: emMs(o.inicio), fim: emMs(o.fim), ocupacoes: contextoEmpresa(tx.estado, o.empresaId).ocupacoes, agora: tx.agora, ignorar: oc ? [oc.id] : [] });
    if (!v.livre) throw falhar('HORARIO_INDISPONIVEL', `${p.curto} não está disponível neste horário (${MOTIVOS[v.motivo].toLowerCase()}).`);
    if (oc) tx.alterar('ocupacoes', oc, { profissionalId: p.id, pendente: false });
    tx.alterar('ordens', o, { profissionalId: p.id, historico: [...o.historico, linha(tx, `Reatribuída para ${p.curto}.`)] });
    if (p.usuarioId) tx.notificar(p.usuarioId, { titulo: 'Atendimento atribuído', texto: `${o.id} · ${formatarDataHora(o.inicio, empresa.fuso)}`, href: '#/empresas/ordens/' + o.id, icone: 'calendar-check' });
    return ok();
  }, opcoes);
}

/** Cancelamento pela empresa (com justificativa): libera o horário e encerra a solicitação vinculada. */
export function cancelarOrdem({ ordemId, justificativa, versao }, opcoes = {}) {
  return executar('cancelarOrdem', tx => {
    const o = tx.exigir('ordens', ordemId);
    exigirGestor(tx, o.empresaId);
    tx.exigirVersao(o, versao);
    const j = String(justificativa || '').trim();
    if (j.length < 10) throw falhar('VALIDACAO', 'Informe a justificativa (mínimo de 10 caracteres).', { campos: { justificativa: 'Informe a justificativa (mínimo de 10 caracteres).' } });
    mudar(o, 'cancelada');
    tx.alterar('ordens', o, { estado: 'cancelada', historico: [...o.historico, linha(tx, `Cancelada pela empresa. Motivo: ${j}`)] });
    liberarNoTx(tx, ocupacaoDe(tx.estado, o.ocupacaoId), 'Cancelada pela empresa');
    if (o.solicitacaoId) {
      const s = tx.get('solicitacoes', o.solicitacaoId);
      if (s && s.estado === 'aceita') {
        if (s.reagendamento) liberarNoTx(tx, ocupacaoDe(tx.estado, s.reagendamento.ocupacaoId), 'Cancelamento');
        tx.alterar('solicitacoes', s, { estado: 'cancelada', reagendamento: null, motivoEncerramento: j, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Atendimento cancelado pela empresa. Horário liberado. Motivo: ${j}`)] });
      }
    }
    if (o.clienteId) { tx.notificar(o.clienteId, { titulo: 'Atendimento cancelado', texto: o.id, href: '#/clientes/solicitacoes/' + (o.solicitacaoId || ''), icone: 'prohibit' }); tx.email(o.clienteId, 'Atendimento cancelado'); }
    return ok();
  }, opcoes);
}

// ---------- Leituras ----------
function visao(e, o) {
  const p = profissionalDe(e, o.profissionalId);
  const s = servicoDe(e, o.servicoId);
  const emp = empresaDe(e, o.empresaId);
  const oc = ocupacaoDe(e, o.ocupacaoId);
  return { ...o, profissionalNome: p ? p.nome : 'A reatribuir', profissionalCurto: p ? p.curto : 'A reatribuir', servicoNome: s ? s.nome : '—', fuso: emp.fuso, empresaNome: emp.nome, empresaTelefone: emp.contatoPublico.telefone, pendente: Boolean(oc && (oc.pendente || !oc.profissionalId)) };
}

/** Ordens visíveis ao usuário: gestor vê as da empresa; técnico apenas as atribuídas. */
export function ordensVisiveis(usuario, empresaId) {
  const v = vinculoEmpresa(usuario, empresaId);
  if (!v) return [];
  const e = ler();
  return e.ordens.filter(o => o.empresaId === empresaId && (v.papel === 'gestor' || o.profissionalId === v.profissionalId)).map(o => visao(e, o)).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}

export function ordemVisivel(usuario, empresaId, id) {
  return ordensVisiveis(usuario, empresaId).find(o => o.id === id) || null;
}

/** Profissionais para reatribuição, com disponibilidade no horário da ordem. */
export function candidatosOrdem(usuario, empresaId, ordemId, t = agora()) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  const e = ler();
  const o = e.ordens.find(x => x.id === ordemId && x.empresaId === empresaId);
  if (!o) return [];
  const c = contextoEmpresa(e, empresaId);
  const servico = servicoDe(e, o.servicoId);
  return c.profissionais.filter(p => p.situacao === 'ativo' && p.id !== o.profissionalId).map(p => {
    const v = verificarProfissional({ profissional: p, empresa: c.empresa, servico, inicio: emMs(o.inicio), fim: emMs(o.fim), ocupacoes: c.ocupacoes, agora: t, ignorar: o.ocupacaoId ? [o.ocupacaoId] : [] });
    return { id: p.id, nome: p.curto, livre: v.livre, motivo: v.livre ? 'disponível' : MOTIVOS[v.motivo].toLowerCase() };
  });
}

/** Retornos previstos (ordens concluídas com próximo retorno). */
export function retornosPrevistos(usuario, empresaId) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  const e = ler();
  return e.ordens.filter(o => o.empresaId === empresaId && o.estado === 'concluida' && o.proximoRetorno).map(o => visao(e, o)).sort((a, b) => a.proximoRetorno.localeCompare(b.proximoRetorno));
}
