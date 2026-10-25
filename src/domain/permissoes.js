// Matriz de permissões (PRD §7) aplicada por papel E vínculo.
// No protótipo estas regras rodam na camada api/ (servidor simulado); a aplicação final
// deve aplicá-las no servidor. Alterar a URL nunca concede autorização.

export const SECOES_TECNICO = ['', 'agenda', 'ordens', 'ajuda'];
export const NIVEIS_ADMIN = { principal: 'Principal', operacoes: 'Operações', suporte: 'Suporte' };

const ativo = u => Boolean(u) && u.situacao === 'ativo';
export const vinculoAdmin = u => (ativo(u) && (u.vinculos || []).find(v => v.tipo === 'admin' && v.situacao !== 'suspenso')) || null;
export const vinculoCliente = u => (ativo(u) && (u.vinculos || []).find(v => v.tipo === 'cliente')) || null;
export const vinculosEmpresa = u => (ativo(u) ? (u.vinculos || []).filter(v => v.tipo === 'empresa') : []);

/** Vínculo ativo do usuário com a empresa indicada (ou null). */
export function vinculoEmpresa(u, empresaId) {
  return vinculosEmpresa(u).find(v => v.empresaId === empresaId && v.situacao === 'ativo') || null;
}
const gestorDe = (u, empresaId) => { const v = vinculoEmpresa(u, empresaId); return Boolean(v && v.papel === 'gestor'); };
const tecnicoDe = (u, empresaId) => { const v = vinculoEmpresa(u, empresaId); return v && v.papel === 'tecnico' ? v : null; };
const nivel = u => { const v = vinculoAdmin(u); return v ? v.nivel : null; };

/** Ambientes disponíveis para o usuário (para o seletor de ambiente). */
export function ambientesDe(u) {
  const out = [];
  for (const v of vinculosEmpresa(u)) if (v.situacao === 'ativo') out.push({ tipo: 'empresas', empresaId: v.empresaId, papel: v.papel });
  if (vinculoCliente(u)) out.push({ tipo: 'clientes' });
  if (vinculoAdmin(u)) out.push({ tipo: 'admin', nivel: nivel(u) });
  return out;
}

/**
 * Verifica se `usuario` (null = visitante) pode executar `acao` sobre `alvo`.
 * `alvo` traz o escopo: empresaId, clienteId, profissionalId, justificativa etc.
 */
export function pode(usuario, acao, alvo = {}) {
  const adm = nivel(usuario);
  switch (acao) {
    case 'catalogo.consultar':
      return true;
    case 'solicitacao.iniciar':
      return !usuario || Boolean(vinculoCliente(usuario));
    case 'solicitacao.enviar':
      return Boolean(vinculoCliente(usuario));
    case 'proposta.decidir':
      return Boolean(vinculoCliente(usuario)) && alvo.clienteId === usuario.id;
    case 'reagendamento.solicitar':
      return (Boolean(vinculoCliente(usuario)) && alvo.clienteId === usuario.id) || gestorDe(usuario, alvo.empresaId);
    case 'proposta.emitir':
    case 'agenda.configurar':
    case 'empresa.gerir':
      return gestorDe(usuario, alvo.empresaId);
    case 'agenda.consultar':
      switch (alvo.escopo) {
        case 'horarios': return true;
        case 'agregada': return Boolean(adm);
        case 'empresa': return gestorDe(usuario, alvo.empresaId);
        case 'profissional': {
          if (gestorDe(usuario, alvo.empresaId)) return true;
          const t = tecnicoDe(usuario, alvo.empresaId);
          return Boolean(t && t.profissionalId === alvo.profissionalId);
        }
        case 'cliente': return Boolean(vinculoCliente(usuario)) && alvo.clienteId === usuario.id;
        default: return false;
      }
    case 'os.atualizar': {
      if (gestorDe(usuario, alvo.empresaId)) return true;
      const t = tecnicoDe(usuario, alvo.empresaId);
      return Boolean(t && alvo.profissionalId && t.profissionalId === alvo.profissionalId);
    }
    case 'clientes.ver': {
      if (adm) return typeof alvo.justificativa === 'string' && alvo.justificativa.trim().length >= 10;
      if (gestorDe(usuario, alvo.empresaId)) return true;
      const t = tecnicoDe(usuario, alvo.empresaId);
      if (t) return Boolean(alvo.profissionalId) && t.profissionalId === alvo.profissionalId;
      return Boolean(vinculoCliente(usuario)) && alvo.clienteId === usuario.id;
    }
    case 'empresa.situacao':
      return (adm === 'principal' || adm === 'operacoes') && typeof alvo.justificativa === 'string' && alvo.justificativa.trim().length >= 10;
    case 'usuarios.gerir':
      if (alvo.escopo === 'equipe') return gestorDe(usuario, alvo.empresaId);
      return adm === 'principal' || adm === 'operacoes';
    case 'artigos.publicar':
    case 'auditoria.consultar':
    case 'suporte.consultar':
      return Boolean(adm);
    case 'admin.moderar':
      return adm === 'principal' || adm === 'operacoes';
    default:
      return false;
  }
}

export const principaisAtivos = usuarios => usuarios.filter(u => ativo(u) && nivel(u) === 'principal').length;

const erro = (code, message) => ({ ok: false, code, message });

/** Regras para alterar o nível de um administrador (sem autoelevação; último principal protegido). */
export function podeAlterarPapel(ator, alvo, novoNivel, usuarios) {
  const na = nivel(ator);
  if (!na || na === 'suporte') return erro('PERMISSAO_INSUFICIENTE', 'Seu nível de administração não permite alterar papéis.');
  if (ator.id === alvo.id) return erro('AUTOELEVACAO', 'Você não pode alterar o próprio papel. Autoelevação de privilégio não é permitida.');
  const alvoAdm = (alvo.vinculos || []).find(v => v.tipo === 'admin');
  if (!alvoAdm) return erro('PAPEL_EXTERNO', 'Papéis dentro de empresas são administrados pela própria empresa.');
  if (!NIVEIS_ADMIN[novoNivel]) return erro('VALIDACAO', 'Escolha um nível de administração válido.');
  const alvoNivel = alvoAdm.nivel;
  if ((novoNivel === 'principal' || alvoNivel === 'principal') && na !== 'principal') {
    return erro('NIVEL_INSUFICIENTE', 'Somente uma administradora ou um administrador principal pode conceder ou alterar o nível Principal.');
  }
  if (alvoNivel === 'principal' && novoNivel !== 'principal' && ativo(alvo) && principaisAtivos(usuarios) <= 1) {
    return erro('ULTIMO_ADMIN_PRINCIPAL', 'É preciso manter ao menos um administrador principal habilitado.');
  }
  return { ok: true };
}

/** Regras para suspender o acesso de um usuário pela administração. */
export function podeSuspenderUsuario(ator, alvo, usuarios) {
  const na = nivel(ator);
  if (!na || na === 'suporte') return erro('PERMISSAO_INSUFICIENTE', 'Seu nível de administração não permite suspender acessos.');
  if (ator.id === alvo.id) return erro('AUTOSUSPENSAO', 'Você não pode suspender o próprio acesso.');
  const alvoAdmin = (alvo.vinculos || []).find(v => v.tipo === 'admin');
  if (alvoAdmin && alvoAdmin.nivel === 'principal') {
    if (ativo(alvo) && principaisAtivos(usuarios) <= 1) return erro('ULTIMO_ADMIN_PRINCIPAL', `${alvo.nome} é a única pessoa com nível Principal habilitada. Habilite outra pessoa com esse nível antes de suspender este acesso.`);
    if (na !== 'principal') return erro('NIVEL_INSUFICIENTE', 'Somente o nível Principal pode suspender outro administrador principal.');
  }
  return { ok: true };
}

/**
 * Acesso a uma rota autenticada.
 * status: 'ok' | 'login' (sem sessão) | 'negado' (sem vínculo) | 'insuficiente' (papel sem acesso à seção)
 */
export function acessoRota(usuario, ambiente, secao = '', empresaId = null) {
  if (!ambiente) return { status: 'ok' };
  if (!usuario) return { status: 'login' };
  if (!ativo(usuario)) return { status: 'negado', motivo: 'conta_suspensa' };
  if (ambiente === 'clientes') return vinculoCliente(usuario) ? { status: 'ok' } : { status: 'negado' };
  if (ambiente === 'admin') return vinculoAdmin(usuario) ? { status: 'ok', nivel: nivel(usuario) } : { status: 'negado' };
  if (ambiente === 'empresas') {
    const vs = vinculosEmpresa(usuario);
    const v = (empresaId && vs.find(x => x.empresaId === empresaId)) || vs.find(x => x.situacao === 'ativo') || vs[0];
    if (!v) return { status: 'negado' };
    if (v.situacao !== 'ativo') return { status: 'negado', motivo: 'vinculo_suspenso' };
    if (v.papel === 'tecnico' && !SECOES_TECNICO.includes(secao)) return { status: 'insuficiente', vinculo: v };
    return { status: 'ok', vinculo: v };
  }
  return { status: 'negado' };
}
