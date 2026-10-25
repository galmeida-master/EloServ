// RF-EMP-07 · Ordens de serviço: Agendada → Em execução → Concluída | Cancelada. Concluir exige “trabalho realizado”.
// Resumo imprimível (não é documento fiscal, laudo ou certificação).
import { h, Botao, Campo, Seg, Alerta, Vazio, Dialogo, Badge, DL, LinhaDoTempo, Tabela, icone } from '../../ui/components.js';
import { estadoView, set, render, toast } from '../../store.js';
import * as ord from '../../api/orders.js';
import { formatarDataHora, formatarIntervalo, formatarRegistro, rotuloFuso, rotuloMes } from '../../domain/datas.js';

const FILTROS = [['', 'Todas'], ['agendada', 'Agendadas'], ['execucao', 'Em execução'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']];

export function Ordens({ usuario, empresaId, vinculo }) {
  const st = estadoView('emp-ordens:' + empresaId, () => ({ filtro: '' }));
  const todas = ord.ordensVisiveis(usuario, empresaId);
  const lista = todas.filter(o => !st.filtro || o.estado === st.filtro);
  const gestor = vinculo.papel === 'gestor';
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, gestor ? 'Ordens de serviço' : 'Meus atendimentos'), h('p', null, gestor ? 'Execução, observações, conclusão e próximo retorno.' : 'Atendimentos atribuídos a você.'))),
    Seg({ rotulo: 'Filtrar por situação', valor: st.filtro, opcoes: FILTROS, onChange: v => set(st, { filtro: v }) }),
    lista.length ? Tabela({ id: 'tab-ordens', rotulo: 'Ordens de serviço', estado: st, linhas: lista, colunas: [
      { id: 'os', titulo: 'Ordem', valor: o => `${o.id} ${o.servicoNome}`, render: o => h('div', null, h('a', { class: 'cell-main', href: '#/empresas/ordens/' + o.id }, o.id), h('div', { class: 'cell-sub' }, o.servicoNome)) },
      { id: 'cli', titulo: 'Cliente', valor: o => o.clienteNome },
      { id: 'prof', titulo: 'Profissional', valor: o => o.profissionalCurto, render: o => o.pendente ? h('span', { class: 'badge t-e' }, icone('warning'), 'A reatribuir') : o.profissionalCurto },
      { id: 'quando', titulo: 'Agendamento', valor: o => o.inicio, render: o => h('span', { class: 'tabular' }, formatarDataHora(o.inicio, o.fuso)) },
      { id: 'sit', titulo: 'Situação', valor: o => o.estado, render: o => Badge('execucao', o.estado) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: o => Botao({ texto: 'Abrir', pequeno: true, href: '#/empresas/ordens/' + o.id, rotulo: 'Abrir ' + o.id }) }
    ] }) : h('div', { class: 'card' }, Vazio({ icone: 'file-text', titulo: todas.length ? 'Nenhuma ordem nesta situação' : 'Nenhuma ordem de serviço', texto: 'Ordens são criadas quando o cliente confirma uma proposta.' })));
}

function Resumo(o) {
  return h('div', { class: 'print-area stack-sm', id: 'resumo-imprimivel' },
    h('div', { class: 'row-between' }, h('div', null, h('p', { class: 'strong' }, o.empresaNome), h('p', { class: 'small muted' }, `Empresa fictícia · ${o.empresaTelefone}`)), h('div', { style: 'text-align:right' }, h('p', { class: 'strong tabular' }, o.id), h('p', { class: 'small' }, Badge('execucao', o.estado)))),
    h('table', null, h('tbody', null,
      [['Cliente', o.clienteNome], ['Serviço', o.servicoNome], ['Equipamento', o.equipamento], ['Agendamento', `${formatarIntervalo(o.inicio, o.fim, o.fuso)} · ${rotuloFuso(o.fuso, o.inicio)}`],
        ['Profissional', o.profissionalNome], ['Relato inicial', o.relato || '—'], ['Trabalho realizado', o.trabalho || '—'], ['Observações', o.observacoes || '—'], ['Próximo retorno', o.proximoRetorno ? rotuloMes(o.proximoRetorno) : '—']]
        .map(([k, v]) => h('tr', null, h('th', { scope: 'row', style: 'width:32%' }, k), h('td', null, v))))),
    h('div', { class: 'grid-2 mt-3' }, h('p', { style: 'border-top:1px solid #94A3B8;padding-top:6px' }, 'Profissional'), h('p', { style: 'border-top:1px solid #94A3B8;padding-top:6px' }, 'Cliente')),
    h('p', { class: 'small muted' }, 'Resumo de atendimento gerado pela EloServ. Não é documento fiscal, laudo técnico ou certificação. Dados demonstrativos.'));
}

export function Ordem({ params, usuario, empresaId, vinculo }) {
  const o = ord.ordemVisivel(usuario, empresaId, params.id);
  const st = estadoView('emp-ordem:' + params.id, () => ({ dlg: null, busy: false, res: null, erros: {}, ed: null, novoProf: '', just: '' }));
  if (!o) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'file-text', titulo: 'Ordem não disponível', texto: 'Ela não existe ou não está atribuída a você.', acoes: [Botao({ texto: 'Voltar', href: '#/empresas/ordens' })] }));
  const gestor = vinculo.papel === 'gestor';
  if (!st.ed || st.ed.id !== o.id) st.ed = { id: o.id, trabalho: o.trabalho, observacoes: o.observacoes, retorno: '6' };
  const ed = st.ed;
  const fuso = o.fuso;
  const chamar = async (fn, msg, tipo) => {
    if (st.busy) return;
    set(st, { busy: true, res: null, erros: {} });
    const r = await fn();
    st.busy = false;
    if (r.ok) { st.dlg = null; if (msg) toast(msg, tipo); st.ed = null; } else if (r.code === 'VALIDACAO') st.erros = (r.details && r.details.campos) || {}; else st.res = r;
    render();
  };
  const candidatos = gestor && o.estado === 'agendada' ? ord.candidatosOrdem(usuario, empresaId, o.id) : [];
  const execucao = h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-exec' }, h('h2', { id: 'tit-exec' }, 'Execução'),
    o.estado === 'agendada' ? h('div', { class: 'stack-sm' },
      h('p', { class: 'text2' }, 'Inicie quando chegar ao local. O cliente acompanha a mudança de situação.'),
      h('div', null, Botao({ texto: 'Iniciar execução', icone: 'play', variante: 'primary', ocupado: st.busy, desabilitado: o.pendente, onClick: () => chamar(() => ord.iniciarExecucao({ ordemId: o.id, versao: o.v }), 'Atendimento em execução.'), id: 'btn-iniciar' }))) : null,
    o.estado === 'execucao' ? h('div', { class: 'stack-sm' },
      Campo({ id: 'os-trabalho', rotulo: 'Trabalho realizado', obrigatorio: true, linhas: 4, valor: ed.trabalho, onInput: v => { ed.trabalho = v; if (st.erros.trabalho) { delete st.erros.trabalho; render(); } }, erro: st.erros.trabalho, maxlength: 1000 }),
      Campo({ id: 'os-obs', rotulo: 'Observações', linhas: 3, valor: ed.observacoes, onInput: v => { ed.observacoes = v; }, maxlength: 1000 }),
      Campo({ id: 'os-retorno', rotulo: 'Próximo retorno sugerido', valor: ed.retorno, onChange: v => { ed.retorno = v; render(); }, opcoes: [['0', 'Sem retorno'], ['3', 'Em 3 meses'], ['6', 'Em 6 meses'], ['12', 'Em 12 meses']].map(([v, l]) => ({ v, l })), ajuda: 'O contato para o retorno é manual nesta versão.' }),
      h('div', { class: 'row' },
        Botao({ texto: 'Concluir atendimento', icone: 'check-circle', variante: 'primary', ocupado: st.busy, onClick: () => chamar(() => ord.concluirOrdem({ ordemId: o.id, trabalho: ed.trabalho, observacoes: ed.observacoes, retornoMeses: Number(ed.retorno), versao: o.v }), 'Ordem concluída. Histórico atualizado.'), id: 'btn-concluir' }),
        Botao({ texto: 'Salvar rascunho', ocupado: st.busy, onClick: () => chamar(() => ord.salvarOrdem({ ordemId: o.id, trabalho: ed.trabalho, observacoes: ed.observacoes, versao: o.v }), 'Alterações salvas.') }))) : null,
    o.estado === 'concluida' ? DL([['Trabalho realizado', o.trabalho], ['Observações', o.observacoes], ['Próximo retorno', o.proximoRetorno ? rotuloMes(o.proximoRetorno) : 'Sem retorno previsto']]) : null,
    o.estado === 'cancelada' ? h('p', { class: 'text2' }, 'Atendimento cancelado. Horário liberado.' + (o.observacoes ? ' ' + o.observacoes : '')) : null);

  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/empresas/ordens' }, gestor ? 'Ordens de serviço' : 'Meus atendimentos'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, o.id)),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('p', { class: 'small text2 tabular' }, o.id), h('h1', null, o.servicoNome), h('p', null, o.clienteNome)),
      h('div', { class: 'row' }, Badge('execucao', o.estado), Botao({ texto: 'Resumo imprimível', icone: 'printer', onClick: () => set(st, { dlg: 'resumo' }), id: 'btn-resumo' }))),
    o.pendente ? Alerta({ tipo: 'err', titulo: 'Atendimento a reatribuir' }, h('p', null, 'O profissional foi desvinculado. Reatribua a um profissional disponível ou combine um novo horário com o cliente.')) : null,
    st.res ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.res.message)) : null,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-dados-os' }, h('h2', { id: 'tit-dados-os' }, 'Dados do atendimento'),
      DL([['Agendamento', `${formatarIntervalo(o.inicio, o.fim, fuso)} · ${rotuloFuso(fuso, o.inicio)}`], ['Profissional', o.profissionalNome], ['Cliente', o.clienteNome], ['Equipamento', o.equipamento], ['Relato inicial', o.relato], o.solicitacaoId ? ['Solicitação de origem', gestor ? h('a', { href: '#/empresas/solicitacoes/' + o.solicitacaoId }, o.solicitacaoId) : o.solicitacaoId] : null]),
      gestor && o.estado === 'agendada' ? h('div', { class: 'stack-sm mt-1' },
        h('div', { class: 'row', style: 'align-items:flex-end' },
          Campo({ id: 'os-reatribuir', rotulo: 'Reatribuir profissional', valor: st.novoProf, onChange: v => set(st, { novoProf: v }), opcoes: [{ v: '', l: 'Escolher profissional…' }, ...candidatos.map(c => ({ v: c.id, l: `${c.nome} — ${c.motivo}`, desabilitado: !c.livre }))], classe: 'grow' }),
          Botao({ texto: 'Reatribuir', ocupado: st.busy, desabilitado: !st.novoProf, onClick: () => chamar(() => ord.reatribuirOrdem({ ordemId: o.id, profissionalId: st.novoProf, versao: o.v }), 'Ordem reatribuída.') })),
        h('div', null, Botao({ texto: 'Cancelar atendimento', variante: 'danger', icone: 'prohibit', onClick: () => set(st, { dlg: 'cancelar', just: '', res: null, erros: {} }) }))) : null),
    execucao,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-hist-os' }, h('h2', { id: 'tit-hist-os' }, 'Histórico de alterações'), LinhaDoTempo(o.historico.slice().reverse(), q => formatarRegistro(q, fuso))),
    h('p', { class: 'xsmall muted' }, 'O resumo da ordem não substitui documento fiscal, laudo técnico ou certificação.'),
    st.dlg === 'resumo' ? Dialogo({ id: 'dlg-resumo', titulo: 'Resumo imprimível', largo: true, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Fechar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Imprimir', icone: 'printer', variante: 'primary', onClick: () => window.print(), id: 'btn-imprimir' })] }, Resumo(o)) : null,
    st.dlg === 'cancelar' ? Dialogo({ id: 'dlg-cancelar-os', titulo: 'Cancelar atendimento?', alerta: true, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Voltar', onClick: () => set(st, { dlg: null }), autofocus: true }), Botao({ texto: 'Cancelar atendimento', variante: 'danger', ocupado: st.busy, onClick: () => chamar(() => ord.cancelarOrdem({ ordemId: o.id, justificativa: st.just, versao: o.v }), 'Atendimento cancelado. Horário liberado e cliente notificado.', 'info') })] },
    h('p', null, 'O horário será liberado e o cliente será notificado. Prefira combinar um novo horário quando possível.'),
    Campo({ id: 'os-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erros.justificativa })) : null);
}
