// Validações de formulário (mensagens próximas ao campo e resumo na revisão).

import { hmParaMin } from './datas.js';

export const DOMINIO_DEMO = '@exemplo.invalid';
export const ETAPAS_SOLICITACAO = ['Serviço', 'Equipamento', 'Local', 'Necessidade', 'Horário', 'Revisão'];

const vazio = v => !String(v ?? '').trim();

/** Erros da etapa `etapa` (0–4) do assistente de solicitação. `ctx.horarioLivre(inicioIso)` informa a vaga. */
export function validarEtapaSolicitacao(etapa, r, ctx = {}) {
  const e = {};
  if (etapa === 0 && vazio(r.servicoId)) e.servicoId = 'Escolha um serviço.';
  if (etapa === 1) {
    if (r.equipamentoModo === 'salvo') { if (vazio(r.equipamentoId)) e.equipamentoId = 'Escolha um equipamento cadastrado.'; }
    else if (vazio(r.equipTipo)) e.equipTipo = 'Informe o tipo do equipamento.';
  }
  if (etapa === 2) {
    if (r.localModo === 'salvo') { if (vazio(r.enderecoId)) e.enderecoId = 'Escolha um endereço salvo.'; }
    else {
      if (vazio(r.bairro)) e.bairro = 'Informe o bairro ou região.';
      if (vazio(r.cidade)) e.cidade = 'Informe a cidade.';
    }
  }
  if (etapa === 3) {
    const n = String(r.descricao || '').trim().length;
    if (n < 15) e.descricao = 'Descreva a necessidade com pelo menos 15 caracteres.';
    else if (n > 600) e.descricao = 'Use no máximo 600 caracteres.';
  }
  if (etapa === 4 && !r.semHorario) {
    if (vazio(r.inicio)) e.inicio = 'Escolha um horário disponível ou marque “Enviar sem horário definido”.';
    else if (ctx.horarioLivre && !ctx.horarioLivre(r.inicio)) e.inicio = 'O horário escolhido não está mais disponível. Escolha outro ou envie sem horário definido.';
  }
  return e;
}

/** Erros de todas as etapas, com a etapa de cada campo (para o resumo da revisão). */
export function validarSolicitacao(r, ctx = {}) {
  const erros = {};
  const etapaDoCampo = {};
  for (let i = 0; i <= 4; i++) {
    const e = validarEtapaSolicitacao(i, r, ctx);
    for (const k of Object.keys(e)) { erros[k] = e[k]; etapaDoCampo[k] = i; }
  }
  return { erros, etapaDoCampo, ok: Object.keys(erros).length === 0 };
}

export function validarEmailDemo(email) {
  const v = String(email || '').trim().toLowerCase();
  if (!v) return 'Informe o e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Informe um e-mail válido.';
  if (!v.endsWith(DOMINIO_DEMO)) return 'Nesta demonstração, use um e-mail fictício terminado em @exemplo.invalid.';
  return null;
}

export function validarTelefone(tel, obrigatorio = false) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return obrigatorio ? 'Informe o telefone.' : null;
  if (d.length < 10 || d.length > 11) return 'Informe DDD e número (10 ou 11 dígitos).';
  return null;
}

/** Apenas o formato 00.000.000/0000-00 (dados demonstrativos não usam CNPJ real). */
export function validarCnpjFormato(cnpj) {
  if (vazio(cnpj)) return 'Informe o CNPJ.';
  if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(String(cnpj).trim())) return 'Use o formato 00.000.000/0000-00.';
  return null;
}

export function validarCadastro(d) {
  const e = {};
  if (d.tipo === 'empresa') {
    if (vazio(d.empresaNome)) e.empresaNome = 'Informe o nome da empresa.';
    const c = validarCnpjFormato(d.cnpj); if (c) e.cnpj = c;
    if (vazio(d.cidade)) e.cidade = 'Informe a cidade.';
  }
  if (vazio(d.nome)) e.nome = d.tipo === 'empresa' ? 'Informe o nome do responsável.' : 'Informe seu nome.';
  const m = validarEmailDemo(d.email); if (m) e.email = m;
  const t = validarTelefone(d.telefone, true); if (t) e.telefone = t;
  if (String(d.senha || '').length < 8) e.senha = 'A credencial precisa ter ao menos 8 caracteres.';
  if (!d.termos) e.termos = 'É necessário aceitar os termos para criar a conta.';
  return e;
}

export function validarJustificativa(texto, minimo = 10) {
  return String(texto || '').trim().length >= minimo ? null : `Informe a justificativa (mínimo de ${minimo} caracteres). Ela fica registrada na auditoria.`;
}

export function validarBloqueio({ diaInteiro, inicio, fim, motivo }) {
  const e = {};
  if (!diaInteiro && hmParaMin(fim) <= hmParaMin(inicio)) e.fim = 'O fim deve ser depois do início.';
  if (vazio(motivo)) e.motivo = 'Informe o motivo interno.';
  return e;
}

/** Proposta: ao menos um item descrito, valores válidos, validade antes do horário proposto. */
export function validarProposta({ itens, inicio, validadeEm, agora, profissionalId }) {
  const e = {};
  if (vazio(profissionalId)) e.profissionalId = 'Atribua um profissional disponível antes de enviar a proposta.';
  if (!itens.length || itens.every(i => vazio(i.descricao))) e.itens = 'Inclua ao menos um item na proposta.';
  else if (itens.some(i => !vazio(i.descricao) && i.valorInvalido)) e.itens = 'Revise os valores: use o formato 220,00 ou deixe em branco para “a definir”.';
  if (!inicio) e.inicio = 'Escolha a data e o horário propostos.';
  else if (inicio <= agora) e.inicio = 'O horário proposto já passou.';
  else if (validadeEm >= inicio) e.validade = 'A validade precisa terminar antes do horário proposto. Escolha uma validade menor.';
  return e;
}

export function validarArtigo(a) {
  const e = [];
  if (vazio(a.titulo)) e.push('Informe o título.');
  if (vazio(a.resumo)) e.push('Informe o resumo.');
  if (!(a.passos || []).some(p => !vazio(p))) e.push('Inclua ao menos um passo.');
  return e;
}

/** 'marina.demo@exemplo.invalid' → 'ma•••@exemplo.invalid' (minimização em listas administrativas). */
export function mascararEmail(email) {
  const [u, d] = String(email || '').split('@');
  if (!d) return '—';
  return u.slice(0, 2) + '•••@' + d;
}

/** Iniciais para avatar: 'Ana Ribeiro' → 'AR'. */
export function iniciais(nome) {
  return String(nome || '').split(/\s+/).filter(p => p && /[A-Za-zÀ-ÿ]/.test(p[0])).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
}

/** 'Marina Duarte' → 'Marina D.' (dados mínimos em listas e notificações). */
export function nomeCurto(nome) {
  const p = String(nome || '').trim().split(/\s+/);
  if (p.length < 2) return p[0] || '';
  return `${p[0]} ${p[p.length - 1][0]}.`;
}
