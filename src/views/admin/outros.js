// RF-ADM-03..08 · Usuários e acessos, moderação, categorias, agendamentos agregados, base de conhecimento,
// suporte, auditoria e configurações da plataforma.
import { h, Botao, Campo, Seg, Alerta, Vazio, Dialogo, Badge, BadgeTom, DL, Tabela, icone } from '../../ui/components.js';
import { ui, estadoView, set, render, toast, navegar, marcarSujo, limparSujo } from '../../store.js';
import * as users from '../../api/users.js';
import * as comp from '../../api/companies.js';
import * as kb from '../../api/kb.js';
import { listarAuditoria, TIPOS_AUDITORIA } from '../../api/audit.js';
import { ler } from '../../api/db.js';
import { podeSuspenderUsuario, podeAlterarPapel, NIVEIS_ADMIN, vinculoAdmin } from '../../domain/permissoes.js';
import { validarArtigo } from '../../domain/validacao.js';
import { formatarData, formatarRegistro, formatarDataHora, formatarPrazo } from '../../domain/datas.js';

export function Usuarios({ usuario }) {
  const st = estadoView('adm-usuarios', () => ({ dlg: null, alvo: null, just: '', nivel: 'suporte', email: '', erro: null, busy: false, msg: null }));
  const { lista, principais } = users.usuariosAdmin(usuario);
  const todos = ler().usuarios;
  const meuNivel = vinculoAdmin(usuario).nivel;
  const abrir = (dlg, alvo, extra = {}) => set(st, { dlg, alvo, just: '', erro: null, ...extra });
  const suspender = u => {
    const alvo = todos.find(x => x.id === u.id);
    const chk = podeSuspenderUsuario(usuario, alvo, todos);
    if (!chk.ok) abrir('bloqueado', u, { msg: chk.message, tituloBloq: chk.code === 'ULTIMO_ADMIN_PRINCIPAL' ? 'Ação bloqueada' : 'Ação não permitida' });
    else abrir('suspender', u);
  };
  const editarPapel = u => {
    if (u.voce) { abrir('bloqueado', u, { tituloBloq: 'Você não pode alterar o próprio papel', msg: 'Autoelevação de privilégio não é permitida. Peça a outra pessoa com nível adequado para revisar seu acesso.' }); return; }
    abrir('papel', u, { nivel: u.admin });
  };
  const executar = async (fn, msg, tipo) => {
    set(st, { busy: true, erro: null });
    const r = await fn();
    st.busy = false;
    if (r.ok) { st.dlg = null; toast(msg, tipo); } else st.erro = r.message;
    render();
  };
  const alvoCompleto = st.alvo ? todos.find(x => x.id === st.alvo.id) : null;
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Usuários e acessos'), h('p', null, `E-mails parcialmente ocultos. Senhas nunca são exibidas. ${principais} ${principais === 1 ? 'administradora principal habilitada' : 'administradores principais habilitados'}.`)),
      Botao({ texto: 'Convidar administrador', icone: 'user-plus', variante: 'primary', onClick: () => abrir('convite', null, { email: '', nivel: 'suporte' }) })),
    Tabela({ id: 'tab-usuarios', rotulo: 'Usuários da plataforma', estado: st, linhas: lista, placeholder: 'Buscar por nome, papel ou empresa...', colunas: [
      { id: 'nome', titulo: 'Usuário', valor: u => `${u.nome} ${u.papeis.join(' ')}`, render: u => h('div', null, h('span', { class: 'cell-main' }, u.nome, u.voce ? ' (você)' : ''), h('div', { class: 'cell-sub' }, u.emailMascarado), h('ul', { class: 'cell-sub' }, u.papeis.map(p => h('li', null, p)))) },
      { id: 'sit', titulo: 'Situação', valor: u => u.situacao, render: u => Badge('registro', u.situacao) },
      { id: 'acoes', titulo: 'Ações', acoes: true, render: u => h('div', { class: 'row', style: 'justify-content:flex-end' },
        u.admin && u.situacao !== 'convite' ? Botao({ texto: 'Editar papel', pequeno: true, onClick: () => editarPapel(u), rotulo: 'Editar papel de ' + u.nome }) : null,
        u.situacao === 'ativo' && !u.voce ? Botao({ texto: 'Suspender', pequeno: true, variante: 'danger', onClick: () => suspender(u), rotulo: 'Suspender ' + u.nome }) : null,
        u.situacao === 'suspenso' ? Botao({ texto: 'Reativar', pequeno: true, onClick: () => abrir('reativar', u), rotulo: 'Reativar ' + u.nome }) : null,
        u.situacao === 'convite' ? Botao({ texto: 'Revogar convite', pequeno: true, variante: 'ghost', onClick: () => executar(() => users.revogarConviteAdmin({ usuarioId: u.id }), 'Convite revogado.', 'info'), rotulo: 'Revogar convite de ' + u.emailMascarado }) : null) }
    ] }),
    h('p', { class: 'small muted' }, 'Não há exclusão destrutiva de histórico. Revogação e suspensão preservam registros. Papéis dentro de empresas (gestão e técnicos) são administrados pela própria empresa.'),
    st.dlg === 'bloqueado' ? Dialogo({ id: 'dlg-bloqueado', titulo: st.tituloBloq, alerta: true, onFechar: () => set(st, { dlg: null }), rodape: [Botao({ texto: 'Entendi', variante: 'primary', onClick: () => set(st, { dlg: null }), autofocus: true })] }, h('p', null, st.msg)) : null,
    st.dlg === 'suspender' ? Dialogo({ id: 'dlg-susp-user', titulo: `Suspender acesso de ${st.alvo.nome}?`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Suspender', variante: 'danger', ocupado: st.busy, onClick: () => executar(() => users.suspenderUsuario({ usuarioId: st.alvo.id, justificativa: st.just }), 'Acesso suspenso.', 'warn') })] },
    h('p', null, 'O usuário deixa de acessar a plataforma até ser reativado. Vínculos e histórico são preservados.'),
    Campo({ id: 'susp-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erro, ajuda: 'Mínimo de 10 caracteres. Fica registrada na auditoria.' })) : null,
    st.dlg === 'reativar' ? Dialogo({ id: 'dlg-reat-user', titulo: `Reativar acesso de ${st.alvo.nome}?`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Reativar', variante: 'primary', ocupado: st.busy, onClick: () => executar(() => users.reativarUsuario({ usuarioId: st.alvo.id, justificativa: st.just }), 'Acesso reativado.') })] },
    Campo({ id: 'reat-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erro })) : null,
    st.dlg === 'papel' ? Dialogo({ id: 'dlg-papel', titulo: `Editar papel de ${st.alvo.nome}`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Fechar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Salvar papel', variante: 'primary', ocupado: st.busy, onClick: () => executar(() => users.alterarPapel({ usuarioId: st.alvo.id, nivel: st.nivel, justificativa: st.just }), 'Papel atualizado.') })] },
    h('p', { class: 'small text2' }, meuNivel === 'principal' ? 'Seu nível (Principal) permite conceder qualquer nível. Deve existir sempre ao menos um administrador principal habilitado.' : 'Seu nível (Operações) permite conceder apenas Suporte ou Operações. O nível Principal exige outra pessoa com nível Principal.'),
    Campo({ id: 'papel-nivel', rotulo: 'Nível de administração', valor: st.nivel, onChange: v => set(st, { nivel: v, erro: null }), opcoes: Object.entries(NIVEIS_ADMIN).map(([v, l]) => {
      const chk = alvoCompleto ? podeAlterarPapel(usuario, alvoCompleto, v, ler().usuarios) : { ok: true };
      return { v, l: chk.ok || v === st.alvo.admin ? l : `${l} — indisponível para o seu nível`, desabilitado: !chk.ok && v !== st.alvo.admin };
    }) }),
    Campo({ id: 'papel-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erro })) : null,
    st.dlg === 'convite' ? Dialogo({ id: 'dlg-conv-admin', titulo: 'Convidar administrador', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Enviar convite', variante: 'primary', ocupado: st.busy, onClick: () => executar(() => users.convidarAdmin({ email: st.email, nivel: st.nivel }), 'Convite criado. Ele pode ser revogado enquanto pendente.') })] },
    Campo({ id: 'conv-adm-email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, valor: st.email, onInput: v => { st.email = v; }, erro: st.erro, ajuda: 'Use um e-mail fictício terminado em @exemplo.invalid. O convite expira em 7 dias.' }),
    Campo({ id: 'conv-adm-nivel', rotulo: 'Nível inicial', valor: st.nivel, onChange: v => { st.nivel = v; }, opcoes: Object.entries(NIVEIS_ADMIN).map(([v, l]) => ({ v, l, desabilitado: v === 'principal' && meuNivel !== 'principal' })) })) : null);
}

export function Publicados({ usuario }) {
  const st = estadoView('adm-pub', () => ({ dlg: null, alvo: null, just: '', erro: null, busy: false }));
  const lista = comp.conteudoPublicado(usuario);
  const enviar = async () => {
    set(st, { busy: true });
    const r = await comp.solicitarAjusteConteudo({ servicoId: st.alvo.id, justificativa: st.just });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast('Ajuste solicitado à empresa. O serviço segue visível até a correção.', 'info'); } else st.erro = r.message;
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Serviços e produtos publicados'), h('p', null, 'Moderação de conteúdo público. Ajustes são solicitados à empresa com justificativa.'))),
    Tabela({ id: 'tab-publicados', rotulo: 'Serviços publicados', estado: st, linhas: lista, colunas: [
      { id: 'nome', titulo: 'Serviço', valor: s => s.nome, render: s => h('div', null, h('span', { class: 'cell-main' }, s.nome), s.moderacao ? h('div', { class: 'cell-sub' }, s.moderacao.motivo) : null) },
      { id: 'emp', titulo: 'Empresa', valor: s => s.empresaNome, classe: 'wrap-anywhere' },
      { id: 'sit', titulo: 'Moderação', valor: s => (s.moderacao ? s.moderacao.situacao : 'ok'), render: s => (s.moderacao ? Badge('registro', s.moderacao.situacao) : BadgeTom('Sem pendências', 'check-circle', 'o')) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: s => (s.moderacao && s.moderacao.situacao === 'ajuste_solicitado' ? h('span', { class: 'small muted' }, 'Aguardando a empresa') : Botao({ texto: 'Solicitar ajuste', pequeno: true, variante: s.moderacao ? 'primary' : 'secondary', onClick: () => set(st, { dlg: 'ajuste', alvo: s, just: s.moderacao ? s.moderacao.motivo : '', erro: null }), rotulo: 'Solicitar ajuste em ' + s.nome })) }
    ] }),
    st.dlg === 'ajuste' ? Dialogo({ id: 'dlg-ajuste-conteudo', titulo: 'Solicitar ajuste de conteúdo', descricao: `${st.alvo.nome} · ${st.alvo.empresaNome}`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Solicitar ajuste', variante: 'primary', ocupado: st.busy, onClick: enviar })] },
    Campo({ id: 'aj-just', rotulo: 'Justificativa', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erro })) : null);
}

export function Categorias({ usuario }) {
  const st = estadoView('adm-cat', () => ({ nome: '', erro: null, busy: false }));
  const cats = ler().categorias;
  const emps = comp.empresasAdmin(usuario).filter(e => e.situacao === 'ativa');
  const criar = async e => {
    e.preventDefault();
    set(st, { busy: true });
    const r = await comp.criarCategoria({ nome: st.nome });
    st.busy = false;
    if (r.ok) { st.nome = ''; st.erro = null; toast('Categoria criada. Ainda sem empresas vinculadas.'); } else st.erro = r.message;
    render();
  };
  return h('div', { class: 'stack content-narrow' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Categorias'), h('p', null, 'Categorias usadas nos filtros do catálogo público.'))),
    h('ul', { class: 'card list' }, cats.map(c => h('li', { class: 'list-item', key: c.id }, h('span', { class: 'strong' }, c.nome), h('span', { class: 'small text2' }, `${emps.filter(e => e.categorias.includes(c.nome)).length} empresas ativas`)))),
    h('form', { class: 'card row', style: 'align-items:flex-end', onSubmit: criar },
      Campo({ id: 'cat-nome', rotulo: 'Nova categoria', valor: st.nome, onInput: v => { st.nome = v; }, erro: st.erro, classe: 'grow', maxlength: 60 }),
      Botao({ texto: 'Adicionar', tipo: 'submit', ocupado: st.busy })));
}

export function Agendamentos({ usuario }) {
  const st = estadoView('adm-ag', () => ({ dlg: null, alvo: null, just: '', erro: null, busy: false }));
  const lista = comp.agendamentosAgregados(usuario);
  const pedir = async () => {
    set(st, { busy: true });
    const r = await comp.solicitarAcessoDetalhe({ empresaId: st.alvo.empresaId, justificativa: st.just });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast('Acesso temporário concedido por 30 minutos e registrado na auditoria.', 'info'); } else st.erro = r.message;
    render();
  };
  const comAcesso = lista.filter(a => a.detalhes);
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Agendamentos'), h('p', null, 'Visão agregada por empresa, sem dados de clientes. Detalhes operacionais exigem justificativa, são temporários e ficam registrados.'))),
    Tabela({ id: 'tab-agregados', rotulo: 'Agendamentos por empresa', estado: st, linhas: lista, chave: a => a.empresaId, colunas: [
      { id: 'emp', titulo: 'Empresa', valor: a => a.nome, render: a => h('div', null, h('span', { class: 'cell-main wrap-anywhere' }, a.nome), a.situacao === 'suspensa' ? h('div', null, Badge('empresa', 'suspensa')) : null) },
      { id: 'conf', titulo: 'Confirmados (7 dias)', valor: a => String(a.confirmados7d).padStart(3, '0'), render: a => String(a.confirmados7d) },
      { id: 'temp', titulo: 'Reservas temporárias', valor: a => String(a.temporarias).padStart(3, '0'), render: a => String(a.temporarias) },
      { id: 'conf2', titulo: 'Conflitos abertos', valor: a => String(a.conflitos).padStart(3, '0'), render: a => String(a.conflitos) },
      { id: 'acao', titulo: 'Ação', acoes: true, render: a => (a.acessoAte ? h('span', { class: 'small' }, 'Acesso até ' + formatarPrazo(a.acessoAte, a.fuso)) : Botao({ texto: 'Solicitar detalhe', pequeno: true, onClick: () => set(st, { dlg: 'acesso', alvo: a, just: '', erro: null }), rotulo: 'Solicitar detalhe de ' + a.nome })) }
    ] }),
    comAcesso.map(a => h('section', { class: 'card stack-sm', key: 'det-' + a.empresaId, 'aria-label': 'Detalhes operacionais de ' + a.nome },
      h('h2', null, 'Detalhes operacionais · ' + a.nome), h('p', { class: 'small text2' }, `Acesso temporário até ${formatarPrazo(a.acessoAte, a.fuso)}. Sem dados pessoais de clientes.`),
      a.detalhes.length ? h('ul', { class: 'list' }, a.detalhes.map(d => h('li', { class: 'list-item', key: d.id + d.inicio }, h('span', { class: 'main' }, h('span', { class: 'strong tabular' }, formatarDataHora(d.inicio, a.fuso)), h('span', { class: 'small text2' }, `${d.id} · ${d.profissional}`)), Badge('ocupacao', d.estado)))) : h('p', { class: 'muted' }, 'Sem atendimentos futuros.'))),
    st.dlg === 'acesso' ? Dialogo({ id: 'dlg-acesso', titulo: 'Solicitar acesso a detalhes operacionais', descricao: 'Dados de clientes e ordens não são exibidos por padrão. O acesso é temporário, limitado ao motivo e registrado na auditoria.', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Registrar pedido', variante: 'primary', ocupado: st.busy, onClick: pedir })] },
    Campo({ id: 'acesso-just', rotulo: 'Motivo', obrigatorio: true, linhas: 3, valor: st.just, onInput: v => { st.just = v; }, erro: st.erro })) : null);
}

export function Ajuda({ usuario }) {
  const st = estadoView('adm-kb', () => ({ busy: false }));
  const lista = kb.todosArtigos(usuario);
  const novo = async () => {
    set(st, { busy: true });
    const r = await kb.novoArtigo();
    st.busy = false;
    if (r.ok) navegar('/admin/ajuda/' + r.data.slug); else toast(r.message, 'warn');
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Base de conhecimento'), h('p', null, 'Criar, editar, salvar rascunho, pré-visualizar, publicar e arquivar artigos.')), Botao({ texto: 'Novo artigo', icone: 'plus', variante: 'primary', ocupado: st.busy, onClick: novo })),
    Tabela({ id: 'tab-artigos', rotulo: 'Artigos da base de conhecimento', estado: st, linhas: lista, chave: a => a.slug, colunas: [
      { id: 'tit', titulo: 'Artigo', valor: a => a.titulo || '(sem título)', render: a => h('div', null, h('a', { class: 'cell-main', href: '#/admin/ajuda/' + a.slug }, a.titulo || '(sem título)'), h('div', { class: 'cell-sub' }, `${a.categoria} · Para: ${a.publico}`)) },
      { id: 'upd', titulo: 'Atualizado', valor: a => a.atualizadoEm, render: a => formatarData(a.atualizadoEm) },
      { id: 'sit', titulo: 'Situação', valor: a => a.situacao, render: a => Badge('registro', a.situacao) }
    ] }));
}

export function Artigo({ params, usuario }) {
  const a = kb.artigoAdmin(usuario, params.slug);
  const base = () => (a ? { titulo: a.titulo, resumo: a.resumo, categoria: a.categoria, publico: a.publico, passos: a.passos.join('\n'), observacoes: a.observacoes.join('\n') } : {});
  const st = estadoView('form:adm-art:' + params.slug, () => ({ f: base(), versao: a ? a.v : null, previa: false, erros: [], busy: false, res: null }));
  if (!a) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'book-open', titulo: 'Artigo não encontrado', acoes: [Botao({ texto: 'Voltar', href: '#/admin/ajuda' })] }));
  const sujo = JSON.stringify(st.f) !== JSON.stringify(base());
  if (sujo) marcarSujo('Você tem alterações não salvas no artigo.'); else limparSujo();
  const f = st.f;
  const acao = async (fn, msg, tipo) => {
    set(st, { busy: true, res: null });
    const r = await fn();
    st.busy = false;
    if (r.ok) { limparSujo(); toast(msg, tipo); delete ui.views['form:adm-art:' + params.slug]; } else { st.res = r; st.erros = (r.details && r.details.lista) || []; }
    render();
  };
  const passos = f.passos.split('\n').filter(x => x.trim());
  const obs = f.observacoes.split('\n').filter(x => x.trim());
  return h('div', { class: 'stack content-narrow' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/admin/ajuda' }, 'Base de conhecimento'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, a.titulo || 'Novo artigo')),
    h('div', { class: 'page-head' }, h('div', { class: 'stack-xs' }, h('h1', null, 'Editar artigo'), h('div', { class: 'row' }, Badge('registro', a.situacao), sujo ? BadgeTom('Alterações não salvas', 'pencil-simple', 'w') : null)),
      h('div', { class: 'row' },
        Botao({ texto: st.previa ? 'Voltar à edição' : 'Visualizar', icone: st.previa ? 'pencil-simple' : 'eye', onClick: () => set(st, { previa: !st.previa }) }),
        Botao({ texto: 'Salvar rascunho', ocupado: st.busy, onClick: () => acao(() => kb.salvarRascunho({ slug: a.slug, ...f, versao: st.versao }), 'Rascunho salvo.') }),
        Botao({ texto: 'Publicar', variante: 'primary', ocupado: st.busy, id: 'btn-publicar', onClick: () => { const e = validarArtigo({ titulo: f.titulo, resumo: f.resumo, passos }); if (e.length) { set(st, { erros: e, res: null }); return; } acao(() => kb.publicarArtigo({ slug: a.slug, ...f, versao: st.versao }), 'Artigo publicado na central de ajuda.'); } }),
        a.situacao !== 'arquivado' ? Botao({ texto: 'Arquivar', variante: 'ghost', ocupado: st.busy, onClick: () => acao(() => kb.arquivarArtigo({ slug: a.slug }), 'Artigo arquivado. Deixa de aparecer na central.', 'info') }) : null)),
    st.erros.length ? Alerta({ tipo: 'err', titulo: 'Antes de publicar', foco: true }, h('ul', { class: 'prose' }, st.erros.map(e => h('li', null, e)))) : null,
    st.res && !st.erros.length ? Alerta({ tipo: 'err' }, h('p', null, st.res.message)) : null,
    st.previa ? h('article', { class: 'card stack', 'aria-label': 'Pré-visualização' }, h('p', { class: 'small text2' }, 'Pré-visualização — não publicada'), h('h2', null, f.titulo || '(sem título)'), h('p', { class: 'lead' }, f.resumo), h('p', { class: 'small muted' }, `${f.categoria} · Para: ${f.publico}`),
      h('ol', { class: 'help-steps' }, passos.map(p => h('li', null, h('span', null, p)))), obs.length ? h('ul', { class: 'prose' }, obs.map(o => h('li', null, o))) : null)
      : h('section', { class: 'card stack' },
        Campo({ id: 'art-titulo', rotulo: 'Título', obrigatorio: true, valor: f.titulo, onInput: v => set(f, { titulo: v }), maxlength: 120 }),
        Campo({ id: 'art-resumo', rotulo: 'Resumo', obrigatorio: true, linhas: 2, valor: f.resumo, onInput: v => set(f, { resumo: v }), maxlength: 300 }),
        h('div', { class: 'form-grid' },
          Campo({ id: 'art-cat', rotulo: 'Categoria', valor: f.categoria, onChange: v => set(f, { categoria: v }), opcoes: kb.CATEGORIAS_AJUDA.map(c => ({ v: c, l: c })) }),
          Campo({ id: 'art-pub', rotulo: 'Público', valor: f.publico, onChange: v => set(f, { publico: v }), opcoes: kb.PUBLICOS_AJUDA.map(c => ({ v: c, l: c })) })),
        Campo({ id: 'art-passos', rotulo: 'Passos (um por linha)', obrigatorio: true, linhas: 6, valor: f.passos, onInput: v => set(f, { passos: v }) }),
        Campo({ id: 'art-obs', rotulo: 'Observações (uma por linha)', linhas: 3, valor: f.observacoes, onInput: v => set(f, { observacoes: v }) })));
}

export function Suporte({ usuario }) {
  const st = estadoView('adm-sup', () => ({}));
  const lista = kb.chamadosSuporte(usuario);
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Solicitações de suporte'), h('p', null, 'Atendimento humano em horário comercial. Sem chatbot.'))),
    Tabela({ id: 'tab-suporte', rotulo: 'Solicitações de suporte', estado: st, linhas: lista, colunas: [
      { id: 'id', titulo: 'Chamado', valor: s => `${s.id} ${s.assunto}`, render: s => h('div', null, h('span', { class: 'cell-main' }, s.assunto), h('div', { class: 'cell-sub tabular' }, s.id)) },
      { id: 'orig', titulo: 'Origem', valor: s => s.origem },
      { id: 'data', titulo: 'Aberto em', valor: s => s.criadoEm, render: s => formatarData(s.criadoEm) },
      { id: 'sit', titulo: 'Situação', valor: s => s.situacao, render: s => Badge('registro', s.situacao) }
    ] }));
}

export function Auditoria({ usuario }) {
  const st = estadoView('adm-aud', () => ({ tipo: '' }));
  const lista = listarAuditoria(usuario, { tipo: st.tipo });
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Auditoria'), h('p', null, 'Quem, quando, entidade afetada, tipo de alteração e justificativa. Registros sem senhas, tokens ou dados pessoais desnecessários.'))),
    Campo({ id: 'aud-tipo', rotulo: 'Tipo de alteração', valor: st.tipo, onChange: v => set(st, { tipo: v, pagina: 1 }), opcoes: [{ v: '', l: 'Todos os tipos' }, ...TIPOS_AUDITORIA.map(([v, l]) => ({ v, l }))] }),
    Tabela({ id: 'tab-auditoria', rotulo: 'Registros de auditoria', estado: st, linhas: lista, vazio: 'Nenhum registro deste tipo.', colunas: [
      { id: 'quando', titulo: 'Quando', valor: a => a.quando, render: a => h('span', { class: 'tabular' }, formatarRegistro(a.quando)) },
      { id: 'quem', titulo: 'Quem', valor: a => a.quem },
      { id: 'ent', titulo: 'Entidade', valor: a => a.entidade, classe: 'wrap-anywhere' },
      { id: 'acao', titulo: 'Alteração', valor: a => a.acao },
      { id: 'just', titulo: 'Justificativa', valor: a => a.justificativa || '—' }
    ] }));
}

export function Configuracoes() {
  return h('div', { class: 'stack content-narrow' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Configurações da plataforma'), h('p', null, 'Parâmetros desta versão. Hipóteses em validação estão identificadas.'))),
    h('section', { class: 'card' }, DL([['Região inicial', 'Mato Grosso · expansão para o Centro-Oeste prevista'], ['Validade padrão da reserva temporária', '24 horas · ajustável por empresa (hipótese proposta)'], ['Prazo de resposta a reagendamento', '48 horas; sem resposta, o original é mantido (hipótese proposta)'],
      ['Convite de profissional', 'Expira em 7 dias (hipótese proposta)'], ['Sessão inativa', 'Expira após 30 minutos (hipótese proposta)'], ['Níveis de administrador', 'Principal, Operações e Suporte; ao menos um Principal habilitado (hipótese proposta)'],
      ['Cobrança da assinatura', 'Fora do escopo inicial. Planos e preços não definidos.'], ['Persistência', 'Demonstração: dados salvos somente neste navegador; sem servidor.']])),
    Alerta({ tipo: 'warn', titulo: 'Requisito para a versão com backend' }, h('p', null, 'A interface não garante sozinha a prevenção de dupla reserva. A aplicação final deve validar e gravar reservas de forma transacional no backend, com proteção no banco de dados para impedir sobreposição de intervalos ativos por profissional.')),
    h('p', { class: 'small' }, icone('info'), ' ', h('a', { href: '#/ajuda/privacidade-e-seguranca' }, 'O que é simulado nesta demonstração')));
}

export { Seg };
