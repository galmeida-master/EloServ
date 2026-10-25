// RF-EMP-06 · Solicitações e propostas da empresa: lista com situação e prazo da reserva; análise com
// atribuição de profissional (disponibilidade e elegibilidade), proposta, recusa e reagendamento.
import { h, Botao, Campo, Check, Alerta, Vazio, Dialogo, Badge, DL, LinhaDoTempo, Tabela, FaixaDatas, Horarios, icone } from '../../ui/components.js';
import { ui, estadoView, set, render, toast, navegar, novaChave } from '../../store.js';
import * as req from '../../api/requests.js';
import { horariosPublicos, diasParaSolicitacao } from '../../api/agenda.js';
import { empresaDoUsuario } from '../../api/companies.js';
import { ler } from '../../api/db.js';
import { agora } from '../../api/clock.js';
import { formatarDataHora, formatarPrazo, formatarRegistro, formatarData, rotuloFuso, rotuloDia, dataLocal, dataBr, horaLocal, emMs, HORA } from '../../domain/datas.js';
import { lerMoeda, rotuloTotal, centavosParaCampo } from '../../domain/dinheiro.js';
import { textoDuracao } from '../public/perfil.js';

export function Solicitacoes({ usuario, empresaId }) {
  const st = estadoView('emp-sols:' + empresaId, () => ({}));
  const lista = req.solicitacoesDaEmpresa(usuario, empresaId);
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Solicitações e orçamentos'), h('p', null, 'Responda dentro do prazo da reserva temporária. Após expirar, o horário é liberado.'))),
    lista.length ? Tabela({ id: 'tab-solicitacoes', rotulo: 'Solicitações da empresa', estado: st, linhas: lista, colunas: [
      { id: 'sol', titulo: 'Solicitação', valor: s => `${s.servicoNome} ${s.id}`, render: s => h('div', null, h('a', { href: '#/empresas/solicitacoes/' + s.id, class: 'cell-main' }, s.servicoNome), h('div', { class: 'cell-sub tabular' }, s.id)) },
      { id: 'cli', titulo: 'Cliente', valor: s => s.clienteNome },
      { id: 'quando', titulo: 'Horário desejado', valor: s => s.inicio || '', render: s => h('span', { class: 'tabular' }, s.inicio ? formatarDataHora(s.inicio, s.fuso) : 'Sem horário definido') },
      { id: 'sit', titulo: 'Situação', valor: s => s.estado, render: s => h('div', { class: 'stack-xs' }, Badge('solicitacao', s.estado), s.reagendamento ? h('span', { class: 'badge t-w' }, icone('calendar-plus'), 'Reagendamento pedido') : null) },
      { id: 'agenda', titulo: 'Agenda', valor: s => s.estadoOcupacao, render: s => h('div', { class: 'stack-xs' }, Badge('ocupacao', s.estadoOcupacao), s.expiraEm ? h('span', { class: 'cell-sub tabular' }, 'expira ' + formatarPrazo(s.expiraEm, s.fuso)) : null) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: s => Botao({ texto: 'Abrir', pequeno: true, href: '#/empresas/solicitacoes/' + s.id, rotulo: 'Abrir ' + s.id }) }
    ] }) : h('div', { class: 'card' }, Vazio({ icone: 'clipboard-text', titulo: 'Nenhuma solicitação recebida', texto: 'Quando um cliente solicitar um serviço pelo perfil público, ela aparece aqui.' })));
}

function itensPadrao(s) {
  const sv = ler().servicos.find(x => x.id === s.servicoId);
  if (!sv) return [{ descricao: '', valor: '', opcional: false }];
  const valor = sv.tipoPreco === 'orcamento' ? sv.visitaCentavos || null : sv.precoCentavos;
  return [{ descricao: sv.nome + (sv.tipoPreco === 'orcamento' ? ' — visita técnica e diagnóstico' : ''), valor: centavosParaCampo(valor), opcional: false }];
}

export function Solicitacao({ params, usuario, empresaId }) {
  const s = req.solicitacaoDaEmpresa(usuario, empresaId, params.id);
  const st = estadoView('emp-sol:' + params.id, () => ({ dlg: null, busy: false, res: null, erros: {}, form: null, analise: false, texto: '' }));
  if (!s) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'clipboard-text', titulo: 'Solicitação não encontrada nesta empresa', texto: 'Ela não existe ou pertence a outra empresa.', acoes: [Botao({ texto: 'Voltar', href: '#/empresas/solicitacoes' })] }));
  ui.contextoSim = { tipo: 'solicitacao', id: s.id };
  const emp = empresaDoUsuario(usuario, empresaId);
  const fuso = s.fuso;
  if (s.estado === 'enviada' && !st.analise) {
    st.analise = true;
    queueMicrotask(async () => { const r = await req.iniciarAnalise({ solicitacaoId: s.id }); if (r.ok && st.form) st.form.versao = (req.solicitacaoDaEmpresa(usuario, empresaId, s.id) || {}).v; render(); });
  }
  const editavel = ['enviada', 'em_analise'].includes(s.estado);
  if (editavel && !st.form) {
    const oc = ler().ocupacoes.find(o => o.id === s.ocupacaoId);
    const validade = s.inicio && emMs(s.inicio) - agora() < 50 * HORA ? '24' : '48';
    st.form = { versao: s.v, profissionalId: oc && oc.estado === 'temporaria' ? oc.profissionalId : '', inicio: s.inicio || '', data: s.inicio ? dataLocal(s.inicio, fuso) : diasParaSolicitacao(undefined, { fuso })[0], alterar: !s.inicio,
      itens: itensPadrao(s), validade, condicoes: 'Pagamento combinado diretamente com o cliente após o atendimento. A EloServ não processa pagamentos.', observacoes: '', chave: novaChave() };
  }
  const f = st.form;
  const candidatos = editavel ? req.candidatosProposta(usuario, empresaId, s.id, f.inicio || null) : [];
  const horarios = editavel && f.alterar && f.profissionalId ? req.horariosDoProfissional(usuario, empresaId, s.id, f.profissionalId, f.data) : [];
  const itensProcessados = editavel ? f.itens.map(i => ({ descricao: i.descricao, valorCentavos: String(i.valor).trim() ? lerMoeda(i.valor) : null, valorInvalido: String(i.valor).trim() !== '' && lerMoeda(i.valor) == null, opcional: i.opcional })) : [];
  const muda = patch => { Object.assign(f, patch); st.res = null; for (const k of Object.keys(patch)) delete st.erros[k]; render(); };

  const enviar = async () => {
    if (st.busy) return;
    set(st, { busy: true, res: null, erros: {} });
    const r = await req.enviarProposta({ solicitacaoId: s.id, profissionalId: f.profissionalId, inicio: f.inicio, itens: itensProcessados, validadeHoras: Number(f.validade), condicoes: f.condicoes, observacoes: f.observacoes, versao: f.versao });
    st.busy = false;
    if (r.ok) { st.form = null; toast('Proposta enviada. A reserva temporária segue até a resposta do cliente.'); }
    else if (r.code === 'VALIDACAO') st.erros = (r.details && r.details.campos) || {};
    else if (r.code === 'SESSAO_EXPIRADA') { navegar('/sessao-expirada?volta=' + encodeURIComponent('/empresas/solicitacoes/' + s.id)); return; }
    else st.res = r;
    render();
  };
  const acao = async (fn, msg, tipo) => {
    if (st.busy) return;
    set(st, { busy: true, res: null });
    const r = await fn();
    st.busy = false;
    if (r.ok) { st.dlg = null; st.form = null; toast(msg, tipo); } else st.res = r;
    render();
  };

  const proposta = editavel ? h('section', { class: 'card stack', 'aria-labelledby': 'tit-proposta-emp' },
    h('h2', { id: 'tit-proposta-emp' }, '1. Atribuir profissional'),
    h('p', { class: 'small text2' }, `Considera serviços que cada profissional executa, jornada, folgas, bloqueios e ${emp.preparoMin} min de preparo/deslocamento.`),
    h('div', { class: 'stack-xs', role: 'radiogroup', 'aria-label': 'Profissional', 'aria-describedby': st.erros.profissionalId ? 'prof-erro' : null },
      candidatos.map(c => h('button', { type: 'button', role: 'radio', class: 'option-card', 'aria-checked': String(f.profissionalId === c.id), 'aria-disabled': c.livre ? null : 'true',
        onClick: () => { if (c.livre) muda({ profissionalId: c.id }); } },
      h('span', { class: 'radio-dot', 'aria-hidden': 'true' }), h('span', { class: 'stack-xs grow' }, h('span', { class: 'strong' }, c.nome), h('span', { class: 'small ' + (c.livre ? '' : 'text2') }, c.livre ? icone('check-circle') : icone('minus-circle'), ' ', c.motivo))))),
    st.erros.profissionalId ? h('p', { class: 'err-msg', id: 'prof-erro' }, icone('warning-circle'), st.erros.profissionalId) : null,
    h('h2', null, '2. Proposta'),
    h('div', { class: 'stack-sm' },
      h('p', null, h('span', { class: 'strong' }, 'Data proposta: '), f.inicio ? `${formatarDataHora(f.inicio, fuso)} · ${rotuloFuso(fuso, f.inicio)}` : 'Escolha a data e o horário'),
      f.alterar ? h('div', { class: 'stack-sm' },
        FaixaDatas({ rotulo: 'Dia proposto', datas: diasParaSolicitacao(undefined, { fuso }), selecionada: f.data, onEscolher: d => muda({ data: d, inicio: '' }), rotuloDe: rotuloDia }),
        f.profissionalId ? (horarios.length ? Horarios({ rotulo: 'Horários livres do profissional em ' + dataBr(f.data), slots: horarios.map(x => ({ ...x, livre: true })), selecionado: f.inicio, onEscolher: x => muda({ inicio: x.inicio }) }) : h('p', { class: 'small muted' }, 'Sem horários livres para este profissional neste dia.'))
          : h('p', { class: 'small muted' }, 'Escolha um profissional para ver os horários livres dele.')) : Botao({ texto: 'Propor outra data ou horário', variante: 'ghost', pequeno: true, onClick: () => muda({ alterar: true }) }),
      st.erros.inicio ? h('p', { class: 'err-msg' }, icone('warning-circle'), st.erros.inicio) : null),
    h('fieldset', { class: 'fieldset stack-sm' }, h('legend', null, 'Itens e valores'),
      f.itens.map((it, i) => h('div', { class: 'row', key: 'it' + i, style: 'align-items:flex-end' },
        Campo({ id: `item-desc-${i}`, rotulo: `Descrição do item ${i + 1}`, valor: it.descricao, onInput: v => { it.descricao = v; render(); }, classe: 'grow', maxlength: 160 }),
        Campo({ id: `item-valor-${i}`, rotulo: 'Valor (R$)', valor: it.valor, onInput: v => { it.valor = v; render(); }, inputmode: 'decimal', placeholder: '0,00', erro: itensProcessados[i] && itensProcessados[i].valorInvalido ? 'Valor inválido' : null, extra: { style: 'max-width:140px' } }),
        Check({ id: `item-opc-${i}`, rotulo: 'Se necessário', marcado: it.opcional, onChange: v => { it.opcional = v; render(); } }),
        f.itens.length > 1 ? Botao({ icone: 'trash', variante: 'ghost', rotulo: `Remover item ${i + 1}`, onClick: () => { f.itens.splice(i, 1); render(); } }) : null)),
      h('div', null, Botao({ texto: 'Adicionar item', icone: 'plus', pequeno: true, onClick: () => { f.itens.push({ descricao: '', valor: '', opcional: false }); render(); } })),
      st.erros.itens ? h('p', { class: 'err-msg' }, icone('warning-circle'), st.erros.itens) : null,
      h('p', null, h('span', { class: 'strong' }, 'Total estimado: '), h('span', { class: 'tabular' }, rotuloTotal(itensProcessados.filter(i => i.descricao.trim()))))),
    h('div', { class: 'form-grid' },
      Campo({ id: 'prop-validade', rotulo: 'Validade da proposta', valor: f.validade, onChange: v => muda({ validade: v }), opcoes: [['24', '24 horas'], ['48', '48 horas'], ['72', '72 horas']].map(([v, l]) => ({ v, l })), erro: st.erros.validade, ajuda: 'A reserva temporária acompanha a validade.' }),
      Campo({ id: 'prop-condicoes', rotulo: 'Condições', linhas: 3, valor: f.condicoes, onInput: v => { f.condicoes = v; }, classe: 'full', maxlength: 500 }),
      Campo({ id: 'prop-obs', rotulo: 'Observações ao cliente', linhas: 2, valor: f.observacoes, onInput: v => { f.observacoes = v; }, classe: 'full', maxlength: 500 })),
    st.res ? Alerta({ tipo: 'err', foco: true, titulo: st.res.code === 'CONFLITO_ATUALIZACAO' ? 'A solicitação mudou desde que você abriu esta tela' : 'Não foi possível enviar a proposta',
      acoes: st.res.code === 'CONFLITO_ATUALIZACAO' ? [Botao({ texto: 'Recarregar dados', onClick: () => { st.form = null; st.res = null; render(); } })] : null }, h('p', null, st.res.message)) : null,
    h('div', { class: 'row' },
      Botao({ texto: 'Enviar proposta', icone: 'paper-plane-tilt', variante: 'primary', ocupado: st.busy, textoOcupado: 'Revalidando e enviando…', onClick: enviar, id: 'btn-enviar-proposta' }),
      Botao({ texto: 'Recusar solicitação', variante: 'danger', onClick: () => set(st, { dlg: 'recusar', texto: '', res: null }) }))) : null;

  const rg = s.reagendamento;
  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/empresas/solicitacoes' }, 'Solicitações'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, s.id)),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('p', { class: 'small text2 tabular' }, `${s.id} · recebida em ${formatarRegistro(s.criadaEm, fuso)}`), h('h1', null, s.servicoNome), h('p', null, s.clienteNome)),
      h('div', { class: 'row' }, Badge('solicitacao', s.estado), Badge('ocupacao', s.estadoOcupacao))),
    s.expiraEm && editavel ? Alerta({ tipo: 'warn' }, h('p', null, `Reserva temporária válida até ${formatarPrazo(s.expiraEm, fuso)}. Sem resposta até lá, a solicitação expira e o horário é liberado.`)) : null,
    s.ajuste && editavel ? Alerta({ tipo: 'info', titulo: 'Ajuste solicitado pelo cliente' }, h('p', null, s.ajuste)) : null,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-pedido' }, h('h2', { id: 'tit-pedido' }, 'Pedido do cliente'),
      DL([['Horário desejado', s.inicioDesejado ? `${formatarDataHora(s.inicioDesejado, fuso)} · ${rotuloFuso(fuso, s.inicioDesejado)}` : 'Sem horário definido'], ['Duração estimada', textoDuracao(s.duracaoMin)],
        ['Equipamento', s.equipamento], ['Local', s.local ? `${s.local.rotulo} · ${s.local.bairro}, ${s.local.cidade}${s.local.referencia ? ' · ' + s.local.referencia : ''}` : '—'], ['Relato', s.descricao], ['Profissional', s.profissionalAtual || 'Não atribuído']])),
    proposta,
    s.estado === 'proposta' ? Alerta({ tipo: 'info', titulo: 'Aguardando o cliente' }, h('p', null, `Proposta enviada com ${s.propostaProfissional} para ${formatarDataHora(s.proposta.inicio, fuso)}. A reserva temporária segue até ${formatarPrazo(s.proposta.validadeEm, fuso)}. Quando o cliente confirmar, o horário é revalidado e a ordem de serviço é criada.`),
      h('div', null, Botao({ texto: 'Recusar ou encerrar solicitação', variante: 'ghost', pequeno: true, onClick: () => set(st, { dlg: 'recusar', texto: '', res: null }) }))) : null,
    s.estado === 'aceita' ? Alerta({ tipo: 'ok', titulo: 'Agendamento confirmado' }, h('p', null, `Ordem de serviço ${s.ordemId} · ${formatarDataHora(s.inicio, fuso)} · ${s.profissionalAtual || 'a reatribuir'}.`),
      h('div', { class: 'row' }, Botao({ texto: 'Abrir ordem de serviço', href: '#/empresas/ordens/' + s.ordemId }),
        !rg && s.estadoExecucao === 'agendada' ? Botao({ texto: 'Propor novo horário ao cliente', icone: 'calendar-plus', onClick: () => set(st, { dlg: 'reagendar', rsData: diasParaSolicitacao(undefined, { fuso })[0], rsInicio: null, res: null, chave: novaChave() }) }) : null)) : null,
    rg && rg.origem === 'cliente' ? Alerta({ tipo: 'warn', titulo: `Pedido de reagendamento para ${formatarDataHora(rg.novoInicio, fuso)}`,
      acoes: [Botao({ texto: 'Confirmar troca', variante: 'primary', ocupado: st.busy, id: 'btn-confirmar-troca', onClick: () => acao(() => req.responderReagendamento({ solicitacaoId: s.id, aceitar: true, versao: s.v }), 'Reagendamento confirmado. Horário anterior liberado.') }),
        Botao({ texto: 'Recusar troca', ocupado: st.busy, onClick: () => acao(() => req.responderReagendamento({ solicitacaoId: s.id, aceitar: false, versao: s.v }), 'Pedido recusado. Horário original mantido.', 'info') })] },
    h('p', null, `O horário atual (${formatarDataHora(s.inicio, fuso)}) continua reservado até a troca ser confirmada. O novo horário está reservado temporariamente. Responder até ${formatarPrazo(rg.prazo, fuso)}.`), rg.motivo ? h('p', { class: 'small' }, 'Motivo: ' + rg.motivo) : null) : null,
    rg && rg.origem === 'empresa' ? Alerta({ tipo: 'info', titulo: `Novo horário proposto ao cliente: ${formatarDataHora(rg.novoInicio, fuso)}` }, h('p', null, `Aguardando resposta do cliente até ${formatarPrazo(rg.prazo, fuso)}. O horário atual continua reservado.`),
      h('div', null, Botao({ texto: 'Retirar proposta de novo horário', pequeno: true, onClick: () => acao(() => req.retirarReagendamento({ solicitacaoId: s.id, versao: s.v }), 'Proposta retirada. Horário original mantido.', 'info') }))) : null,
    ['recusada', 'expirada', 'cancelada'].includes(s.estado) ? Alerta({ tipo: 'info', titulo: 'Solicitação encerrada' }, h('p', null, 'Nenhum horário reservado.' + (s.motivoEncerramento ? ' Motivo: ' + s.motivoEncerramento : ''))) : null,
    st.res && !editavel ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.res.message)) : null,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-hist' }, h('h2', { id: 'tit-hist' }, 'Histórico'), LinhaDoTempo(s.linhaDoTempo.slice().reverse(), q => formatarRegistro(q, fuso))),
    st.dlg === 'recusar' ? Dialogo({ id: 'dlg-recusar-sol', titulo: 'Recusar solicitação?', descricao: 'A reserva temporária será liberada e o cliente será notificado.', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Voltar', onClick: () => set(st, { dlg: null }), desabilitado: st.busy }), Botao({ texto: 'Recusar', variante: 'danger', ocupado: st.busy, onClick: () => acao(() => req.recusarSolicitacao({ solicitacaoId: s.id, motivo: st.texto, versao: s.v }), 'Solicitação recusada. O horário foi liberado.', 'info') })] },
    Campo({ id: 'recusa-sol-motivo', rotulo: 'Motivo ao cliente (opcional)', linhas: 3, valor: st.texto, onInput: v => { st.texto = v; }, maxlength: 300 }),
    st.res ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null) : null,
    st.dlg === 'reagendar' ? (() => {
      const slots = horariosPublicos({ empresaId, servicoId: s.servicoId, data: st.rsData }).filter(x => x.inicio !== s.inicio);
      return Dialogo({ id: 'dlg-reag-emp', titulo: 'Propor novo horário ao cliente', descricao: `O horário atual (${formatarDataHora(s.inicio, fuso)}) continua reservado até o cliente aceitar.`, largo: true, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
        rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Enviar ao cliente', variante: 'primary', ocupado: st.busy, onClick: () => { if (!st.rsInicio) { st.res = { message: 'Escolha um novo horário.' }; render(); return; } acao(() => req.solicitarReagendamento({ solicitacaoId: s.id, inicio: st.rsInicio, idempotencyKey: st.chave + st.rsInicio }), 'Novo horário proposto ao cliente. O horário atual continua reservado.'); } })] },
      FaixaDatas({ rotulo: 'Novo dia', datas: diasParaSolicitacao(undefined, { fuso }), selecionada: st.rsData, onEscolher: d => set(st, { rsData: d, rsInicio: null }), rotuloDe: rotuloDia }),
      slots.length ? Horarios({ rotulo: 'Horários em ' + dataBr(st.rsData), slots, selecionado: st.rsInicio, onEscolher: x => set(st, { rsInicio: x.inicio, res: null }) }) : h('p', { class: 'muted small' }, 'Sem horários livres neste dia.'),
      st.res ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null);
    })() : null);
}

export { horaLocal, formatarData };
