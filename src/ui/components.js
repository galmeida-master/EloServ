// Componentes reutilizáveis e acessíveis (rótulos, aria-*, foco e teclado).
import { h } from './h.js';
import { icone } from './icons.js';
import { render } from '../store.js';
import { rotulo as rotuloEstado } from '../domain/estados.js';

const cls = (...c) => c.filter(Boolean).join(' ');

/** Botão (ou link com aparência de botão). Durante o envio fica desabilitado com aria-busy. */
export function Botao({ texto, icone: ic = null, variante = 'secondary', pequeno = false, onClick = null, ocupado = false, textoOcupado = null,
  desabilitado = false, tipo = 'button', href = null, rotulo = null, classe = '', autofocus = false, id = null, bloco = false, controla = null, expandido = null, atual = null, extra = {} }) {
  const c = cls('btn', 'btn-' + variante, pequeno && 'btn-sm', !texto && 'btn-icon', bloco && 'btn-block', classe);
  const filhos = ocupado
    ? [icone('circle-notch', { classe: 'spin' }), textoOcupado || texto]
    : [ic && icone(ic), texto ? h('span', null, texto) : null];
  if (href) return h('a', { class: c, href, id, 'aria-label': rotulo, 'aria-current': atual, 'data-autofocus': autofocus || null, ...extra }, filhos);
  return h('button', {
    type: tipo, class: c, id, disabled: desabilitado || ocupado, 'aria-busy': ocupado ? 'true' : null, 'aria-label': rotulo,
    'aria-controls': controla, 'aria-expanded': expandido == null ? null : String(expandido), 'data-autofocus': autofocus || null,
    onClick: e => { if (ocupado || desabilitado) { e.preventDefault(); return; } if (onClick) onClick(e); }, ...extra
  }, filhos);
}

/** Badge de status: texto + ícone (cor nunca é o único sinal). */
export function Badge(maquina, estado, texto = null) {
  const r = rotuloEstado(maquina, estado);
  return h('span', { class: 'badge t-' + r.tom }, icone(r.icon), texto || r.label);
}
export function BadgeTom(texto, ic, tom = 'n') {
  return h('span', { class: 'badge t-' + tom }, icone(ic), texto);
}

const ICONE_ALERTA = { info: 'info', warn: 'warning', err: 'warning-circle', ok: 'check-circle' };
/** Alerta em contexto. Erros que exigem ação ficam visíveis na tela (não em toast). */
export function Alerta({ tipo = 'info', titulo = null, id = null, acoes = null, papel = null, foco = false }, ...filhos) {
  return h('div', { class: 'alert alert-' + tipo, id, role: papel || (tipo === 'err' ? 'alert' : null), tabindex: foco ? '-1' : null, 'data-foco': foco || null },
    icone(ICONE_ALERTA[tipo]),
    h('div', { class: 'body' }, titulo ? h('p', { class: 'alert-title' }, titulo) : null, ...filhos, acoes ? h('div', { class: 'row' }, acoes) : null));
}

/** Campo com rótulo associado, ajuda e erro próximo ao campo. */
export function Campo({ id, rotulo, tipo = 'text', valor = '', onInput = null, onChange = null, erro = null, ajuda = null, obrigatorio = false, placeholder = null,
  opcoes = null, linhas = null, maxlength = null, autocomplete = null, somenteLeitura = false, desabilitado = false, inputmode = null, contador = false,
  autofocus = false, classe = '', onKeydown = null, rotuloOculto = false, min = null, max = null, extra = {} }) {
  const idAjuda = ajuda ? id + '-ajuda' : null;
  const idErro = erro ? id + '-erro' : null;
  const desc = [idAjuda, idErro].filter(Boolean).join(' ') || null;
  const comum = {
    id, name: id, 'aria-invalid': erro ? 'true' : null, 'aria-describedby': desc, 'aria-required': obrigatorio ? 'true' : null,
    disabled: desabilitado, readonly: somenteLeitura, 'data-autofocus': autofocus || null,
    onInput: onInput ? e => onInput(e.target.value, e) : null, onChange: onChange ? e => onChange(e.target.value, e) : null, onKeydown, ...extra
  };
  let controle;
  if (opcoes) {
    controle = h('select', { ...comum, class: 'select', value: valor ?? '' },
      opcoes.map(o => h('option', { value: o.v, disabled: o.desabilitado || null }, o.l)));
  } else if (linhas) {
    controle = h('textarea', { ...comum, class: 'textarea', rows: linhas, maxlength, placeholder, value: valor ?? '' });
  } else {
    controle = h('input', { ...comum, class: 'input', type: tipo, value: valor ?? '', placeholder, maxlength, autocomplete, inputmode, min, max });
  }
  return h('div', { class: cls('field', classe) },
    h('label', { for: id, class: rotuloOculto ? 'sr-only' : null }, rotulo, obrigatorio ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    ajuda ? h('p', { class: 'hint', id: idAjuda }, ajuda) : null,
    controle,
    contador && maxlength ? h('p', { class: 'counter', 'aria-live': 'polite' }, `${String(valor || '').length}/${maxlength}`) : null,
    erro ? h('p', { class: 'err-msg', id: idErro }, icone('warning-circle'), erro) : null);
}

export function Check({ id, rotulo, ajuda = null, marcado = false, onChange, erro = null, obrigatorio = false, desabilitado = false }) {
  const idErro = erro ? id + '-erro' : null;
  return h('div', { class: 'field' },
    h('label', { class: 'check', for: id },
      h('input', { type: 'checkbox', id, name: id, checked: Boolean(marcado), disabled: desabilitado, 'aria-invalid': erro ? 'true' : null, 'aria-describedby': idErro, 'aria-required': obrigatorio ? 'true' : null, onChange: e => onChange(e.target.checked) }),
      h('span', { class: 'txt' }, h('span', null, rotulo, obrigatorio ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), ajuda ? h('span', { class: 'hint' }, ajuda) : null)),
    erro ? h('p', { class: 'err-msg', id: idErro }, icone('warning-circle'), erro) : null);
}

/** Controle segmentado (escolha única) com botões de alternância. */
export function Seg({ rotulo, valor, opcoes, onChange, id = null, rotuloVisivel = false }) {
  return h('div', { class: 'field' },
    rotuloVisivel ? h('span', { class: 'label', id: id ? id + '-rot' : null }, rotulo) : null,
    h('div', { class: 'seg', role: 'group', 'aria-label': rotuloVisivel ? null : rotulo, 'aria-labelledby': rotuloVisivel && id ? id + '-rot' : null, id },
      opcoes.map(([v, l, ic]) => h('button', { type: 'button', class: 'seg-opt', 'aria-pressed': String(valor === v), onClick: () => onChange(v) }, ic ? icone(ic) : null, l))));
}

/** Diálogo modal: foco gerenciado, Escape fecha quando seguro (não fecha durante envio). */
export function Dialogo({ id, titulo, descricao = null, onFechar, ocupado = false, largo = false, alerta = false, rodape = null, semFechar = false, sob = false }, ...filhos) {
  const fechar = () => { if (!ocupado && onFechar) onFechar(); };
  return h('div', { class: cls('overlay', sob && 'under'), 'data-overlay': id, key: 'ov-' + id, onFechar: fechar },
    h('div', { class: cls('dialog', largo && 'wide'), role: alerta ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-titulo', 'aria-describedby': descricao ? id + '-desc' : null, id },
      h('div', { class: 'dialog-head' },
        h('div', { class: 'stack-xs' }, h('h2', { id: id + '-titulo' }, titulo), descricao ? h('p', { id: id + '-desc', class: 'text2 small' }, descricao) : null),
        semFechar ? null : Botao({ icone: 'x', variante: 'ghost', rotulo: 'Fechar', onClick: fechar, desabilitado: ocupado })),
      h('div', { class: 'dialog-body' }, ...filhos),
      rodape ? h('div', { class: 'dialog-foot' }, rodape) : null));
}

/** Painel lateral (gaveta). */
export function Gaveta({ id, titulo, onFechar, lado = 'direita', rodape = null, rotuloRegiao = null, cabecalhoExtra = null }, ...filhos) {
  return h('div', { class: cls('drawer-overlay', lado === 'esquerda' && 'left'), 'data-overlay': id, key: 'ov-' + id, onFechar,
    onClick: e => { if (e.target === e.currentTarget) onFechar(); } },
  h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-titulo', id, 'aria-label': rotuloRegiao },
    h('div', { class: 'drawer-head' }, h('h2', { id: id + '-titulo' }, titulo), h('div', { class: 'row' }, cabecalhoExtra, Botao({ icone: 'x', variante: 'ghost', rotulo: 'Fechar painel', onClick: onFechar }))),
    h('div', { class: 'drawer-body' }, ...filhos),
    rodape ? h('div', { class: 'drawer-foot' }, rodape) : null));
}

export function Vazio({ icone: ic = 'info', titulo, texto = null, acoes = null, nivel = 'h2' }) {
  return h('div', { class: 'empty' }, icone(ic), h(nivel, null, titulo), texto ? h('p', null, texto) : null, acoes ? h('div', { class: 'row', style: 'justify-content:center' }, acoes) : null);
}

export function Esqueleto({ linhas = 3, rotulo = 'Carregando…' } = {}) {
  return h('div', { class: 'card', 'aria-busy': 'true', role: 'status' },
    h('span', { class: 'sr-only' }, rotulo),
    Array.from({ length: linhas }, (_, i) => h('div', { class: 'skeleton sk-line', style: `width:${90 - i * 12}%`, 'aria-hidden': 'true' })));
}

/** Abas com contagem; setas do teclado alternam entre elas. */
export function Abas({ id, rotulo, abas, ativa, onTrocar }) {
  const tecla = e => {
    const i = abas.findIndex(a => a.id === ativa);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % abas.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + abas.length) % abas.length;
    if (n == null) return;
    e.preventDefault();
    onTrocar(abas[n].id);
    queueMicrotask(() => { const b = document.getElementById(`${id}-${abas[n].id}`); if (b) b.focus(); });
  };
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': rotulo, onKeydown: tecla },
    abas.map(a => h('button', { type: 'button', role: 'tab', id: `${id}-${a.id}`, class: 'tab', 'aria-selected': String(a.id === ativa), tabindex: a.id === ativa ? '0' : '-1', onClick: () => onTrocar(a.id) },
      a.texto, a.n != null ? h('span', { class: 'n' }, String(a.n)) : null)));
}

export function LinhaDoTempo(itens, formatar) {
  if (!itens.length) return h('p', { class: 'muted' }, 'Sem registros.');
  return h('ol', { class: 'timeline' }, itens.map((it, i) => h('li', { class: 'tl-item', key: 'tl-' + i },
    h('span', { class: 'tl-dot', 'aria-hidden': 'true' }),
    h('div', null, h('p', { class: 'tl-when' }, h('time', { datetime: it.quando }, formatar(it.quando))), h('p', null, it.texto)))));
}

export function Passos({ rotulo, passos, atual, onIr }) {
  return h('nav', { 'aria-label': rotulo },
    h('ol', { class: 'stepper' }, passos.map((p, i) => h('li', null,
      h('button', { type: 'button', class: cls('step', i < atual && 'done'), 'aria-current': i === atual ? 'step' : null, onClick: () => onIr(i) },
        h('span', { class: 'n', 'aria-hidden': 'true' }, i < atual ? icone('check') : String(i + 1)),
        h('span', { class: i === atual ? null : 'hide-mob' }, p, i < atual ? h('span', { class: 'sr-only' }, ' (concluída)') : null))))));
}

export function DL(pares) {
  return h('dl', { class: 'dl' }, pares.filter(Boolean).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v == null || v === '' ? '—' : v)]));
}

export function Kpis(lista) {
  return h('div', { class: 'kpis' }, lista.map(k => h('a', { class: 'kpi', href: k.href }, h('span', { class: 'n' }, String(k.n)), h('span', { class: 'l' }, k.l))));
}

/** Faixa de datas (escolha de dia). */
export function FaixaDatas({ rotulo, datas, selecionada, onEscolher, rotuloDe, contagem = null }) {
  return h('div', { class: 'datestrip', role: 'group', 'aria-label': rotulo },
    datas.map(d => {
      const r = rotuloDe(d);
      const n = contagem ? contagem[d] : null;
      return h('button', { type: 'button', class: 'date-chip', 'aria-pressed': String(d === selecionada), 'aria-label': `${r.completo}${n != null ? ', ' + n + ' atendimentos' : ''}`, onClick: () => onEscolher(d) },
        h('strong', null, r.curto), h('span', { class: 'tabular' }, r.dataCurta), n != null ? h('span', { class: 'xsmall' }, n + ' atend.') : null);
    }));
}

/** Seletor de horários: livres podem ser escolhidos; ocupados aparecem como “Indisponível”, sem detalhes. */
export function Horarios({ rotulo, slots, selecionado, onEscolher }) {
  return h('div', { class: 'slots', role: 'group', 'aria-label': rotulo },
    slots.map(s => (s.livre
      ? h('button', { type: 'button', class: 'slot', 'aria-pressed': String(s.inicio === selecionado), onClick: () => onEscolher(s) }, h('span', { class: 'tabular' }, s.hora))
      : h('button', { type: 'button', class: 'slot busy', disabled: true, 'aria-label': s.hora + ' indisponível' }, h('span', { class: 'tabular' }, s.hora), h('span', { class: 'lbl' }, 'Indisponível')))));
}

// ---------- Tabela (padrão docs/Padrão de tabelas.md) ----------
const normal = v => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const TAMANHOS_PAGINA = [10, 15, 20, 25, 50];

/**
 * Tabela com busca (debounce de 300 ms, substring em qualquer coluna, sugestões), ordenação por
 * qualquer coluna (asc → desc → original) e paginação (10 por padrão; seletor no rodapé; anterior/próxima no topo).
 */
export function Tabela({ id, rotulo, colunas, linhas, estado: st, chave = l => l.id, vazio = 'Nenhum registro encontrado.', placeholder = 'Pesquisar em todos os campos...', ferramentas = null, semBusca = false }) {
  if (st.q == null) Object.assign(st, { q: '', qAplicada: '', pagina: 1, porPagina: 10, ordem: null, buscando: false, sugestoes: false });
  const aplicar = () => { clearTimeout(st._t); st.qAplicada = st.q; st.buscando = false; st.pagina = 1; st.sugestoes = false; render(); };
  const q = normal(st.qAplicada);
  const lista = q ? linhas.filter(l => colunas.some(c => c.valor && normal(c.valor(l)).includes(q))) : linhas.slice();
  if (st.ordem) {
    const c = colunas.find(x => x.id === st.ordem.col);
    if (c && c.valor) lista.sort((a, b) => String(c.valor(a) ?? '').localeCompare(String(c.valor(b) ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' }) * (st.ordem.dir === 'asc' ? 1 : -1));
  }
  const total = lista.length;
  const paginar = linhas.length >= 10;
  const paginas = Math.max(1, Math.ceil(total / st.porPagina));
  if (st.pagina > paginas) st.pagina = paginas;
  const inicio = (st.pagina - 1) * st.porPagina;
  const visiveis = paginar ? lista.slice(inicio, inicio + st.porPagina) : lista;
  const sugestoes = st.sugestoes && st.q.trim().length >= 2
    ? [...new Set(linhas.flatMap(l => colunas.filter(c => c.valor && !c.acoes).map(c => String(c.valor(l) ?? ''))).filter(v => v && normal(v).includes(normal(st.q)) && normal(v) !== normal(st.q)))].slice(0, 6)
    : [];
  const ordenar = c => {
    if (!st.ordem || st.ordem.col !== c.id) st.ordem = { col: c.id, dir: 'asc' };
    else if (st.ordem.dir === 'asc') st.ordem = { col: c.id, dir: 'desc' };
    else st.ordem = null;
    render();
  };
  const ariaSort = c => (st.ordem && st.ordem.col === c.id ? (st.ordem.dir === 'asc' ? 'ascending' : 'descending') : null);
  const setaSort = c => (st.ordem && st.ordem.col === c.id ? icone(st.ordem.dir === 'asc' ? 'caret-up' : 'caret-down') : icone('arrows-down-up', { classe: 'muted' }));
  const navegar = d => { st.pagina = Math.min(paginas, Math.max(1, st.pagina + d)); render(); };

  return h('div', { class: 'stack-sm', id },
    h('div', { class: 'table-tools' },
      semBusca ? h('span') : h('form', { class: 'row grow', role: 'search', onSubmit: e => { e.preventDefault(); aplicar(); } },
        h('div', { class: 'table-search' },
          h('label', { for: id + '-busca', class: 'sr-only' }, 'Pesquisar em ' + rotulo),
          h('input', { id: id + '-busca', class: 'input', type: 'search', placeholder, value: st.q, autocomplete: 'off', 'aria-describedby': id + '-resumo',
            onInput: e => { st.q = e.target.value; st.buscando = true; st.sugestoes = true; clearTimeout(st._t); st._t = setTimeout(aplicar, 300); render(); },
            onKeydown: e => { if (e.key === 'Escape' && st.sugestoes) { e.stopPropagation(); st.sugestoes = false; render(); } } }),
          st.buscando ? h('span', { class: 'spinner', 'aria-hidden': 'true' }, icone('circle-notch', { classe: 'spin' })) : null,
          sugestoes.length ? h('div', { class: 'suggestions', role: 'group', 'aria-label': 'Sugestões de pesquisa' },
            sugestoes.map(v => h('button', { type: 'button', onClick: () => { st.q = v; aplicar(); } }, v))) : null),
        Botao({ texto: 'Pesquisar', icone: 'magnifying-glass', tipo: 'submit' }),
        ferramentas),
      paginar ? h('div', { class: 'pager-top', role: 'group', 'aria-label': 'Paginação de ' + rotulo },
        Botao({ icone: 'caret-left', rotulo: 'Página anterior', onClick: () => navegar(-1), desabilitado: st.pagina <= 1 }),
        h('span', { class: 'small text2 tabular' }, `Página ${st.pagina} de ${paginas}`),
        Botao({ icone: 'caret-right', rotulo: 'Próxima página', onClick: () => navegar(1), desabilitado: st.pagina >= paginas })) : null),
    h('p', { id: id + '-resumo', class: 'sr-only', 'aria-live': 'polite' }, `${total} ${total === 1 ? 'registro' : 'registros'}${q ? ' para a pesquisa' : ''}.`),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'table responsive' },
        h('caption', { class: 'sr-only' }, rotulo),
        h('thead', null, h('tr', null, colunas.map(c => h('th', { scope: 'col', class: c.acoes ? 'actions' : null, 'aria-sort': c.acoes ? null : ariaSort(c) },
          c.acoes ? h('span', { class: 'sr-only' }, c.titulo) : h('button', { type: 'button', class: 'sort', onClick: () => ordenar(c) }, c.titulo, setaSort(c)))))),
        h('tbody', null, visiveis.length
          ? visiveis.map(l => h('tr', { key: 'r-' + chave(l) }, colunas.map(c => h('td', { 'data-label': c.titulo, class: c.acoes ? 'actions' : c.classe || null }, c.render ? c.render(l) : String(c.valor(l) ?? '—')))))
          : h('tr', null, h('td', { colspan: String(colunas.length) }, h('p', { class: 'muted' }, vazio))))),
      paginar ? h('div', { class: 'table-foot' },
        h('div', { class: 'row' },
          h('label', { for: id + '-pp', class: 'small' }, 'Itens por página'),
          h('select', { id: id + '-pp', class: 'select', value: String(st.porPagina), onChange: e => { st.porPagina = Number(e.target.value); st.pagina = 1; render(); } },
            TAMANHOS_PAGINA.map(n => h('option', { value: String(n) }, String(n))))),
        h('span', { class: 'tabular' }, total ? `${inicio + 1}–${Math.min(inicio + st.porPagina, total)} de ${total}` : '0 resultados')) : null));
}

export { icone, h };
