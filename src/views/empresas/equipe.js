// RF-EMP-04 · Profissionais: convidar, definir função, serviços e jornada, suspender, revogar (tratando cada
// atendimento futuro, com justificativa) e reativar — sem apagar histórico. Nada é cancelado silenciosamente.
import { h, Botao, Campo, Check, Alerta, Vazio, Dialogo, Badge, DL, LinhaDoTempo, Tabela, icone } from '../../ui/components.js';
import { estadoView, set, render, toast } from '../../store.js';
import * as comp from '../../api/companies.js';
import { empresaDoUsuario } from '../../api/companies.js';
import { formatarRegistro, formatarIntervalo, formatarData, dataBr, minParaHm, rotuloDia, proximosDias, dataLocal } from '../../domain/datas.js';
import { agora } from '../../api/clock.js';

const DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const HORAS = []; for (let m = 6 * 60; m <= 20 * 60; m += 30) HORAS.push(minParaHm(m));
export const textoJornada = j => (j ? `${DIAS.filter(([d]) => j.dias.includes(d)).map(([, l]) => l).join(', ')} · ${j.inicio}–${j.fim}${j.intervalo ? ` · intervalo ${j.intervalo.inicio}–${j.intervalo.fim}` : ''}` : 'A configurar após o aceite');

export function Profissionais({ usuario, empresaId }) {
  const st = estadoView('emp-pros:' + empresaId, () => ({ dlg: null, nome: '', email: '', erros: {}, busy: false }));
  const lista = comp.profissionaisDaEmpresa(usuario, empresaId);
  const convidar = async () => {
    set(st, { busy: true, erros: {} });
    const r = await comp.convidarProfissional({ empresaId, nome: st.nome, email: st.email });
    st.busy = false;
    if (r.ok) { st.dlg = null; st.nome = ''; st.email = ''; toast('Convite enviado. Ele aparece como pendente até o aceite.'); } else st.erros = (r.details && r.details.campos) || { nome: r.message };
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Profissionais'), h('p', null, 'Técnicos acessam apenas a própria agenda, os atendimentos atribuídos, o registro de execução e a ajuda.')),
      Botao({ texto: 'Convidar profissional', icone: 'user-plus', variante: 'primary', onClick: () => set(st, { dlg: 'convite', erros: {} }) })),
    Tabela({ id: 'tab-profissionais', rotulo: 'Profissionais da empresa', estado: st, linhas: lista, colunas: [
      { id: 'nome', titulo: 'Profissional', valor: p => p.nome, render: p => h('div', null, h('a', { class: 'cell-main', href: '#/empresas/profissionais/' + p.id }, p.nome), h('div', { class: 'cell-sub' }, p.funcao)) },
      { id: 'servicos', titulo: 'Serviços', valor: p => p.servicosNomes.join(', ') || '—' },
      { id: 'futuros', titulo: 'Atendimentos futuros', valor: p => String(p.futuros).padStart(3, '0'), render: p => h('span', { class: 'tabular' }, String(p.futuros)) },
      { id: 'sit', titulo: 'Situação', valor: p => p.situacao, render: p => Badge('registro', p.situacao) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: p => Botao({ texto: 'Abrir', pequeno: true, href: '#/empresas/profissionais/' + p.id, rotulo: 'Abrir ' + p.nome }) }
    ] }),
    st.dlg === 'convite' ? Dialogo({ id: 'dlg-convite', titulo: 'Convidar profissional', descricao: 'A pessoa recebe um convite e só acessa após aceitar. Função inicial: técnico. O convite expira em 7 dias.', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Enviar convite', variante: 'primary', ocupado: st.busy, onClick: convidar })] },
    Campo({ id: 'conv-nome', rotulo: 'Nome', obrigatorio: true, valor: st.nome, onInput: v => { st.nome = v; }, erro: st.erros.nome, maxlength: 120 }),
    Campo({ id: 'conv-email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, valor: st.email, onInput: v => { st.email = v; }, erro: st.erros.email, ajuda: 'Use um e-mail fictício terminado em @exemplo.invalid.' }),
    h('p', { class: 'small text2' }, 'Serviços e jornada são configurados depois do aceite.')) : null);
}

function EditorJornada({ p, usuario, empresaId, st }) {
  const servicos = comp.servicosDaEmpresa(usuario, empresaId).filter(s => s.situacao !== 'arquivado');
  const e = st.ed;
  const j = e.jornada;
  const muda = () => render();
  const salvar = async () => {
    set(st, { busy: true, erros: {} });
    const r = await comp.atualizarProfissional({ profissionalId: p.id, funcao: e.funcao, servicos: e.servicos, jornada: e.semIntervalo ? { ...j, intervalo: null } : j, folgas: e.folgas, versao: p.v });
    st.busy = false;
    if (r.ok) { st.ed = null; toast('Função, serviços e jornada atualizados. Novas disponibilidades já consideram as regras.'); } else st.erros = (r.details && r.details.campos) || { geral: r.message };
    render();
  };
  const hoje = dataLocal(agora());
  return h('section', { class: 'card stack', 'aria-labelledby': 'tit-ed-jornada' },
    h('h2', { id: 'tit-ed-jornada' }, 'Editar função, serviços e jornada'),
    st.erros.geral ? Alerta({ tipo: 'err' }, h('p', null, st.erros.geral)) : null,
    Campo({ id: 'pro-funcao', rotulo: 'Função', valor: e.funcao, onInput: v => { e.funcao = v; }, maxlength: 60 }),
    h('fieldset', { class: 'fieldset' }, h('legend', null, 'Serviços que executa'), h('div', { class: 'grid-2' }, servicos.map(s => Check({ id: 'pro-sv-' + s.id, rotulo: s.nome + (s.situacao === 'inativo' ? ' (inativo)' : ''), marcado: e.servicos.includes(s.id),
      onChange: v => { e.servicos = v ? [...e.servicos, s.id] : e.servicos.filter(x => x !== s.id); muda(); } })))),
    h('fieldset', { class: 'fieldset stack-sm' }, h('legend', null, 'Jornada e intervalos'),
      h('div', { class: 'row' }, DIAS.map(([d, l]) => Check({ id: 'pro-dia-' + d, rotulo: l, marcado: j.dias.includes(d), onChange: v => { j.dias = v ? [...j.dias, d] : j.dias.filter(x => x !== d); muda(); } }))),
      st.erros.dias ? h('p', { class: 'err-msg' }, icone('warning-circle'), st.erros.dias) : null,
      h('div', { class: 'form-grid' },
        Campo({ id: 'pro-ini', rotulo: 'Início da jornada', valor: j.inicio, onChange: v => { j.inicio = v; muda(); }, opcoes: HORAS.map(t => ({ v: t, l: t })) }),
        Campo({ id: 'pro-fim', rotulo: 'Fim da jornada', valor: j.fim, onChange: v => { j.fim = v; muda(); }, opcoes: HORAS.map(t => ({ v: t, l: t })), erro: st.erros.fim }),
        h('div', { class: 'full' }, Check({ id: 'pro-sem-int', rotulo: 'Sem intervalo', marcado: e.semIntervalo, onChange: v => { e.semIntervalo = v; muda(); } })),
        e.semIntervalo ? null : Campo({ id: 'pro-int-ini', rotulo: 'Início do intervalo', valor: j.intervalo.inicio, onChange: v => { j.intervalo.inicio = v; muda(); }, opcoes: HORAS.map(t => ({ v: t, l: t })) }),
        e.semIntervalo ? null : Campo({ id: 'pro-int-fim', rotulo: 'Fim do intervalo', valor: j.intervalo.fim, onChange: v => { j.intervalo.fim = v; muda(); }, opcoes: HORAS.map(t => ({ v: t, l: t })), erro: st.erros.intervalo }))),
    h('fieldset', { class: 'fieldset stack-sm' }, h('legend', null, 'Folgas'),
      e.folgas.length ? h('ul', { class: 'chips' }, e.folgas.map(d => h('li', { class: 'chip' }, dataBr(d), h('button', { type: 'button', 'aria-label': 'Remover folga ' + dataBr(d), onClick: () => { e.folgas = e.folgas.filter(x => x !== d); muda(); } }, icone('x'))))) : h('p', { class: 'small muted' }, 'Nenhuma folga cadastrada.'),
      h('div', { class: 'row', style: 'align-items:flex-end' }, Campo({ id: 'pro-nova-folga', rotulo: 'Adicionar folga', valor: e.novaFolga || '', onChange: v => { e.novaFolga = v; muda(); }, opcoes: [{ v: '', l: 'Escolher data…' }, ...proximosDias(hoje, 30, { pularDomingo: false }).map(d => ({ v: d, l: rotuloDia(d).completo }))] }),
        Botao({ texto: 'Adicionar', pequeno: true, desabilitado: !e.novaFolga, onClick: () => { if (!e.folgas.includes(e.novaFolga)) e.folgas = [...e.folgas, e.novaFolga].sort(); e.novaFolga = ''; muda(); } }))),
    h('div', { class: 'row' }, Botao({ texto: 'Salvar', variante: 'primary', ocupado: st.busy, onClick: salvar }), Botao({ texto: 'Cancelar', onClick: () => set(st, { ed: null, erros: {} }) })));
}

export function Profissional({ params, usuario, empresaId }) {
  const lista = comp.profissionaisDaEmpresa(usuario, empresaId);
  const p = lista.find(x => x.id === params.id);
  const st = estadoView('emp-pro:' + params.id, () => ({ enc: null, ed: null, busy: false, res: null, erros: {} }));
  if (!p) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'users', titulo: 'Profissional não encontrado', acoes: [Botao({ texto: 'Voltar', href: '#/empresas/profissionais' })] }));
  const emp = empresaDoUsuario(usuario, empresaId);
  const fuso = emp.fuso;
  const futuros = st.enc ? comp.atendimentosFuturos(usuario, empresaId, p.id) : [];
  const chamar = async (fn, msg, tipo) => {
    if (st.busy) return;
    set(st, { busy: true, res: null });
    const r = await fn();
    st.busy = false;
    if (r.ok) { st.enc = null; toast(msg, tipo); } else st.res = r;
    render();
  };
  let painelEnc = null;
  if (st.enc) {
    const e = st.enc;
    const pend = futuros.filter(f => !e.trat[f.id]).length;
    const justOk = e.just.trim().length >= 10;
    const pronto = pend === 0 && justOk;
    const dica = pend ? `Defina o tratamento de todos os atendimentos futuros (${pend} pendente${pend > 1 ? 's' : ''}).` : !justOk ? 'Informe a justificativa (mínimo de 10 caracteres).' : 'Pronto para ' + (e.acao === 'revogar' ? 'revogar.' : 'suspender.');
    const verbo = e.acao === 'revogar' ? 'Revogar acesso' : 'Suspender acesso';
    painelEnc = h('section', { class: 'card stack', 'aria-labelledby': 'tit-enc', id: 'painel-encerramento' },
      h('h2', { id: 'tit-enc' }, `${verbo} de ${p.curto}`),
      h('p', { class: 'strong' }, 'Etapa 1 · Revisar atendimentos futuros'),
      h('p', { class: 'small text2' }, 'Nenhum atendimento é cancelado automaticamente. Escolha um tratamento para cada um: reatribuir a um profissional disponível ou combinar novo horário com o cliente.'),
      futuros.length ? h('ul', { class: 'stack-sm' }, futuros.map(f => h('li', { class: 'card stack-xs', style: 'background:var(--raised)', key: 'f-' + f.id },
        h('p', null, h('span', { class: 'strong' }, `${f.ref} · ${f.servico}`), h('span', { class: 'small text2', style: 'display:block' }, `${formatarIntervalo(f.inicio, f.fim, fuso)} · ${f.estado === 'temporaria' ? 'Reserva temporária' : 'Confirmada'}`)),
        Campo({ id: 'trat-' + f.id, rotulo: 'Tratamento para ' + f.ref, valor: e.trat[f.id] || '', onChange: v => { e.trat[f.id] = v; st.res = null; render(); },
          opcoes: [{ v: '', l: 'Escolher tratamento…' }, ...f.opcoes.map(o => ({ v: o.id, l: `Reatribuir a ${o.nome} — ${o.motivo}`, desabilitado: !o.livre })), { v: 'combinar', l: 'Combinar novo horário com o cliente' }] }),
        e.trat[f.id] ? h('p', { class: 'small', style: 'color:var(--ok)' }, icone('check-circle'), ' Tratamento definido') : h('p', { class: 'small text2' }, icone('clock'), ' Pendente')))) : h('p', { class: 'muted' }, 'Sem atendimentos futuros.'),
      h('p', { class: 'strong' }, 'Etapa 2 · Justificativa (registrada na auditoria)'),
      Campo({ id: 'enc-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: e.just, onInput: v => { e.just = v; render(); }, maxlength: 500 }),
      st.res ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.res.message)) : null,
      h('p', { class: 'small', id: 'enc-dica', role: 'status' }, dica),
      h('div', { class: 'row' },
        Botao({ texto: verbo, variante: 'danger', ocupado: st.busy, desabilitado: !pronto, extra: { 'aria-describedby': 'enc-dica' }, id: 'btn-confirmar-encerramento',
          onClick: () => chamar(() => (e.acao === 'revogar' ? comp.revogarProfissional : comp.suspenderProfissional)({ profissionalId: p.id, tratamentos: e.trat, justificativa: e.just }),
            e.acao === 'revogar' ? `Acesso de ${p.curto} revogado. Histórico preservado e atendimentos tratados.` : `Acesso de ${p.curto} suspenso. Atendimentos tratados.`) }),
        Botao({ texto: 'Cancelar', onClick: () => set(st, { enc: null, res: null }) })),
      h('p', { class: 'xsmall muted' }, e.acao === 'revogar' ? 'O histórico de atendimentos e ordens permanece. O profissional deixa de acessar a empresa imediatamente. Bloqueios internos futuros dele são removidos.' : 'Suspender bloqueia o acesso temporariamente; o histórico é preservado.'));
  }
  const abrirEnc = acao => set(st, { enc: { acao, trat: {}, just: '' }, res: null, ed: null });
  const abrirEd = () => set(st, { ed: { funcao: p.funcao, servicos: [...p.servicos], jornada: JSON.parse(JSON.stringify(p.jornada || emp.jornadaPadrao)), semIntervalo: !(p.jornada || emp.jornadaPadrao).intervalo, folgas: [...(p.folgas || [])] }, enc: null, erros: {} });
  if (st.ed && !st.ed.jornada.intervalo) st.ed.jornada.intervalo = { inicio: '12:00', fim: '13:00' };
  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/empresas/profissionais' }, 'Profissionais'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, p.nome)),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('h1', null, p.nome), h('p', null, `${p.funcao} · ${p.email || 'e-mail não informado'}`)), Badge('registro', p.situacao)),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-funcao' }, h('div', { class: 'card-head' }, h('h2', { id: 'tit-funcao' }, 'Função e jornada'), ['ativo', 'suspenso'].includes(p.situacao) && !st.ed ? Botao({ texto: 'Editar', icone: 'pencil-simple', pequeno: true, onClick: abrirEd }) : null),
      DL([['Serviços', p.servicosNomes.join(', ') || 'Nenhum serviço definido'], ['Jornada', textoJornada(p.jornada)], ['Folgas', (p.folgas || []).map(dataBr).join(', ') || 'Nenhuma'], ['Permissões', 'Própria agenda, atendimentos atribuídos, registro de execução e ajuda.']])),
    st.ed ? EditorJornada({ p, usuario, empresaId, st }) : null,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-acesso' }, h('h2', { id: 'tit-acesso' }, 'Acesso'),
      p.situacao === 'ativo' ? h('div', { class: 'stack-sm' },
        h('p', { class: 'text2' }, `Suspender bloqueia o acesso temporariamente. Revogar encerra o vínculo com a empresa. Em ambos, o histórico é preservado. ${p.futuros} atendimento(s) futuro(s).`),
        st.enc ? null : h('div', { class: 'row' }, Botao({ texto: 'Suspender acesso', icone: 'pause-circle', onClick: () => abrirEnc('suspender') }), Botao({ texto: 'Revogar acesso', icone: 'prohibit', variante: 'danger', onClick: () => abrirEnc('revogar'), id: 'btn-revogar' }))) : null,
      p.situacao === 'suspenso' ? h('div', { class: 'stack-sm' }, h('p', { class: 'text2' }, 'Acesso suspenso. Atendimentos atribuídos foram tratados; a gestão continua vendo o histórico.'),
        st.enc ? null : h('div', { class: 'row' }, Botao({ texto: 'Reativar acesso', variante: 'primary', ocupado: st.busy, onClick: () => chamar(() => comp.reativarProfissional({ profissionalId: p.id }), 'Acesso reativado.') }), Botao({ texto: 'Revogar acesso', variante: 'danger', onClick: () => abrirEnc('revogar') }))) : null,
      ['convite', 'convite_expirado'].includes(p.situacao) ? h('div', { class: 'stack-sm' },
        h('p', { class: 'text2' }, p.situacao === 'convite' ? `Convite enviado em ${formatarData(p.conviteEm, fuso)}, ainda não aceito. Expira em ${formatarData(p.conviteExpiraEm, fuso)}.` : 'Convite expirado sem aceite.'),
        h('div', { class: 'row' }, Botao({ texto: 'Reenviar convite', icone: 'envelope-simple', ocupado: st.busy, onClick: () => chamar(() => comp.reenviarConvite({ profissionalId: p.id }), 'Convite reenviado (demonstração).', 'info') }),
          Botao({ texto: 'Revogar convite', variante: 'danger', ocupado: st.busy, onClick: () => chamar(() => comp.revogarConvite({ profissionalId: p.id }), 'Convite revogado.', 'info') }))) : null,
      p.situacao === 'revogado' ? h('p', { class: 'text2' }, 'Acesso revogado. O nome continua nas ordens e no histórico já registrados.') : null),
    painelEnc,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-vinculo' }, h('h2', { id: 'tit-vinculo' }, 'Histórico do vínculo'), LinhaDoTempo((p.historico || []).slice().reverse(), q => formatarRegistro(q, fuso))));
}
