// Controle otimista por versão de registro e registro de idempotência (funções puras).

export const CONFLITO = 'CONFLITO_ATUALIZACAO';
export const MENSAGEM_CONFLITO = 'Este registro foi alterado em outra aba ou sessão depois que você abriu a tela. Nada foi gravado. Atualize para ver a situação atual e tente novamente.';

/** Compara a versão vista pela tela com a versão atual. */
export function verificarVersao(registro, versaoEsperada) {
  if (versaoEsperada == null) return null;
  if (!registro) return { ok: false, code: 'NAO_ENCONTRADO', message: 'Registro não encontrado.' };
  if (registro.v !== versaoEsperada) return { ok: false, code: CONFLITO, message: MENSAGEM_CONFLITO, details: { esperada: versaoEsperada, atual: registro.v } };
  return null;
}

/**
 * Registros tocados por uma transação cujas versões mudaram entre a leitura e a gravação.
 * `lidos` e `atuais`: { 'colecao/id': versao }.
 */
export function versoesAlteradas(lidos, atuais) {
  return Object.keys(lidos).filter(k => atuais[k] !== lidos[k]);
}

export const TTL_IDEMPOTENCIA = 48 * 3600000;

/** Resultado já registrado para a chave (ou null). */
export function buscarIdempotente(registro, chave, agora, ttl = TTL_IDEMPOTENCIA) {
  if (!chave) return null;
  const r = registro[chave];
  if (!r || agora - r.em > ttl) return null;
  return r.resultado;
}

/** Novo registro com o resultado gravado e entradas vencidas removidas. */
export function registrarIdempotente(registro, chave, resultado, agora, ttl = TTL_IDEMPOTENCIA) {
  const novo = {};
  for (const [k, v] of Object.entries(registro)) if (agora - v.em <= ttl) novo[k] = v;
  if (chave) novo[chave] = { em: agora, resultado };
  return novo;
}
