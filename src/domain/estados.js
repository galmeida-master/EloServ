// Três estados independentes (PRD §6.3) como máquinas de estado, com transições
// inválidas rejeitadas, e rótulos de apresentação (texto + ícone + tom; cor nunca é o único sinal).

export const MAQUINAS = {
  solicitacao: {
    enviada: ['em_analise', 'proposta', 'recusada', 'cancelada', 'expirada'],
    em_analise: ['proposta', 'recusada', 'cancelada', 'expirada'],
    proposta: ['aceita', 'em_analise', 'recusada', 'cancelada', 'expirada'],
    aceita: ['cancelada'],
    recusada: [],
    cancelada: [],
    expirada: ['enviada']
  },
  ocupacao: {
    temporaria: ['confirmada', 'liberada'],
    confirmada: ['liberada'],
    bloqueio: ['liberada'],
    liberada: []
  },
  execucao: {
    agendada: ['execucao', 'cancelada'],
    execucao: ['concluida'],
    concluida: [],
    cancelada: []
  }
};

export const ESTADOS_INICIAIS = {
  solicitacao: ['enviada'],
  ocupacao: ['temporaria', 'bloqueio'],
  execucao: ['agendada']
};

export const ENCERRADAS = ['recusada', 'cancelada', 'expirada'];

export function podeTransitar(maquina, de, para) {
  const m = MAQUINAS[maquina];
  if (!m) return false;
  if (de == null) return ESTADOS_INICIAIS[maquina].includes(para);
  return Boolean(m[de] && m[de].includes(para));
}

/** Aplica a transição ou devolve erro TRANSICAO_INVALIDA. */
export function transitar(maquina, de, para) {
  if (podeTransitar(maquina, de, para)) return { ok: true, estado: para };
  return {
    ok: false,
    code: 'TRANSICAO_INVALIDA',
    message: `Não é possível passar de “${rotulo(maquina, de).label}” para “${rotulo(maquina, para).label}”.`
  };
}

/**
 * Relações entre as dimensões:
 * - “Aceita” ocorre junto com ocupação “Confirmada” e cria a execução (ordem de serviço).
 * - “Recusada”, “Cancelada” ou “Expirada” implicam ocupação “Liberada”.
 * - Não existe execução antes da aceitação.
 * - “Bloqueio interno” é ocupação sem solicitação.
 * Devolve a lista de violações (vazia quando coerente).
 */
export function verificarRelacoes({ solicitacao = null, ocupacao = null, execucao = null }) {
  const v = [];
  const sol = solicitacao && solicitacao.estado;
  if (execucao && sol !== 'aceita' && !(sol === 'cancelada' && execucao.estado === 'cancelada')) {
    v.push('Execução existe sem solicitação aceita.');
  }
  if (sol === 'aceita') {
    if (!ocupacao || ocupacao.estado !== 'confirmada') v.push('Solicitação aceita exige ocupação confirmada.');
    if (!execucao) v.push('Solicitação aceita exige execução (ordem de serviço).');
  }
  if (ENCERRADAS.includes(sol) && ocupacao && ocupacao.estado !== 'liberada') {
    v.push('Solicitação encerrada exige ocupação liberada.');
  }
  if (ocupacao && ocupacao.estado === 'bloqueio' && solicitacao) v.push('Bloqueio interno não pode ter solicitação.');
  if (ocupacao && ocupacao.estado === 'confirmada' && solicitacao && sol !== 'aceita' && sol !== null) {
    v.push('Ocupação confirmada exige solicitação aceita.');
  }
  return v;
}

// Rótulos: [texto, ícone Phosphor, tom] — tons: a (destaque), w (atenção), o (sucesso), n (neutro), e (erro)
const ROTULOS = {
  solicitacao: {
    enviada: ['Enviada', 'paper-plane-tilt', 'a'],
    em_analise: ['Em análise', 'magnifying-glass', 'w'],
    proposta: ['Proposta enviada', 'file-text', 'a'],
    aceita: ['Aceita', 'check-circle', 'o'],
    recusada: ['Recusada', 'x-circle', 'n'],
    cancelada: ['Cancelada', 'prohibit', 'n'],
    expirada: ['Expirada', 'hourglass', 'n']
  },
  ocupacao: {
    temporaria: ['Reserva temporária', 'hourglass', 'w'],
    confirmada: ['Confirmada', 'check-circle', 'o'],
    bloqueio: ['Bloqueio interno', 'lock-simple', 'n'],
    liberada: ['Liberada', 'arrow-u-up-left', 'n'],
    sem_horario: ['Sem horário reservado', 'minus-circle', 'n']
  },
  execucao: {
    agendada: ['Agendada', 'calendar-check', 'a'],
    execucao: ['Em execução', 'wrench', 'w'],
    concluida: ['Concluída', 'check-circle', 'o'],
    cancelada: ['Cancelada', 'prohibit', 'n'],
    aguardando: ['Aguardando confirmação', 'clock', 'n']
  },
  empresa: {
    preenchimento: ['Cadastro em preenchimento', 'pencil-simple', 'n'],
    aguardando: ['Aguardando habilitação', 'hourglass', 'w'],
    ativa: ['Ativa', 'check-circle', 'o'],
    suspensa: ['Suspensa', 'pause-circle', 'e'],
    arquivada: ['Arquivada', 'archive', 'n']
  },
  registro: {
    ativo: ['Ativo', 'check-circle', 'o'],
    inativo: ['Inativo', 'pause-circle', 'n'],
    arquivado: ['Arquivado', 'archive', 'n'],
    convite: ['Convite pendente', 'envelope-simple', 'w'],
    convite_expirado: ['Convite expirado', 'hourglass', 'n'],
    suspenso: ['Suspenso', 'pause-circle', 'w'],
    revogado: ['Acesso revogado', 'prohibit', 'n'],
    publicado: ['Publicado', 'check-circle', 'o'],
    rascunho: ['Rascunho', 'pencil-simple', 'n'],
    aberta: ['Aberta', 'circle', 'w'],
    andamento: ['Em andamento', 'clock', 'a'],
    resolvida: ['Resolvida', 'check-circle', 'o'],
    revisar: ['Ajuste necessário', 'warning', 'w'],
    ajuste_solicitado: ['Ajuste solicitado', 'clock', 'a']
  }
};

export function rotulo(maquina, estado) {
  const r = (ROTULOS[maquina] || {})[estado];
  if (!r) return { label: estado == null ? '—' : String(estado), icon: 'minus-circle', tom: 'n' };
  return { label: r[0], icon: r[1], tom: r[2] };
}

/** Situação de exibição da ocupação para uma solicitação (inclui “Sem horário reservado”). */
export function estadoOcupacaoExibicao(ocupacao) {
  return ocupacao ? ocupacao.estado : 'sem_horario';
}
