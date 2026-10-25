// Layouts: área pública (cabeçalho) e ambientes autenticados (menu lateral, barra superior,
// notificações, ajuda, menu do usuário com seletor de ambiente; barra inferior do cliente no celular).
import { h, Botao, Seg, Gaveta, Dialogo, icone, Badge } from '../ui/components.js';
import { ui, render, navegar, set, limparSujo } from '../store.js';
import * as auth from '../api/auth.js';
import { ler } from '../api/db.js';
import { minhasNotificacoes, naoLidas, marcarTodasLidas, marcarLida } from '../api/notifications.js';
import { ambientesDe, vinculoEmpresa, NIVEIS_ADMIN } from '../domain/permissoes.js';
import { TEMAS, DENSIDADES, lerTema, lerDensidade, definirTema, definirDensidade } from '../ui/tema.js';
import { formatarRegistro } from '../domain/datas.js';
import { iniciais } from '../domain/validacao.js';
import { artigo as lerArtigo } from '../api/kb.js';

const NOMES_AMBIENTE = { clientes: 'Área do cliente', empresas: 'Ambiente da empresa', admin: 'Central de administração' };

export function BarraDemo() {
  return h('div', { class: 'demo-bar', role: 'region', 'aria-label': 'Aviso de demonstração' },
    h('p', null, h('strong', null, 'Demonstração — dados fictícios, salvos neste navegador. '),
      h('a', { href: '#/ajuda/privacidade-e-seguranca' }, 'Saiba o que é simulado')),
    Botao({ texto: 'Simulação', icone: 'flask', pequeno: true, onClick: () => set(ui, { simAberto: true }), id: 'abrir-simulacao', controla: 'painel-simulacao', expandido: ui.simAberto }));
}

export function ControlesAparencia(idBase = 'ap') {
  return h('div', { class: 'stack-sm' },
    Seg({ id: idBase + '-tema', rotulo: 'Tema', rotuloVisivel: true, valor: lerTema(), opcoes: TEMAS, onChange: v => { definirTema(v); render(); } }),
    Seg({ id: idBase + '-dens', rotulo: 'Densidade', rotuloVisivel: true, valor: lerDensidade(), opcoes: DENSIDADES, onChange: v => { definirDensidade(v); render(); } }),
    h('p', { class: 'hint' }, '“Sistema” acompanha o dispositivo. Tema e densidade são independentes e ficam salvos neste navegador.'));
}

function alternarPopover(nome) { ui.popover = ui.popover === nome ? null : nome; render(); }

function PopAparencia() {
  const aberto = ui.popover === 'aparencia';
  return h('div', { class: 'pop-wrap' },
    Botao({ texto: 'Aparência', icone: 'sun', variante: 'ghost', onClick: () => alternarPopover('aparencia'), controla: 'pop-aparencia', expandido: aberto, id: 'btn-aparencia' }),
    aberto ? h('div', { class: 'popover', id: 'pop-aparencia', role: 'region', 'aria-label': 'Aparência' }, ControlesAparencia('pub')) : null);
}

function linkPublico(href, texto) {
  const atual = ui.rota === href || ui.rota.startsWith(href + '/');
  return h('a', { href: '#' + href, 'aria-current': atual ? 'page' : null }, texto);
}

export function LayoutPublico(conteudo) {
  const u = auth.usuarioAtual();
  const s = auth.lerSessao();
  const minhaArea = u && s ? auth.rotaInicial(s.ambiente) : null;
  const acoes = u
    ? [Botao({ texto: 'Minha área', icone: 'squares-four', variante: 'primary', href: '#' + minhaArea })]
    : [Botao({ texto: 'Entrar', variante: 'ghost', href: '#/entrar' }), Botao({ texto: 'Criar conta', variante: 'primary', href: '#/cadastro' })];
  return h('div', { class: 'pub' },
    h('a', { href: '#conteudo', class: 'skip-link', onClick: e => { e.preventDefault(); const m = document.getElementById('conteudo'); if (m) m.focus(); } }, 'Pular para o conteúdo'),
    BarraDemo(),
    h('header', { class: 'pub-header' },
      h('div', { class: 'inner' },
        h('a', { href: '#/', class: 'brand', 'aria-label': 'EloServ — início' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'E'), 'EloServ'),
        h('nav', { class: 'pub-nav desk', 'aria-label': 'Principal' }, linkPublico('/fornecedores', 'Fornecedores'), linkPublico('/ajuda', 'Ajuda'), linkPublico('/cadastro', 'Para empresas')),
        h('div', { class: 'grow' }),
        h('div', { class: 'row pub-actions desk' }, PopAparencia(), ...acoes),
        h('div', { class: 'only-mob' }, Botao({ icone: 'list', rotulo: 'Abrir menu', variante: 'ghost', onClick: () => set(ui, { menuAberto: true }), controla: 'menu-publico', expandido: ui.menuAberto })))),
    h('main', { id: 'conteudo', class: 'pub-main', tabindex: '-1' }, conteudo),
    h('footer', { class: 'pub-footer' },
      h('div', { class: 'inner' },
        h('div', { class: 'stack-sm' }, h('p', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'E'), 'EloServ'), h('p', { class: 'text2' }, 'Conecte a equipe. Organize cada serviço.'),
          h('p', { class: 'small muted' }, 'Protótipo de demonstração. Empresas, pessoas, valores e horários são fictícios e demonstrativos.')),
        h('nav', { 'aria-label': 'Produto' }, h('h2', null, 'Produto'), h('ul', null, h('li', null, h('a', { href: '#/fornecedores' }, 'Fornecedores')), h('li', null, h('a', { href: '#/cadastro' }, 'Cadastrar empresa')), h('li', null, h('a', { href: '#/entrar' }, 'Entrar')))),
        h('nav', { 'aria-label': 'Ajuda' }, h('h2', null, 'Ajuda'), h('ul', null, h('li', null, h('a', { href: '#/ajuda' }, 'Central de ajuda')), h('li', null, h('a', { href: '#/ajuda/como-solicitar-atendimento' }, 'Como solicitar')), h('li', null, h('a', { href: '#/recuperar-acesso' }, 'Recuperar acesso')))),
        h('div', null, h('h2', null, 'Privacidade'), h('ul', null, h('li', null, h('a', { href: '#/ajuda/privacidade-e-seguranca' }, 'Privacidade e segurança'))), h('p', { class: 'small muted' }, 'Termos de uso e política de privacidade serão publicados antes do lançamento.')))),
    ui.menuAberto ? Gaveta({ id: 'menu-publico', titulo: 'Menu', lado: 'esquerda', onFechar: () => set(ui, { menuAberto: false }) },
      h('nav', { class: 'mobile-nav', 'aria-label': 'Principal' }, linkPublico('/', 'Início'), linkPublico('/fornecedores', 'Fornecedores'), linkPublico('/ajuda', 'Ajuda'), linkPublico('/cadastro', 'Para empresas'),
        u ? h('a', { href: '#' + minhaArea }, 'Minha área') : linkPublico('/entrar', 'Entrar')),
      h('hr', { class: 'divider' }),
      ControlesAparencia('mob')) : null);
}

// ---------- Ambientes autenticados ----------
function navCliente(u) {
  const e = ler();
  const aguardando = e.solicitacoes.filter(s => s.clienteId === u.id && s.estado === 'proposta').length;
  return [['/clientes', 'Visão geral', 'squares-four', true], ['/fornecedores', 'Buscar fornecedores', 'magnifying-glass'], ['/clientes/solicitacoes', 'Solicitações e orçamentos', 'clipboard-text', false, aguardando],
    ['/clientes/agendamentos', 'Agendamentos', 'calendar-blank'], ['/clientes/equipamentos', 'Meus equipamentos', 'thermometer'], ['/clientes/historico', 'Histórico', 'clock-counter-clockwise'],
    ['/clientes/perfil', 'Perfil e endereços', 'user'], ['/ajuda', 'Ajuda', 'question'], ['/clientes/preferencias', 'Preferências', 'gear']];
}
function navEmpresa(u, empresaId) {
  const v = vinculoEmpresa(u, empresaId);
  const e = ler();
  if (v && v.papel === 'tecnico') return [['/empresas', 'Visão geral', 'squares-four', true], ['/empresas/agenda', 'Minha agenda', 'calendar-blank'], ['/empresas/ordens', 'Meus atendimentos', 'file-text'], ['/empresas/ajuda', 'Ajuda', 'question']];
  const novas = e.solicitacoes.filter(s => s.empresaId === empresaId && (['enviada', 'em_analise'].includes(s.estado) || (s.reagendamento && s.reagendamento.origem === 'cliente'))).length;
  return [['/empresas', 'Visão geral', 'squares-four', true], ['/empresas/perfil', 'Perfil da empresa', 'storefront'], ['/empresas/servicos', 'Serviços', 'wrench'], ['/empresas/produtos', 'Produtos', 'package'],
    ['/empresas/profissionais', 'Profissionais', 'users'], ['/empresas/agenda', 'Agenda', 'calendar-blank'], ['/empresas/solicitacoes', 'Solicitações e orçamentos', 'clipboard-text', false, novas],
    ['/empresas/ordens', 'Ordens de serviço', 'file-text'], ['/empresas/clientes', 'Clientes e equipamentos', 'address-book'], ['/empresas/historico', 'Histórico e retornos', 'clock-counter-clockwise'],
    ['/empresas/ajuda', 'Ajuda', 'question'], ['/empresas/configuracoes', 'Configurações', 'gear']];
}
function navAdmin() {
  const e = ler();
  const pend = e.empresas.filter(x => x.situacao === 'aguardando').length;
  const sup = e.suporte.filter(x => x.situacao === 'aberta').length;
  return [['/admin', 'Visão geral', 'squares-four', true], ['/admin/empresas', 'Empresas', 'buildings', false, pend], ['/admin/usuarios', 'Usuários e acessos', 'users-three'],
    ['/admin/publicados', 'Serviços e produtos publicados', 'storefront'], ['/admin/categorias', 'Categorias', 'tag'], ['/admin/agendamentos', 'Agendamentos', 'calendar-blank'],
    ['/admin/ajuda', 'Base de conhecimento', 'book-open'], ['/admin/suporte', 'Solicitações de suporte', 'lifebuoy', false, sup], ['/admin/auditoria', 'Auditoria', 'clock-counter-clockwise'], ['/admin/configuracoes', 'Configurações', 'gear']];
}

function itemNav([href, texto, ic, exato, n]) {
  const atual = exato ? ui.rota === href : ui.rota === href || ui.rota.startsWith(href + '/');
  return h('a', { href: '#' + href, 'aria-current': atual ? 'page' : null }, icone(ic), h('span', null, texto), n ? h('span', { class: 'count', 'aria-label': `${n} pendente${n > 1 ? 's' : ''}` }, String(n)) : null);
}

const AJUDA_POR_ROTA = [
  ['/empresas/agenda', 'como-bloquear-periodo'], ['/empresas/profissionais', 'como-convidar-profissional'], ['/empresas/ordens', 'acompanhar-ordem-de-servico'],
  ['/empresas/servicos', 'servicos-e-produtos-no-perfil'], ['/empresas/produtos', 'servicos-e-produtos-no-perfil'], ['/empresas/perfil', 'como-cadastrar-empresa'],
  ['/empresas/solicitacoes', 'o-que-significa-cada-situacao'], ['/clientes/solicitacoes', 'como-confirmar-horario'], ['/clientes/agendamentos', 'como-reagendar'],
  ['/admin', 'permissoes-e-acessos'], ['/empresas', 'o-que-significa-cada-situacao'], ['/clientes', 'o-que-significa-cada-situacao']
];
export const ajudaDaRota = rota => (AJUDA_POR_ROTA.find(([p]) => rota === p || rota.startsWith(p + '/')) || [null, 'o-que-significa-cada-situacao'])[1];

function contexto(ambiente, u, sessao) {
  if (ambiente === 'clientes') return { nome: 'Área do cliente', sub: `${u.nome} · conta pessoal` };
  if (ambiente === 'admin') { const v = u.vinculos.find(x => x.tipo === 'admin'); return { nome: 'Central de administração', sub: `${u.nome} · ${NIVEIS_ADMIN[v.nivel]}` }; }
  const v = vinculoEmpresa(u, sessao.empresaId) || u.vinculos.find(x => x.tipo === 'empresa');
  const emp = ler().empresas.find(x => x.id === (v && v.empresaId));
  return { nome: emp ? emp.nome : 'Empresa', sub: `${v && v.papel === 'tecnico' ? 'Técnico' : 'Proprietária(o) e gestão'} · empresa fictícia`, empresa: emp };
}

function PopNotificacoes(u) {
  const aberto = ui.popover === 'notificacoes';
  const lista = minhasNotificacoes(u);
  const n = naoLidas(u);
  return h('div', { class: 'pop-wrap' },
    Botao({ icone: 'bell', variante: 'ghost', rotulo: `Notificações${n ? ', ' + n + ' não lidas' : ''}`, onClick: () => alternarPopover('notificacoes'), controla: 'pop-notificacoes', expandido: aberto, id: 'btn-notificacoes',
      extra: { 'data-count': n ? String(n) : null } }),
    n ? h('span', { class: 'badge t-a', style: 'position:absolute;top:-4px;right:-6px;padding:0 6px;font-size:11px', 'aria-hidden': 'true' }, String(n)) : null,
    aberto ? h('div', { class: 'popover', id: 'pop-notificacoes', role: 'region', 'aria-label': 'Notificações' },
      h('div', { class: 'row-between' }, h('h2', { class: 'small strong' }, 'Notificações'), n ? Botao({ texto: 'Marcar como lidas', variante: 'ghost', pequeno: true, onClick: async () => { await marcarTodasLidas(); render(); } }) : null),
      lista.length ? h('ul', { class: 'stack-xs', style: 'max-height:320px;overflow:auto' }, lista.map(x => h('li', { key: x.id },
        h('a', { href: x.href, class: 'notif' + (x.lida ? '' : ' unread'), onClick: () => { marcarLida(x.id); ui.popover = null; } },
          icone(x.icone), h('span', { class: 'stack-xs' }, h('span', { class: 'strong small' }, x.titulo, x.lida ? null : h('span', { class: 'sr-only' }, ' (não lida)')), h('span', { class: 'small text2' }, x.texto), h('span', { class: 'xsmall muted' }, formatarRegistro(x.criadaEm))))))) : h('p', { class: 'muted small' }, 'Nenhuma notificação.'),
      h('p', { class: 'xsmall muted mt-1' }, 'Notificação na aplicação não é o mesmo que e-mail entregue. Uma falha de e-mail não altera um agendamento confirmado.')) : null);
}

function PopUsuario(u, sessao, ambiente) {
  const aberto = ui.popover === 'usuario';
  const ambientes = ambientesDe(u);
  const nomeAmb = a => (a.tipo === 'empresas' ? `${(ler().empresas.find(e => e.id === a.empresaId) || {}).nome} · ${a.papel === 'tecnico' ? 'Técnico' : 'Gestão'}` : a.tipo === 'clientes' ? 'Cliente · conta pessoal' : 'Administração · ' + NIVEIS_ADMIN[a.nivel]);
  const trocar = a => { if (auth.trocarAmbiente(a.tipo, a.empresaId)) { ui.popover = null; limparSujo(); navegar(auth.rotaInicial(a.tipo)); } };
  return h('div', { class: 'pop-wrap' },
    Botao({ texto: h('span', { class: 'hide-mob' }, u.nome), icone: null, variante: 'ghost', onClick: () => alternarPopover('usuario'), controla: 'pop-usuario', expandido: aberto, id: 'btn-usuario', rotulo: 'Menu do usuário: ' + u.nome,
      extra: {} }),
    aberto ? h('div', { class: 'popover', id: 'pop-usuario', role: 'region', 'aria-label': 'Menu do usuário' },
      h('div', { class: 'row', style: 'padding:6px 10px' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(u.nome)), h('div', { class: 'stack-xs' }, h('span', { class: 'strong' }, u.nome), h('span', { class: 'small text2 wrap-anywhere' }, u.email))),
      h('p', { class: 'menu-label' }, 'Ambiente'),
      ambientes.length > 1
        ? h('div', { role: 'group', 'aria-label': 'Trocar ambiente' }, ambientes.map(a => h('button', { type: 'button', class: 'menu-item', 'aria-current': a.tipo === ambiente ? 'true' : null, onClick: () => trocar(a) }, icone(a.tipo === 'empresas' ? 'buildings' : a.tipo === 'admin' ? 'shield-check' : 'user'), nomeAmb(a))))
        : h('p', { class: 'small text2', style: 'padding:4px 10px' }, nomeAmb(ambientes[0] || { tipo: ambiente })),
      h('p', { class: 'xsmall muted', style: 'padding:4px 10px' }, ambientes.length > 1 ? 'A troca usa os vínculos da sua conta. Alterar o endereço da página não concede acesso.' : 'Esta conta tem um único vínculo. Pessoas com vários vínculos veem aqui o seletor de ambiente.'),
      h('hr', { class: 'divider' }),
      h('p', { class: 'menu-label' }, 'Aparência'),
      h('div', { style: 'padding:4px 10px' }, ControlesAparencia('usr')),
      h('hr', { class: 'divider' }),
      h('a', { class: 'menu-item', href: '#/ajuda/privacidade-e-seguranca' }, icone('shield-check'), 'Privacidade e segurança'),
      h('button', { type: 'button', class: 'menu-item', onClick: () => { auth.sair(); ui.popover = null; limparSujo(); navegar('/'); } }, icone('sign-out'), 'Sair')) : null);
}

export function LayoutAmbiente({ ambiente, conteudo, usuario: u, sessao, migalha }) {
  const ctx = contexto(ambiente, u, sessao);
  const itens = ambiente === 'clientes' ? navCliente(u) : ambiente === 'admin' ? navAdmin() : navEmpresa(u, sessao.empresaId);
  const nav = h('nav', { class: 'side-nav', 'aria-label': 'Menu — ' + ctx.nome }, itens.map(itemNav));
  const tabs = ambiente === 'clientes'
    ? h('nav', { class: 'bottom-nav', 'aria-label': 'Navegação rápida' }, [['/clientes', 'Início', 'squares-four', true], ['/clientes/solicitacoes', 'Solicitações', 'clipboard-text'], ['/clientes/agendamentos', 'Agenda', 'calendar-blank'], ['/fornecedores', 'Buscar', 'magnifying-glass']].map(([href, texto, ic, exato]) => {
      const atual = exato ? ui.rota === href : ui.rota.startsWith(href);
      return h('a', { href: '#' + href, 'aria-current': atual ? 'page' : null }, icone(ic), texto);
    }))
    : null;
  const marca = h('div', { class: 'side-brand' },
    h('a', { href: '#/', class: 'brand', 'aria-label': 'EloServ — página inicial pública' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'E'), ambiente === 'admin' ? 'EloServ Admin' : 'EloServ'),
    h('p', { class: 'ctx-name' }, ctx.nome), h('p', { class: 'ctx-sub' }, ctx.sub),
    ctx.empresa ? Badge('empresa', ctx.empresa.situacao) : null);
  return h('div', { class: 'app' + (ambiente === 'clientes' ? ' with-bottom' : '') },
    h('a', { href: '#conteudo', class: 'skip-link', onClick: e => { e.preventDefault(); const m = document.getElementById('conteudo'); if (m) m.focus(); } }, 'Pular para o conteúdo'),
    h('aside', { class: 'sidebar', 'aria-label': 'Menu lateral' }, marca, nav),
    h('div', { class: 'main-col' },
      BarraDemo(),
      h('header', { class: 'topbar' },
        h('span', { class: 'menu-toggle' }, Botao({ icone: 'list', variante: 'ghost', rotulo: 'Abrir menu', onClick: () => set(ui, { menuAberto: true }), controla: 'menu-ambiente', expandido: ui.menuAberto, id: 'btn-menu' })),
        h('p', { class: 'crumb' }, h('span', { class: 'env' }, NOMES_AMBIENTE[ambiente] + (migalha ? ' › ' : '')), migalha ? h('span', null, migalha) : null),
        h('div', { class: 'grow' }),
        Botao({ icone: 'question', variante: 'ghost', rotulo: 'Ajuda sobre esta tela', onClick: () => set(ui, { ajuda: ajudaDaRota(ui.rota), popover: null }), id: 'btn-ajuda-contextual' }),
        PopNotificacoes(u),
        PopUsuario(u, sessao, ambiente)),
      h('main', { id: 'conteudo', class: 'content', tabindex: '-1' }, conteudo)),
    tabs,
    ui.menuAberto ? Gaveta({ id: 'menu-ambiente', titulo: ctx.nome, lado: 'esquerda', onFechar: () => set(ui, { menuAberto: false }) }, h('p', { class: 'ctx-sub' }, ctx.sub), h('nav', { class: 'side-nav', 'aria-label': 'Menu — ' + ctx.nome }, itens.map(itemNav))) : null);
}

/** Painel lateral de ajuda contextual: não perde os dados da tela ou do formulário aberto. */
export function PainelAjuda() {
  if (!ui.ajuda) return null;
  const a = lerArtigo(ui.ajuda);
  const fechar = () => set(ui, { ajuda: null });
  const temDialogo = Boolean(document.querySelector('.overlay[data-overlay]'));
  return Gaveta({ id: 'painel-ajuda', titulo: 'Ajuda', onFechar: fechar,
    rodape: h('div', { class: 'stack-sm' },
      h('p', { class: 'small text2' }, temDialogo ? 'O formulário que você estava preenchendo continua aberto. Feche este painel para voltar a ele.' : 'Feche este painel para voltar ao que estava fazendo.'),
      Botao({ texto: 'Voltar ao que eu estava fazendo', icone: 'arrow-left', variante: 'primary', onClick: fechar, bloco: true, id: 'voltar-da-ajuda' })) },
  a ? h('article', { class: 'stack' },
    h('div', { class: 'stack-xs' }, h('h3', null, a.titulo), h('p', { class: 'text2' }, a.resumo), h('p', { class: 'xsmall muted' }, `Para: ${a.publico} · Atualizado em ${formatarRegistro(a.atualizadoEm).split(' · ')[0]}`)),
    h('div', { class: 'stack-sm' }, h('h4', { class: 'strong' }, 'Passos'), h('ol', { class: 'help-steps' }, a.passos.map(p => h('li', null, h('span', null, p))))),
    a.observacoes.length ? h('div', { class: 'stack-sm' }, h('h4', { class: 'strong' }, 'Observações'), h('ul', { class: 'stack-xs prose' }, a.observacoes.map(o => h('li', null, o)))) : null,
    h('a', { href: '#/ajuda/' + a.slug, onClick: () => { ui.ajuda = null; } }, 'Abrir na central de ajuda')) : h('p', null, 'Artigo não encontrado.'));
}

export function Toasts() {
  return h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' },
    ui.toasts.map(t => h('div', { class: 'toast ' + t.tipo, key: 't' + t.id }, icone(t.tipo === 'ok' ? 'check-circle' : t.tipo === 'warn' ? 'warning' : 'info'),
      h('p', { class: 'grow' }, t.mensagem),
      Botao({ icone: 'x', variante: 'ghost', pequeno: true, rotulo: 'Dispensar mensagem', onClick: () => { ui.toasts = ui.toasts.filter(x => x.id !== t.id); render(); } }))));
}

/** Confirmação antes de perder dados não salvos. */
export function DialogoSairSemSalvar() {
  if (!ui.navegacaoPendente) return null;
  return Dialogo({ id: 'dlg-nao-salvo', titulo: 'Descartar alterações?', alerta: true, onFechar: () => set(ui, { navegacaoPendente: null }),
    rodape: [Botao({ texto: 'Continuar editando', variante: 'primary', onClick: () => set(ui, { navegacaoPendente: null }), autofocus: true }),
      Botao({ texto: 'Descartar e sair', variante: 'danger', onClick: () => { const alvo = ui.navegacaoPendente; ui.navegacaoPendente = null; ui.descartar = true; limparSujo(); navegar(alvo); } })] },
  h('p', null, (ui.sujo && ui.sujo.mensagem) || 'Você tem alterações não salvas.'), h('p', { class: 'text2' }, 'Se sair agora, as alterações desta tela serão perdidas.'));
}
