// Solicitações, propostas, confirmação, recusa, ajuste, cancelamento e reagendamento.
import { ok, falhar, ler } from './db.js';
import { executar, exigirGestor, empresaDe, servicoDe, profissionalDe, ocupacaoDe, ordemDe, gestoresDa, linha, estadoOcupacao } from './comum.js';
import { reservarNoTx, confirmarNoTx, liberarNoTx, calcularAlternativas, registrarConflito, contextoEmpresa } from './agenda.js';
import { agora } from './clock.js';
import { transitar } from '../domain/estados.js';
import { verificarProfissional, fimDoServico, ocupacaoAtiva, MOTIVOS, escolherProfissional } from '../domain/agenda.js';
import { prazoReserva, prazoReagendamento, podeReagendar, resolverReagendamento, avaliarCancelamento } from '../domain/reservas.js';
import { validarSolicitacao, validarProposta, nomeCurto } from '../domain/validacao.js';
import { pode, vinculoEmpresa } from '../domain/permissoes.js';
import { formatarDataHora, formatarIntervalo, formatarPrazo, emMs, HORA, dataLocal, proximosDias, paraUtc, minParaHm } from '../domain/datas.js';
import { rotuloTotal, explicacaoPreco } from '../domain/dinheiro.js';

const iso = ms => new Date(ms).toISOString();

function mudarEstado(tx, s, para) {
  const t = transitar('solicitacao', s.estado, para);
  if (!t.ok) throw falhar(t.code, t.message);
  s.estado = para;
}

function textoEquipamento(estado, r, clienteId) {
  if (r.equipamentoModo === 'salvo') {
    const e = estado.equipamentos.find(x => x.id === r.equipamentoId && x.clienteId === clienteId);
    if (!e) throw falhar('VALIDACAO', 'Revise os dados da solicitação.', { campos: { equipamentoId: 'Escolha um equipamento cadastrado.' } });
    return [e.tipo, e.capacidade, e.marca].filter(Boolean).join(' ') + (e.local ? ' · ' + e.local : '');
  }
  return [r.equipTipo, r.equipCapacidade, r.equipMarca].filter(x => String(x || '').trim()).map(x => x.trim()).join(' ') + (String(r.equipLocal || '').trim() ? ' · ' + r.equipLocal.trim() : '');
}

function localDe(estado, r, clienteId) {
  if (r.localModo === 'salvo') {
    const e = estado.enderecos.find(x => x.id === r.enderecoId && x.clienteId === clienteId);
    if (!e) throw falhar('VALIDACAO', 'Revise os dados da solicitação.', { campos: { enderecoId: 'Escolha um endereço salvo.' } });
    return { rotulo: e.rotulo, bairro: e.bairro, cidade: e.cidade, referencia: e.referencia || '' };
  }
  return { rotulo: (r.localRotulo || 'Casa').trim(), bairro: r.bairro.trim(), cidade: r.cidade.trim(), referencia: (r.referencia || '').trim() };
}

function notificarGestores(tx, empresaId, n) {
  for (const g of gestoresDa(tx.estado, empresaId)) { tx.notificar(g.id, n); tx.email(g.id, n.titulo); }
}

/**
 * Envia uma solicitação. Com horário: o servidor tenta criar a reserva temporária na mesma transação.
 * Sucesso só é devolvido após a gravação. Idempotente pela chave da tentativa.
 */
export async function criarSolicitacao(rascunho, { idempotencyKey, ...opcoes } = {}) {
  const r = await executar('criarSolicitacao', tx => {
    const ator = tx.exigirAtor();
    if (!pode(ator, 'solicitacao.enviar')) throw falhar('ACESSO_NEGADO', 'Entre com uma conta de cliente para enviar a solicitação.');
    const empresa = tx.estado.empresas.find(e => e.slug === rascunho.empresaSlug);
    if (!empresa || empresa.situacao !== 'ativa') throw falhar('EMPRESA_INDISPONIVEL', 'Esta empresa não está recebendo novas solicitações no momento.');
    const servico = servicoDe(tx.estado, rascunho.servicoId);
    if (!servico || servico.empresaId !== empresa.id || servico.situacao !== 'ativo') throw falhar('SERVICO_INDISPONIVEL', 'Este serviço foi desativado pela empresa e não está disponível para solicitação.');
    const v = validarSolicitacao(rascunho);
    if (!v.ok) throw falhar('VALIDACAO', 'Revise os dados da solicitação.', { campos: v.erros });
    const id = 'SOL-' + tx.seq('sol');
    let ocupacao = null;
    if (!rascunho.semHorario) {
      ocupacao = reservarNoTx(tx, { empresaId: empresa.id, servicoId: servico.id, inicio: rascunho.inicio, solicitacaoId: id, expiraEm: prazoReserva(tx.agora, empresa.validadeReservaH, rascunho.inicio) });
    }
    const s = tx.inserir('solicitacoes', {
      id, empresaId: empresa.id, clienteId: ator.id, clienteNome: nomeCurto(ator.nome), servicoId: servico.id,
      equipamento: textoEquipamento(tx.estado, rascunho, ator.id), local: localDe(tx.estado, rascunho, ator.id), descricao: rascunho.descricao.trim(),
      inicioDesejado: ocupacao ? ocupacao.inicio : null, estado: 'enviada', ocupacaoId: ocupacao ? ocupacao.id : null, ordemId: null, proposta: null,
      reagendamento: null, ajuste: '', motivoEncerramento: '', criadaEm: iso(tx.agora),
      linhaDoTempo: [linha(tx, ocupacao ? `Solicitação enviada. Reserva temporária criada até ${formatarPrazo(ocupacao.expiraEm, empresa.fuso)}.` : 'Solicitação enviada sem horário definido.')]
    });
    notificarGestores(tx, empresa.id, { titulo: 'Nova solicitação', texto: `${id} · ${servico.nome}`, href: '#/empresas/solicitacoes/' + id, icone: 'paper-plane-tilt' });
    return ok({ id: s.id, empresaNome: empresa.nome, inicio: ocupacao ? ocupacao.inicio : null, expiraEm: ocupacao ? ocupacao.expiraEm : null, fuso: empresa.fuso });
  }, { ...opcoes, idempotencyKey });
  if (!r.ok && r.code === 'HORARIO_INDISPONIVEL') {
    const emp = ler().empresas.find(e => e.slug === rascunho.empresaSlug);
    if (emp) await registrarConflito({ empresaId: emp.id, inicio: rascunho.inicio, origem: 'Envio de solicitação: horário ocupado por operação concorrente. Nada foi gravado.' });
  }
  return r;
}

/** Empresa inicia a análise (ao abrir uma solicitação recém-chegada). */
export function iniciarAnalise({ solicitacaoId }, opcoes = {}) {
  return executar('iniciarAnalise', tx => {
    const s = tx.exigir('solicitacoes', solicitacaoId);
    const ator = exigirGestor(tx, s.empresaId);
    if (s.estado !== 'enviada') return ok({ semMudanca: true });
    mudarEstado(tx, s, 'em_analise');
    tx.alterar('solicitacoes', s, { linhaDoTempo: [...s.linhaDoTempo, linha(tx, `${nomeCurto(ator.nome)} iniciou a análise.`)] });
    return ok();
  }, { semAtraso: true, falhavel: false, ...opcoes });
}

/** Empresa envia a proposta: revalida o profissional no horário e move/cria a reserva temporária até a validade. */
export function enviarProposta(d, opcoes = {}) {
  return executar('enviarProposta', tx => {
    const s = tx.exigir('solicitacoes', d.solicitacaoId);
    exigirGestor(tx, s.empresaId);
    tx.exigirVersao(s, d.versao);
    if (!['enviada', 'em_analise'].includes(s.estado)) throw falhar('TRANSICAO_INVALIDA', 'Esta solicitação não aceita uma nova proposta na situação atual.');
    const empresa = empresaDe(tx.estado, s.empresaId);
    const servico = servicoDe(tx.estado, s.servicoId);
    const inicio = d.inicio ? emMs(d.inicio) : null;
    const validadeEm = tx.agora + Number(d.validadeHoras || 48) * HORA;
    const erros = validarProposta({ itens: d.itens || [], inicio, validadeEm, agora: tx.agora, profissionalId: d.profissionalId });
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise a proposta antes de enviar.', { campos: erros });
    const prof = profissionalDe(tx.estado, d.profissionalId);
    if (!prof || prof.empresaId !== s.empresaId) throw falhar('VALIDACAO', 'Revise a proposta antes de enviar.', { campos: { profissionalId: 'Profissional inválido.' } });
    const fim = fimDoServico(inicio, servico);
    const atual = ocupacaoDe(tx.estado, s.ocupacaoId);
    const ignorar = atual ? [atual.id] : [];
    const v = verificarProfissional({ profissional: prof, empresa, servico, inicio, fim, ocupacoes: contextoEmpresa(tx.estado, s.empresaId).ocupacoes, agora: tx.agora, ignorar });
    if (!v.livre) throw falhar('HORARIO_INDISPONIVEL', `${prof.curto} não está livre em ${formatarDataHora(inicio, empresa.fuso)} (${MOTIVOS[v.motivo].toLowerCase()}). Escolha outro profissional ou horário.`);
    let ocupacaoId;
    if (atual && atual.estado === 'temporaria' && ocupacaoAtiva(atual, tx.agora)) {
      tx.alterar('ocupacoes', atual, { profissionalId: prof.id, inicio: iso(inicio), fim: iso(fim), expiraEm: iso(validadeEm) });
      ocupacaoId = atual.id;
    } else {
      if (atual) liberarNoTx(tx, atual, 'Substituída pela reserva da proposta');
      ocupacaoId = tx.inserir('ocupacoes', { id: tx.id('OC'), empresaId: s.empresaId, profissionalId: prof.id, inicio: iso(inicio), fim: iso(fim), estado: 'temporaria', expiraEm: iso(validadeEm), solicitacaoId: s.id, ordemId: null, motivo: '', rotulo: '', pendente: false }).id;
      tx.auditar({ entidade: `Reserva ${ocupacaoId} · ${formatarDataHora(inicio, empresa.fuso)}`, acao: 'Reserva temporária criada', tipo: 'reserva', empresaId: s.empresaId });
    }
    const itens = d.itens.filter(i => String(i.descricao || '').trim()).map(i => ({ descricao: i.descricao.trim(), valorCentavos: i.valorCentavos ?? null, opcional: Boolean(i.opcional) }));
    mudarEstado(tx, s, 'proposta');
    tx.alterar('solicitacoes', s, {
      ocupacaoId, ajuste: '',
      proposta: { profissionalId: prof.id, inicio: iso(inicio), fim: iso(fim), validadeEm: iso(validadeEm), enviadaEm: iso(tx.agora), itens, condicoes: (d.condicoes || '').trim(), observacoes: (d.observacoes || '').trim() },
      linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Proposta enviada com ${prof.curto}. Validade até ${formatarPrazo(validadeEm, empresa.fuso)}.`)]
    });
    tx.notificar(s.clienteId, { titulo: 'Proposta recebida', texto: `${s.id} · ${empresa.nome}`, href: '#/clientes/solicitacoes/' + s.id, icone: 'file-text' });
    tx.email(s.clienteId, 'Proposta recebida');
    return ok({ ocupacaoId, validadeEm: iso(validadeEm) });
  }, opcoes);
}

/** Cliente confirma: revalida o horário e converte a reserva em confirmada, criando a ordem de serviço. */
export async function confirmarProposta({ solicitacaoId, versao, idempotencyKey }, opcoes = {}) {
  const r = await executar('confirmarProposta', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!pode(ator, 'proposta.decidir', { clienteId: s.clienteId })) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    if (s.estado !== 'proposta' || !s.proposta) throw falhar('TRANSICAO_INVALIDA', 'Esta proposta não está mais aguardando confirmação.');
    if (emMs(s.proposta.validadeEm) <= tx.agora) throw falhar('PROPOSTA_EXPIRADA', 'A proposta venceu e não pode mais ser confirmada. Você pode pedir uma nova proposta.');
    const empresa = empresaDe(tx.estado, s.empresaId);
    const o = ocupacaoDe(tx.estado, s.ocupacaoId);
    if (!o) throw falhar('HORARIO_INDISPONIVEL', 'O horário deixou de estar reservado. Nada foi confirmado.');
    tx.get('ocupacoes', o.id);
    try {
      confirmarNoTx(tx, o);
    } catch (e) {
      if (e.resultado) e.resultado.details = { ...(e.resultado.details || {}), alternativas: calcularAlternativas(tx.estado, { empresaId: s.empresaId, servicoId: s.servicoId, inicio: o.inicio, t: tx.agora }) };
      throw e;
    }
    const ordemId = 'OS-' + tx.seq('os');
    const prof = profissionalDe(tx.estado, o.profissionalId);
    tx.inserir('ordens', {
      id: ordemId, empresaId: s.empresaId, ocupacaoId: o.id, profissionalId: o.profissionalId, servicoId: s.servicoId, clienteNome: s.clienteNome, clienteId: s.clienteId,
      solicitacaoId: s.id, equipamento: s.equipamento, relato: s.descricao, observacoes: '', trabalho: '', proximoRetorno: '', estado: 'agendada', inicio: o.inicio, fim: o.fim,
      historico: [linha(tx, `Criada a partir de ${s.id} após confirmação do cliente.`)]
    });
    tx.alterar('ocupacoes', o, { ordemId });
    mudarEstado(tx, s, 'aceita');
    tx.alterar('solicitacoes', s, { ordemId, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Proposta confirmada. Horário revalidado e agendamento confirmado: ${formatarIntervalo(o.inicio, o.fim, empresa.fuso)}.`)] });
    notificarGestores(tx, s.empresaId, { titulo: 'Proposta confirmada', texto: `${s.id} · ordem ${ordemId} criada`, href: '#/empresas/ordens/' + ordemId, icone: 'calendar-check' });
    if (prof && prof.usuarioId) tx.notificar(prof.usuarioId, { titulo: 'Atendimento atribuído', texto: `${ordemId} · ${formatarDataHora(o.inicio, empresa.fuso)}`, href: '#/empresas/ordens/' + ordemId, icone: 'calendar-check' });
    tx.email(s.clienteId, 'Agendamento confirmado');
    return ok({ ordemId, inicio: o.inicio, fim: o.fim });
  }, { ...opcoes, idempotencyKey });
  if (!r.ok && r.code === 'HORARIO_INDISPONIVEL') {
    const s = ler().solicitacoes.find(x => x.id === solicitacaoId);
    if (s) await registrarConflito({ empresaId: s.empresaId, inicio: s.proposta ? s.proposta.inicio : agora(), origem: 'Confirmação de proposta: horário ocupado na revalidação. Nada foi confirmado.' });
  }
  return r;
}

export function recusarProposta({ solicitacaoId, motivo, versao }, opcoes = {}) {
  return executar('recusarProposta', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!pode(ator, 'proposta.decidir', { clienteId: s.clienteId })) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    mudarEstado(tx, s, 'recusada');
    liberarNoTx(tx, ocupacaoDe(tx.estado, s.ocupacaoId), 'Proposta recusada pelo cliente');
    const m = String(motivo || '').trim();
    tx.alterar('solicitacoes', s, { motivoEncerramento: m, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Proposta recusada. Horário liberado.' + (m ? ' Motivo: ' + m : ''))] });
    notificarGestores(tx, s.empresaId, { titulo: 'Proposta recusada', texto: `${s.id} · horário liberado`, href: '#/empresas/solicitacoes/' + s.id, icone: 'x-circle' });
    return ok();
  }, opcoes);
}

export function pedirAjuste({ solicitacaoId, texto, versao }, opcoes = {}) {
  return executar('pedirAjuste', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!pode(ator, 'proposta.decidir', { clienteId: s.clienteId })) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    const t = String(texto || '').trim();
    if (!t) throw falhar('VALIDACAO', 'Descreva o ajuste desejado.', { campos: { texto: 'Descreva o ajuste desejado.' } });
    mudarEstado(tx, s, 'em_analise');
    tx.alterar('solicitacoes', s, { ajuste: t, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Ajuste solicitado: ${t}. Reserva temporária mantida até a validade.`)] });
    notificarGestores(tx, s.empresaId, { titulo: 'Ajuste solicitado', texto: `${s.id} · revise a proposta`, href: '#/empresas/solicitacoes/' + s.id, icone: 'note-pencil' });
    return ok();
  }, opcoes);
}

export function pedirNovaProposta({ solicitacaoId, versao }, opcoes = {}) {
  return executar('pedirNovaProposta', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!pode(ator, 'proposta.decidir', { clienteId: s.clienteId })) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    mudarEstado(tx, s, 'enviada');
    tx.alterar('solicitacoes', s, { ocupacaoId: null, inicioDesejado: null, propostaAnterior: s.proposta, proposta: null, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Nova proposta solicitada. Sem horário reservado até a resposta da empresa.')] });
    notificarGestores(tx, s.empresaId, { titulo: 'Nova proposta solicitada', texto: `${s.id}`, href: '#/empresas/solicitacoes/' + s.id, icone: 'paper-plane-tilt' });
    return ok();
  }, opcoes);
}

/** Após conflito na confirmação: pede outro horário, reservando-o temporariamente (dados mantidos). */
export function pedirOutroHorario({ solicitacaoId, inicio, versao, idempotencyKey }, opcoes = {}) {
  return executar('pedirOutroHorario', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!pode(ator, 'proposta.decidir', { clienteId: s.clienteId })) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    const empresa = empresaDe(tx.estado, s.empresaId);
    liberarNoTx(tx, ocupacaoDe(tx.estado, s.ocupacaoId), 'Horário indisponível na confirmação');
    const o = reservarNoTx(tx, { empresaId: s.empresaId, servicoId: s.servicoId, inicio, solicitacaoId: s.id, expiraEm: prazoReserva(tx.agora, empresa.validadeReservaH, inicio) });
    mudarEstado(tx, s, 'em_analise');
    tx.alterar('solicitacoes', s, { ocupacaoId: o.id, inicioDesejado: o.inicio, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Horário proposto ficou indisponível na confirmação. Novo horário solicitado: ${formatarDataHora(o.inicio, empresa.fuso)}. Dados mantidos.`)] });
    notificarGestores(tx, s.empresaId, { titulo: 'Novo horário solicitado', texto: `${s.id} · ${formatarDataHora(o.inicio, empresa.fuso)}`, href: '#/empresas/solicitacoes/' + s.id, icone: 'calendar-plus' });
    return ok({ inicio: o.inicio });
  }, { ...opcoes, idempotencyKey });
}

/** Empresa recusa a solicitação (motivo opcional) e libera o horário. */
export function recusarSolicitacao({ solicitacaoId, motivo, versao }, opcoes = {}) {
  return executar('recusarSolicitacao', tx => {
    const s = tx.exigir('solicitacoes', solicitacaoId);
    exigirGestor(tx, s.empresaId);
    tx.exigirVersao(s, versao);
    if (!['enviada', 'em_analise', 'proposta'].includes(s.estado)) throw falhar('TRANSICAO_INVALIDA', 'Esta solicitação já foi encerrada.');
    mudarEstado(tx, s, 'recusada');
    liberarNoTx(tx, ocupacaoDe(tx.estado, s.ocupacaoId), 'Solicitação recusada pela empresa');
    const m = String(motivo || '').trim();
    tx.alterar('solicitacoes', s, { motivoEncerramento: m, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Solicitação recusada pela empresa. Reserva liberada.' + (m ? ' Motivo: ' + m : ''))] });
    tx.notificar(s.clienteId, { titulo: 'Solicitação recusada', texto: `${s.id} · horário liberado`, href: '#/clientes/solicitacoes/' + s.id, icone: 'x-circle' });
    tx.email(s.clienteId, 'Solicitação recusada');
    return ok();
  }, opcoes);
}

/** Cancelamento pelo cliente (próprio) ou pela empresa, seguindo a política demonstrativa. */
export function cancelarSolicitacao({ solicitacaoId, motivo, versao }, opcoes = {}) {
  return executar('cancelarSolicitacao', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    const doCliente = s.clienteId === ator.id;
    const daEmpresa = (vinculoEmpresa(ator, s.empresaId) || {}).papel === 'gestor';
    if (!doCliente && !daEmpresa) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    const empresa = empresaDe(tx.estado, s.empresaId);
    const m = String(motivo || '').trim();
    let nota = '';
    if (s.estado === 'aceita') {
      const ordem = ordemDe(tx.estado, s.ordemId);
      if (!ordem || ordem.estado !== 'agendada') throw falhar('TRANSICAO_INVALIDA', 'O atendimento já foi iniciado ou concluído e não pode ser cancelado aqui.');
      const pol = avaliarCancelamento(ordem.inicio, tx.agora);
      nota = pol.semCusto ? ' Dentro do prazo de cancelamento sem custo.' : ' Fora do prazo de cancelamento sem custo: a empresa pode cobrar a visita conforme a proposta.';
      tx.alterar('ordens', ordem, { estado: 'cancelada', historico: [...ordem.historico, linha(tx, `Cancelada ${doCliente ? 'pelo cliente' : 'pela empresa'}.${m ? ' Motivo: ' + m : ''}`)] });
    }
    mudarEstado(tx, s, 'cancelada');
    liberarNoTx(tx, ocupacaoDe(tx.estado, s.ocupacaoId), doCliente ? 'Cancelada pelo cliente' : 'Cancelada pela empresa');
    if (s.reagendamento) liberarNoTx(tx, ocupacaoDe(tx.estado, s.reagendamento.ocupacaoId), 'Cancelamento');
    tx.alterar('solicitacoes', s, { reagendamento: null, motivoEncerramento: m, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Cancelada ${doCliente ? 'pelo cliente' : 'pela empresa'}. Horário liberado.${nota}${m ? ' Motivo: ' + m : ''}`)] });
    if (doCliente) notificarGestores(tx, s.empresaId, { titulo: 'Cancelamento', texto: `${s.id} · horário liberado`, href: '#/empresas/solicitacoes/' + s.id, icone: 'prohibit' });
    else tx.notificar(s.clienteId, { titulo: 'Cancelamento', texto: `${s.id} · ${empresa.nome}`, href: '#/clientes/solicitacoes/' + s.id, icone: 'prohibit' });
    return ok({ semCusto: !nota.includes('Fora') });
  }, opcoes);
}

/** Pedido de reagendamento: reserva temporariamente o novo horário; o original continua reservado. */
export function solicitarReagendamento({ solicitacaoId, inicio, motivo, idempotencyKey }, opcoes = {}) {
  return executar('solicitarReagendamento', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    const doCliente = s.clienteId === ator.id;
    const daEmpresa = (vinculoEmpresa(ator, s.empresaId) || {}).papel === 'gestor';
    if (!doCliente && !daEmpresa) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    const ordem = ordemDe(tx.estado, s.ordemId);
    const chk = podeReagendar(s, ordem, inicio, tx.agora);
    if (!chk.ok) throw falhar(chk.code, chk.message);
    const empresa = empresaDe(tx.estado, s.empresaId);
    const original = ocupacaoDe(tx.estado, s.ocupacaoId);
    const prazo = prazoReagendamento(tx.agora, inicio);
    const novo = reservarNoTx(tx, { empresaId: s.empresaId, servicoId: s.servicoId, inicio, solicitacaoId: s.id, expiraEm: prazo, preferidoId: original ? original.profissionalId : null });
    tx.alterar('solicitacoes', s, {
      reagendamento: { novoInicio: novo.inicio, novoFim: novo.fim, ocupacaoId: novo.id, prazo: iso(prazo), origem: doCliente ? 'cliente' : 'empresa', motivo: String(motivo || '').trim(), solicitadoEm: iso(tx.agora) },
      linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Reagendamento ${doCliente ? 'solicitado pelo cliente' : 'proposto pela empresa'} para ${formatarDataHora(novo.inicio, empresa.fuso)}. Horário atual mantido até a confirmação.`)]
    });
    if (doCliente) notificarGestores(tx, s.empresaId, { titulo: 'Pedido de reagendamento', texto: `${s.id} · responder até ${formatarPrazo(prazo, empresa.fuso)}`, href: '#/empresas/solicitacoes/' + s.id, icone: 'calendar-plus' });
    else { tx.notificar(s.clienteId, { titulo: 'Reagendamento proposto', texto: `${s.id} · responder até ${formatarPrazo(prazo, empresa.fuso)}`, href: '#/clientes/solicitacoes/' + s.id, icone: 'calendar-plus' }); tx.email(s.clienteId, 'Reagendamento proposto'); }
    return ok({ prazo: iso(prazo), novoInicio: novo.inicio });
  }, { ...opcoes, idempotencyKey });
}

/** Resposta ao reagendamento pela outra parte. Aceito: novo confirmado e original liberado; recusado: original mantido. */
export function responderReagendamento({ solicitacaoId, aceitar, versao }, opcoes = {}) {
  return executar('responderReagendamento', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!s.reagendamento) throw falhar('TRANSICAO_INVALIDA', 'Não há pedido de reagendamento pendente.');
    const rg = s.reagendamento;
    const autorizado = rg.origem === 'cliente' ? (vinculoEmpresa(ator, s.empresaId) || {}).papel === 'gestor' : s.clienteId === ator.id;
    if (!autorizado) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    const empresa = empresaDe(tx.estado, s.empresaId);
    const original = ocupacaoDe(tx.estado, s.ocupacaoId);
    const novo = ocupacaoDe(tx.estado, rg.ocupacaoId);
    let novoValido = Boolean(novo && novo.estado === 'temporaria' && ocupacaoAtiva(novo, tx.agora));
    if (aceitar && novoValido) {
      const prof = profissionalDe(tx.estado, novo.profissionalId);
      novoValido = verificarProfissional({ profissional: prof, empresa, inicio: emMs(novo.inicio), fim: emMs(novo.fim), ocupacoes: contextoEmpresa(tx.estado, s.empresaId).ocupacoes, agora: tx.agora, ignorar: [novo.id, original ? original.id : ''] }).livre;
    }
    const res = resolverReagendamento({ original, novo, aceito: Boolean(aceitar), novoAindaValido: novoValido });
    if (!res.ok) throw falhar(res.code, res.message);
    const anterior = original ? formatarDataHora(original.inicio, empresa.fuso) : '';
    if (res.novo === 'confirmada') {
      tx.alterar('ocupacoes', novo, { estado: 'confirmada', expiraEm: null, ordemId: s.ordemId });
      tx.auditar({ entidade: `Reserva ${novo.id} · ${formatarDataHora(novo.inicio, empresa.fuso)}`, acao: 'Reserva confirmada (reagendamento)', tipo: 'reserva', empresaId: s.empresaId });
      liberarNoTx(tx, original, 'Reagendamento confirmado');
      const ordem = ordemDe(tx.estado, s.ordemId);
      if (ordem) tx.alterar('ordens', ordem, { ocupacaoId: novo.id, inicio: novo.inicio, fim: novo.fim, profissionalId: novo.profissionalId, historico: [...ordem.historico, linha(tx, `Reagendada para ${formatarIntervalo(novo.inicio, novo.fim, empresa.fuso)}. Horário anterior (${anterior}) liberado.`)] });
      tx.alterar('solicitacoes', s, { ocupacaoId: novo.id, reagendamento: null, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Reagendamento confirmado. Novo horário: ${formatarDataHora(novo.inicio, empresa.fuso)}. Horário anterior (${anterior}) liberado.`)] });
    } else {
      liberarNoTx(tx, novo, 'Reagendamento recusado');
      tx.alterar('solicitacoes', s, { reagendamento: null, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Pedido de reagendamento recusado. Horário original mantido.')] });
    }
    const destino = rg.origem === 'cliente' ? s.clienteId : null;
    if (destino) { tx.notificar(destino, { titulo: aceitar ? 'Reagendamento confirmado' : 'Reagendamento recusado', texto: `${s.id} · ${aceitar ? 'novo horário confirmado' : 'horário original mantido'}`, href: '#/clientes/solicitacoes/' + s.id, icone: 'calendar-check' }); tx.email(destino, aceitar ? 'Reagendamento confirmado' : 'Reagendamento recusado'); }
    else notificarGestores(tx, s.empresaId, { titulo: aceitar ? 'Cliente aceitou o novo horário' : 'Cliente recusou o novo horário', texto: s.id, href: '#/empresas/solicitacoes/' + s.id, icone: 'calendar-check' });
    return ok({ aceito: Boolean(aceitar) });
  }, opcoes);
}

/** Quem pediu o reagendamento pode retirar o pedido (original mantido). */
export function retirarReagendamento({ solicitacaoId, versao }, opcoes = {}) {
  return executar('retirarReagendamento', tx => {
    const ator = tx.exigirAtor();
    const s = tx.exigir('solicitacoes', solicitacaoId);
    if (!s.reagendamento) throw falhar('TRANSICAO_INVALIDA', 'Não há pedido de reagendamento pendente.');
    const autorizado = s.reagendamento.origem === 'cliente' ? s.clienteId === ator.id : (vinculoEmpresa(ator, s.empresaId) || {}).papel === 'gestor';
    if (!autorizado) throw falhar('NAO_ENCONTRADO', 'Solicitação não encontrada nesta conta.');
    tx.exigirVersao(s, versao);
    liberarNoTx(tx, ocupacaoDe(tx.estado, s.reagendamento.ocupacaoId), 'Pedido de reagendamento retirado');
    tx.alterar('solicitacoes', s, { reagendamento: null, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Pedido de reagendamento retirado. Horário original mantido.')] });
    return ok();
  }, opcoes);
}

// ---------- Leituras ----------

function visao(estado, s, t) {
  const empresa = empresaDe(estado, s.empresaId);
  const servico = servicoDe(estado, s.servicoId);
  const o = ocupacaoDe(estado, s.ocupacaoId);
  const ordem = ordemDe(estado, s.ordemId);
  const prof = s.proposta ? profissionalDe(estado, s.proposta.profissionalId) : null;
  const profAtual = ordem ? profissionalDe(estado, ordem.profissionalId) : o ? profissionalDe(estado, o.profissionalId) : null;
  const inicio = ordem ? ordem.inicio : o ? o.inicio : s.inicioDesejado;
  const rg = s.reagendamento;
  return {
    ...s,
    empresaNome: empresa ? empresa.nome : '—', empresaSlug: empresa ? empresa.slug : '', fuso: empresa ? empresa.fuso : 'America/Cuiaba',
    servicoNome: servico ? servico.nome : '—', duracaoMin: servico ? servico.duracaoMin : 0, precoTexto: servico ? explicacaoPreco(servico) : '',
    estadoOcupacao: estadoOcupacao(o, t), expiraEm: o && o.estado === 'temporaria' ? o.expiraEm : null,
    estadoExecucao: ordem ? ordem.estado : 'aguardando', ordem,
    inicio, fim: ordem ? ordem.fim : o ? o.fim : null,
    propostaVencida: Boolean(s.proposta && emMs(s.proposta.validadeEm) <= t),
    propostaProfissional: prof ? prof.curto : '', profissionalAtual: profAtual ? profAtual.curto : '', totalTexto: s.proposta ? rotuloTotal(s.proposta.itens) : '',
    reagendamentoPendente: Boolean(rg)
  };
}

/** Solicitações do cliente atual. */
export function minhasSolicitacoes(usuario, t = agora()) {
  if (!usuario) return [];
  const e = ler();
  return e.solicitacoes.filter(s => s.clienteId === usuario.id).map(s => visao(e, s, t)).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}
export function minhaSolicitacao(usuario, id, t = agora()) {
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === id);
  if (!usuario || !s || s.clienteId !== usuario.id) return null;
  return visao(e, s, t);
}

/** Solicitações da empresa (isolamento: apenas da empresa do vínculo de gestão). */
export function solicitacoesDaEmpresa(usuario, empresaId, t = agora()) {
  if (!pode(usuario, 'proposta.emitir', { empresaId })) return [];
  const e = ler();
  return e.solicitacoes.filter(s => s.empresaId === empresaId).map(s => visao(e, s, t)).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}
export function solicitacaoDaEmpresa(usuario, empresaId, id, t = agora()) {
  if (!pode(usuario, 'proposta.emitir', { empresaId })) return null;
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === id && x.empresaId === empresaId);
  return s ? visao(e, s, t) : null;
}

/** Profissionais candidatos para a proposta, com disponibilidade e elegibilidade no horário. */
export function candidatosProposta(usuario, empresaId, solicitacaoId, inicio, t = agora()) {
  if (!pode(usuario, 'proposta.emitir', { empresaId })) return [];
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === solicitacaoId && x.empresaId === empresaId);
  if (!s) return [];
  const c = contextoEmpresa(e, empresaId);
  const servico = servicoDe(e, s.servicoId);
  return c.profissionais.filter(p => p.situacao === 'ativo').map(p => {
    if (!p.servicos.includes(servico.id)) return { id: p.id, nome: p.curto, livre: false, motivo: MOTIVOS.NAO_EXECUTA };
    if (!inicio) return { id: p.id, nome: p.curto, livre: true, motivo: 'Executa o serviço' };
    const ini = emMs(inicio);
    const v = verificarProfissional({ profissional: p, empresa: c.empresa, servico, inicio: ini, fim: fimDoServico(ini, servico), ocupacoes: c.ocupacoes, agora: t, ignorar: s.ocupacaoId ? [s.ocupacaoId] : [] });
    let motivo = v.livre ? 'Disponível no horário' : MOTIVOS[v.motivo];
    if (!v.livre && v.conflito) {
      const ordem = ordemDe(e, v.conflito.ordemId);
      motivo += ' · ' + (ordem ? ordem.id : v.conflito.solicitacaoId || v.conflito.rotulo || 'reserva');
    }
    return { id: p.id, nome: p.curto, livre: v.livre, motivo };
  });
}

/** Horários livres de um profissional num dia (para a empresa propor outro horário). */
export function horariosDoProfissional(usuario, empresaId, solicitacaoId, profissionalId, data, t = agora()) {
  if (!pode(usuario, 'proposta.emitir', { empresaId })) return [];
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === solicitacaoId && x.empresaId === empresaId);
  const p = profissionalDe(e, profissionalId);
  if (!s || !p) return [];
  const c = contextoEmpresa(e, empresaId);
  const servico = servicoDe(e, s.servicoId);
  const out = [];
  for (let m = 7 * 60; m <= 18 * 60; m += 30) {
    const hora = minParaHm(m);
    const ini = paraUtc(data, hora, c.empresa.fuso);
    const v = verificarProfissional({ profissional: p, empresa: c.empresa, servico, inicio: ini, fim: fimDoServico(ini, servico), ocupacoes: c.ocupacoes, agora: t, ignorar: s.ocupacaoId ? [s.ocupacaoId] : [] });
    if (v.livre) out.push({ hora, inicio: iso(ini) });
  }
  return out;
}

/** Próximas datas para a empresa escolher outro horário. */
export function datasParaProposta(empresaId, t = agora()) {
  const e = ler();
  const emp = empresaDe(e, empresaId);
  return proximosDias(dataLocal(t, emp.fuso), 10);
}

/** Simulação: a empresa responde a solicitação com uma proposta padrão. */
export function simularEmpresaEnviaProposta(solicitacaoId) {
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === solicitacaoId);
  if (!s) return Promise.resolve({ ok: false, code: 'NAO_ENCONTRADO', message: 'Solicitação não encontrada.' });
  const gestor = gestoresDa(e, s.empresaId)[0];
  const servico = servicoDe(e, s.servicoId);
  const c = contextoEmpresa(e, s.empresaId);
  const t = agora();
  const o = ocupacaoDe(e, s.ocupacaoId);
  let inicio = o && ocupacaoAtiva(o, t) ? o.inicio : null;
  let profissionalId = o && ocupacaoAtiva(o, t) ? o.profissionalId : null;
  if (!inicio) {
    for (const d of proximosDias(dataLocal(t, c.empresa.fuso), 10)) {
      for (const hora of ['08:00', '10:00', '13:30', '15:00']) {
        const ini = paraUtc(d, hora, c.empresa.fuso);
        const p = escolherProfissional({ ...c, servico, inicio: ini, agora: t });
        if (p) { inicio = iso(ini); profissionalId = p.id; break; }
      }
      if (inicio) break;
    }
  }
  const validadeHoras = Math.max(1, Math.min(48, Math.floor((emMs(inicio) - t) / HORA) - 1));
  const valor = servico.tipoPreco === 'orcamento' ? (servico.visitaCentavos || 9000) : servico.precoCentavos;
  return enviarProposta({
    solicitacaoId, profissionalId, inicio, validadeHoras, versao: s.v,
    itens: [{ descricao: servico.nome + (servico.tipoPreco === 'orcamento' ? ' — visita técnica' : ''), valorCentavos: valor }],
    condicoes: 'Pagamento combinado diretamente com a empresa após o atendimento. A EloServ não processa pagamentos.',
    observacoes: 'Proposta simulada pelo painel de demonstração.'
  }, { ator: gestor ? gestor.id : null });
}

/** Simulação: o cliente confirma a proposta. */
export function simularClienteConfirma(solicitacaoId) {
  const s = ler().solicitacoes.find(x => x.id === solicitacaoId);
  if (!s) return Promise.resolve({ ok: false, code: 'NAO_ENCONTRADO', message: 'Solicitação não encontrada.' });
  return confirmarProposta({ solicitacaoId, versao: s.v, idempotencyKey: 'sim-' + solicitacaoId + '-' + s.v }, { ator: s.clienteId });
}

/** Simulação: a outra parte responde ao pedido de reagendamento. */
export function simularRespostaReagendamento(solicitacaoId, aceitar) {
  const e = ler();
  const s = e.solicitacoes.find(x => x.id === solicitacaoId);
  if (!s || !s.reagendamento) return Promise.resolve({ ok: false, code: 'TRANSICAO_INVALIDA', message: 'Não há pedido de reagendamento pendente.' });
  const ator = s.reagendamento.origem === 'cliente' ? (gestoresDa(e, s.empresaId)[0] || {}).id : s.clienteId;
  return responderReagendamento({ solicitacaoId, aceitar, versao: s.v }, { ator });
}

