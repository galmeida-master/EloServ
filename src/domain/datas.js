// Datas, horários e fuso. Instantes são armazenados em UTC (ISO 8601) e convertidos
// para o fuso da empresa na apresentação, com Intl.DateTimeFormat.

export const FUSO_PADRAO = 'America/Cuiaba';
export const MINUTO = 60000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

const NOMES_FUSO = {
  'America/Cuiaba': 'Cuiabá',
  'America/Sao_Paulo': 'Brasília',
  'America/Campo_Grande': 'Campo Grande',
  'America/Porto_Velho': 'Porto Velho'
};
export const FUSOS_DISPONIVEIS = [
  ['America/Cuiaba', 'Cuiabá — Mato Grosso'],
  ['America/Sao_Paulo', 'Brasília — GO, DF e demais'],
  ['America/Campo_Grande', 'Campo Grande — Mato Grosso do Sul']
];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIA_IDX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatadores = new Map();
function formatador(fuso) {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'
    });
    formatadores.set(fuso, f);
  }
  return f;
}

/** Converte ms, ISO ou Date em milissegundos desde a época. */
export function emMs(instante) {
  if (typeof instante === 'number') return instante;
  if (instante instanceof Date) return instante.getTime();
  return Date.parse(instante);
}

export const isoUtc = instante => new Date(emMs(instante)).toISOString();
const dois = n => String(n).padStart(2, '0');

/** Partes de calendário de um instante no fuso indicado. */
export function partesNoFuso(instante, fuso = FUSO_PADRAO) {
  const o = {};
  for (const p of formatador(fuso).formatToParts(new Date(emMs(instante)))) o[p.type] = p.value;
  return {
    ano: Number(o.year), mes: Number(o.month), dia: Number(o.day),
    hora: Number(o.hour) % 24, minuto: Number(o.minute), segundo: Number(o.second),
    diaSemana: DIA_IDX[o.weekday]
  };
}

/** Deslocamento do fuso em minutos (local − UTC) no instante indicado. */
export function deslocamentoMin(instante, fuso = FUSO_PADRAO) {
  const ms = emMs(instante);
  const p = partesNoFuso(ms, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - (ms - (((ms % 1000) + 1000) % 1000))) / MINUTO);
}

export function hmParaMin(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + m;
}
export const minParaHm = min => dois(Math.floor(min / 60)) + ':' + dois(min % 60);

/** Instante UTC (ms) correspondente à data 'AAAA-MM-DD' e hora 'HH:MM' locais do fuso. */
export function paraUtc(data, hora, fuso = FUSO_PADRAO) {
  const [a, m, d] = data.split('-').map(Number);
  const min = hmParaMin(hora);
  const palpite = Date.UTC(a, m - 1, d, Math.floor(min / 60), min % 60);
  const off1 = deslocamentoMin(palpite, fuso);
  let ms = palpite - off1 * MINUTO;
  const off2 = deslocamentoMin(ms, fuso);
  if (off2 !== off1) ms = palpite - off2 * MINUTO;
  return ms;
}

export function dataLocal(instante, fuso = FUSO_PADRAO) {
  const p = partesNoFuso(instante, fuso);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}
export function horaLocal(instante, fuso = FUSO_PADRAO) {
  const p = partesNoFuso(instante, fuso);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}
export function minutosLocal(instante, fuso = FUSO_PADRAO) {
  const p = partesNoFuso(instante, fuso);
  return p.hora * 60 + p.minuto;
}

/** Aritmética de calendário sobre 'AAAA-MM-DD' (independente de fuso). */
export function somarDias(data, n) {
  const [a, m, d] = data.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`;
}
export function diaSemanaData(data) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
export function somarMeses(data, n) {
  const [a, m] = data.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}`;
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa'. */
export function dataBr(data) {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
export function rotuloDia(data) {
  const [, m, d] = data.split('-');
  const ds = diaSemanaData(data);
  return { curto: DIAS[ds], dataCurta: `${d}/${m}`, completo: `${DIAS[ds]}, ${dataBr(data)}`, longo: `${DIAS_LONGOS[ds]}, ${dataBr(data)}` };
}
/** 'AAAA-MM' → 'abril de 2027'. */
export function rotuloMes(anoMes) {
  const [a, m] = anoMes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export function formatarData(instante, fuso = FUSO_PADRAO) {
  return dataBr(dataLocal(instante, fuso));
}
export function formatarDataCurta(instante, fuso = FUSO_PADRAO) {
  const p = partesNoFuso(instante, fuso);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}
/** 'Qua, 28/10/2026 · 13:30' */
export function formatarDataHora(instante, fuso = FUSO_PADRAO) {
  const p = partesNoFuso(instante, fuso);
  return `${DIAS[p.diaSemana]}, ${dois(p.dia)}/${dois(p.mes)}/${p.ano} · ${dois(p.hora)}:${dois(p.minuto)}`;
}
/** 'Qua, 28/10/2026 · 13:30–15:30' */
export function formatarIntervalo(inicio, fim, fuso = FUSO_PADRAO) {
  return `${formatarDataHora(inicio, fuso)}–${horaLocal(fim, fuso)}`;
}
/** '27/10/2026, 18:00' — usado em prazos. */
export function formatarPrazo(instante, fuso = FUSO_PADRAO) {
  return `${formatarData(instante, fuso)}, ${horaLocal(instante, fuso)}`;
}
/** '24/10/2026 · 09:12' — usado em linhas do tempo e auditoria. */
export function formatarRegistro(instante, fuso = FUSO_PADRAO) {
  return `${formatarData(instante, fuso)} · ${horaLocal(instante, fuso)}`;
}

/** 'UTC−4' (com sinal de menos tipográfico). */
export function rotuloUtc(fuso = FUSO_PADRAO, instante = Date.now()) {
  const off = deslocamentoMin(instante, fuso);
  const sinal = off < 0 ? '−' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60), m = abs % 60;
  return 'UTC' + sinal + h + (m ? ':' + dois(m) : '');
}
/** 'Horário de Cuiabá (UTC−4)' */
export function rotuloFuso(fuso = FUSO_PADRAO, instante = Date.now()) {
  return `Horário de ${NOMES_FUSO[fuso] || fuso} (${rotuloUtc(fuso, instante)})`;
}

/** Próximos `n` dias a partir de `data` (exclusive), opcionalmente pulando domingos. */
export function proximosDias(data, n, { pularDomingo = true } = {}) {
  const out = [];
  let d = data;
  while (out.length < n) {
    d = somarDias(d, 1);
    if (pularDomingo && diaSemanaData(d) === 0) continue;
    out.push(d);
  }
  return out;
}

/** Próximos `n` dias úteis (seg–sex) após `data`, pulando as datas informadas. */
export function proximosDiasUteis(data, n, pular = []) {
  const out = [];
  let d = data;
  while (out.length < n) {
    d = somarDias(d, 1);
    const ds = diaSemanaData(d);
    if (ds === 0 || ds === 6 || pular.includes(d)) continue;
    out.push(d);
  }
  return out;
}
