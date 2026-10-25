// Sessão simulada, papéis e vínculos. Não há verificação real de senha nesta demonstração.
import { storage, CHAVES } from './storage.js';
import { agora } from './clock.js';
import { ler, transacao, ok, falhar, MENSAGENS } from './db.js';
import { atraso } from './sim.js';
import { INATIVIDADE_SESSAO_MIN } from '../domain/reservas.js';
import { ambientesDe, acessoRota } from '../domain/permissoes.js';
import { validarCadastro, nomeCurto, validarEmailDemo } from '../domain/validacao.js';
import { MINUTO } from '../domain/datas.js';

export const LIMITE_INATIVIDADE = INATIVIDADE_SESSAO_MIN * MINUTO;

/** Sessão atual (marca `expirada` após 30 min sem atividade). */
export function lerSessao() {
  const s = storage.getJson(CHAVES.sessao, null);
  if (!s || !s.usuarioId) return null;
  if (agora() - (s.ultimaAtividade || 0) > LIMITE_INATIVIDADE) return { ...s, expirada: true };
  return s;
}

export function usuarioAtual() {
  const s = lerSessao();
  if (!s || s.expirada) return null;
  return ler().usuarios.find(u => u.id === s.usuarioId) || null;
}

export const atorId = () => { const s = lerSessao(); return s && !s.expirada ? s.usuarioId : null; };

/** Atualiza a última atividade (com intervalo mínimo para não gravar a cada clique). */
export function registrarAtividade() {
  const s = storage.getJson(CHAVES.sessao, null);
  if (!s || agora() - (s.ultimaAtividade || 0) > LIMITE_INATIVIDADE) return;
  if (agora() - (s.ultimaAtividade || 0) < 15000) return;
  storage.setJson(CHAVES.sessao, { ...s, ultimaAtividade: agora() });
}

function iniciarSessao(usuario, preferencia = null) {
  const ambientes = ambientesDe(usuario);
  const escolhido = (preferencia && ambientes.find(a => a.tipo === preferencia)) || ambientes[0] || null;
  storage.setJson(CHAVES.sessao, {
    usuarioId: usuario.id, ambiente: escolhido ? escolhido.tipo : null, empresaId: escolhido && escolhido.empresaId ? escolhido.empresaId : null,
    ultimaAtividade: agora(), criadaEm: agora()
  });
  return escolhido;
}

/** Rota inicial do ambiente atual. */
export function rotaInicial(ambiente) {
  return ambiente === 'empresas' ? '/empresas' : ambiente === 'admin' ? '/admin' : ambiente === 'clientes' ? '/clientes' : '/';
}

/** Entrar com e-mail e credencial (qualquer credencial com 8+ caracteres é aceita na demonstração). */
export async function entrar({ email, senha, ambientePreferido = null }) {
  await atraso();
  const e = String(email || '').trim().toLowerCase();
  const u = ler().usuarios.find(x => x.email === e);
  if (!u || String(senha || '').length < 8 || u.situacao === 'convite') {
    return { ok: false, code: 'CREDENCIAIS', message: 'E-mail ou credencial incorretos. Verifique os dados e tente novamente.' };
  }
  if (u.situacao !== 'ativo') return { ok: false, code: 'ACESSO_NEGADO', message: 'Este acesso está suspenso. Fale com a administração da plataforma.' };
  const amb = iniciarSessao(u, ambientePreferido);
  return ok({ usuarioId: u.id, ambiente: amb ? amb.tipo : null });
}

/** Painel de simulação: alterna a persona sem pedir credencial. */
export function entrarComoPersona(usuarioId) {
  if (usuarioId === 'visitante') { sair(); return null; }
  const u = ler().usuarios.find(x => x.id === usuarioId);
  if (!u) return null;
  const amb = iniciarSessao(u);
  return amb ? amb.tipo : null;
}

export function sair() { storage.remove(CHAVES.sessao); }

/** Seletor de ambiente: só troca entre vínculos existentes. */
export function trocarAmbiente(tipo, empresaId = null) {
  const u = usuarioAtual();
  if (!u) return false;
  const a = ambientesDe(u).find(x => x.tipo === tipo && (!empresaId || x.empresaId === empresaId));
  if (!a) return false;
  const s = storage.getJson(CHAVES.sessao, {});
  storage.setJson(CHAVES.sessao, { ...s, ambiente: a.tipo, empresaId: a.empresaId || null, ultimaAtividade: agora() });
  return true;
}

/** Simulação: força a expiração da sessão por inatividade. */
export function expirarSessaoAgora() {
  const s = storage.getJson(CHAVES.sessao, null);
  if (s) storage.setJson(CHAVES.sessao, { ...s, ultimaAtividade: agora() - LIMITE_INATIVIDADE - MINUTO });
}

/** Verifica o acesso do usuário atual a uma rota autenticada. */
export function verificarAcesso(ambiente, secao) {
  const s = lerSessao();
  if (ambiente && s && s.expirada) return { status: 'expirada' };
  const u = usuarioAtual();
  return acessoRota(u, ambiente, secao, s && s.empresaId);
}

/** Cadastro de cliente (entra em seguida) ou de empresa (fica “Aguardando habilitação”). */
export async function cadastrar(dados) {
  const erros = validarCadastro(dados);
  if (Object.keys(erros).length) return { ok: false, code: 'VALIDACAO', message: 'Revise os campos destacados.', details: erros };
  const email = dados.email.trim().toLowerCase();
  const r = await transacao('cadastrar', tx => {
    if (tx.todos('usuarios').some(u => u.email === email)) throw falhar('VALIDACAO', 'Revise os campos destacados.', { email: 'Já existe uma conta com este e-mail. Entre ou recupere o acesso.' });
    const id = tx.id('u');
    const vinculos = [];
    let empresaId = null;
    if (dados.tipo === 'empresa') {
      empresaId = 'emp-' + tx.seq('empresa');
      const slug = String(dados.empresaNome).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + tx.estado.meta.seq.empresa;
      tx.inserir('empresas', {
        id: empresaId, slug, nome: dados.empresaNome.trim(), razaoSocial: '', cnpj: dados.cnpj.trim(), cidade: dados.cidade.trim(), area: [dados.cidade.trim()],
        categorias: [], modalidades: ['Residencial'], situacao: 'aguardando', descricao: '', horarios: 'Seg a sex 07:30–17:30',
        contatoPublico: { telefone: '', email: '' }, contatoPrivado: { responsavel: dados.nome.trim(), email },
        fuso: 'America/Cuiaba', preparoMin: 30, validadeReservaH: 24, jornadaPadrao: { dias: [1, 2, 3, 4, 5], inicio: '07:30', fim: '17:30', intervalo: { inicio: '12:00', fim: '13:00' } },
        feriados: [], politicas: [], dataCadastro: new Date(tx.agora).toISOString(), dataHabilitacao: null,
        analise: { cnpj: false, resp: false, svc: false, pol: false, pub: false }, justificativa: ''
      });
      vinculos.push({ tipo: 'empresa', empresaId, papel: 'gestor', situacao: 'ativo' });
    } else {
      vinculos.push({ tipo: 'cliente' });
    }
    tx.inserir('usuarios', {
      id, nome: dados.nome.trim(), email, telefone: dados.telefone.trim(), situacao: 'ativo', vinculos,
      rotuloPapel: dados.tipo === 'empresa' ? 'gestor, ' + dados.empresaNome.trim() : 'cliente', criadoEm: new Date(tx.agora).toISOString(),
      preferencias: { emailAtendimentos: true, marketing: Boolean(dados.marketing) }
    });
    if (empresaId) {
      for (const adm of tx.todos('usuarios').filter(u => (u.vinculos || []).some(v => v.tipo === 'admin') && u.situacao === 'ativo')) {
        tx.notificar(adm.id, { titulo: 'Cadastro aguardando habilitação', texto: dados.empresaNome.trim(), href: '#/admin/empresas/' + empresaId, icone: 'buildings' });
      }
    }
    return ok({ usuarioId: id, empresaId, nome: nomeCurto(dados.nome) });
  }, { falhavel: true });
  if (r.ok) {
    const u = ler().usuarios.find(x => x.id === r.data.usuarioId);
    iniciarSessao(u);
  }
  return r;
}

/** Recuperação de acesso: a resposta nunca revela se o e-mail existe. */
export async function recuperarAcesso(email) {
  await atraso();
  const erro = validarEmailDemo(email);
  if (erro && !/exemplo\.invalid/.test(erro)) return { ok: false, code: 'VALIDACAO', message: erro };
  return ok({ mensagem: 'Se houver uma conta com este e-mail, você receberá as instruções em alguns minutos. Por segurança, não informamos se o e-mail está cadastrado.' });
}

export { MENSAGENS };
