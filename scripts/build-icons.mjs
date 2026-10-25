// Gera src/ui/icons-data.js a partir dos SVGs do Phosphor (peso regular).
// O arquivo gerado é versionado: a aplicação não depende deste script em tempo de execução.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NOMES = [
  'paper-plane-tilt', 'magnifying-glass', 'file-text', 'check-circle', 'x-circle', 'prohibit', 'hourglass',
  'lock-simple', 'arrow-u-up-left', 'minus-circle', 'calendar-check', 'wrench', 'clock', 'pause-circle', 'archive',
  'envelope-simple', 'pencil-simple', 'circle', 'squares-four', 'clipboard-text', 'calendar-blank', 'thermometer',
  'clock-counter-clockwise', 'user', 'question', 'gear', 'storefront', 'package', 'users', 'address-book',
  'buildings', 'users-three', 'tag', 'book-open', 'lifebuoy', 'bell', 'list', 'x', 'caret-down', 'caret-left',
  'caret-right', 'caret-up', 'arrow-left', 'arrow-right', 'sun', 'moon', 'desktop', 'rows', 'list-dashes', 'columns',
  'list-bullets', 'warning', 'info', 'warning-circle', 'circle-notch', 'map-pin', 'phone', 'plus', 'trash', 'printer',
  'sign-out', 'sign-in', 'arrows-left-right', 'flask', 'sliders-horizontal', 'arrow-clockwise', 'check', 'funnel',
  'user-circle', 'shield-check', 'calendar-x', 'calendar-plus', 'note-pencil', 'crosshair', 'house', 'briefcase',
  'arrow-square-out', 'arrows-down-up', 'timer', 'snowflake', 'fan', 'user-plus', 'key', 'play', 'thumbs-up',
  'thumbs-down', 'envelope-open', 'swap', 'clock-clockwise', 'lightning', 'eye', 'monitor', 'device-mobile'
];

const base = join('node_modules', '@phosphor-icons', 'core', 'assets', 'regular');
const dados = {};
const faltando = [];
for (const nome of NOMES) {
  const arq = join(base, nome + '.svg');
  if (!existsSync(arq)) { faltando.push(nome); continue; }
  const svg = readFileSync(arq, 'utf8');
  const caminhos = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
  const outros = svg.replace(/<path[^>]*\/>/g, '').match(/<(rect|circle|line|polyline|polygon|ellipse)\b/);
  if (!caminhos.length || outros) { faltando.push(nome + ' (formato não suportado)'); continue; }
  dados[nome] = caminhos;
}
if (faltando.length) console.warn('Ícones ignorados:', faltando.join(', '));

const saida = '// Arquivo gerado por scripts/build-icons.mjs a partir de @phosphor-icons/core (licença MIT).\n' +
  '// Não editar manualmente.\n' +
  'export const ICONES = ' + JSON.stringify(dados, null, 0).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, '\n}') + ';\n';
writeFileSync(join('src', 'ui', 'icons-data.js'), saida);
console.log('Gerados', Object.keys(dados).length, 'ícones em src/ui/icons-data.js');
