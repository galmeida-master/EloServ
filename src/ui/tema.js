// Tema (Sistema, Claro, Escuro) e densidade (Conforto, Compacto): independentes e persistidos.
// O script inline do <head> aplica a escolha antes da primeira renderização (sem flash).
import { storage, CHAVES } from '../api/storage.js';

export const TEMAS = [['system', 'Sistema', 'desktop'], ['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon']];
export const DENSIDADES = [['comfort', 'Conforto', 'rows'], ['compact', 'Compacto', 'list-dashes']];

export const lerTema = () => { const t = storage.get(CHAVES.tema); return ['system', 'light', 'dark'].includes(t) ? t : 'dark'; };
export const lerDensidade = () => (storage.get(CHAVES.densidade) === 'compact' ? 'compact' : 'comfort');

const claroNoSistema = () => { try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; } };

export function aplicar() {
  const t = lerTema();
  const efetivo = t === 'system' ? (claroNoSistema() ? 'light' : 'dark') : t;
  document.documentElement.setAttribute('data-theme', efetivo);
  document.documentElement.setAttribute('data-density', lerDensidade());
}

export function definirTema(t) { storage.set(CHAVES.tema, t); aplicar(); }
export function definirDensidade(d) { storage.set(CHAVES.densidade, d); aplicar(); }

/** “Sistema” acompanha mudanças do dispositivo em tempo real. */
export function observarSistema(aoMudar) {
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (lerTema() === 'system') { aplicar(); aoMudar(); } });
  } catch { /* navegador sem suporte */ }
}
