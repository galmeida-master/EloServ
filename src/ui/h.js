// Construção declarativa de DOM e reconciliação (morph) sem dependências.
// As telas são funções que devolvem elementos; o morph reaproveita os nós existentes
// para preservar foco, posição do cursor e valores digitados entre renderizações.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'selected', 'indeterminate']);

function addChildren(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) { addChildren(el, k); continue; }
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

function setHandler(el, type, fn) {
  if (!el.__h) el.__h = {};
  if (!el.__ls) el.__ls = new Set();
  el.__h[type] = fn;
  if (!el.__ls.has(type)) {
    el.__ls.add(type);
    el.addEventListener(type, ev => { const f = el.__h && el.__h[type]; if (f) f(ev); });
  }
}

function applyProps(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (PROPS.has(k)) { if (v === undefined) continue; if (!el.__p) el.__p = {}; el.__p[k] = v; el[k] = v; continue; }
    if (v == null || v === false) continue;
    if (k === 'key') { el.setAttribute('data-key', String(v)); continue; }
    if (k === 'class' || k === 'className') {
      const c = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
      if (c) el.setAttribute('class', c);
      continue;
    }
    if (k.startsWith('on') && typeof v === 'function') { setHandler(el, k.slice(2).toLowerCase(), v); continue; }
    el.setAttribute(k, v === true ? '' : String(v));
  }
}

/** Cria um elemento HTML. `props` aceita class, atributos, aria-*, onClick etc. */
export function h(tag, props, ...children) {
  if (props instanceof Node || Array.isArray(props) || typeof props === 'string' || typeof props === 'number') {
    children.unshift(props);
    props = null;
  }
  const el = document.createElement(tag);
  applyProps(el, props);
  addChildren(el, children);
  if (el.__p) for (const [k, v] of Object.entries(el.__p)) el[k] = v; // ex.: value de <select> após as opções
  return el;
}

/** Cria um elemento SVG (usado pelos ícones). */
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, String(v));
  addChildren(el, children);
  return el;
}

/** Fragmento: devolve a lista de filhos (achatada) para compor em h(). */
export const frag = (...kids) => kids;

const keyOf = n => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);

function syncAttrs(from, to) {
  for (const a of Array.from(from.attributes)) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of Array.from(to.attributes)) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
}

function syncHandlers(from, to) {
  const types = new Set([...(from.__h ? Object.keys(from.__h) : []), ...(to.__h ? Object.keys(to.__h) : [])]);
  for (const t of types) {
    const fn = to.__h && to.__h[t];
    if (fn) setHandler(from, t, fn);
    else if (from.__h) delete from.__h[t];
  }
}

function syncProps(from, to) {
  const p = to.__p;
  if (!p) return;
  for (const [k, v] of Object.entries(p)) {
    if (k === 'value' && from === document.activeElement && from.value === String(v)) continue;
    if (from[k] !== v) from[k] = v;
  }
  from.__p = p;
}

function morphChildren(from, to) {
  const next = Array.from(to.childNodes);
  const keyed = new Map();
  for (const c of Array.from(from.childNodes)) { const k = keyOf(c); if (k) keyed.set(k, c); }
  next.forEach((nk, i) => {
    const cur = from.childNodes[i] || null;
    const k = keyOf(nk);
    let match = null;
    if (k) { match = keyed.get(k) || null; if (match) keyed.delete(k); if (match && match.nodeName !== nk.nodeName) match = null; }
    else if (cur && !keyOf(cur) && same(cur, nk)) match = cur;
    if (match) {
      if (match !== cur) from.insertBefore(match, cur);
      morphNode(match, nk);
    } else {
      from.insertBefore(nk, cur);
    }
  });
  while (from.childNodes.length > next.length) from.removeChild(from.lastChild);
}

/** Atualiza `from` (no documento) para ficar igual a `to` (recém-construído). Devolve o nó resultante. */
export function morphNode(from, to) {
  if (!same(from, to)) { from.replaceWith(to); return to; }
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return from;
  }
  syncAttrs(from, to);
  syncHandlers(from, to);
  morphChildren(from, to);
  syncProps(from, to);
  if (!to.__p && from.__p) from.__p = null;
  return from;
}

/** Monta ou atualiza o conteúdo de `container` com `tree`. */
export function mount(container, tree) {
  const first = container.firstElementChild;
  if (first && container.childNodes.length === 1) return morphNode(first, tree);
  container.replaceChildren(tree);
  return tree;
}
