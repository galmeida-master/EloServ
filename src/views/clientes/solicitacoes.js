// RF-CLI-02/03/04 · Solicitações e orçamentos do cliente: lista com filtros, detalhe com três situações
// independentes, proposta (confirmar, recusar, pedir ajuste), reagendamento e cancelamento.
import { h, Botao, Campo, Alerta, Vazio, Dialogo, Abas, Badge, BadgeTom, DL, LinhaDoTempo, FaixaDatas, Horarios, icone } from '../../ui/components.js';
import { ui, estadoView, set, render, toast, navegar, novaChave } from '../../store.js';
import * as req from '../../api/requests.js';
import { horariosPublicos, diasParaSolicitacao } from '../../api/agenda.js';
import { agora } from '../../api/clock.js';
import { formatarDataHora, formatarIntervalo, formatarPrazo, formatarRegistro, formatarData, rotuloFuso, rotuloDia, dataBr, rotuloMes } from '../../domain/datas.js';
import { formatarMoeda } from '../../domain/dinheiro.js';
import { avaliarCancelamento } from '../../domain/reservas.js';
import { textoDuracao } from '../public/perfil.js';

export const GRUPOS = {
  todas: () => true,
  voce: s => s.estado === 'proposta' || Boolean(s.reagendamento && s.reagendamento.origem === 'empresa'),
  andamento: s => ['enviada', 'em_analise', 'proposta'].includes(s.estado) || (s.estado === 'aceita' && !['concluida', 'cancelada'].includes(s.estadoExecucao)),
  encerradas: s => ['recusada', 'cancelada', 'expirada'].includes(s.estado) || s.estadoExecucao === 'concluida'
};

export function itemSolicitacao(s) {
  return h('li', { key: s.id },
    h('a', { class: 'list-item', href: '#/clientes/solicitacoes/' + s.id },
      h('span', { class: 'main' }, h('span', { class: 'strong' }, s.servicoNome), h('span', { class: 'small text2' }, `${s.id} · ${s.empresaNome} · ${s.inicio ? formatarDataHora(s.inicio, s.fuso) : 'Sem horário definido'}`)),
      h('span', { class: 'row' }, Badge('solicitacao', s.estado), Badge('ocupacao', s.estadoOcupacao), s.reagendamento ? BadgeTom('Reagendamento pendente', 'calendar-plus', 'w') : null)));
}

export function Solicitacoes({ usuario }) {
  const st = estadoView('cli-sols', () => ({ aba: 'todas' }));
  const todas = req.minhasSolicitacoes(usuario);
  const lista = todas.filter(GRUPOS[st.aba]);
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Solicitações e orçamentos'), h('p', null, 'Acompanhe cada pedido: solicitação, ocupação da agenda e execução são situações independentes.')),
      Botao({ texto: 'Nova solicitação', icone: 'plus', variante: 'primary', href: '#/fornecedores' })),
    Abas({ id: 'abas-sol', rotulo: 'Filtrar solicitações', ativa: st.aba, onTrocar: a => set(st, { aba: a }),
      abas: [['todas', 'Todas'], ['voce', 'Aguardando você'], ['andamento', 'Em andamento'], ['encerradas', 'Encerradas']].map(([id, texto]) => ({ id, texto, n: todas.filter(GRUPOS[id]).length })) }),
    h('section', { class: 'card', role: 'tabpanel', 'aria-labelledby': 'abas-sol-' + st.aba },
      lista.length ? h('ul', { class: 'list' }, lista.map(itemSolicitacao))
        : Vazio({ icone: 'clipboard-text', titulo: 'Nenhuma solicitação nesta visão.', texto: st.aba === 'todas' ? 'Encontre um fornecedor e envie sua primeira solicitação.' : null, acoes: st.aba === 'todas' ? [Botao({ texto: 'Buscar fornecedores', href: '#/fornecedores' })] : null })));
}

function trilhas(s) {
  return h('div', { class: 'tracks', 'aria-label': 'Situações da solicitação' },
    h('div', { class: 'track' }, h('h2', { class: 'k' }, 'Solicitação'), Badge('solicitacao', s.estado)),
    h('div', { class: 'track' }, h('h2', { class: 'k' }, 'Ocupação da agenda'), Badge('ocupacao', s.estadoOcupacao)),
    h('div', { class: 'track' }, h('h2', { class: 'k' }, 'Execução'), Badge('execucao', s.estadoExecucao)));
}

function cartaoProposta(s, acoes) {
  const p = s.proposta;
  const fuso = s.fuso;
  return h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-proposta' },
    h('div', { class: 'card-head' }, h('h2', { id: 'tit-proposta' }, 'Proposta da empresa'), h('span', { class: 'small text2' }, `Válida até ${formatarPrazo(p.validadeEm, fuso)}`)),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('caption', { class: 'sr-only' }, 'Itens da proposta'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Item'), h('th', { scope: 'col', style: 'text-align:right' }, 'Valor'))),
      h('tbody', null, p.itens.map(i => h('tr', null, h('td', null, i.descricao, i.opcional ? h('span', { class: 'small muted' }, ' (se necessário)') : null), h('td', { class: 'tabular', style: 'text-align:right' }, i.valorCentavos == null ? 'A definir' : formatarMoeda(i.valorCentavos))))))),
    DL([['Total estimado', h('span', { class: 'strong tabular' }, s.totalTexto)], ['Data proposta', `${formatarIntervalo(p.inicio, p.fim, fuso)} · ${rotuloFuso(fuso, p.inicio)}`],
      ['Profissional', s.propostaProfissional || '—'], ['Condições', p.condicoes], ['Observações', p.observacoes]]),
    acoes,
    h('p', { class: 'xsmall muted' }, 'Confirmar registra sua intenção de contratação na EloServ. Não é assinatura digital certificada e não envolve pagamento online.'));
}

export function Solicitacao({ params, usuario }) {
  const s = req.minhaSolicitacao(usuario, params.id);
  const st = estadoView('cli-sol:' + params.id, () => ({ dlg: null, busy: false, res: null, texto: '', rsData: null, rsInicio: null, versao: null }));
  if (!s) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'clipboard-text', titulo: 'Solicitação não encontrada', texto: 'Ela pode ter sido removida da demonstração ou pertencer a outra conta.', acoes: [Botao({ texto: 'Voltar às solicitações', href: '#/clientes/solicitacoes' })] }));
  ui.contextoSim = { tipo: 'solicitacao', id: s.id };
  const fuso = s.fuso;
  const abrir = (dlg, extra = {}) => set(st, { dlg, res: null, texto: '', versao: s.v, ...extra });
  const fechar = () => set(st, { dlg: null, res: null, busy: false });
  const chamar = async (fn, ok) => {
    if (st.busy) return;
    set(st, { busy: true, res: null });
    const r = await fn();
    st.busy = false;
    if (r.ok) { st.dlg = null; ok(r); } else if (r.code === 'SESSAO_EXPIRADA') { navegar('/sessao-expirada?volta=' + encodeURIComponent('/clientes/solicitacoes/' + s.id)); return; } else st.res = r;
    render();
  };
  const vencida = s.propostaVencida;
  const alertas = [];
  if (s.expiraEm && s.estado !== 'aceita') alertas.push(Alerta({ tipo: 'warn', titulo: 'Ainda não é um agendamento confirmado' }, h('p', null, `Reserva temporária até ${formatarPrazo(s.expiraEm, fuso)} (${rotuloFuso(fuso)}).`)));
  if (['enviada', 'em_analise'].includes(s.estado)) alertas.push(Alerta({ tipo: 'info', titulo: 'A empresa está analisando' }, h('p', null, s.inicio ? 'Você receberá uma proposta com valores, condições e validade. Acompanhe por aqui, mesmo sem horário confirmado.' : 'Sem horário reservado: a empresa vai propor um horário na proposta.'), s.ajuste ? h('p', { class: 'small' }, 'Ajuste solicitado por você: ' + s.ajuste) : null));
  if (s.estado === 'expirada') alertas.push(Alerta({ tipo: 'warn', titulo: s.proposta ? 'Proposta expirada' : 'Solicitação expirada', acoes: [Botao({ texto: 'Pedir nova proposta', variante: 'primary', ocupado: st.busy, onClick: () => chamar(() => req.pedirNovaProposta({ solicitacaoId: s.id, versao: s.v }), () => toast('Pedido de nova proposta enviado.')) })] },
    h('p', null, s.proposta ? `A proposta venceu em ${formatarPrazo(s.proposta.validadeEm, fuso)} sem confirmação. O horário foi liberado e não pode mais ser confirmado.` : 'A reserva temporária venceu sem proposta da empresa. O horário foi liberado.')));
  if (['recusada', 'cancelada'].includes(s.estado)) alertas.push(Alerta({ tipo: 'info', titulo: s.estado === 'recusada' ? 'Solicitação recusada' : 'Solicitação cancelada' }, h('p', null, 'Nenhum horário está reservado.' + (s.motivoEncerramento ? ' Motivo: ' + s.motivoEncerramento : ''))));
  if (s.reagendamento && s.reagendamento.origem === 'cliente') alertas.push(Alerta({ tipo: 'warn', titulo: `Reagendamento solicitado para ${formatarDataHora(s.reagendamento.novoInicio, fuso)}`,
    acoes: [Botao({ texto: 'Retirar pedido', ocupado: st.busy, onClick: () => chamar(() => req.retirarReagendamento({ solicitacaoId: s.id, versao: s.v }), () => toast('Pedido retirado. Seu horário original foi mantido.', 'info')) }),
      Botao({ texto: 'Como funciona o reagendamento', variante: 'ghost', onClick: () => set(ui, { ajuda: 'como-reagendar' }) })] },
  h('p', null, `Seu horário atual (${formatarDataHora(s.inicio, fuso)}) continua reservado até a empresa confirmar a troca. Prazo de resposta: ${formatarPrazo(s.reagendamento.prazo, fuso)}.`)));
  if (s.reagendamento && s.reagendamento.origem === 'empresa') alertas.push(Alerta({ tipo: 'warn', titulo: `A empresa propôs um novo horário: ${formatarDataHora(s.reagendamento.novoInicio, fuso)}`,
    acoes: [Botao({ texto: 'Aceitar novo horário', variante: 'primary', ocupado: st.busy, onClick: () => chamar(() => req.responderReagendamento({ solicitacaoId: s.id, aceitar: true, versao: s.v }), () => toast('Reagendamento confirmado. Horário anterior liberado.')) }),
      Botao({ texto: 'Manter horário atual', ocupado: st.busy, onClick: () => chamar(() => req.responderReagendamento({ solicitacaoId: s.id, aceitar: false, versao: s.v }), () => toast('Horário original mantido.', 'info')) })] },
  h('p', null, `Seu horário atual (${formatarDataHora(s.inicio, fuso)}) continua reservado até você responder. Prazo: ${formatarPrazo(s.reagendamento.prazo, fuso)}.`)));
  if (s.estado === 'aceita' && s.estadoExecucao === 'agendada') alertas.push(Alerta({ tipo: 'ok', titulo: 'Agendamento confirmado' }, h('p', null, `${formatarIntervalo(s.inicio, s.fim, fuso)} · ${rotuloFuso(fuso, s.inicio)} · Profissional: ${s.profissionalAtual || 'a definir pela empresa'}.`)));
  if (s.estadoExecucao === 'concluida') alertas.push(Alerta({ tipo: 'ok', titulo: 'Atendimento concluído' }, h('p', null, s.ordem && s.ordem.proximoRetorno ? `Próximo retorno sugerido pela empresa: ${rotuloMes(s.ordem.proximoRetorno)}.` : 'Sem retorno previsto.')));
  const podeDecidir = s.estado === 'proposta' && !vencida;
  const acoesProposta = podeDecidir ? h('div', { class: 'row' },
    Botao({ texto: 'Confirmar proposta', icone: 'check-circle', variante: 'primary', onClick: () => abrir('confirmar', { chave: novaChave() }), id: 'btn-confirmar-proposta' }),
    Botao({ texto: 'Pedir ajuste', icone: 'note-pencil', onClick: () => abrir('ajuste') }),
    Botao({ texto: 'Recusar', icone: 'x-circle', variante: 'danger', onClick: () => abrir('recusar') })) : null;
  const podeReagendar = s.estado === 'aceita' && s.estadoExecucao === 'agendada' && !s.reagendamento;
  const podeCancelar = ['enviada', 'em_analise', 'proposta'].includes(s.estado) || podeReagendar;

  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/clientes/solicitacoes' }, 'Solicitações'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, s.id)),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('p', { class: 'small text2 tabular' }, `${s.id} · criada em ${formatarData(s.criadaEm, fuso)}`), h('h1', null, s.servicoNome), h('p', null, s.empresaNome))),
    trilhas(s),
    ...alertas,
    s.proposta && (s.estado === 'proposta' || s.estado === 'aceita') ? cartaoProposta(s, acoesProposta) : null,
    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-dados' }, h('h2', { id: 'tit-dados' }, 'Dados da solicitação'),
        DL([['Data e hora', s.inicio ? `${formatarDataHora(s.inicio, fuso)} · ${rotuloFuso(fuso, s.inicio)}` : 'Sem horário definido'], ['Duração estimada', textoDuracao(s.duracaoMin)], ['Preço', s.precoTexto],
          ['Equipamento', s.equipamento], ['Local', s.local ? `${s.local.rotulo} · ${s.local.bairro}, ${s.local.cidade}` : '—'], ['Profissional', s.profissionalAtual || 'A definir pela empresa'], ['Necessidade', s.descricao]]),
        podeReagendar || podeCancelar ? h('div', { class: 'row mt-1' },
          podeReagendar ? Botao({ texto: 'Solicitar reagendamento', icone: 'calendar-plus', onClick: () => abrir('reagendar', { rsData: diasParaSolicitacao(undefined, { fuso })[0], rsInicio: null, chave: novaChave() }) }) : null,
          podeReagendar ? Botao({ texto: 'Como funciona o reagendamento', variante: 'ghost', onClick: () => set(ui, { ajuda: 'como-reagendar' }) }) : null,
          podeCancelar ? Botao({ texto: s.estado === 'aceita' ? 'Cancelar atendimento' : 'Cancelar solicitação', icone: 'prohibit', variante: 'danger', onClick: () => abrir('cancelar') }) : null) : null),
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-tl' }, h('h2', { id: 'tit-tl' }, 'Linha do tempo'), LinhaDoTempo(s.linhaDoTempo.slice().reverse(), q => formatarRegistro(q, fuso)))),
    dialogos(s, st, chamar, fechar));
}

function dialogos(s, st, chamar, fechar) {
  const fuso = s.fuso;
  if (st.dlg === 'confirmar') {
    const res = st.res;
    if (res && res.code === 'HORARIO_INDISPONIVEL') {
      const alts = (res.details && res.details.alternativas) || [];
      return Dialogo({ id: 'dlg-confirmar', titulo: 'O horário deixou de estar disponível', alerta: true, onFechar: fechar, ocupado: st.busy, rodape: [Botao({ texto: 'Decidir depois', onClick: fechar })] },
        Alerta({ tipo: 'err', foco: true }, h('p', null, res.message)),
        h('p', { class: 'strong' }, 'Pedir à empresa outro horário'),
        alts.length ? h('div', { class: 'stack-xs' }, alts.map(a => Botao({ texto: a.rotulo, ocupado: st.busy, onClick: () => chamar(() => req.pedirOutroHorario({ solicitacaoId: s.id, inicio: a.inicio, versao: s.v, idempotencyKey: st.chave + a.inicio }), () => toast('Novo horário enviado para análise da empresa.', 'info')) })))
          : h('p', { class: 'muted' }, 'Não há horários livres próximos. Peça uma nova proposta à empresa.'));
    }
    return Dialogo({ id: 'dlg-confirmar', titulo: 'Confirmar proposta', descricao: `${s.id} · ${s.servicoNome}`, ocupado: st.busy, onFechar: fechar,
      rodape: [Botao({ texto: 'Cancelar', onClick: fechar, desabilitado: st.busy }), Botao({ texto: 'Confirmar proposta', variante: 'primary', ocupado: st.busy, textoOcupado: 'Revalidando horário…', id: 'dlg-confirmar-ok',
        onClick: () => chamar(() => req.confirmarProposta({ solicitacaoId: s.id, versao: st.versao, idempotencyKey: st.chave }), () => toast('Agendamento confirmado.')) })] },
    DL([['Data', `${formatarIntervalo(s.proposta.inicio, s.proposta.fim, fuso)} · ${rotuloFuso(fuso, s.proposta.inicio)}`], ['Total estimado', s.totalTexto], ['Validade', formatarPrazo(s.proposta.validadeEm, fuso)]]),
    h('p', { class: 'small text2' }, 'Ao confirmar, o sistema verifica novamente a disponibilidade do horário. Isto registra sua intenção de contratação; não é assinatura digital e não envolve pagamento.'),
    st.res ? Alerta({ tipo: 'err', foco: true, titulo: st.res.code === 'CONFLITO_ATUALIZACAO' ? 'A proposta mudou desde que você abriu esta tela' : 'Não foi possível confirmar',
      acoes: st.res.code === 'CONFLITO_ATUALIZACAO' ? [Botao({ texto: 'Fechar e ver a situação atual', onClick: fechar })] : null }, h('p', null, st.res.message)) : null);
  }
  if (st.dlg === 'recusar') {
    return Dialogo({ id: 'dlg-recusar', titulo: 'Recusar proposta?', descricao: 'A reserva temporária será liberada. Você pode enviar uma nova solicitação depois.', ocupado: st.busy, onFechar: fechar,
      rodape: [Botao({ texto: 'Voltar', onClick: fechar, desabilitado: st.busy }), Botao({ texto: 'Recusar proposta', variante: 'danger', ocupado: st.busy, textoOcupado: 'Enviando…', onClick: () => chamar(() => req.recusarProposta({ solicitacaoId: s.id, motivo: st.texto, versao: st.versao }), () => toast('Proposta recusada. O horário foi liberado.', 'info')) })] },
    Campo({ id: 'recusa-motivo', rotulo: 'Motivo (opcional, visível para a empresa)', linhas: 3, valor: st.texto, onInput: v => { st.texto = v; }, maxlength: 300 }),
    st.res ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null);
  }
  if (st.dlg === 'ajuste') {
    return Dialogo({ id: 'dlg-ajuste', titulo: 'Pedir ajuste na proposta', descricao: 'A reserva temporária continua valendo até o fim da validade atual.', ocupado: st.busy, onFechar: fechar,
      rodape: [Botao({ texto: 'Cancelar', onClick: fechar, desabilitado: st.busy }), Botao({ texto: 'Enviar pedido', variante: 'primary', ocupado: st.busy, textoOcupado: 'Enviando…',
        onClick: () => { if (!st.texto.trim()) { st.res = { code: 'VALIDACAO', message: 'Descreva o ajuste desejado.' }; render(); return; } chamar(() => req.pedirAjuste({ solicitacaoId: s.id, texto: st.texto, versao: st.versao }), () => toast('Pedido de ajuste enviado.')); } })] },
    Campo({ id: 'ajuste-texto', rotulo: 'O que precisa mudar?', obrigatorio: true, linhas: 4, valor: st.texto, onInput: v => { st.texto = v; }, maxlength: 600, erro: st.res && st.res.code === 'VALIDACAO' ? st.res.message : null }),
    st.res && st.res.code !== 'VALIDACAO' ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null);
  }
  if (st.dlg === 'reagendar') {
    const dias = diasParaSolicitacao(undefined, { fuso });
    const slots = horariosPublicos({ empresaId: s.empresaId, servicoId: s.servicoId, data: st.rsData }).filter(x => x.inicio !== s.inicio);
    return Dialogo({ id: 'dlg-reagendar', titulo: 'Solicitar reagendamento', descricao: `Seu horário atual (${formatarDataHora(s.inicio, fuso)}) continua reservado até a empresa confirmar a troca.`, ocupado: st.busy, onFechar: fechar, largo: true,
      rodape: [Botao({ texto: 'Cancelar', onClick: fechar, desabilitado: st.busy }), Botao({ texto: 'Enviar pedido', variante: 'primary', ocupado: st.busy, textoOcupado: 'Reservando novo horário…', id: 'dlg-reagendar-ok',
        onClick: () => { if (!st.rsInicio) { st.res = { code: 'VALIDACAO', message: 'Escolha um novo horário.' }; render(); return; } chamar(() => req.solicitarReagendamento({ solicitacaoId: s.id, inicio: st.rsInicio, motivo: st.texto, idempotencyKey: st.chave + st.rsInicio }), () => toast('Pedido de reagendamento enviado. Seu horário atual continua reservado.')); } })] },
    FaixaDatas({ rotulo: 'Escolha o novo dia', datas: dias, selecionada: st.rsData, onEscolher: d => set(st, { rsData: d, rsInicio: null }), rotuloDe: rotuloDia }),
    slots.length ? Horarios({ rotulo: 'Novos horários em ' + dataBr(st.rsData), slots, selecionado: st.rsInicio, onEscolher: x => set(st, { rsInicio: x.inicio, res: null }) }) : h('p', { class: 'muted small' }, 'Sem horários disponíveis neste dia.'),
    st.res && st.res.code === 'VALIDACAO' ? h('p', { class: 'err-msg' }, icone('warning-circle'), st.res.message) : null,
    Campo({ id: 'reag-motivo', rotulo: 'Motivo (opcional)', valor: st.texto, onInput: v => { st.texto = v; }, maxlength: 200 }),
    h('p', { class: 'small text2' }, `${rotuloFuso(fuso)}. Hipótese em validação: a empresa tem até 48 horas para responder; sem resposta, o horário original é mantido.`),
    st.res && st.res.code !== 'VALIDACAO' ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.res.message)) : null);
  }
  if (st.dlg === 'cancelar') {
    const pol = s.estado === 'aceita' ? avaliarCancelamento(s.inicio, agora()) : null;
    return Dialogo({ id: 'dlg-cancelar', titulo: s.estado === 'aceita' ? 'Cancelar atendimento?' : 'Cancelar solicitação?', alerta: true, ocupado: st.busy, onFechar: fechar,
      rodape: [Botao({ texto: 'Voltar', onClick: fechar, desabilitado: st.busy, autofocus: true }), Botao({ texto: 'Confirmar cancelamento', variante: 'danger', ocupado: st.busy, textoOcupado: 'Cancelando…', onClick: () => chamar(() => req.cancelarSolicitacao({ solicitacaoId: s.id, motivo: st.texto, versao: st.versao }), () => toast('Cancelamento registrado. O horário foi liberado.', 'info')) })] },
    pol ? Alerta({ tipo: pol.semCusto ? 'info' : 'warn' }, h('p', null, pol.semCusto ? 'Dentro do prazo de cancelamento sem custo (até 12 horas antes, política demonstrativa da empresa).' : 'Fora do prazo de cancelamento sem custo: a empresa pode cobrar a visita conforme informado na proposta.')) : h('p', null, 'A solicitação será encerrada e qualquer reserva temporária será liberada.'),
    Campo({ id: 'cancel-motivo', rotulo: 'Motivo (opcional)', valor: st.texto, onInput: v => { st.texto = v; }, maxlength: 200 }),
    st.res ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null);
  }
  return null;
}

