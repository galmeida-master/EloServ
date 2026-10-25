// RF-ADM-01/02 · Visão geral e empresas: análise cadastral; habilitar, suspender, reativar e arquivar
// sempre com justificativa e registro em auditoria.
import { h, Botao, Campo, Check, Alerta, Vazio, Dialogo, Badge, DL, Tabela, icone } from '../../ui/components.js';
import { estadoView, set, render, toast } from '../../store.js';
import * as comp from '../../api/companies.js';
import { usuariosAdmin } from '../../api/users.js';
import { listarAuditoria } from '../../api/audit.js';
import { chamadosSuporte } from '../../api/kb.js';
import { formatarData, formatarRegistro } from '../../domain/datas.js';
import { rotulo } from '../../domain/estados.js';

export function Visao({ usuario }) {
  const emps = comp.empresasAdmin(usuario);
  const u = usuariosAdmin(usuario).lista;
  const pend = emps.filter(e => e.situacao === 'aguardando');
  const recentes = listarAuditoria(usuario).slice(0, 6);
  const sup = chamadosSuporte(usuario).filter(s => s.situacao === 'aberta').length;
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Visão geral'), h('p', null, 'Situação operacional da plataforma. Valores derivados dos dados demonstrativos.'))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'av-sit' }, h('h2', { id: 'av-sit' }, 'Empresas por situação'),
      h('ul', { class: 'row' }, ['aguardando', 'ativa', 'preenchimento', 'suspensa', 'arquivada'].map(k => h('li', null, h('a', { href: '#/admin/empresas?situacao=' + k, class: 'kpi', style: 'min-width:150px' }, h('span', { class: 'n' }, String(emps.filter(e => e.situacao === k).length)), Badge('empresa', k)))))),
    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'av-pend' }, h('h2', { id: 'av-pend' }, 'Aguardando habilitação'),
        pend.length ? h('ul', { class: 'list' }, pend.map(e => h('li', { key: e.id }, h('a', { class: 'list-item', href: '#/admin/empresas/' + e.id }, h('span', { class: 'main' }, h('span', { class: 'strong' }, e.nome), h('span', { class: 'small text2' }, `${e.cidade} · cadastro em ${formatarData(e.dataCadastro)}`)), h('span', { class: 'small' }, 'Analisar cadastro')))))
          : h('p', { class: 'muted' }, 'Nenhum cadastro aguardando análise.')),
      h('section', { class: 'stack-sm', 'aria-label': 'Indicadores de acesso e suporte' },
        h('div', { class: 'kpis' },
          h('a', { class: 'kpi', href: '#/admin/usuarios' }, h('span', { class: 'n' }, String(u.filter(x => x.situacao === 'ativo').length)), h('span', { class: 'l' }, 'Usuários ativos')),
          h('a', { class: 'kpi', href: '#/admin/usuarios' }, h('span', { class: 'n' }, String(u.filter(x => x.situacao === 'suspenso').length)), h('span', { class: 'l' }, 'Suspensos')),
          h('a', { class: 'kpi', href: '#/admin/suporte' }, h('span', { class: 'n' }, String(sup)), h('span', { class: 'l' }, 'Suporte em aberto'))))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'av-rec' }, h('div', { class: 'card-head' }, h('h2', { id: 'av-rec' }, 'Atividades administrativas recentes'), Botao({ texto: 'Ver auditoria', variante: 'ghost', href: '#/admin/auditoria' })),
      recentes.length ? h('ul', { class: 'list' }, recentes.map(a => h('li', { class: 'list-item', key: a.id }, h('span', { class: 'main' }, h('span', { class: 'strong' }, `${a.acao} · ${a.entidade}`), h('span', { class: 'small text2' }, `${formatarRegistro(a.quando)} · ${a.quem}`))))) : h('p', { class: 'muted' }, 'Sem atividades registradas.')));
}

export function Empresas({ usuario, query }) {
  const st = estadoView('adm-emps', () => ({ situacao: query.situacao || '', cidade: '', desde: '' }));
  if (query.situacao && st._q !== query.situacao) { st._q = query.situacao; st.situacao = query.situacao; }
  const todas = comp.empresasAdmin(usuario);
  const cidades = [...new Set(todas.map(e => e.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const lista = todas.filter(e => (!st.situacao || e.situacao === st.situacao) && (!st.cidade || e.cidade === st.cidade) && (!st.desde || e.dataCadastro.slice(0, 10) >= st.desde));
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Empresas'), h('p', null, 'Busca e filtros por situação, cidade e data de cadastro.'))),
    h('div', { class: 'grid-3' },
      Campo({ id: 'adm-f-sit', rotulo: 'Situação', valor: st.situacao, onChange: v => set(st, { situacao: v, pagina: 1 }), opcoes: [{ v: '', l: 'Todas as situações' }, ...['preenchimento', 'aguardando', 'ativa', 'suspensa', 'arquivada'].map(k => ({ v: k, l: rotulo('empresa', k).label }))] }),
      Campo({ id: 'adm-f-cid', rotulo: 'Cidade', valor: st.cidade, onChange: v => set(st, { cidade: v, pagina: 1 }), opcoes: [{ v: '', l: 'Todas as cidades' }, ...cidades.map(c => ({ v: c, l: c }))] }),
      Campo({ id: 'adm-f-data', rotulo: 'Cadastradas a partir de', tipo: 'date', valor: st.desde, onInput: v => set(st, { desde: v, pagina: 1 }) })),
    h('p', { class: 'small text2', role: 'status' }, `${lista.length} de ${todas.length} empresas`),
    Tabela({ id: 'tab-adm-empresas', rotulo: 'Empresas cadastradas', estado: st, linhas: lista, vazio: 'Nenhuma empresa com esses filtros.', placeholder: 'Buscar empresa, cidade ou responsável...', colunas: [
      { id: 'nome', titulo: 'Empresa', valor: e => e.nome, render: e => h('div', null, h('a', { class: 'cell-main wrap-anywhere', href: '#/admin/empresas/' + e.id }, e.nome), h('div', { class: 'cell-sub' }, 'Responsável: ' + e.responsavel)) },
      { id: 'cidade', titulo: 'Cidade', valor: e => e.cidade },
      { id: 'cad', titulo: 'Cadastro', valor: e => e.dataCadastro, render: e => h('span', { class: 'tabular' }, formatarData(e.dataCadastro)) },
      { id: 'sit', titulo: 'Situação', valor: e => e.situacao, render: e => Badge('empresa', e.situacao) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: e => Botao({ texto: e.situacao === 'aguardando' ? 'Analisar cadastro' : 'Ver detalhes', pequeno: true, variante: e.situacao === 'aguardando' ? 'primary' : 'secondary', href: '#/admin/empresas/' + e.id, rotulo: (e.situacao === 'aguardando' ? 'Analisar cadastro de ' : 'Ver detalhes de ') + e.nome }) }
    ] }));
}

const ACOES = {
  habilitar: { titulo: 'Habilitar', botao: 'Habilitar e registrar', impactos: ['O perfil público passa a aparecer no catálogo.', 'A empresa pode receber solicitações.', 'Habilitação não representa certificação técnica.'] },
  suspender: { titulo: 'Suspender', botao: 'Suspender', impactos: ['Perfil público deixa de aparecer no catálogo.', 'Novas solicitações ficam bloqueadas.', 'Atendimentos confirmados permanecem e precisam ser tratados pela empresa com seus clientes. Nada é cancelado automaticamente.', 'Histórico preservado.'] },
  reativar: { titulo: 'Reativar', botao: 'Reativar', impactos: ['O perfil volta ao catálogo e a empresa volta a receber solicitações.'] },
  arquivar: { titulo: 'Arquivar', botao: 'Arquivar', impactos: ['A empresa deixa de operar na plataforma.', 'Dados e histórico ficam preservados para consulta. Não há exclusão.'] }
};

export function Empresa({ params, usuario }) {
  const e = comp.empresasAdmin(usuario).find(x => x.id === params.id);
  const st = estadoView('adm-emp:' + params.id, () => ({ dlg: null, just: '', erro: null, busy: false }));
  if (!e) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'buildings', titulo: 'Empresa não encontrada', acoes: [Botao({ texto: 'Voltar', href: '#/admin/empresas' })] }));
  const hist = listarAuditoria(usuario, { empresaId: e.id }).filter(a => a.tipo !== 'reserva').slice(0, 10);
  const itens = comp.ITENS_ANALISE;
  const feitos = itens.filter(([k]) => e.analise[k]).length;
  const completo = feitos === itens.length;
  const abrir = acao => set(st, { dlg: acao, just: '', erro: null });
  const confirmar = async () => {
    set(st, { busy: true, erro: null });
    const r = await comp.alterarSituacaoEmpresa({ empresaId: e.id, acao: st.dlg, justificativa: st.just });
    st.busy = false;
    if (r.ok) {
      const msgs = { habilitar: 'Empresa habilitada. Perfil público disponível e registro de auditoria criado.', suspender: 'Empresa suspensa. Perfil oculto e novas solicitações bloqueadas.', reativar: 'Empresa reativada.', arquivar: 'Empresa arquivada. Histórico preservado.' };
      toast(msgs[st.dlg], st.dlg === 'suspender' ? 'warn' : 'ok');
      st.dlg = null;
    } else st.erro = r.message;
    render();
  };
  const cfg = st.dlg ? ACOES[st.dlg] : null;
  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/admin/empresas' }, 'Empresas'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, e.nome)),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('h1', { class: 'wrap-anywhere' }, e.nome), h('p', null, `${e.cidade} · cadastro em ${formatarData(e.dataCadastro)} · empresa fictícia`)), Badge('empresa', e.situacao)),
    e.situacao === 'suspensa' && e.justificativa ? Alerta({ tipo: 'warn' }, h('p', null, 'Justificativa registrada: ' + e.justificativa)) : null,
    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'ae-cad' }, h('h2', { id: 'ae-cad' }, 'Cadastro e responsáveis'),
        DL([['CNPJ', e.cnpj + ' (fictício)'], ['Responsável', e.responsavel], ['E-mail', e.emailMascarado + ' (parcialmente oculto)'], ['Área atendida', e.area.join(', ')], ['Serviços publicados', String(e.servicosPublicados)], ['Atendimentos futuros', `${e.futuros} (apenas contagem)`]])),
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'ae-analise' }, h('div', { class: 'card-head' }, h('h2', { id: 'ae-analise' }, 'Análise cadastral'), h('span', { class: 'small text2', role: 'status' }, `${feitos} de ${itens.length} verificados`)),
        e.situacao === 'aguardando' ? h('div', { class: 'stack-xs' }, itens.map(([k, l]) => Check({ id: 'an-' + k, rotulo: l, marcado: e.analise[k], onChange: async v => { await comp.marcarAnalise({ empresaId: e.id, item: k, valor: v }); render(); } })))
          : h('ul', { class: 'stack-xs small' }, itens.map(([k, l]) => h('li', null, icone(e.analise[k] ? 'check-circle' : 'minus-circle'), ' ', l, e.analise[k] ? '' : ' (pendente)'))),
        h('p', { class: 'xsmall muted' }, 'Habilitação é uma verificação cadastral; não representa certificação técnica.'))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'ae-acoes' }, h('h2', { id: 'ae-acoes' }, 'Ações administrativas'),
      e.situacao === 'aguardando' ? h('div', { class: 'stack-xs' }, h('div', { class: 'row' }, Botao({ texto: 'Habilitar empresa', icone: 'check-circle', variante: 'primary', desabilitado: !completo, onClick: () => abrir('habilitar'), id: 'btn-habilitar', extra: { 'aria-describedby': 'dica-habilitar' } }), Botao({ texto: 'Arquivar empresa', variante: 'ghost', onClick: () => abrir('arquivar') })),
        h('p', { class: 'small text2', id: 'dica-habilitar' }, completo ? 'Análise concluída. Habilite com justificativa.' : 'Conclua todos os itens da análise para habilitar.')) : null,
      e.situacao === 'ativa' ? h('div', { class: 'row' }, Botao({ texto: 'Ver perfil público', icone: 'arrow-square-out', href: '#/fornecedores/' + e.slug }), Botao({ texto: 'Suspender empresa', icone: 'pause-circle', variante: 'danger', onClick: () => abrir('suspender') })) : null,
      e.situacao === 'suspensa' ? h('div', { class: 'row' }, Botao({ texto: 'Reativar empresa', variante: 'primary', onClick: () => abrir('reativar') }), Botao({ texto: 'Arquivar empresa', variante: 'danger', onClick: () => abrir('arquivar') })) : null,
      e.situacao === 'preenchimento' ? h('div', { class: 'stack-xs' }, h('p', { class: 'text2' }, 'Cadastro ainda em preenchimento pelo responsável. Nenhuma ação de habilitação disponível.'), h('div', null, Botao({ texto: 'Arquivar empresa', variante: 'ghost', onClick: () => abrir('arquivar') }))) : null,
      e.situacao === 'arquivada' ? h('p', { class: 'text2' }, 'Empresa arquivada. Histórico disponível apenas para consulta.') : null,
      h('p', { class: 'xsmall muted' }, 'Ações sensíveis exigem justificativa e geram registro de auditoria.')),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'ae-hist' }, h('h2', { id: 'ae-hist' }, 'Histórico administrativo'),
      hist.length ? h('ul', { class: 'list' }, hist.map(a => h('li', { class: 'list-item', key: a.id }, h('span', { class: 'main' }, h('span', { class: 'strong' }, a.acao), h('span', { class: 'small text2' }, `${formatarRegistro(a.quando)} · ${a.quem}`), a.justificativa ? h('span', { class: 'small' }, 'Justificativa: ' + a.justificativa) : null)))) : h('p', { class: 'muted' }, 'Sem registros administrativos para esta empresa.')),
    cfg ? Dialogo({ id: 'dlg-situacao', titulo: `${cfg.titulo} ${e.nome}?`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }), alerta: st.dlg !== 'habilitar',
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }), desabilitado: st.busy }), Botao({ texto: cfg.botao, variante: st.dlg === 'habilitar' || st.dlg === 'reativar' ? 'primary' : 'danger', ocupado: st.busy, onClick: confirmar, id: 'dlg-situacao-ok' })] },
    h('div', { class: 'stack-xs' }, h('p', { class: 'strong' }, 'Impacto'), h('ul', { class: 'prose small stack-xs' }, cfg.impactos.map(i => h('li', null, i)), st.dlg === 'suspender' ? h('li', null, `${e.futuros} atendimento(s) confirmado(s) permanecem para tratamento.`) : null)),
    Campo({ id: 'sit-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; if (st.erro) { st.erro = null; render(); } }, erro: st.erro, ajuda: 'Mínimo de 10 caracteres. Fica registrada na auditoria.', maxlength: 500 })) : null);
}
