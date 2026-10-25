// RF-PUB-02 · Catálogo de fornecedores com filtros combináveis, estados de carregamento, erro e vazio.
import { h, Botao, Campo, Seg, Alerta, Vazio, Esqueleto, Dialogo, icone } from '../../ui/components.js';
import { ui, estadoView, render, set, toast } from '../../store.js';
import { listarCatalogo, opcoesCatalogo, filtrarCatalogo } from '../../api/companies.js';

function carregar(st) {
  const pedido = (st.pedido || 0) + 1;
  st.pedido = pedido;
  st.status = 'carregando';
  render();
  listarCatalogo().then(r => {
    if (pedido !== st.pedido) return; // resposta obsoleta: uma carga mais recente já foi iniciada
    if (r.ok) { st.lista = r.data; st.status = 'ok'; } else { st.status = 'erro'; st.erro = r.message; }
    render();
  });
}

export function Catalogo({ query }) {
  const st = estadoView('catalogo', () => ({ status: 'inicial', lista: [], f: { q: '', cidade: '', categoria: '', servico: '', modalidade: '' }, filtrosAbertos: false, dlg: null }));
  if (st.visita !== ui.visita) {
    st.visita = ui.visita;
    if (query.servico || query.cidade) st.f = { ...st.f, servico: query.servico || '', cidade: query.cidade || '' };
    st.status = 'carregando';
    queueMicrotask(() => carregar(st));
  }
  const op = opcoesCatalogo();
  const f = st.f;
  const setF = patch => { st.f = { ...st.f, ...patch }; render(); };
  const lista = filtrarCatalogo(st.lista, f);
  const chips = [];
  if (f.q) chips.push(['Nome: ' + f.q, { q: '' }]);
  if (f.cidade) chips.push(['Cidade: ' + f.cidade, { cidade: '' }]);
  if (f.categoria) chips.push([f.categoria, { categoria: '' }]);
  if (f.servico) chips.push([f.servico, { servico: '' }]);
  if (f.modalidade) chips.push(['Atendimento ' + f.modalidade.toLowerCase(), { modalidade: '' }]);
  const limpar = () => setF({ q: '', cidade: '', categoria: '', servico: '', modalidade: '' });
  const mob = ui.largura < 640;
  const mostrarFiltros = !mob || st.filtrosAbertos;

  let resultado;
  if (st.status === 'carregando' || st.status === 'inicial') {
    resultado = h('div', { class: 'grid-auto' }, [1, 2, 3].map(() => Esqueleto({ linhas: 4, rotulo: 'Carregando fornecedores…' })));
  } else if (st.status === 'erro') {
    resultado = Alerta({ tipo: 'err', titulo: 'Não foi possível carregar os fornecedores', acoes: [Botao({ texto: 'Tentar novamente', icone: 'arrow-clockwise', onClick: () => carregar(st) })] },
      h('p', null, 'Verifique sua conexão. Seus filtros foram mantidos.'));
  } else if (!lista.length) {
    const outrasCidades = f.cidade ? [...new Set(filtrarCatalogo(st.lista, { ...f, cidade: '' }).map(x => x.cidade))].slice(0, 3) : [];
    const outrasCategorias = f.categoria ? [...new Set(filtrarCatalogo(st.lista, { ...f, categoria: '' }).flatMap(x => x.categorias))].filter(c => c !== f.categoria) : [];
    const semCidade = f.cidade && !st.lista.some(x => x.cidade === f.cidade || x.area.includes(f.cidade));
    resultado = h('div', { class: 'card' }, Vazio({ icone: 'magnifying-glass', titulo: 'Nenhum fornecedor encontrado',
      texto: semCidade ? `Ainda não há empresas habilitadas que atendam ${f.cidade}.` : 'Nenhuma empresa corresponde a todos os filtros selecionados ao mesmo tempo.',
      acoes: [Botao({ texto: 'Limpar filtros', onClick: limpar }),
        ...outrasCidades.map(c => Botao({ texto: 'Buscar em ' + c, variante: 'ghost', onClick: () => setF({ cidade: c }) })),
        ...outrasCategorias.map(c => Botao({ texto: 'Ver ' + c, variante: 'ghost', onClick: () => setF({ categoria: c }) }))] }));
  } else {
    resultado = h('ul', { class: 'grid-auto', 'aria-label': 'Fornecedores encontrados' }, lista.map(x => h('li', { class: 'card stack-sm', key: x.slug },
      h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ini),
        h('div', { class: 'stack-xs grow' }, h('h2', { style: 'font-size:16px' }, x.nome), x.recente ? h('span', { class: 'badge t-a' }, icone('check-circle'), 'Habilitada recentemente') : null)),
      h('p', { class: 'small text2' }, icone('map-pin'), ` ${x.cidade} · atende ${x.area.join(', ')}`),
      h('p', { class: 'small' }, x.servicos.join(' · ') || 'Serviços em cadastro'),
      h('ul', { class: 'chips', 'aria-label': 'Modalidades de atendimento' }, x.modalidades.map(m => h('li', { class: 'badge t-n' }, m))),
      h('div', { class: 'row mt-1' },
        Botao({ texto: 'Ver perfil', href: '#/fornecedores/' + x.slug, rotulo: 'Ver perfil de ' + x.nome }),
        Botao({ texto: 'Solicitar atendimento', variante: 'primary', href: '#/fornecedores/' + x.slug + '/solicitar', rotulo: 'Solicitar atendimento a ' + x.nome })))));
  }

  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Fornecedores'), h('p', null, 'Empresas habilitadas de climatização e refrigeração. Habilitação cadastral não é certificação técnica.'))),
    h('section', { class: 'card stack-sm', 'aria-label': 'Filtros de busca' },
      h('div', { class: 'row', style: 'align-items:flex-end' },
        Campo({ id: 'filtro-nome', rotulo: 'Buscar por nome', tipo: 'search', valor: f.q, onInput: v => setF({ q: v }), classe: 'grow', placeholder: 'Nome da empresa' }),
        mob ? Botao({ texto: `Filtros (${chips.length})`, icone: 'funnel', onClick: () => set(st, { filtrosAbertos: !st.filtrosAbertos }), expandido: st.filtrosAbertos, controla: 'filtros-catalogo' }) : null,
        Botao({ texto: 'Usar minha localização', icone: 'crosshair', variante: 'ghost', onClick: () => set(st, { dlg: 'geo' }) })),
      mostrarFiltros ? h('div', { class: 'grid-3', id: 'filtros-catalogo' },
        Campo({ id: 'filtro-cidade', rotulo: 'Cidade', valor: f.cidade, onChange: v => setF({ cidade: v }), opcoes: [{ v: '', l: 'Todas as cidades' }, ...op.cidades.map(c => ({ v: c, l: c }))] }),
        Campo({ id: 'filtro-categoria', rotulo: 'Categoria', valor: f.categoria, onChange: v => setF({ categoria: v }), opcoes: [{ v: '', l: 'Todas as categorias' }, ...op.categorias.map(c => ({ v: c, l: c }))] }),
        Campo({ id: 'filtro-servico', rotulo: 'Serviço oferecido', valor: f.servico, onChange: v => setF({ servico: v }), opcoes: [{ v: '', l: 'Todos os serviços' }, ...op.servicos.map(c => ({ v: c, l: c }))] }),
        Seg({ id: 'filtro-modalidade', rotulo: 'Atendimento', rotuloVisivel: true, valor: f.modalidade, onChange: v => setF({ modalidade: v }), opcoes: [['', 'Todos'], ['Residencial', 'Residencial'], ['Comercial', 'Comercial']] })) : null,
      chips.length ? h('div', { class: 'row' }, h('ul', { class: 'chips', 'aria-label': 'Filtros ativos' }, chips.map(([t, p]) => h('li', { class: 'chip' }, t, h('button', { type: 'button', 'aria-label': 'Remover filtro ' + t, onClick: () => setF(p) }, icone('x'))))),
        Botao({ texto: 'Limpar filtros', variante: 'ghost', pequeno: true, onClick: limpar })) : null),
    st.status === 'ok' ? h('p', { class: 'small text2', role: 'status' }, `${lista.length} ${lista.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}`) : null,
    resultado,
    st.dlg === 'geo' ? Dialogo({ id: 'dlg-geo', titulo: 'Usar sua localização?', onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Escolher manualmente', onClick: () => set(st, { dlg: null }) }),
        Botao({ texto: 'Permitir', variante: 'primary', onClick: () => { st.dlg = null; setF({ cidade: 'Cuiabá' }); toast('Simulação: cidade definida como Cuiabá. Em produção, o navegador pediria permissão.', 'info'); } })] },
    h('p', null, 'Usamos a localização apenas para preencher a cidade da busca. Ela não é salva. Você pode escolher a cidade manualmente a qualquer momento.')) : null);
}
