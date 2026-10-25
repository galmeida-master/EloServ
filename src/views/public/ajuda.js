// RF-PUB-04 · Base de conhecimento: busca, filtros por categoria e público, artigo com passos,
// observações, relacionados, “Este artigo ajudou?” e canal de suporte. Sem chatbot.
import { h, Botao, Campo, Seg, Vazio, Dialogo, icone } from '../../ui/components.js';
import { estadoView, set, render, toast } from '../../store.js';
import { listarArtigos, contarPorCategoria, artigo, abrirSuporte, CATEGORIAS_AJUDA } from '../../api/kb.js';
import { formatarData } from '../../domain/datas.js';

export function DialogoSuporte(st, assuntoPadrao = '') {
  if (st.dlg !== 'suporte') return null;
  if (st.supAssunto == null) st.supAssunto = assuntoPadrao;
  const enviar = async () => {
    set(st, { supBusy: true, supErro: null });
    const r = await abrirSuporte({ assunto: st.supAssunto, texto: st.supTexto });
    st.supBusy = false;
    if (r.ok) { st.dlg = null; st.supAssunto = null; st.supTexto = ''; toast(`Solicitação de suporte ${r.data.id} registrada (demonstração). Resposta em horário comercial.`); }
    else st.supErro = r.details && r.details.campos ? r.details.campos : { texto: r.message };
    render();
  };
  const e = st.supErro || {};
  return Dialogo({ id: 'dlg-suporte', titulo: 'Solicitação de suporte', descricao: 'Atendimento humano em horário comercial. Não inclua senhas ou dados sensíveis.', ocupado: st.supBusy, onFechar: () => set(st, { dlg: null, supErro: null }),
    rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null, supErro: null }), desabilitado: st.supBusy }), Botao({ texto: 'Enviar', variante: 'primary', ocupado: st.supBusy, textoOcupado: 'Enviando…', onClick: enviar })] },
  Campo({ id: 'sup-assunto', rotulo: 'Assunto', obrigatorio: true, valor: st.supAssunto, onInput: v => { st.supAssunto = v; }, erro: e.assunto, maxlength: 120 }),
  Campo({ id: 'sup-texto', rotulo: 'Descreva a dúvida', obrigatorio: true, linhas: 4, valor: st.supTexto || '', onInput: v => { st.supTexto = v; }, erro: e.texto, maxlength: 1000 }));
}

export function CentralAjuda() {
  const st = estadoView('ajuda', () => ({ q: '', cat: '', pub: '', dlg: null }));
  const lista = listarArtigos({ q: st.q, categoria: st.cat, publico: st.pub });
  const contagem = contarPorCategoria();
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Central de ajuda'), h('p', null, 'Artigos para clientes e empresas. Atendimento de suporte em horário comercial.'))),
    h('div', { class: 'kb-layout' },
      h('aside', { class: 'stack', 'aria-label': 'Filtros da ajuda' },
        Campo({ id: 'ajuda-busca', rotulo: 'Buscar na ajuda', tipo: 'search', valor: st.q, onInput: v => set(st, { q: v }), placeholder: 'Ex.: reagendar, bloqueio, proposta' }),
        Seg({ id: 'ajuda-publico', rotulo: 'Público', rotuloVisivel: true, valor: st.pub, opcoes: [['', 'Todos'], ['Clientes', 'Clientes'], ['Empresas', 'Empresas']], onChange: v => set(st, { pub: v }) }),
        h('div', { class: 'stack-xs' }, h('h2', { class: 'label', id: 'cat-titulo' }, 'Categorias'),
          h('ul', { class: 'cat-list', 'aria-labelledby': 'cat-titulo' }, CATEGORIAS_AJUDA.map(c => h('li', null,
            h('button', { type: 'button', 'aria-pressed': String(st.cat === c), onClick: () => set(st, { cat: st.cat === c ? '' : c }) }, h('span', null, c), h('span', { class: 'small muted', 'aria-label': `${contagem[c]} artigos` }, String(contagem[c])))))))),
      h('section', { class: 'stack', 'aria-label': 'Artigos' },
        h('p', { class: 'small text2', role: 'status' }, `${lista.length} ${lista.length === 1 ? 'artigo' : 'artigos'}`),
        lista.length ? h('ul', { class: 'stack-sm' }, lista.map(a => h('li', { key: a.slug },
          h('a', { class: 'card stack-xs', href: '#/ajuda/' + a.slug, style: 'display:flex;text-decoration:none;color:var(--text)' },
            h('h2', { style: 'font-size:16px;color:var(--accent-text)' }, a.titulo), h('p', { class: 'small text2' }, a.resumo),
            h('p', { class: 'xsmall muted' }, `${a.categoria} · Para: ${a.publico} · Atualizado em ${formatarData(a.atualizadoEm)}`)))))
          : h('div', { class: 'card' }, Vazio({ icone: 'book-open', titulo: 'Nenhum artigo encontrado', texto: st.cat && !contagem[st.cat] ? `Ainda não há artigos publicados em “${st.cat}”.` : 'Nenhum artigo corresponde à busca.',
            acoes: [Botao({ texto: 'Limpar filtros', onClick: () => set(st, { q: '', cat: '', pub: '' }) }), Botao({ texto: 'Falar com o suporte', variante: 'ghost', onClick: () => set(st, { dlg: 'suporte' }) })] })),
        h('p', { class: 'small text2' }, 'Não encontrou o que precisava? ', h('button', { type: 'button', class: 'link-btn', onClick: () => set(st, { dlg: 'suporte' }) }, 'Abrir solicitação de suporte'), '.'))),
    DialogoSuporte(st));
}

export function Artigo({ params }) {
  const a = artigo(params.slug);
  const st = estadoView('artigo:' + params.slug, () => ({ util: null, dlg: null }));
  if (!a) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'book-open', titulo: 'Artigo não encontrado', texto: 'Ele pode ter sido arquivado ou o endereço mudou.', acoes: [Botao({ texto: 'Ir para a central de ajuda', href: '#/ajuda' })] }));
  return h('div', { class: 'stack content-narrow', style: 'margin:0 auto;width:100%' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/ajuda' }, 'Ajuda'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', null, a.categoria)),
    h('article', { class: 'card stack' },
      h('header', { class: 'stack-xs' }, h('h1', null, a.titulo), h('p', { class: 'lead' }, a.resumo), h('p', { class: 'small muted' }, `Para: ${a.publico} · Atualizado em ${formatarData(a.atualizadoEm)}`)),
      h('section', { class: 'stack-sm', 'aria-labelledby': 'art-passos' }, h('h2', { id: 'art-passos' }, 'Passos'), h('ol', { class: 'help-steps' }, a.passos.map(p => h('li', null, h('span', null, p))))),
      a.observacoes.length ? h('section', { class: 'stack-sm', 'aria-labelledby': 'art-obs' }, h('h2', { id: 'art-obs' }, 'Observações'), h('ul', { class: 'prose stack-xs' }, a.observacoes.map(o => h('li', null, o)))) : null,
      h('section', { class: 'stack-sm', 'aria-labelledby': 'art-util', style: 'border-top:1px solid var(--border);padding-top:16px' },
        h('h2', { id: 'art-util' }, 'Este artigo ajudou?'),
        st.util == null ? h('div', { class: 'row' }, Botao({ texto: 'Sim', icone: 'thumbs-up', onClick: () => set(st, { util: true }) }), Botao({ texto: 'Não', icone: 'thumbs-down', onClick: () => set(st, { util: false }) }))
          : h('p', { role: 'status' }, st.util ? 'Obrigado pelo retorno.' : 'Obrigado. Se a dúvida continua, fale com o suporte. ', st.util ? null : h('button', { type: 'button', class: 'link-btn', onClick: () => set(st, { dlg: 'suporte' }) }, 'Abrir solicitação de suporte'))),
      a.relacionadosArtigos.length ? h('section', { class: 'stack-sm', 'aria-labelledby': 'art-rel' }, h('h2', { id: 'art-rel' }, 'Conteúdo relacionado'),
        h('ul', { class: 'stack-xs' }, a.relacionadosArtigos.map(x => h('li', null, icone('book-open'), ' ', h('a', { href: '#/ajuda/' + x.slug }, x.titulo))))) : null),
    DialogoSuporte(st, a.titulo));
}
