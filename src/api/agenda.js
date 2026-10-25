// Agenda: disponibilidade, reservas temporárias, confirmação, liberação, expiração e bloqueios.
// Toda revalidação acontece DENTRO da transação, sobre o estado mais recente.
import { ok, falhar, ler, transacao } from './db.js';
import { executar, exigirGestor, empresaDe, servicoDe, profissionalDe, ocupacaoDe, ordemDe, gestoresDa, linha } from './comum.js';
import { agora } from './clock.js';
import {
  verificarProfissional, escolherProfissional, horariosDoDia, alternativasHorario, disponibilidadePorProfissional,
  conflitosDoBloqueio, sugerirJanelasBloqueio, ocupacaoAtiva, janelaDoDia, jornadaDe, fimDoServico, MOTIVOS
} from '../domain/agenda.js';
import { calcularExpiracoes, haExpiracoes } from '../domain/reservas.js';
import { paraUtc, dataLocal, proximosDias, horaLocal, formatarDataHora, emMs, minParaHm } from '../domain/datas.js';
import { validarBloqueio } from '../domain/validacao.js';
import { pode, vinculoEmpresa } from '../domain/permissoes.js';

const iso = ms => new Date(ms).toISOString();

export function contextoEmpresa(estado, empresaId) {
  return {
    empresa: empresaDe(estado, empresaId),
    profissionais: estado.profissionais.filter(p => p.empresaId === empresaId),
    ocupacoes: estado.ocupacoes.filter(o => o.empresaId === empresaId)
  };
}

/** Dias oferecidos para solicitação (próximos 10 dias, sem domingos). */
export function diasParaSolicitacao(t = agora(), empresa = null) {
  return proximosDias(dataLocal(t, empresa ? empresa.fuso : undefined), 10);
}

/** Alternativas de horário para mensagens de conflito. */
export function calcularAlternativas(estado, { empresaId, servicoId, inicio, t, excluir = [] }) {
  const c = contextoEmpresa(estado, empresaId);
  const servico = servicoDe(estado, servicoId);
  if (!c.empresa || !servico) return [];
  const base = dataLocal(inicio, c.empresa.fuso);
  const datas = [base, ...proximosDias(base, 4)].filter(d => d >= dataLocal(t, c.empresa.fuso));
  return alternativasHorario({ ...c, servico, datas, agora: t, desejado: emMs(inicio), excluir: [emMs(inicio), ...excluir] })
    .map(s => ({ inicio: iso(s.inicio), rotulo: formatarDataHora(s.inicio, c.empresa.fuso) }));
}

/**
 * Cria uma reserva temporária dentro de uma transação já aberta.
 * Escolhe um profissional elegível livre (considerando preparo) ou lança HORARIO_INDISPONIVEL com alternativas.
 */
export function reservarNoTx(tx, { empresaId, servicoId, inicio, expiraEm, solicitacaoId = null, preferidoId = null, extra = {} }) {
  const empresa = empresaDe(tx.estado, empresaId);
  if (!empresa || empresa.situacao !== 'ativa') throw falhar('EMPRESA_INDISPONIVEL', 'Esta empresa não está recebendo novas solicitações no momento.');
  const servico = servicoDe(tx.estado, servicoId);
  if (!servico || servico.empresaId !== empresaId || servico.situacao !== 'ativo') throw falhar('SERVICO_INDISPONIVEL', 'Este serviço foi desativado pela empresa e não está disponível para solicitação.');
  const ini = emMs(inicio);
  const c = contextoEmpresa(tx.estado, empresaId);
  const prof = escolherProfissional({ ...c, servico, inicio: ini, agora: tx.agora, preferidoId });
  if (!prof) {
    throw falhar('HORARIO_INDISPONIVEL', `O horário ${formatarDataHora(ini, empresa.fuso)} deixou de estar disponível. Nada foi reservado e seus dados foram mantidos.`,
      { alternativas: calcularAlternativas(tx.estado, { empresaId, servicoId, inicio: ini, t: tx.agora }), horario: iso(ini) });
  }
  const o = tx.inserir('ocupacoes', {
    id: tx.id('OC'), empresaId, profissionalId: prof.id, inicio: iso(ini), fim: iso(fimDoServico(ini, servico)), estado: 'temporaria',
    expiraEm: iso(emMs(expiraEm)), solicitacaoId, ordemId: null, motivo: '', rotulo: '', pendente: false, ...extra
  });
  tx.auditar({ entidade: `Reserva ${o.id} · ${formatarDataHora(ini, empresa.fuso)}`, acao: 'Reserva temporária criada', tipo: 'reserva', empresaId });
  return o;
}

/** Revalida e confirma uma reserva temporária dentro da transação. */
export function confirmarNoTx(tx, ocupacao) {
  const empresa = empresaDe(tx.estado, ocupacao.empresaId);
  if (ocupacao.estado !== 'temporaria' || !ocupacaoAtiva(ocupacao, tx.agora)) {
    throw falhar('HORARIO_INDISPONIVEL', 'O horário deixou de estar reservado (a reserva temporária expirou ou foi liberada). Nada foi confirmado.');
  }
  const prof = profissionalDe(tx.estado, ocupacao.profissionalId);
  const v = prof ? verificarProfissional({ profissional: prof, empresa, inicio: emMs(ocupacao.inicio), fim: emMs(ocupacao.fim), ocupacoes: contextoEmpresa(tx.estado, ocupacao.empresaId).ocupacoes, agora: tx.agora, ignorar: [ocupacao.id] }) : { livre: false, motivo: 'PROFISSIONAL_INDISPONIVEL' };
  if (!v.livre) {
    throw falhar('HORARIO_INDISPONIVEL', `${formatarDataHora(ocupacao.inicio, empresa.fuso)} foi ocupado por outra operação antes da sua confirmação. A proposta não foi confirmada e seus dados foram mantidos.`, { motivo: MOTIVOS[v.motivo] });
  }
  tx.alterar('ocupacoes', ocupacao, { estado: 'confirmada', expiraEm: null });
  tx.auditar({ entidade: `Reserva ${ocupacao.id} · ${formatarDataHora(ocupacao.inicio, empresa.fuso)}`, acao: 'Reserva confirmada', tipo: 'reserva', empresaId: ocupacao.empresaId });
  return ocupacao;
}

export function liberarNoTx(tx, ocupacao, motivo) {
  if (!ocupacao || ocupacao.estado === 'liberada') return;
  const empresa = empresaDe(tx.estado, ocupacao.empresaId);
  tx.alterar('ocupacoes', ocupacao, { estado: 'liberada', expiraEm: null, motivoLiberacao: motivo || '' });
  if (ocupacao.estado !== 'bloqueio') {
    tx.auditar({ entidade: `Reserva ${ocupacao.id} · ${formatarDataHora(ocupacao.inicio, empresa.fuso)}`, acao: 'Reserva liberada', tipo: 'reserva', justificativa: motivo || '', empresaId: ocupacao.empresaId });
  }
}

// ---------- Operações públicas da API de agenda ----------

/** Cria uma reserva temporária isolada (sem solicitação). Idempotente pela chave. */
export function criarReservaTemporaria({ empresaId, servicoId, inicio, idempotencyKey }, opcoes = {}) {
  return executar('criarReservaTemporaria', tx => {
    const empresa = empresaDe(tx.estado, empresaId);
    const o = reservarNoTx(tx, { empresaId, servicoId, inicio, expiraEm: tx.agora + (empresa ? empresa.validadeReservaH : 24) * 3600000, extra: opcoes.extra || {} });
    return ok({ reservaId: o.id, profissionalId: o.profissionalId, expiraEm: o.expiraEm });
  }, { ...opcoes, idempotencyKey });
}

export function confirmarReserva(reservaId, idempotencyKey, opcoes = {}) {
  return executar('confirmarReserva', tx => {
    const o = tx.exigir('ocupacoes', reservaId);
    confirmarNoTx(tx, o);
    return ok({ reservaId });
  }, { ...opcoes, idempotencyKey });
}

export function liberarReserva(reservaId, motivo, opcoes = {}) {
  return executar('liberarReserva', tx => {
    const o = tx.exigir('ocupacoes', reservaId);
    liberarNoTx(tx, o, motivo);
    return ok({ reservaId });
  }, opcoes);
}

/** Expira reservas temporárias, propostas, pedidos de reagendamento e convites vencidos. */
export async function expirarReservas(t = agora()) {
  const previa = calcularExpiracoes(ler(), t);
  if (!haExpiracoes(previa)) return ok({ alteradas: 0 });
  return transacao('expirarReservas', tx => {
    const e = calcularExpiracoes(tx.estado, tx.agora);
    if (!haExpiracoes(e)) return ok({ alteradas: 0 });
    const solExp = new Map(e.expirarSolicitacoes.map(x => [x.id, x.motivo]));
    for (const id of e.liberarOcupacoes) {
      const o = ocupacaoDe(tx.estado, id);
      if (o && o.estado === 'temporaria') liberarNoTx(tx, o, 'Expiração automática');
    }
    for (const [id, motivo] of solExp) {
      const s = tx.get('solicitacoes', id);
      if (!s) continue;
      const texto = motivo === 'proposta' ? 'Proposta expirou sem resposta. Horário liberado.' : 'Reserva temporária expirou sem proposta. Horário liberado.';
      tx.alterar('solicitacoes', s, { estado: 'expirada', linhaDoTempo: [...s.linhaDoTempo, linha(tx, texto)] });
      tx.notificar(s.clienteId, { titulo: motivo === 'proposta' ? 'Proposta expirada' : 'Solicitação expirada', texto: `${s.id} · horário liberado`, href: '#/clientes/solicitacoes/' + s.id, icone: 'hourglass' });
      for (const g of gestoresDa(tx.estado, s.empresaId)) tx.notificar(g.id, { titulo: 'Solicitação expirada', texto: `${s.id} · horário liberado`, href: '#/empresas/solicitacoes/' + s.id, icone: 'hourglass' });
    }
    for (const id of e.reagendamentosVencidos) {
      const s = tx.get('solicitacoes', id);
      if (!s || !s.reagendamento) continue;
      tx.alterar('solicitacoes', s, { reagendamento: null, linhaDoTempo: [...s.linhaDoTempo, linha(tx, 'Pedido de reagendamento sem resposta no prazo. Horário original mantido.')] });
      tx.notificar(s.clienteId, { titulo: 'Reagendamento não respondido', texto: `${s.id} · horário original mantido`, href: '#/clientes/solicitacoes/' + s.id, icone: 'hourglass' });
    }
    for (const id of e.convites) {
      const p = tx.get('profissionais', id);
      if (p) tx.alterar('profissionais', p, { situacao: 'convite_expirado', historico: [...(p.historico || []), linha(tx, 'Convite expirou sem aceite.')] });
    }
    return ok({ alteradas: e.liberarOcupacoes.length + solExp.size + e.reagendamentosVencidos.length + e.convites.length });
  }, { falhavel: false, semAtraso: true });
}

/** Registra em auditoria um conflito de reserva (a operação original não gravou nada). */
export function registrarConflito({ empresaId, inicio, origem }) {
  return transacao('registrarConflito', tx => {
    const empresa = empresaDe(tx.estado, empresaId);
    tx.auditar({ entidade: `Horário ${formatarDataHora(inicio, empresa ? empresa.fuso : undefined)}`, acao: 'Conflito de reserva', tipo: 'reserva', justificativa: origem, empresaId });
    return ok();
  }, { falhavel: false, semAtraso: true });
}

// ---------- Leituras ----------

/** Agenda pública: apenas horários e indicação de vaga — nunca nomes, endereços, ordens ou motivos. */
export function horariosPublicos({ empresaId, servicoId, data }, t = agora()) {
  const estado = ler();
  const c = contextoEmpresa(estado, empresaId);
  const servico = servicoDe(estado, servicoId);
  if (!c.empresa || c.empresa.situacao !== 'ativa' || !servico || servico.situacao !== 'ativo') return [];
  return horariosDoDia({ ...c, servico, data, agora: t }).map(s => ({ hora: s.hora, inicio: iso(s.inicio), livre: s.livre }));
}

export function horarioLivre({ empresaId, servicoId, inicio }, t = agora()) {
  const estado = ler();
  const c = contextoEmpresa(estado, empresaId);
  const servico = servicoDe(estado, servicoId);
  if (!c.empresa || !servico) return false;
  return Boolean(escolherProfissional({ ...c, servico, inicio: emMs(inicio), agora: t }));
}

/** Disponibilidade detalhada (empresa): o que cada profissional elegível tem livre e o que o cliente verá. */
export function disponibilidadeEmpresa({ empresaId, servicoId, data, usuario }, t = agora()) {
  if (!pode(usuario, 'agenda.consultar', { escopo: 'empresa', empresaId })) return null;
  const estado = ler();
  const c = contextoEmpresa(estado, empresaId);
  const servico = servicoDe(estado, servicoId);
  if (!servico) return null;
  const r = disponibilidadePorProfissional({ ...c, servico, data, agora: t });
  return {
    linhas: r.linhas.map(l => ({ id: l.profissional.id, nome: l.profissional.curto, estado: l.estado, motivo: l.motivo ? MOTIVOS[l.motivo] : '', horarios: l.horarios })),
    uniao: r.uniao, duracaoMin: servico.duracaoMin, preparoMin: c.empresa.preparoMin
  };
}

/**
 * Agenda do dia para a empresa: colunas por profissional com eventos.
 * Técnico vê somente a própria coluna; motivos de bloqueio só para a gestão.
 */
export function agendaDoDia({ empresaId, data, usuario }, t = agora()) {
  const estado = ler();
  const v = vinculoEmpresa(usuario, empresaId);
  if (!v) return null;
  const gestor = v.papel === 'gestor';
  const c = contextoEmpresa(estado, empresaId);
  const fuso = c.empresa.fuso;
  const profs = c.profissionais.filter(p => ['ativo', 'suspenso'].includes(p.situacao) && (gestor || p.id === v.profissionalId));
  const doDia = c.ocupacoes.filter(o => dataLocal(o.inicio, fuso) === data && ocupacaoAtiva(o, t));
  const evento = o => {
    const ordem = ordemDe(estado, o.ordemId);
    const sol = o.solicitacaoId ? estado.solicitacoes.find(s => s.id === o.solicitacaoId) : null;
    const servico = servicoDe(estado, (ordem || sol || {}).servicoId);
    const reag = sol && sol.reagendamento && sol.reagendamento.ocupacaoId === o.id;
    let ref = o.rotulo || o.id, href = null, titulo = '', quem = '';
    if (o.estado === 'bloqueio') { ref = o.rotulo || 'Bloqueio'; titulo = gestor ? 'Bloqueio interno' : 'Indisponível'; quem = gestor ? o.motivo : ''; }
    else if (ordem) { ref = ordem.id; href = '#/empresas/ordens/' + ordem.id; titulo = servico ? servico.nome : 'Atendimento'; quem = ordem.clienteNome; }
    else if (sol) { ref = sol.id; href = gestor ? '#/empresas/solicitacoes/' + sol.id : null; titulo = servico ? servico.nome : 'Solicitação'; quem = reag ? 'Novo horário pedido · ' + sol.clienteNome : sol.clienteNome + (o.estado === 'temporaria' ? ' · aguardando' : ''); }
    else if (o.simulada) { ref = 'Simulação'; titulo = o.rotulo || 'Operação concorrente (simulação)'; quem = ''; }
    return {
      id: o.id, estado: o.pendente ? 'pendente' : o.estado, inicio: o.inicio, fim: o.fim, hi: horaLocal(o.inicio, fuso), hf: horaLocal(o.fim, fuso),
      ref, titulo, quem, href, bloqueio: o.estado === 'bloqueio', motivo: gestor ? o.motivo : '', profissionalId: o.profissionalId,
      expiraEm: o.expiraEm, reagendamento: Boolean(reag)
    };
  };
  const colunas = profs.map(p => {
    const j = janelaDoDia({ profissional: { ...p, situacao: 'ativo' }, empresa: c.empresa, data });
    const jornada = jornadaDe(p, c.empresa);
    return {
      id: p.id, nome: p.curto, situacao: p.situacao,
      indisponivel: j.ok ? null : (j.motivo === 'FOLGA' ? 'Folga' : j.motivo === 'FERIADO' ? 'Feriado' : 'Fora da jornada'),
      jornada: j.ok ? { inicio: minParaHm(j.inicioMin), fim: minParaHm(j.fimMin) } : null,
      intervalo: j.ok && jornada && jornada.intervalo ? jornada.intervalo : null,
      eventos: doDia.filter(o => o.profissionalId === p.id).map(evento).sort((a, b) => a.inicio.localeCompare(b.inicio))
    };
  });
  const pendentes = gestor ? doDia.filter(o => !o.profissionalId || o.pendente).map(evento) : [];
  if (pendentes.length) colunas.push({ id: 'pendente', nome: 'A reatribuir', situacao: 'pendente', indisponivel: null, jornada: null, intervalo: null, eventos: pendentes });
  return { colunas, gestor, fuso };
}

/** Quantidade de atendimentos por dia (para a faixa de datas). */
export function contagemPorDia({ empresaId, datas, usuario }, t = agora()) {
  const estado = ler();
  const v = vinculoEmpresa(usuario, empresaId);
  if (!v) return {};
  const fuso = empresaDe(estado, empresaId).fuso;
  const out = {};
  for (const d of datas) out[d] = 0;
  for (const o of estado.ocupacoes) {
    if (o.empresaId !== empresaId || o.estado === 'bloqueio' || !ocupacaoAtiva(o, t)) continue;
    if (v.papel !== 'gestor' && o.profissionalId !== v.profissionalId) continue;
    const d = dataLocal(o.inicio, fuso);
    if (d in out) out[d] += 1;
  }
  return out;
}

// ---------- Bloqueios ----------

export function intervaloDoBloqueio(estado, { profissionalId, data, diaInteiro, inicio, fim }) {
  const p = profissionalDe(estado, profissionalId);
  const empresa = empresaDe(estado, p.empresaId);
  const j = jornadaDe(p, empresa) || empresa.jornadaPadrao;
  const hi = diaInteiro ? j.inicio : inicio;
  const hf = diaInteiro ? j.fim : fim;
  return { ini: paraUtc(data, hi, empresa.fuso), fim: paraUtc(data, hf, empresa.fuso), hi, hf, empresa, profissional: p };
}

/**
 * Cria um bloqueio. Se sobrepuser atendimentos (temporários ou confirmados), NÃO salva:
 * devolve BLOQUEIO_CONFLITANTE com os afetados e sugestões de períodos livres.
 */
export function criarBloqueio(dados, opcoes = {}) {
  return executar('criarBloqueio', tx => {
    const p = tx.exigir('profissionais', dados.profissionalId);
    exigirGestor(tx, p.empresaId);
    const erros = validarBloqueio(dados);
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos do bloqueio.', { campos: erros });
    const b = intervaloDoBloqueio(tx.estado, dados);
    if (b.fim <= b.ini) throw falhar('VALIDACAO', 'Revise os campos do bloqueio.', { campos: { fim: 'O fim deve ser depois do início.' } });
    const ocupacoes = contextoEmpresa(tx.estado, p.empresaId).ocupacoes;
    const afetados = conflitosDoBloqueio({ profissionalId: p.id, inicio: b.ini, fim: b.fim, ocupacoes, agora: tx.agora });
    if (afetados.length) {
      const sugestoes = sugerirJanelasBloqueio({ profissional: p, empresa: b.empresa, data: dados.data, ocupacoes, agora: tx.agora, duracaoMs: b.fim - b.ini });
      throw falhar('BLOQUEIO_CONFLITANTE', 'O período conflita com atendimentos existentes. O bloqueio não foi salvo.', {
        afetados: afetados.map(o => {
          const ordem = ordemDe(tx.estado, o.ordemId);
          const ref = ordem ? ordem.id : o.solicitacaoId || o.id;
          return { id: o.id, ref, rotulo: `${ref} · ${horaLocal(o.inicio, b.empresa.fuso)}–${horaLocal(o.fim, b.empresa.fuso)} · ${o.estado === 'temporaria' ? 'Reserva temporária' : 'Confirmada'}`, href: ordem ? '#/empresas/ordens/' + ordem.id : o.solicitacaoId ? '#/empresas/solicitacoes/' + o.solicitacaoId : null };
        }),
        alternativas: sugestoes.map(([a, z]) => ({ inicio: horaLocal(a, b.empresa.fuso), fim: horaLocal(z, b.empresa.fuso) }))
      });
    }
    const rotulo = 'BLQ-' + String(tx.seq('blq')).padStart(2, '0');
    const o = tx.inserir('ocupacoes', { id: tx.id('OC'), empresaId: p.empresaId, profissionalId: p.id, inicio: iso(b.ini), fim: iso(b.fim), estado: 'bloqueio', expiraEm: null, solicitacaoId: null, ordemId: null, motivo: dados.motivo.trim(), rotulo, pendente: false });
    tx.auditar({ entidade: `${rotulo} · ${p.curto} · ${formatarDataHora(b.ini, b.empresa.fuso)}`, acao: 'Bloqueio criado', tipo: 'agenda', empresaId: p.empresaId });
    return ok({ id: o.id, rotulo, inicio: o.inicio, fim: o.fim });
  }, opcoes);
}

export function removerBloqueio({ ocupacaoId }, opcoes = {}) {
  return executar('removerBloqueio', tx => {
    const o = tx.exigir('ocupacoes', ocupacaoId);
    exigirGestor(tx, o.empresaId);
    if (o.estado !== 'bloqueio') throw falhar('TRANSICAO_INVALIDA', 'Apenas bloqueios internos podem ser removidos aqui.');
    const empresa = empresaDe(tx.estado, o.empresaId);
    tx.alterar('ocupacoes', o, { estado: 'liberada' });
    tx.auditar({ entidade: `${o.rotulo} · ${formatarDataHora(o.inicio, empresa.fuso)}`, acao: 'Bloqueio removido', tipo: 'agenda', empresaId: o.empresaId });
    return ok();
  }, opcoes);
}

/** Simulação: ocupa o horário com reservas de outra operação (uma por profissional elegível livre). */
export function simularReservaConcorrente({ empresaId, servicoId, inicio }) {
  return transacao('simularReservaConcorrente', tx => {
    let n = 0;
    for (;;) {
      const c = contextoEmpresa(tx.estado, empresaId);
      const servico = servicoDe(tx.estado, servicoId);
      if (!servico || !escolherProfissional({ ...c, servico, inicio: emMs(inicio), agora: tx.agora })) break;
      reservarNoTx(tx, { empresaId, servicoId, inicio, expiraEm: tx.agora + 24 * 3600000, extra: { simulada: true, rotulo: 'Operação concorrente (simulação)' } });
      n += 1;
      if (n > 20) break;
    }
    return ok({ reservas: n });
  }, { falhavel: false, semAtraso: true });
}

/** Simulação: insere uma ocupação sobreposta ao horário de uma reserva (corrida que o backend deve impedir). */
export function simularOcupacaoSobreposta({ ocupacaoId }) {
  return transacao('simularOcupacaoSobreposta', tx => {
    const o = tx.exigir('ocupacoes', ocupacaoId);
    tx.inserir('ocupacoes', { id: tx.id('OC'), empresaId: o.empresaId, profissionalId: o.profissionalId, inicio: o.inicio, fim: o.fim, estado: 'confirmada', expiraEm: null, solicitacaoId: null, ordemId: null, motivo: '', rotulo: 'Operação concorrente (simulação)', pendente: false, simulada: true });
    return ok();
  }, { falhavel: false, semAtraso: true });
}

