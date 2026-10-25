// Controles de simulação (painel “Simulação”): latência artificial, falhas de rede e de e-mail.
// Nunca são misturados à interface real; o painel é rotulado como demonstração.
import { storage, CHAVES } from './storage.js';

const PADRAO = { latencia: 'padrao', falharProximoEnvio: false, falharCatalogo: false, falharEmail: false };
export const LATENCIAS = {
  padrao: [400, 900],
  rapida: [60, 160],
  nenhuma: [0, 0]
};

export function lerSim() {
  return { ...PADRAO, ...storage.getJson(CHAVES.sim, {}) };
}

export function definirSim(patch) {
  storage.setJson(CHAVES.sim, { ...lerSim(), ...patch });
}

/** Atraso artificial de rede (configurável). */
export function atraso() {
  const [min, max] = LATENCIAS[lerSim().latencia] || LATENCIAS.padrao;
  if (!max) return Promise.resolve();
  const ms = min + Math.round(Math.random() * (max - min));
  return new Promise(r => setTimeout(r, ms));
}

/** Consome a falha programada para o próximo envio (escrita). */
export function consumirFalhaEnvio() {
  const s = lerSim();
  if (!s.falharProximoEnvio) return false;
  definirSim({ falharProximoEnvio: false });
  return true;
}

/** Consome a falha programada para a próxima leitura do catálogo. */
export function consumirFalhaCatalogo() {
  const s = lerSim();
  if (!s.falharCatalogo) return false;
  definirSim({ falharCatalogo: false });
  return true;
}
