// Registro de telas por rota (ver src/router.js).
import { Inicio } from './public/inicio.js';
import { Catalogo } from './public/catalogo.js';
import { PerfilFornecedor } from './public/perfil.js';
import { Solicitar } from './public/solicitar.js';
import { CentralAjuda, Artigo } from './public/ajuda.js';
import { Entrar, Cadastro, Recuperar, SessaoExpirada, AcessoNegado, NaoEncontrada } from './public/acesso.js';
import * as cli from './clientes/index.js';
import * as emp from './empresas/index.js';
import * as adm from './admin/index.js';

export const VIEWS = {
  inicio: Inicio, catalogo: Catalogo, perfil: PerfilFornecedor, solicitar: Solicitar, ajuda: CentralAjuda, artigo: Artigo,
  entrar: Entrar, cadastro: Cadastro, recuperar: Recuperar, sessaoExpirada: SessaoExpirada, acessoNegado: AcessoNegado, naoEncontrada: NaoEncontrada,
  cliVisao: cli.Visao, cliSolicitacoes: cli.Solicitacoes, cliSolicitacao: cli.Solicitacao, cliAgendamentos: cli.Agendamentos, cliEquipamentos: cli.Equipamentos,
  cliHistorico: cli.Historico, cliPerfil: cli.Perfil, cliPreferencias: cli.Preferencias,
  empVisao: emp.Visao, empPerfil: emp.Perfil, empServicos: emp.Servicos, empProdutos: emp.Produtos, empProfissionais: emp.Profissionais, empProfissional: emp.Profissional,
  empAgenda: emp.Agenda, empSolicitacoes: emp.Solicitacoes, empSolicitacao: emp.Solicitacao, empOrdens: emp.Ordens, empOrdem: emp.Ordem, empClientes: emp.Clientes,
  empHistorico: emp.Historico, empAjuda: emp.Ajuda, empConfiguracoes: emp.Configuracoes,
  admVisao: adm.Visao, admEmpresas: adm.Empresas, admEmpresa: adm.Empresa, admUsuarios: adm.Usuarios, admPublicados: adm.Publicados, admCategorias: adm.Categorias,
  admAgendamentos: adm.Agendamentos, admAjuda: adm.Ajuda, admArtigo: adm.Artigo, admSuporte: adm.Suporte, admAuditoria: adm.Auditoria, admConfiguracoes: adm.Configuracoes
};

export const TITULOS = {
  inicio: 'Início', catalogo: 'Fornecedores', perfil: 'Perfil do fornecedor', solicitar: 'Solicitar atendimento', ajuda: 'Central de ajuda', artigo: 'Ajuda',
  entrar: 'Entrar', cadastro: 'Criar conta', recuperar: 'Recuperar acesso', sessaoExpirada: 'Sessão expirada', acessoNegado: 'Acesso negado', naoEncontrada: 'Página não encontrada',
  cliVisao: 'Visão geral', cliSolicitacoes: 'Solicitações e orçamentos', cliSolicitacao: 'Solicitação', cliAgendamentos: 'Agendamentos', cliEquipamentos: 'Meus equipamentos',
  cliHistorico: 'Histórico', cliPerfil: 'Perfil e endereços', cliPreferencias: 'Preferências',
  empVisao: 'Visão geral', empPerfil: 'Perfil da empresa', empServicos: 'Serviços', empProdutos: 'Produtos', empProfissionais: 'Profissionais', empProfissional: 'Profissional',
  empAgenda: 'Agenda', empSolicitacoes: 'Solicitações e orçamentos', empSolicitacao: 'Solicitação', empOrdens: 'Ordens de serviço', empOrdem: 'Ordem de serviço',
  empClientes: 'Clientes e equipamentos', empHistorico: 'Histórico e retornos', empAjuda: 'Ajuda', empConfiguracoes: 'Configurações',
  admVisao: 'Visão geral', admEmpresas: 'Empresas', admEmpresa: 'Empresa', admUsuarios: 'Usuários e acessos', admPublicados: 'Serviços e produtos publicados', admCategorias: 'Categorias',
  admAgendamentos: 'Agendamentos', admAjuda: 'Base de conhecimento', admArtigo: 'Editar artigo', admSuporte: 'Solicitações de suporte', admAuditoria: 'Auditoria', admConfiguracoes: 'Configurações'
};
