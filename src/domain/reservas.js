// Expiração de reservas temporárias, propostas, pedidos de reagendamento e convites,
// e regras de reagendamento (o original permanece reservado até a troca ser confirmada).

import { emMs, HORA } from './datas.js';

export const VALIDADE_RESERVA_PADRAO_H = 24; // H1
export const PRAZO_REAGENDAMENTO_H = 48;     // H3
export const VALIDADE_CONVITE_DIAS = 7;      // H4
export const INATIVIDADE_SESSAO_MIN = 30;    // H5

const vencido = (instante, agora) => instante != null && emMs(instante) <= agora;

/**
 * Calcula o que deve expirar em `agora`, sem alterar nada.
 * Devolve listas de ids e o motivo de cada solicitação.
 */
export function calcularExpiracoes({ ocupacoes, solicitacoes, profissionais = [] }, agora) {
  const liberar = new Set(ocupacoes.filter(o => o.estado === 'temporaria' && vencido(o.expiraEm, agora)).map(o => o.id));
  const expirarSolicitacoes = [];
  const reagendamentosVencidos = [];
  for (const s of solicitacoes) {
    if (s.estado === 'proposta' && s.proposta && vencido(s.proposta.validadeEm, agora)) {
      expirarSolicitacoes.push({ id: s.id, motivo: 'proposta' });
      if (s.ocupacaoId) liberar.add(s.ocupacaoId);
    } else if ((s.estado === 'enviada' || s.estado === 'em_analise') && s.ocupacaoId && liberar.has(s.ocupacaoId)) {
      expirarSolicitacoes.push({ id: s.id, motivo: 'reserva' });
    }
    if (s.reagendamento && vencido(s.reagendamento.prazo, agora)) {
      reagendamentosVencidos.push(s.id);
      if (s.reagendamento.ocupacaoId) liberar.add(s.reagendamento.ocupacaoId);
    }
  }
  const convites = profissionais.filter(p => p.situacao === 'convite' && vencido(p.conviteExpiraEm, agora)).map(p => p.id);
  return { liberarOcupacoes: [...liberar], expirarSolicitacoes, reagendamentosVencidos, convites };
}

export const haExpiracoes = r => r.liberarOcupacoes.length + r.expirarSolicitacoes.length + r.reagendamentosVencidos.length + r.convites.length > 0;

/** Prazo de uma reserva temporária: validade configurada, limitada ao início do atendimento. */
export function prazoReserva(agora, validadeHoras, inicio) {
  const prazo = agora + validadeHoras * HORA;
  return inicio ? Math.min(prazo, emMs(inicio)) : prazo;
}

/** Prazo do pedido de reagendamento (48 h), limitado a 1 h antes do novo horário. */
export function prazoReagendamento(agora, novoInicio, horas = PRAZO_REAGENDAMENTO_H) {
  return Math.min(agora + horas * HORA, emMs(novoInicio) - HORA);
}

/**
 * Pode pedir reagendamento? Exige atendimento aceito, ainda agendado, sem pedido pendente
 * e com o novo horário diferente do atual.
 */
export function podeReagendar(solicitacao, ordem, novoInicio, agora) {
  if (!solicitacao || solicitacao.estado !== 'aceita') return { ok: false, code: 'TRANSICAO_INVALIDA', message: 'Só é possível reagendar atendimentos confirmados.' };
  if (!ordem || ordem.estado !== 'agendada') return { ok: false, code: 'TRANSICAO_INVALIDA', message: 'O atendimento já foi iniciado, concluído ou cancelado.' };
  if (solicitacao.reagendamento) return { ok: false, code: 'REAGENDAMENTO_PENDENTE', message: 'Já existe um pedido de reagendamento aguardando resposta.' };
  if (!novoInicio || emMs(novoInicio) <= agora) return { ok: false, code: 'VALIDACAO', message: 'Escolha um novo horário no futuro.' };
  if (emMs(novoInicio) - HORA <= agora) return { ok: false, code: 'VALIDACAO', message: 'O novo horário precisa ter ao menos 1 hora de antecedência para a resposta.' };
  return { ok: true };
}

/**
 * Resultado da resposta a um pedido de reagendamento:
 * aceito → novo horário confirmado e original liberado; recusado/vencido → original mantido.
 * Devolve os estados finais das duas ocupações.
 */
export function resolverReagendamento({ original, novo, aceito, novoAindaValido }) {
  if (aceito && novoAindaValido) return { ok: true, original: 'liberada', novo: 'confirmada' };
  if (aceito && !novoAindaValido) return { ok: false, code: 'HORARIO_INDISPONIVEL', message: 'O novo horário deixou de estar reservado. O horário original foi mantido.', original: original.estado, novo: 'liberada' };
  return { ok: true, original: original.estado, novo: 'liberada' };
}

/** Política demonstrativa de cancelamento (H8): sem custo até 12 h antes. */
export function avaliarCancelamento(inicio, agora, horasSemCusto = 12) {
  const antecedenciaH = (emMs(inicio) - agora) / HORA;
  return { semCusto: antecedenciaH >= horasSemCusto, antecedenciaH };
}
