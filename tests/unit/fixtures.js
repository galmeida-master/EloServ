// Dados mínimos para os testes de domínio (fictícios).
import { paraUtc } from '../../src/domain/datas.js';

export const FUSO = 'America/Cuiaba';
export const SEG = '2026-10-26';
export const TER = '2026-10-27';
export const SAB = '2026-10-31';
/** “Agora” dos testes: sábado, 24/10/2026, 10:00 em Cuiabá. */
export const AGORA = paraUtc('2026-10-24', '10:00', FUSO);

export const at = (data, hora, fuso = FUSO) => paraUtc(data, hora, fuso);
export const iso = (data, hora, fuso = FUSO) => new Date(paraUtc(data, hora, fuso)).toISOString();

export const JORNADA = { dias: [1, 2, 3, 4, 5], inicio: '07:30', fim: '17:30', intervalo: { inicio: '12:00', fim: '13:00' } };

export function empresa(extra = {}) {
  return { id: 'emp', fuso: FUSO, preparoMin: 30, jornadaPadrao: JORNADA, feriados: [], ...extra };
}

export function prof(id, servicos, extra = {}) {
  return { id, servicos, situacao: 'ativo', jornada: JORNADA, folgas: [], ...extra };
}

export const SERV_HIG = { id: 'hig', duracaoMin: 90 };
export const SERV_PREV = { id: 'prev', duracaoMin: 120 };
export const SERV_INST = { id: 'inst', duracaoMin: 180 };

let n = 0;
export function ocup(profissionalId, data, ini, fim, estado = 'confirmada', extra = {}) {
  n += 1;
  return { id: 'o' + n, profissionalId, inicio: iso(data, ini), fim: iso(data, fim), estado, ...extra };
}
