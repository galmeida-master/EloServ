// Ícones Phosphor (regular) em SVG inline. Sempre acompanhados de texto ou rótulo acessível.
import { s } from './h.js';
import { ICONES } from './icons-data.js';

export function icone(nome, { classe = '', rotulo = null } = {}) {
  const caminhos = ICONES[nome] || ICONES.circle;
  const attrs = { viewBox: '0 0 256 256', class: ('ic ' + classe).trim(), focusable: 'false' };
  if (rotulo) { attrs.role = 'img'; attrs['aria-label'] = rotulo; } else attrs['aria-hidden'] = 'true';
  return s('svg', attrs, ...caminhos.map(d => s('path', { d })));
}
