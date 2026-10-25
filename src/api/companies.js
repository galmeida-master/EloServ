// Empresas: catálogo público, perfil público, operação da empresa, profissionais e ações administrativas.
import { ok, falhar, ler, leituraRemota } from './db.js';
import { executar, exigirGestor, empresaDe, servicoDe, profissionalDe, ocupacaoDe, ordemDe, gestoresDa, linha } from './comum.js';
import { liberarNoTx, contextoEmpresa } from './agenda.js';
import { agora } from './clock.js';
import { consumirFalhaCatalogo } from './sim.js';
import { pode, vinculoEmpresa, vinculoAdmin } from '../domain/permissoes.js';
import { verificarProfissional, ocupacaoAtiva, MOTIVOS } from '../domain/agenda.js';
import { validarEmailDemo, validarJustificativa, iniciais, nomeCurto, mascararEmail, validarTelefone } from '../domain/validacao.js';
import { DIA, emMs, dataLocal, formatarDataHora, hmParaMin, FUSOS_DISPONIVEIS } from '../domain/datas.js';
import { lerMoeda, rotuloPreco } from '../domain/dinheiro.js';
import { VALIDADE_CONVITE_DIAS } from '../domain/reservas.js';

const iso = ms => new Date(ms).toISOString();
const RECENTE = 7 * DIA; // “Habilitada recentemente”

// ---------- Catálogo público ----------
function cartao(e, emp, t) {
  const servicos = e.servicos.filter(s => s.empresaId === emp.id && s.situacao === 'ativo');
  return {
    slug: emp.slug, nome: emp.nome, ini: iniciais(emp.nome), cidade: emp.cidade, area: emp.area, categorias: emp.categorias, modalidades: emp.modalidades,
    servicos: servicos.map(s => s.nome), recente: Boolean(emp.dataHabilitacao && t - emMs(emp.dataHabilitacao) < RECENTE)
  };
}
const ativas = e => e.empresas.filter(x => x.situacao === 'ativa');

export function opcoesCatalogo() {
  const e = ler();
  const emp = ativas(e);
  const cidades = [...new Set(['Barra do Garças', 'Cáceres', 'Cuiabá', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Várzea Grande', ...emp.flatMap(x => [x.cidade, ...x.area])])].filter(c => !/\(/.test(c)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const categorias = e.categorias.map(c => c.nome);
  const servicos = [...new Set(e.servicos.filter(s => s.situacao === 'ativo' && emp.some(x => x.id === s.empresaId)).map(s => s.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { cidades, categorias, servicos };
}

export function filtrarCatalogo(lista, f) {
  const q = String(f.q || '').trim().toLowerCase();
  return lista.filter(x => (!q || x.nome.toLowerCase().includes(q))
    && (!f.cidade || x.cidade === f.cidade || x.area.includes(f.cidade))
    && (!f.categoria || x.categorias.includes(f.categoria))
    && (!f.servico || x.servicos.includes(f.servico))
    && (!f.modalidade || x.modalidades.includes(f.modalidade)));
}

/** Catálogo (leitura remota simulada: atraso e falha opcional). */
export function listarCatalogo() {
  const t = agora();
  return leituraRemota(e => ativas(e).map(emp => cartao(e, emp, t)), { falha: consumirFalhaCatalogo });
}
export function catalogoSincrono() {
  const e = ler();
  const t = agora();
  return ativas(e).map(emp => cartao(e, emp, t));
}

/** Perfil público: apenas dados autorizados para publicação. Empresas não ativas não são exibidas. */
export function perfilPublico(slug) {
  const e = ler();
  const emp = e.empresas.find(x => x.slug === slug);
  if (!emp || emp.situacao !== 'ativa') return null;
  return {
    id: emp.id, slug: emp.slug, nome: emp.nome, ini: iniciais(emp.nome), descricao: emp.descricao, cidade: emp.cidade, area: emp.area, modalidades: emp.modalidades,
    horarios: emp.horarios, contato: emp.contatoPublico, politicas: emp.politicas, fuso: emp.fuso, categorias: emp.categorias,
    servicos: e.servicos.filter(s => s.empresaId === emp.id && s.situacao === 'ativo').map(s => ({ ...s, precoTexto: rotuloPreco(s) })),
    produtos: e.produtos.filter(p => p.empresaId === emp.id && p.situacao === 'ativo'),
    profissionais: e.profissionais.filter(p => p.empresaId === emp.id && p.situacao === 'ativo' && p.publico).map(p => ({ nome: p.curto, descricao: p.publico, ini: iniciais(p.nome) }))
  };
}

export function consultarProduto({ produtoId, mensagem }, opcoes = {}) {
  return executar('consultarProduto', tx => {
    const p = tx.exigir('produtos', produtoId);
    tx.inserir('consultas', { id: tx.id('CONS'), produtoId, empresaId: p.empresaId, usuarioId: tx.ator ? tx.ator.id : null, mensagem: String(mensagem || '').slice(0, 600), criadaEm: iso(tx.agora) });
    for (const g of gestoresDa(tx.estado, p.empresaId)) tx.notificar(g.id, { titulo: 'Consulta de produto', texto: p.nome, href: '#/empresas/produtos', icone: 'package' });
    return ok();
  }, opcoes);
}

// ---------- Ambiente da empresa ----------
export function empresaDoUsuario(usuario, empresaId) {
  const v = vinculoEmpresa(usuario, empresaId);
  if (!v) return null;
  return empresaDe(ler(), empresaId);
}

/** Visão geral acionável, com indicadores derivados dos dados (sem percentuais de crescimento). */
export function visaoGeralEmpresa(usuario, empresaId, t = agora()) {
  const v = vinculoEmpresa(usuario, empresaId);
  if (!v) return null;
  const e = ler();
  const emp = empresaDe(e, empresaId);
  const gestor = v.papel === 'gestor';
  const hoje = dataLocal(t, emp.fuso);
  const minhas = o => gestor || o.profissionalId === v.profissionalId;
  const ordens = e.ordens.filter(o => o.empresaId === empresaId && minhas(o));
  const sols = e.solicitacoes.filter(s => s.empresaId === empresaId);
  const aguardandoResposta = sols.filter(s => ['enviada', 'em_analise'].includes(s.estado));
  const aguardandoCliente = sols.filter(s => s.estado === 'proposta');
  const reag = sols.filter(s => s.reagendamento && s.reagendamento.origem === 'cliente');
  const hojeOrd = ordens.filter(o => ['agendada', 'execucao'].includes(o.estado) && dataLocal(o.inicio, emp.fuso) === hoje);
  const execucao = ordens.filter(o => o.estado === 'execucao');
  const semana = ordens.filter(o => o.estado === 'agendada' && emMs(o.inicio) > t && emMs(o.inicio) < t + 7 * DIA);
  const retornos = gestor ? e.ordens.filter(o => o.empresaId === empresaId && o.proximoRetorno && o.proximoRetorno <= dataLocal(t + 31 * DIA, emp.fuso).slice(0, 7)) : [];
  const pendentes = gestor ? e.ocupacoes.filter(o => o.empresaId === empresaId && ocupacaoAtiva(o, t) && o.estado !== 'bloqueio' && (o.pendente || !o.profissionalId)) : [];
  const susp = gestor ? e.profissionais.filter(p => p.empresaId === empresaId && p.situacao === 'suspenso') : [];
  const comSuspensos = gestor ? e.ocupacoes.filter(o => o.empresaId === empresaId && ocupacaoAtiva(o, t) && o.estado !== 'bloqueio' && susp.some(p => p.id === o.profissionalId)) : [];
  const convites = gestor ? e.profissionais.filter(p => p.empresaId === empresaId && p.situacao === 'convite') : [];
  const acoes = [];
  for (const s of aguardandoResposta) {
    const o = ocupacaoDe(e, s.ocupacaoId);
    acoes.push({ icone: 'paper-plane-tilt', tom: 'w', titulo: `${s.id} aguarda resposta`, texto: o && o.estado === 'temporaria' ? `Reserva temporária expira em ${formatarDataHora(o.expiraEm, emp.fuso)}` : 'Sem horário reservado', href: '#/empresas/solicitacoes/' + s.id });
  }
  for (const s of reag) acoes.push({ icone: 'calendar-plus', tom: 'w', titulo: `${s.id}: pedido de reagendamento`, texto: `Responder até ${formatarDataHora(s.reagendamento.prazo, emp.fuso)}`, href: '#/empresas/solicitacoes/' + s.id });
  for (const o of pendentes) acoes.push({ icone: 'warning', tom: 'e', titulo: 'Atendimento a reatribuir', texto: `${o.ordemId || o.solicitacaoId || o.id} · ${formatarDataHora(o.inicio, emp.fuso)}`, href: o.ordemId ? '#/empresas/ordens/' + o.ordemId : '#/empresas/agenda' });
  for (const o of comSuspensos) acoes.push({ icone: 'warning', tom: 'e', titulo: 'Conflito a revisar: profissional suspenso', texto: `${o.ordemId || o.solicitacaoId || o.id} · ${formatarDataHora(o.inicio, emp.fuso)}`, href: o.ordemId ? '#/empresas/ordens/' + o.ordemId : '#/empresas/agenda' });
  for (const p of convites) acoes.push({ icone: 'envelope-simple', tom: 'w', titulo: `Convite pendente: ${p.curto}`, texto: `Enviado em ${formatarDataHora(p.conviteEm, emp.fuso)}`, href: '#/empresas/profissionais/' + p.id });
  for (const s of aguardandoCliente) acoes.push({ icone: 'file-text', tom: 'a', titulo: `${s.id} aguarda o cliente`, texto: `Proposta válida até ${formatarDataHora(s.proposta.validadeEm, emp.fuso)}`, href: '#/empresas/solicitacoes/' + s.id });
  const proximos = ordens.filter(o => o.estado === 'agendada' && emMs(o.inicio) > t).sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 6)
    .map(o => ({ id: o.id, inicio: o.inicio, servico: (servicoDe(e, o.servicoId) || {}).nome, profissional: (profissionalDe(e, o.profissionalId) || { curto: 'A reatribuir' }).curto }));
  const kpis = gestor ? [
    { n: aguardandoResposta.length, l: 'Solicitações aguardando resposta', href: '#/empresas/solicitacoes' },
    { n: hojeOrd.length, l: 'Atendimentos de hoje', href: '#/empresas/agenda' },
    { n: aguardandoCliente.length, l: 'Propostas aguardando cliente', href: '#/empresas/solicitacoes' },
    { n: execucao.length, l: 'Ordens em execução', href: '#/empresas/ordens' },
    { n: retornos.length, l: 'Retornos previstos (30 dias)', href: '#/empresas/historico' },
    { n: pendentes.length + comSuspensos.length, l: 'Bloqueios e conflitos a revisar', href: '#/empresas/agenda' }
  ] : [
    { n: semana.length, l: 'Meus atendimentos nos próximos 7 dias', href: '#/empresas/agenda' },
    { n: hojeOrd.length, l: 'Atendimentos de hoje', href: '#/empresas/agenda' },
    { n: execucao.length, l: 'Em execução', href: '#/empresas/ordens' }
  ];
  return { empresa: emp, gestor, kpis, acoes: gestor ? acoes : [], hoje: hojeOrd.map(o => ({ id: o.id, inicio: o.inicio, servico: (servicoDe(e, o.servicoId) || {}).nome })), proximos };
}

export function salvarPerfilEmpresa(d, opcoes = {}) {
  return executar('salvarPerfilEmpresa', tx => {
    const emp = tx.exigir('empresas', d.empresaId);
    exigirGestor(tx, emp.id);
    tx.exigirVersao(emp, d.versao);
    if (emp.situacao === 'arquivada') throw falhar('TRANSICAO_INVALIDA', 'Empresa arquivada: dados disponíveis apenas para consulta.');
    const erros = {};
    if (!String(d.nome || '').trim()) erros.nome = 'Informe o nome da empresa.';
    if (d.emailPublico && validarEmailDemo(d.emailPublico)) erros.emailPublico = validarEmailDemo(d.emailPublico);
    if (validarTelefone(d.telefonePublico)) erros.telefonePublico = validarTelefone(d.telefonePublico);
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos destacados.', { campos: erros });
    tx.alterar('empresas', emp, {
      nome: d.nome.trim(), razaoSocial: String(d.razaoSocial || '').trim(), descricao: String(d.descricao || '').trim(), horarios: String(d.horarios || '').trim(),
      contatoPublico: { telefone: String(d.telefonePublico || '').trim(), email: String(d.emailPublico || '').trim() },
      area: String(d.area || '').split(',').map(x => x.trim()).filter(Boolean), politicas: String(d.politicas || '').split('\n').map(x => x.trim()).filter(Boolean),
      modalidades: d.modalidades && d.modalidades.length ? d.modalidades : emp.modalidades
    });
    return ok();
  }, opcoes);
}

/** Configurações da agenda: preparo, validade da reserva, fuso e feriados/exceções. */
export function salvarConfiguracoes(d, opcoes = {}) {
  return executar('salvarConfiguracoes', tx => {
    const emp = tx.exigir('empresas', d.empresaId);
    exigirGestor(tx, emp.id);
    tx.exigirVersao(emp, d.versao);
    if (!FUSOS_DISPONIVEIS.some(([f]) => f === d.fuso)) throw falhar('VALIDACAO', 'Escolha um fuso válido.', { campos: { fuso: 'Escolha um fuso válido.' } });
    const preparo = Number(d.preparoMin), validade = Number(d.validadeReservaH);
    if (![0, 15, 30, 45, 60].includes(preparo) || ![12, 24, 48].includes(validade)) throw falhar('VALIDACAO', 'Revise os valores informados.');
    tx.alterar('empresas', emp, { preparoMin: preparo, validadeReservaH: validade, fuso: d.fuso, feriados: (d.feriados || emp.feriados).slice().sort((a, b) => a.data.localeCompare(b.data)) });
    for (const [servicoId, dur] of Object.entries(d.duracoes || {})) {
      const s = tx.get('servicos', servicoId);
      const n = Number(dur);
      if (s && s.empresaId === emp.id && n >= 15 && n <= 600 && n !== s.duracaoMin) tx.alterar('servicos', s, { duracaoMin: n });
    }
    return ok();
  }, opcoes);
}

// ---------- Serviços e produtos ----------
export function servicosDaEmpresa(usuario, empresaId) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  return ler().servicos.filter(s => s.empresaId === empresaId).map(s => ({ ...s, precoTexto: rotuloPreco(s) }));
}

export function salvarServico(d, opcoes = {}) {
  return executar('salvarServico', tx => {
    exigirGestor(tx, d.empresaId);
    const erros = {};
    if (!String(d.nome || '').trim()) erros.nome = 'Informe o nome do serviço.';
    const dur = Number(d.duracaoMin);
    if (!(dur >= 15 && dur <= 600)) erros.duracaoMin = 'Informe a duração entre 15 e 600 minutos.';
    let preco = null;
    if (d.tipoPreco !== 'orcamento') { preco = lerMoeda(d.preco); if (preco == null) erros.preco = 'Informe o valor (ex.: 180,00).'; }
    if (!['fixo', 'a_partir', 'orcamento'].includes(d.tipoPreco)) erros.tipoPreco = 'Escolha o tipo de preço.';
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos do serviço.', { campos: erros });
    const dados = { nome: d.nome.trim(), descricao: String(d.descricao || '').trim(), duracaoMin: dur, local: String(d.local || 'No endereço do cliente').trim(), tipoPreco: d.tipoPreco, precoCentavos: preco, observacao: String(d.observacao || '').trim() };
    if (d.id) {
      const s = tx.exigir('servicos', d.id);
      if (s.empresaId !== d.empresaId) throw falhar('NAO_ENCONTRADO', 'Serviço não encontrado.');
      tx.exigirVersao(s, d.versao);
      tx.alterar('servicos', s, dados);
      return ok({ id: s.id });
    }
    const s = tx.inserir('servicos', { id: tx.id('sv'), empresaId: d.empresaId, ...dados, situacao: 'ativo', usos: 0, moderacao: null });
    return ok({ id: s.id });
  }, opcoes);
}

/** Ativar/desativar/arquivar. Registros com vínculo operacional não são excluídos. */
export function alterarSituacaoServico({ servicoId, situacao, versao }, opcoes = {}) {
  return executar('alterarSituacaoServico', tx => {
    const s = tx.exigir('servicos', servicoId);
    exigirGestor(tx, s.empresaId);
    tx.exigirVersao(s, versao);
    if (!['ativo', 'inativo', 'arquivado'].includes(situacao) || s.situacao === 'arquivado') throw falhar('TRANSICAO_INVALIDA', 'Serviço arquivado não pode ser alterado.');
    const profs = tx.estado.profissionais.filter(p => p.empresaId === s.empresaId);
    if (situacao === 'ativo' && !profs.some(p => p.situacao === 'ativo' && p.servicos.includes(s.id))) {
      tx.alterar('servicos', s, { situacao });
      return ok({ aviso: 'Nenhum profissional ativo executa este serviço: ele aparece no perfil, mas sem horários disponíveis.' });
    }
    tx.alterar('servicos', s, { situacao });
    return ok();
  }, opcoes);
}

export function produtosDaEmpresa(usuario, empresaId) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  return ler().produtos.filter(p => p.empresaId === empresaId);
}

export function salvarProduto(d, opcoes = {}) {
  return executar('salvarProduto', tx => {
    exigirGestor(tx, d.empresaId);
    const erros = {};
    if (!String(d.nome || '').trim()) erros.nome = 'Informe o nome do produto.';
    let preco = null;
    if (String(d.preco || '').trim()) { preco = lerMoeda(d.preco); if (preco == null) erros.preco = 'Use o formato 89,90 ou deixe em branco para “sob consulta”.'; }
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos do produto.', { campos: erros });
    const dados = { nome: d.nome.trim(), descricao: String(d.descricao || '').trim(), precoCentavos: preco, disponibilidade: d.disponibilidade || 'Disponível' };
    if (d.id) {
      const p = tx.exigir('produtos', d.id);
      if (p.empresaId !== d.empresaId) throw falhar('NAO_ENCONTRADO', 'Produto não encontrado.');
      tx.exigirVersao(p, d.versao);
      tx.alterar('produtos', p, dados);
      return ok({ id: p.id });
    }
    return ok({ id: tx.inserir('produtos', { id: tx.id('pr'), empresaId: d.empresaId, ...dados, situacao: 'ativo' }).id });
  }, opcoes);
}

export function alterarSituacaoProduto({ produtoId, situacao }, opcoes = {}) {
  return executar('alterarSituacaoProduto', tx => {
    const p = tx.exigir('produtos', produtoId);
    exigirGestor(tx, p.empresaId);
    if (!['ativo', 'inativo', 'arquivado'].includes(situacao)) throw falhar('VALIDACAO', 'Situação inválida.');
    tx.alterar('produtos', p, { situacao });
    return ok();
  }, opcoes);
}

// ---------- Clientes operacionais ----------
export function clientesDaEmpresa(usuario, empresaId) {
  if (!pode(usuario, 'clientes.ver', { empresaId })) return [];
  return ler().clientesOp.filter(c => c.empresaId === empresaId);
}

export function salvarClienteOperacional(d, opcoes = {}) {
  return executar('salvarClienteOperacional', tx => {
    exigirGestor(tx, d.empresaId);
    const erros = {};
    if (!String(d.nome || '').trim()) erros.nome = 'Informe o nome do cliente.';
    const tel = validarTelefone(d.telefone); if (tel) erros.telefone = tel;
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos.', { campos: erros });
    tx.inserir('clientesOp', { id: 'CLI-' + String(tx.seq('cliOp') + 23).padStart(3, '0'), empresaId: d.empresaId, nome: d.nome.trim(), cidade: String(d.cidade || '').trim() || '—', telefone: String(d.telefone || '').trim(), equipamentos: 0, ultimo: null, origem: 'Cadastro da empresa', conviteEnviado: Boolean(d.convidar) });
    return ok({ convite: Boolean(d.convidar) });
  }, opcoes);
}

// ---------- Profissionais ----------
export function profissionaisDaEmpresa(usuario, empresaId, t = agora()) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  const e = ler();
  return e.profissionais.filter(p => p.empresaId === empresaId).map(p => ({
    ...p, servicosNomes: p.servicos.map(id => (servicoDe(e, id) || {}).nome).filter(Boolean),
    futuros: e.ocupacoes.filter(o => o.profissionalId === p.id && o.estado !== 'bloqueio' && ocupacaoAtiva(o, t) && emMs(o.inicio) > t).length
  }));
}

/** Atendimentos futuros do profissional e opções de tratamento (reatribuir a elegível livre ou combinar novo horário). */
export function atendimentosFuturos(usuario, empresaId, profissionalId, t = agora()) {
  if (!pode(usuario, 'empresa.gerir', { empresaId })) return [];
  const e = ler();
  const c = contextoEmpresa(e, empresaId);
  return e.ocupacoes.filter(o => o.profissionalId === profissionalId && o.estado !== 'bloqueio' && ocupacaoAtiva(o, t) && emMs(o.inicio) > t)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map(o => {
      const ordem = ordemDe(e, o.ordemId);
      const sol = o.solicitacaoId ? e.solicitacoes.find(s => s.id === o.solicitacaoId) : null;
      const servico = servicoDe(e, (ordem || sol || {}).servicoId);
      const opcoes = c.profissionais.filter(p => p.id !== profissionalId && p.situacao === 'ativo').map(p => {
        const v = verificarProfissional({ profissional: p, empresa: c.empresa, servico, inicio: emMs(o.inicio), fim: emMs(o.fim), ocupacoes: c.ocupacoes, agora: t, ignorar: [o.id] });
        return { id: p.id, nome: p.curto, livre: v.livre, motivo: v.livre ? 'disponível' : MOTIVOS[v.motivo].toLowerCase() };
      });
      return { id: o.id, ref: ordem ? ordem.id : sol ? sol.id : o.id, servico: servico ? servico.nome : '—', inicio: o.inicio, fim: o.fim, estado: o.estado, opcoes };
    });
}

export function convidarProfissional({ empresaId, nome, email }, opcoes = {}) {
  return executar('convidarProfissional', tx => {
    exigirGestor(tx, empresaId);
    const erros = {};
    if (!String(nome || '').trim()) erros.nome = 'Informe o nome.';
    const m = validarEmailDemo(email); if (m) erros.email = m;
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise os campos do convite.', { campos: erros });
    const p = tx.inserir('profissionais', {
      id: tx.id('p'), empresaId, nome: nome.trim(), curto: nomeCurto(nome), funcao: 'Técnico', servicos: [], situacao: 'convite', jornada: null, folgas: [], usuarioId: null,
      email: email.trim().toLowerCase(), publico: null, conviteEm: iso(tx.agora), conviteExpiraEm: iso(tx.agora + VALIDADE_CONVITE_DIAS * DIA), historico: [linha(tx, 'Convite enviado.')]
    });
    tx.auditar({ entidade: `Profissional ${p.curto}`, acao: 'Convite para equipe enviado', tipo: 'convite', empresaId });
    return ok({ id: p.id });
  }, opcoes);
}

export function reenviarConvite({ profissionalId }, opcoes = {}) {
  return executar('reenviarConvite', tx => {
    const p = tx.exigir('profissionais', profissionalId);
    exigirGestor(tx, p.empresaId);
    if (!['convite', 'convite_expirado'].includes(p.situacao)) throw falhar('TRANSICAO_INVALIDA', 'Não há convite pendente.');
    tx.alterar('profissionais', p, { situacao: 'convite', conviteEm: iso(tx.agora), conviteExpiraEm: iso(tx.agora + VALIDADE_CONVITE_DIAS * DIA), historico: [...p.historico, linha(tx, 'Convite reenviado.')] });
    return ok();
  }, opcoes);
}

export function revogarConvite({ profissionalId }, opcoes = {}) {
  return executar('revogarConvite', tx => {
    const p = tx.exigir('profissionais', profissionalId);
    exigirGestor(tx, p.empresaId);
    if (!['convite', 'convite_expirado'].includes(p.situacao)) throw falhar('TRANSICAO_INVALIDA', 'Não há convite pendente.');
    tx.alterar('profissionais', p, { situacao: 'revogado', historico: [...p.historico, linha(tx, 'Convite revogado.')] });
    tx.auditar({ entidade: `Profissional ${p.curto}`, acao: 'Convite revogado', tipo: 'revogacao', empresaId: p.empresaId });
    return ok();
  }, opcoes);
}

export function atualizarProfissional(d, opcoes = {}) {
  return executar('atualizarProfissional', tx => {
    const p = tx.exigir('profissionais', d.profissionalId);
    exigirGestor(tx, p.empresaId);
    tx.exigirVersao(p, d.versao);
    const j = d.jornada;
    const erros = {};
    if (j) {
      if (!j.dias.length) erros.dias = 'Escolha ao menos um dia de trabalho.';
      if (hmParaMin(j.fim) <= hmParaMin(j.inicio)) erros.fim = 'O fim da jornada deve ser depois do início.';
      if (j.intervalo && (hmParaMin(j.intervalo.fim) <= hmParaMin(j.intervalo.inicio) || hmParaMin(j.intervalo.inicio) < hmParaMin(j.inicio) || hmParaMin(j.intervalo.fim) > hmParaMin(j.fim))) erros.intervalo = 'O intervalo precisa estar dentro da jornada.';
    }
    const validos = tx.estado.servicos.filter(s => s.empresaId === p.empresaId).map(s => s.id);
    if (Object.keys(erros).length) throw falhar('VALIDACAO', 'Revise a jornada.', { campos: erros });
    tx.alterar('profissionais', p, {
      funcao: String(d.funcao || p.funcao).trim(), servicos: (d.servicos || p.servicos).filter(id => validos.includes(id)),
      jornada: j || p.jornada, folgas: d.folgas || p.folgas, historico: [...p.historico, linha(tx, 'Função, serviços ou jornada atualizados.')]
    });
    return ok();
  }, opcoes);
}

/**
 * Suspender ou revogar um profissional exige tratar cada atendimento futuro (reatribuir a um profissional
 * elegível livre ou combinar novo horário com o cliente) e justificativa. Nada é cancelado silenciosamente.
 */
function encerrarAcesso(acao) {
  return (d, opcoes = {}) => executar(acao === 'revogar' ? 'revogarProfissional' : 'suspenderProfissional', tx => {
    const p = tx.exigir('profissionais', d.profissionalId);
    const ator = exigirGestor(tx, p.empresaId);
    if (p.situacao !== 'ativo' && !(acao === 'revogar' && p.situacao === 'suspenso')) throw falhar('TRANSICAO_INVALIDA', 'Este acesso não está ativo.');
    const jErr = validarJustificativa(d.justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    const c = contextoEmpresa(tx.estado, p.empresaId);
    const futuros = c.ocupacoes.filter(o => o.profissionalId === p.id && o.estado !== 'bloqueio' && ocupacaoAtiva(o, tx.agora) && emMs(o.inicio) > tx.agora);
    const trat = d.tratamentos || {};
    const pendentes = futuros.filter(o => !trat[o.id]);
    if (pendentes.length) throw falhar('TRATAMENTO_PENDENTE', `Defina o tratamento de todos os atendimentos futuros (${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}).`, { pendentes: pendentes.map(o => o.id) });
    for (const o of futuros) {
      const destino = trat[o.id];
      const ordem = ordemDe(tx.estado, o.ordemId);
      const ref = ordem ? ordem.id : o.solicitacaoId || o.id;
      if (destino === 'combinar') {
        tx.alterar('ocupacoes', o, { profissionalId: null, pendente: true });
        if (ordem) tx.alterar('ordens', ordem, { profissionalId: null, historico: [...ordem.historico, linha(tx, `Profissional desvinculado (${p.curto}); novo horário ou profissional a combinar com o cliente.`)] });
        const cliente = ordem ? ordem.clienteId : (tx.estado.solicitacoes.find(s => s.id === o.solicitacaoId) || {}).clienteId;
        if (cliente) tx.notificar(cliente, { titulo: 'A empresa vai combinar um novo horário', texto: `${ref} · contato pela empresa`, href: '#/clientes/solicitacoes', icone: 'calendar-plus' });
      } else {
        const novo = profissionalDe(tx.estado, destino);
        const ordemServ = servicoDe(tx.estado, (ordem || tx.estado.solicitacoes.find(s => s.id === o.solicitacaoId) || {}).servicoId);
        const v = novo && novo.empresaId === p.empresaId ? verificarProfissional({ profissional: novo, empresa: c.empresa, servico: ordemServ, inicio: emMs(o.inicio), fim: emMs(o.fim), ocupacoes: tx.estado.ocupacoes.filter(x => x.empresaId === p.empresaId), agora: tx.agora, ignorar: [o.id] }) : { livre: false, motivo: 'PROFISSIONAL_INDISPONIVEL' };
        if (!v.livre) throw falhar('HORARIO_INDISPONIVEL', `${novo ? novo.curto : 'O profissional escolhido'} não está disponível para ${ref} (${MOTIVOS[v.motivo].toLowerCase()}). Nada foi alterado; escolha outro tratamento.`);
        tx.alterar('ocupacoes', o, { profissionalId: novo.id, pendente: false });
        if (ordem) tx.alterar('ordens', ordem, { profissionalId: novo.id, historico: [...ordem.historico, linha(tx, `Reatribuída para ${novo.curto} antes da ${acao === 'revogar' ? 'revogação' : 'suspensão'} de acesso de ${p.curto}.`)] });
        if (o.solicitacaoId && !ordem) {
          const s = tx.get('solicitacoes', o.solicitacaoId);
          if (s && s.proposta) tx.alterar('solicitacoes', s, { proposta: { ...s.proposta, profissionalId: novo.id }, linhaDoTempo: [...s.linhaDoTempo, linha(tx, `Profissional proposto alterado para ${novo.curto}.`)] });
        }
        if (novo.usuarioId) tx.notificar(novo.usuarioId, { titulo: 'Atendimento atribuído', texto: `${ref} · ${formatarDataHora(o.inicio, c.empresa.fuso)}`, href: ordem ? '#/empresas/ordens/' + ordem.id : '#/empresas/agenda', icone: 'calendar-check' });
      }
    }
    if (acao === 'revogar') {
      for (const b of c.ocupacoes.filter(o => o.profissionalId === p.id && o.estado === 'bloqueio' && emMs(o.fim) > tx.agora)) liberarNoTx(tx, b, 'Profissional revogado');
    }
    const usuario = p.usuarioId ? tx.get('usuarios', p.usuarioId) : null;
    if (usuario) {
      const vinculos = acao === 'revogar'
        ? usuario.vinculos.map(v => (v.tipo === 'empresa' && v.empresaId === p.empresaId ? { ...v, situacao: 'revogado' } : v))
        : usuario.vinculos.map(v => (v.tipo === 'empresa' && v.empresaId === p.empresaId ? { ...v, situacao: 'suspenso' } : v));
      tx.alterar('usuarios', usuario, { vinculos });
      tx.notificar(usuario.id, { titulo: 'Alteração de acesso', texto: acao === 'revogar' ? 'Seu vínculo com a empresa foi encerrado.' : 'Seu acesso à empresa foi suspenso.', href: '#/', icone: 'lock-simple' });
    }
    tx.alterar('profissionais', p, { situacao: acao === 'revogar' ? 'revogado' : 'suspenso', historico: [...p.historico, linha(tx, `${acao === 'revogar' ? 'Acesso revogado' : 'Acesso suspenso'} por ${nomeCurto(ator.nome)}. ${futuros.length} atendimento(s) tratado(s).`)] });
    tx.auditar({ entidade: `Profissional ${p.curto}`, acao: acao === 'revogar' ? 'Acesso revogado' : 'Acesso suspenso', tipo: acao === 'revogar' ? 'revogacao' : 'suspensao', justificativa: d.justificativa.trim(), empresaId: p.empresaId });
    return ok({ tratados: futuros.length });
  }, opcoes);
}
export const suspenderProfissional = encerrarAcesso('suspender');
export const revogarProfissional = encerrarAcesso('revogar');

export function reativarProfissional({ profissionalId }, opcoes = {}) {
  return executar('reativarProfissional', tx => {
    const p = tx.exigir('profissionais', profissionalId);
    exigirGestor(tx, p.empresaId);
    if (p.situacao !== 'suspenso') throw falhar('TRANSICAO_INVALIDA', 'Apenas acessos suspensos podem ser reativados.');
    const usuario = p.usuarioId ? tx.get('usuarios', p.usuarioId) : null;
    if (usuario) tx.alterar('usuarios', usuario, { vinculos: usuario.vinculos.map(v => (v.tipo === 'empresa' && v.empresaId === p.empresaId ? { ...v, situacao: 'ativo' } : v)) });
    tx.alterar('profissionais', p, { situacao: 'ativo', historico: [...p.historico, linha(tx, 'Acesso reativado.')] });
    tx.auditar({ entidade: `Profissional ${p.curto}`, acao: 'Acesso reativado', tipo: 'reativacao', empresaId: p.empresaId });
    return ok();
  }, opcoes);
}

// ---------- Administração: empresas ----------
export function empresasAdmin(usuario) {
  if (!vinculoAdmin(usuario)) return [];
  const e = ler();
  return e.empresas.map(emp => ({
    ...emp, responsavel: emp.contatoPrivado.responsavel ? nomeCurto(emp.contatoPrivado.responsavel) : 'Sem responsável ativo', emailMascarado: emp.contatoPrivado.email ? mascararEmail(emp.contatoPrivado.email) : '—',
    servicosPublicados: e.servicos.filter(s => s.empresaId === emp.id && s.situacao === 'ativo').length,
    futuros: e.ocupacoes.filter(o => o.empresaId === emp.id && o.estado === 'confirmada' && emMs(o.inicio) > agora()).length
  }));
}

export const ITENS_ANALISE = [['cnpj', 'CNPJ informado e consistente com a razão social'], ['resp', 'Responsável confirmou e-mail e telefone'], ['svc', 'Ao menos um serviço com duração e forma de preço'], ['pol', 'Políticas de atendimento e cancelamento publicadas'], ['pub', 'Conteúdo público sem promessas ou selos não comprovados']];

export function marcarAnalise({ empresaId, item, valor }, opcoes = {}) {
  return executar('marcarAnalise', tx => {
    if (!pode(tx.exigirAtor(), 'admin.moderar')) throw falhar('ACESSO_NEGADO', 'Seu nível de administração não permite esta ação.');
    const emp = tx.exigir('empresas', empresaId);
    tx.alterar('empresas', emp, { analise: { ...emp.analise, [item]: Boolean(valor) } });
    return ok();
  }, { semAtraso: true, ...opcoes });
}

const TRANSICOES_EMPRESA = { habilitar: [['aguardando'], 'ativa', 'Empresa habilitada', 'habilitacao'], suspender: [['ativa'], 'suspensa', 'Empresa suspensa', 'suspensao'], reativar: [['suspensa'], 'ativa', 'Empresa reativada', 'reativacao'], arquivar: [['suspensa', 'preenchimento', 'aguardando'], 'arquivada', 'Empresa arquivada', 'arquivamento'] };

/** Habilitar, suspender, reativar ou arquivar — sempre com justificativa e registro em auditoria. */
export function alterarSituacaoEmpresa({ empresaId, acao, justificativa }, opcoes = {}) {
  return executar('alterarSituacaoEmpresa', tx => {
    const ator = tx.exigirAtor();
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    if (!pode(ator, 'empresa.situacao', { justificativa })) throw falhar('ACESSO_NEGADO', 'Seu nível de administração não permite alterar a situação de empresas.');
    const emp = tx.exigir('empresas', empresaId);
    const tr = TRANSICOES_EMPRESA[acao];
    if (!tr || !tr[0].includes(emp.situacao)) throw falhar('TRANSICAO_INVALIDA', 'Esta ação não está disponível na situação atual da empresa.');
    if (acao === 'habilitar' && !ITENS_ANALISE.every(([k]) => emp.analise[k])) throw falhar('ANALISE_INCOMPLETA', 'Conclua todos os itens da análise cadastral antes de habilitar.');
    const patch = { situacao: tr[1], justificativa: acao === 'suspender' ? justificativa.trim() : '' };
    if (acao === 'habilitar') patch.dataHabilitacao = iso(tx.agora);
    tx.alterar('empresas', emp, patch);
    tx.auditar({ entidade: 'Empresa ' + emp.nome, acao: tr[2], tipo: tr[3], justificativa: justificativa.trim(), empresaId });
    for (const g of gestoresDa(tx.estado, empresaId)) { tx.notificar(g.id, { titulo: tr[2], texto: emp.nome, href: '#/empresas/perfil', icone: 'buildings' }); tx.email(g.id, tr[2]); }
    return ok({ situacao: tr[1] });
  }, opcoes);
}

/** Moderação: conteúdo publicado (serviços) com pedidos de ajuste justificados. */
export function conteudoPublicado(usuario) {
  if (!vinculoAdmin(usuario)) return [];
  const e = ler();
  return e.servicos.filter(s => s.situacao === 'ativo' && (empresaDe(e, s.empresaId) || {}).situacao === 'ativa').map(s => ({ ...s, empresaNome: empresaDe(e, s.empresaId).nome }));
}

export function solicitarAjusteConteudo({ servicoId, justificativa }, opcoes = {}) {
  return executar('solicitarAjusteConteudo', tx => {
    if (!pode(tx.exigirAtor(), 'admin.moderar')) throw falhar('ACESSO_NEGADO', 'Seu nível de administração não permite moderar conteúdo.');
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    const s = tx.exigir('servicos', servicoId);
    const emp = empresaDe(tx.estado, s.empresaId);
    tx.alterar('servicos', s, { moderacao: { situacao: 'ajuste_solicitado', motivo: justificativa.trim() } });
    tx.auditar({ entidade: `Serviço “${s.nome}” · ${emp.nome}`, acao: 'Ajuste de conteúdo solicitado', tipo: 'moderacao', justificativa: justificativa.trim(), empresaId: emp.id });
    for (const g of gestoresDa(tx.estado, emp.id)) tx.notificar(g.id, { titulo: 'Ajuste de conteúdo solicitado', texto: s.nome, href: '#/empresas/servicos', icone: 'warning' });
    return ok();
  }, opcoes);
}

export function criarCategoria({ nome }, opcoes = {}) {
  return executar('criarCategoria', tx => {
    if (!pode(tx.exigirAtor(), 'admin.moderar')) throw falhar('ACESSO_NEGADO', 'Seu nível de administração não permite criar categorias.');
    const n = String(nome || '').trim();
    if (!n) throw falhar('VALIDACAO', 'Informe o nome da categoria.', { campos: { nome: 'Informe o nome da categoria.' } });
    if (tx.estado.categorias.some(c => c.nome.toLowerCase() === n.toLowerCase())) throw falhar('VALIDACAO', 'Já existe uma categoria com este nome.', { campos: { nome: 'Já existe uma categoria com este nome.' } });
    tx.inserir('categorias', { id: tx.id('cat'), nome: n });
    tx.auditar({ entidade: `Categoria “${n}”`, acao: 'Categoria criada', tipo: 'categoria' });
    return ok();
  }, opcoes);
}

/** Visão agregada de agendamentos por empresa, sem dados de clientes. */
export function agendamentosAgregados(usuario, t = agora()) {
  if (!pode(usuario, 'agenda.consultar', { escopo: 'agregada' })) return [];
  const e = ler();
  return e.empresas.filter(emp => ['ativa', 'suspensa'].includes(emp.situacao)).map(emp => {
    const oc = e.ocupacoes.filter(o => o.empresaId === emp.id && ocupacaoAtiva(o, t) && emMs(o.inicio) > t);
    const acesso = e.acessosTemporarios.find(a => a.empresaId === emp.id && a.usuarioId === usuario.id && emMs(a.expiraEm) > t);
    return {
      empresaId: emp.id, nome: emp.nome, situacao: emp.situacao,
      confirmados7d: oc.filter(o => o.estado === 'confirmada' && emMs(o.inicio) < t + 7 * DIA).length,
      temporarias: oc.filter(o => o.estado === 'temporaria').length,
      conflitos: oc.filter(o => o.estado !== 'bloqueio' && (o.pendente || !o.profissionalId)).length,
      acessoAte: acesso ? acesso.expiraEm : null,
      detalhes: acesso ? oc.filter(o => o.estado !== 'bloqueio').map(o => ({ id: o.ordemId || o.solicitacaoId || o.id, inicio: o.inicio, estado: o.estado, profissional: (profissionalDe(e, o.profissionalId) || { curto: 'A reatribuir' }).curto })).sort((a, b) => a.inicio.localeCompare(b.inicio)) : null,
      fuso: emp.fuso
    };
  });
}

/** Acesso administrativo a detalhes operacionais: com justificativa, temporário (30 min) e auditado. */
export function solicitarAcessoDetalhe({ empresaId, justificativa }, opcoes = {}) {
  return executar('solicitarAcessoDetalhe', tx => {
    const ator = tx.exigirAtor();
    if (!vinculoAdmin(ator)) throw falhar('ACESSO_NEGADO', 'Apenas a administração pode solicitar este acesso.');
    const jErr = validarJustificativa(justificativa);
    if (jErr) throw falhar('VALIDACAO', jErr, { campos: { justificativa: jErr } });
    const emp = tx.exigir('empresas', empresaId);
    const expira = tx.agora + 30 * 60000;
    tx.inserir('acessosTemporarios', { id: tx.id('ACS'), empresaId, usuarioId: ator.id, justificativa: justificativa.trim(), expiraEm: iso(expira), criadoEm: iso(tx.agora) });
    tx.auditar({ entidade: 'Agendamentos · ' + emp.nome, acao: 'Acesso temporário a detalhes operacionais', tipo: 'acesso_detalhe', justificativa: justificativa.trim(), empresaId });
    return ok({ expiraEm: iso(expira) });
  }, opcoes);
}

