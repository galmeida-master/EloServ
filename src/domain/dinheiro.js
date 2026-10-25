// Valores monetários em centavos (inteiros) e textos de preço. A EloServ não processa pagamentos.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ESPACO_RIGIDO = new RegExp(String.fromCharCode(160), 'g');

/** 22000 → 'R$ 220,00' (com espaço comum). */
export function formatarMoeda(centavos) {
  return BRL.format(centavos / 100).replace(ESPACO_RIGIDO, ' ');
}

/** '1.180,50' | '220' | 'R$ 35,00' → centavos; null quando inválido ou vazio. */
export function lerMoeda(texto) {
  if (texto == null) return null;
  const t = String(texto).replace(/R\$\s?/i, '').replace(/\s/g, '').trim();
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const [int, dec = ''] = t.replace(/\./g, '').split(',');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

/** Centavos → '220,00' (para preencher campos). */
export const centavosParaCampo = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

export const TIPOS_PRECO = { fixo: 'Preço fixo', a_partir: 'A partir de', orcamento: 'Sob orçamento' };

/** Texto curto do preço de um serviço. */
export function rotuloPreco(servico) {
  if (servico.tipoPreco === 'orcamento') return 'Sob orçamento';
  if (servico.tipoPreco === 'a_partir') return 'A partir de ' + formatarMoeda(servico.precoCentavos);
  return formatarMoeda(servico.precoCentavos);
}

/** Texto explicativo do preço, usado na revisão da solicitação. */
export function explicacaoPreco(servico) {
  if (servico.tipoPreco === 'orcamento') return 'Sob orçamento — valor definido na proposta';
  if (servico.tipoPreco === 'a_partir') return 'A partir de ' + formatarMoeda(servico.precoCentavos) + ' — não é o valor final';
  return 'Preço fixo · ' + formatarMoeda(servico.precoCentavos);
}

/** Total estimado de uma proposta: itens obrigatórios somam o mínimo; opcionais ampliam o máximo. */
export function totalProposta(itens) {
  let min = 0, max = 0, aDefinir = false;
  for (const i of itens) {
    if (i.valorCentavos == null) { aDefinir = true; continue; }
    max += i.valorCentavos;
    if (!i.opcional) min += i.valorCentavos;
  }
  return { min, max, aDefinir };
}

export function rotuloTotal(itens) {
  const t = totalProposta(itens);
  if (!itens.length) return 'A definir';
  const base = t.min === t.max ? formatarMoeda(t.min) : `${formatarMoeda(t.min)} a ${formatarMoeda(t.max)}`;
  return t.aDefinir ? `${base} + itens a definir após avaliação` : base;
}
