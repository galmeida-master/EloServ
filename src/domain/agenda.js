// Regras de agenda (PRD §6): capacidade por profissional, jornada, intervalos, folgas,
// feriados, bloqueios, duração do serviço e tempo de preparo/deslocamento.
// Funções puras: recebem os dados e o instante atual (`agora`, em ms).

import { emMs, paraUtc, dataLocal, minutosLocal, diaSemanaData, hmParaMin, minParaHm, MINUTO } from './datas.js';

export const MOTIVOS = {
  NAO_EXECUTA: 'Não executa este serviço',
  PROFISSIONAL_INDISPONIVEL: 'Profissional indisponível',
  FORA_DA_JORNADA: 'Fora da jornada',
  FOLGA: 'Folga',
  FERIADO: 'Feriado ou empresa fechada',
  INTERVALO: 'Intervalo',
  BLOQUEIO: 'Bloqueio interno',
  OCUPADO: 'Ocupado',
  PREPARO: 'Tempo de preparo/deslocamento',
  NO_PASSADO: 'Horário já passou'
};

/** Uma ocupação ocupa a agenda se estiver confirmada, for bloqueio ou for temporária ainda válida. */
export function ocupacaoAtiva(o, agora) {
  if (o.estado === 'confirmada' || o.estado === 'bloqueio') return true;
  if (o.estado === 'temporaria') return !o.expiraEm || emMs(o.expiraEm) > agora;
  return false;
}

/** Sobreposição de [a1, b1) com [a2, b2), com folga opcional (preparo). Fim igual ao início não sobrepõe. */
export function sobrepoe(a1, b1, a2, b2, folga = 0) {
  return a1 < b2 + folga && a2 < b1 + folga;
}

export function jornadaDe(profissional, empresa) {
  return profissional.jornada || empresa.jornadaPadrao;
}

/** Janela de trabalho do profissional na data local ('AAAA-MM-DD'). */
export function janelaDoDia({ profissional, empresa, data }) {
  if (profissional.situacao !== 'ativo') return { ok: false, motivo: 'PROFISSIONAL_INDISPONIVEL' };
  const j = jornadaDe(profissional, empresa);
  if (!j || !j.dias.includes(diaSemanaData(data))) return { ok: false, motivo: 'FORA_DA_JORNADA' };
  if ((profissional.folgas || []).includes(data)) return { ok: false, motivo: 'FOLGA' };
  let fimMin = hmParaMin(j.fim);
  const feriado = (empresa.feriados || []).find(f => f.data === data);
  if (feriado) {
    if (feriado.tipo === 'fechado') return { ok: false, motivo: 'FERIADO', feriado };
    if (feriado.ate) fimMin = Math.min(fimMin, hmParaMin(feriado.ate));
  }
  const intervalos = j.intervalo ? [[hmParaMin(j.intervalo.inicio), hmParaMin(j.intervalo.fim)]] : [];
  return { ok: true, inicioMin: hmParaMin(j.inicio), fimMin, intervalos };
}

/**
 * Verifica se o profissional pode atender em [inicio, fim) (ms).
 * Bloqueios usam sobreposição simples; atendimentos consideram o tempo de preparo da empresa.
 */
export function verificarProfissional({ profissional, empresa, servico = null, inicio, fim, ocupacoes, agora, ignorar = [] }) {
  if (servico && !(profissional.servicos || []).includes(servico.id)) return { livre: false, motivo: 'NAO_EXECUTA' };
  if (inicio <= agora) return { livre: false, motivo: 'NO_PASSADO' };
  const data = dataLocal(inicio, empresa.fuso);
  if (dataLocal(fim - 1, empresa.fuso) !== data) return { livre: false, motivo: 'FORA_DA_JORNADA' };
  const janela = janelaDoDia({ profissional, empresa, data });
  if (!janela.ok) return { livre: false, motivo: janela.motivo };
  const mi = minutosLocal(inicio, empresa.fuso);
  const mf = mi + Math.round((fim - inicio) / MINUTO);
  if (mi < janela.inicioMin || mf > janela.fimMin) return { livre: false, motivo: 'FORA_DA_JORNADA' };
  if (janela.intervalos.some(([a, b]) => sobrepoe(mi, mf, a, b))) return { livre: false, motivo: 'INTERVALO' };
  const preparo = (empresa.preparoMin || 0) * MINUTO;
  for (const o of ocupacoes) {
    if (o.profissionalId !== profissional.id || ignorar.includes(o.id) || !ocupacaoAtiva(o, agora)) continue;
    const s = emMs(o.inicio), e = emMs(o.fim);
    if (o.estado === 'bloqueio') {
      if (sobrepoe(inicio, fim, s, e)) return { livre: false, motivo: 'BLOQUEIO', conflito: o };
    } else if (sobrepoe(inicio, fim, s, e, preparo)) {
      return { livre: false, motivo: sobrepoe(inicio, fim, s, e) ? 'OCUPADO' : 'PREPARO', conflito: o };
    }
  }
  return { livre: true };
}

export function profissionaisElegiveis(profissionais, servicoId) {
  return profissionais.filter(p => p.situacao === 'ativo' && (p.servicos || []).includes(servicoId));
}

export const fimDoServico = (inicio, servico) => inicio + servico.duracaoMin * MINUTO;

/**
 * Escolhe um profissional elegível livre para o horário. Dá preferência ao `preferidoId`
 * e, depois, a quem tem menos ocupações no dia (empate: ordem de cadastro).
 */
export function escolherProfissional({ empresa, servico, profissionais, ocupacoes, inicio, agora, preferidoId = null, ignorar = [] }) {
  const fim = fimDoServico(inicio, servico);
  const livres = profissionaisElegiveis(profissionais, servico.id)
    .filter(p => verificarProfissional({ profissional: p, empresa, servico, inicio, fim, ocupacoes, agora, ignorar }).livre);
  if (!livres.length) return null;
  const pref = livres.find(p => p.id === preferidoId);
  if (pref) return pref;
  const data = dataLocal(inicio, empresa.fuso);
  const carga = p => ocupacoes.filter(o => o.profissionalId === p.id && ocupacaoAtiva(o, agora) && o.estado !== 'bloqueio' && dataLocal(o.inicio, empresa.fuso) === data).length;
  return livres.map((p, i) => ({ p, i, c: carga(p) })).sort((a, b) => a.c - b.c || a.i - b.i)[0].p;
}

/**
 * Horários candidatos de um dia para um serviço, com indicação de vaga.
 * Existe vaga somente se ao menos um profissional elegível estiver livre (PRD §6.1).
 */
export function horariosDoDia({ empresa, servico, profissionais, ocupacoes, data, agora, passoMin = 30 }) {
  const eleg = profissionaisElegiveis(profissionais, servico.id);
  const janelas = eleg.map(p => janelaDoDia({ profissional: p, empresa, data })).filter(j => j.ok);
  if (!janelas.length) return [];
  const ini = Math.min(...janelas.map(j => j.inicioMin));
  const fim = Math.max(...janelas.map(j => j.fimMin));
  const out = [];
  for (let m = ini; m + servico.duracaoMin <= fim; m += passoMin) {
    const hora = minParaHm(m);
    const inicio = paraUtc(data, hora, empresa.fuso);
    const fimMs = fimDoServico(inicio, servico);
    const livres = eleg.filter(p => verificarProfissional({ profissional: p, empresa, servico, inicio, fim: fimMs, ocupacoes, agora }).livre);
    out.push({ hora, inicio, fim: fimMs, livre: livres.length > 0, profissionalIds: livres.map(p => p.id) });
  }
  return out;
}

/** Disponibilidade detalhada por profissional (visão da empresa). O cliente vê apenas a união. */
export function disponibilidadePorProfissional({ empresa, servico, profissionais, ocupacoes, data, agora, passoMin = 30 }) {
  const ativos = profissionais.filter(p => p.situacao === 'ativo');
  const linhas = ativos.map(p => {
    if (!(p.servicos || []).includes(servico.id)) return { profissional: p, estado: 'nao_executa', motivo: 'NAO_EXECUTA', horarios: [] };
    const j = janelaDoDia({ profissional: p, empresa, data });
    if (!j.ok) return { profissional: p, estado: 'indisponivel', motivo: j.motivo, horarios: [] };
    const horarios = [];
    for (let m = j.inicioMin; m + servico.duracaoMin <= j.fimMin; m += passoMin) {
      const inicio = paraUtc(data, minParaHm(m), empresa.fuso);
      const v = verificarProfissional({ profissional: p, empresa, servico, inicio, fim: fimDoServico(inicio, servico), ocupacoes, agora });
      if (v.livre) horarios.push(minParaHm(m));
    }
    return { profissional: p, estado: horarios.length ? 'disponivel' : 'sem_horarios', motivo: null, horarios };
  });
  const uniao = [...new Set(linhas.flatMap(l => l.horarios))].sort();
  return { linhas, uniao };
}

/** Janelas livres (sem sobreposição simples) na jornada do profissional, descontando intervalos e ocupações ativas. */
export function janelasLivres({ profissional, empresa, data, ocupacoes, agora, ignorar = [] }) {
  const j = janelaDoDia({ profissional, empresa, data });
  if (!j.ok) return [];
  const toMs = m => paraUtc(data, minParaHm(m), empresa.fuso);
  const ocupados = j.intervalos.map(([a, b]) => [toMs(a), toMs(b)])
    .concat(ocupacoes
      .filter(o => o.profissionalId === profissional.id && !ignorar.includes(o.id) && ocupacaoAtiva(o, agora) && dataLocal(o.inicio, empresa.fuso) === data)
      .map(o => [emMs(o.inicio), emMs(o.fim)]))
    .sort((a, b) => a[0] - b[0]);
  const janelas = [];
  let cur = Math.max(toMs(j.inicioMin), agora);
  const fim = toMs(j.fimMin);
  for (const [a, b] of ocupados) {
    if (a > cur) janelas.push([cur, Math.min(a, fim)]);
    cur = Math.max(cur, b);
  }
  if (cur < fim) janelas.push([cur, fim]);
  return janelas.filter(([a, b]) => b > a);
}

/** Atendimentos (temporários ou confirmados) que um bloqueio em [inicio, fim) afetaria. */
export function conflitosDoBloqueio({ profissionalId, inicio, fim, ocupacoes, agora }) {
  return ocupacoes.filter(o => o.profissionalId === profissionalId && o.estado !== 'bloqueio' && ocupacaoAtiva(o, agora) && sobrepoe(inicio, fim, emMs(o.inicio), emMs(o.fim)));
}

/** Sugestões de períodos livres para um bloqueio de `duracaoMs` (até `limite`). */
export function sugerirJanelasBloqueio({ profissional, empresa, data, ocupacoes, agora, duracaoMs, limite = 3 }) {
  const minimo = Math.min(duracaoMs, 60 * MINUTO);
  return janelasLivres({ profissional, empresa, data, ocupacoes, agora })
    .filter(([a, b]) => b - a >= minimo)
    .slice(0, limite)
    .map(([a, b]) => [a, Math.min(b, a + duracaoMs)]);
}

/** Horários alternativos livres, priorizando proximidade do horário desejado. */
export function alternativasHorario({ empresa, servico, profissionais, ocupacoes, datas, agora, desejado = null, excluir = [], limite = 4 }) {
  const livres = datas.flatMap(data => horariosDoDia({ empresa, servico, profissionais, ocupacoes, data, agora }))
    .filter(s => s.livre && !excluir.includes(s.inicio));
  const ref = desejado ?? agora;
  return livres
    .sort((a, b) => Math.abs(a.inicio - ref) - Math.abs(b.inicio - ref) || a.inicio - b.inicio)
    .slice(0, limite)
    .sort((a, b) => a.inicio - b.inicio);
}
