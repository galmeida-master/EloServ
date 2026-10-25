// Rotas (PRD §4) com roteamento por âncora (#/rota), guardas de autenticação e permissão.
// A verificação de acesso é feita pela camada api/ (auth.verificarAcesso) — alterar a URL nunca concede autorização.

/**
 * Tabela de rotas. `ambiente`: null (pública) | 'clientes' | 'empresas' | 'admin'.
 * `secao` é usada pela regra do técnico (acesso apenas a agenda, ordens e ajuda).
 */
export const ROTAS = [
  ['/', 'inicio', null],
  ['/fornecedores', 'catalogo', null],
  ['/fornecedores/:slug', 'perfil', null],
  ['/fornecedores/:slug/solicitar', 'solicitar', null],
  ['/ajuda', 'ajuda', null],
  ['/ajuda/:slug', 'artigo', null],
  ['/entrar', 'entrar', null],
  ['/cadastro', 'cadastro', null],
  ['/recuperar-acesso', 'recuperar', null],
  ['/sessao-expirada', 'sessaoExpirada', null],
  ['/acesso-negado', 'acessoNegado', null],
  ['/convite/:id', 'convite', null],

  ['/clientes', 'cliVisao', 'clientes'],
  ['/clientes/solicitacoes', 'cliSolicitacoes', 'clientes'],
  ['/clientes/solicitacoes/:id', 'cliSolicitacao', 'clientes'],
  ['/clientes/agendamentos', 'cliAgendamentos', 'clientes'],
  ['/clientes/equipamentos', 'cliEquipamentos', 'clientes'],
  ['/clientes/historico', 'cliHistorico', 'clientes'],
  ['/clientes/perfil', 'cliPerfil', 'clientes'],
  ['/clientes/preferencias', 'cliPreferencias', 'clientes'],

  ['/empresas', 'empVisao', 'empresas'],
  ['/empresas/perfil', 'empPerfil', 'empresas'],
  ['/empresas/servicos', 'empServicos', 'empresas'],
  ['/empresas/produtos', 'empProdutos', 'empresas'],
  ['/empresas/profissionais', 'empProfissionais', 'empresas'],
  ['/empresas/profissionais/:id', 'empProfissional', 'empresas'],
  ['/empresas/agenda', 'empAgenda', 'empresas'],
  ['/empresas/solicitacoes', 'empSolicitacoes', 'empresas'],
  ['/empresas/solicitacoes/:id', 'empSolicitacao', 'empresas'],
  ['/empresas/ordens', 'empOrdens', 'empresas'],
  ['/empresas/ordens/:id', 'empOrdem', 'empresas'],
  ['/empresas/clientes', 'empClientes', 'empresas'],
  ['/empresas/historico', 'empHistorico', 'empresas'],
  ['/empresas/ajuda', 'empAjuda', 'empresas'],
  ['/empresas/configuracoes', 'empConfiguracoes', 'empresas'],

  ['/admin', 'admVisao', 'admin'],
  ['/admin/empresas', 'admEmpresas', 'admin'],
  ['/admin/empresas/:id', 'admEmpresa', 'admin'],
  ['/admin/usuarios', 'admUsuarios', 'admin'],
  ['/admin/publicados', 'admPublicados', 'admin'],
  ['/admin/categorias', 'admCategorias', 'admin'],
  ['/admin/agendamentos', 'admAgendamentos', 'admin'],
  ['/admin/ajuda', 'admAjuda', 'admin'],
  ['/admin/ajuda/:slug', 'admArtigo', 'admin'],
  ['/admin/suporte', 'admSuporte', 'admin'],
  ['/admin/auditoria', 'admAuditoria', 'admin'],
  ['/admin/configuracoes', 'admConfiguracoes', 'admin']
].map(([padrao, view, ambiente]) => ({ padrao, view, ambiente, partes: padrao.split('/').filter(Boolean) }));

/** Lê a âncora atual: '#/fornecedores/x?y=1' → { caminho: '/fornecedores/x', query: { y: '1' } }. */
export function lerAncora(hash = location.hash) {
  const bruto = (hash || '').replace(/^#/, '') || '/';
  const [caminho, qs = ''] = bruto.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  const limpo = '/' + caminho.split('/').filter(Boolean).join('/');
  return { caminho: limpo, query, completo: bruto };
}

/** Encontra a rota e os parâmetros. Sem correspondência: página não encontrada. */
export function resolver(caminho) {
  const partes = caminho.split('/').filter(Boolean);
  for (const r of ROTAS) {
    if (r.partes.length !== partes.length) continue;
    const params = {};
    let ok = true;
    r.partes.forEach((p, i) => {
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(partes[i]);
      else if (p !== partes[i]) ok = false;
    });
    if (ok) return { ...r, params, secao: r.ambiente && r.ambiente !== 'clientes' ? (partes[1] || '') : (partes[1] || '') };
  }
  const ambiente = ['clientes', 'empresas', 'admin'].includes(partes[0]) ? partes[0] : null;
  return { view: 'naoEncontrada', ambiente, params: {}, secao: partes[1] || '', padrao: null };
}
