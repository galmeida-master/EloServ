// Relógio da demonstração: hora real + deslocamento ajustável pelo painel de simulação
// (permite demonstrar expiração de reservas e propostas sem esperar).
import { storage, CHAVES } from './storage.js';

export function deslocamento() {
  const v = Number(storage.get(CHAVES.relogio));
  return Number.isFinite(v) ? v : 0;
}

export const agora = () => Date.now() + deslocamento();

export function avancar(ms) {
  storage.set(CHAVES.relogio, String(deslocamento() + ms));
}

export function zerarRelogio() {
  storage.remove(CHAVES.relogio);
}
