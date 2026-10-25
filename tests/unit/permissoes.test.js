import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pode, acessoRota, ambientesDe, podeAlterarPapel, podeSuspenderUsuario, principaisAtivos, vinculoEmpresa } from '../../src/domain/permissoes.js';

const u = (id, vinculos, situacao = 'ativo') => ({ id, nome: id, situacao, vinculos });
const ana = u('ana', [{ tipo: 'cliente' }]);
const marina = u('marina', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'gestor', situacao: 'ativo' }, { tipo: 'cliente' }]);
const carlos = u('carlos', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', profissionalId: 'p-carlos', situacao: 'ativo' }]);
const diego = u('diego', [{ tipo: 'empresa', empresaId: 'polar', papel: 'gestor', situacao: 'ativo' }]);
const paulo = u('paulo', [{ tipo: 'admin', nivel: 'operacoes' }]);
const lucia = u('lucia', [{ tipo: 'admin', nivel: 'principal' }]);
const sup = u('sup', [{ tipo: 'admin', nivel: 'suporte' }]);
const visitante = null;
const F = { empresaId: 'friovale' };

describe('Matriz de permissões (PRD §7)', () => {
  test('consultar catálogo e ajuda: todos', () => {
    for (const x of [ana, marina, carlos, paulo, visitante]) assert.equal(pode(x, 'catalogo.consultar'), true);
  });
  test('iniciar solicitação: cliente e visitante (envia após entrar); admin, gestor e técnico não', () => {
    assert.equal(pode(visitante, 'solicitacao.iniciar'), true);
    assert.equal(pode(visitante, 'solicitacao.enviar'), false);
    assert.equal(pode(ana, 'solicitacao.enviar'), true);
    assert.equal(pode(carlos, 'solicitacao.iniciar'), false);
    assert.equal(pode(paulo, 'solicitacao.iniciar'), false);
    assert.equal(pode(diego, 'solicitacao.enviar'), false);
    assert.equal(pode(marina, 'solicitacao.enviar'), true, 'Marina também é cliente');
  });
  test('confirmar/recusar proposta: apenas as próprias', () => {
    assert.equal(pode(ana, 'proposta.decidir', { clienteId: 'ana' }), true);
    assert.equal(pode(ana, 'proposta.decidir', { clienteId: 'outra' }), false);
    assert.equal(pode(marina, 'proposta.decidir', { clienteId: 'ana' }), false);
    assert.equal(pode(paulo, 'proposta.decidir', { clienteId: 'ana' }), false);
    assert.equal(pode(visitante, 'proposta.decidir', { clienteId: 'ana' }), false);
  });
  test('reagendar/cancelar: gestor da empresa ou o próprio cliente', () => {
    assert.equal(pode(ana, 'reagendamento.solicitar', { clienteId: 'ana', empresaId: 'friovale' }), true);
    assert.equal(pode(marina, 'reagendamento.solicitar', { clienteId: 'ana', empresaId: 'friovale' }), true);
    assert.equal(pode(diego, 'reagendamento.solicitar', { clienteId: 'ana', empresaId: 'friovale' }), false);
    assert.equal(pode(carlos, 'reagendamento.solicitar', { clienteId: 'ana', empresaId: 'friovale' }), false);
  });
  test('emitir proposta, configurar agenda e gerir equipe: só gestor da própria empresa', () => {
    for (const acao of ['proposta.emitir', 'agenda.configurar', 'empresa.gerir']) {
      assert.equal(pode(marina, acao, F), true, acao);
      assert.equal(pode(diego, acao, F), false, `${acao}: isolamento entre empresas`);
      assert.equal(pode(carlos, acao, F), false, `${acao}: técnico sem acesso`);
      assert.equal(pode(paulo, acao, F), false);
      assert.equal(pode(ana, acao, F), false);
    }
  });
  test('consultar agenda conforme o escopo', () => {
    assert.equal(pode(visitante, 'agenda.consultar', { escopo: 'horarios' }), true);
    assert.equal(pode(paulo, 'agenda.consultar', { escopo: 'agregada' }), true);
    assert.equal(pode(marina, 'agenda.consultar', { escopo: 'agregada' }), false);
    assert.equal(pode(marina, 'agenda.consultar', { escopo: 'empresa', ...F }), true);
    assert.equal(pode(diego, 'agenda.consultar', { escopo: 'empresa', ...F }), false);
    assert.equal(pode(carlos, 'agenda.consultar', { escopo: 'empresa', ...F }), false);
    assert.equal(pode(carlos, 'agenda.consultar', { escopo: 'profissional', ...F, profissionalId: 'p-carlos' }), true);
    assert.equal(pode(carlos, 'agenda.consultar', { escopo: 'profissional', ...F, profissionalId: 'p-juliana' }), false);
    assert.equal(pode(marina, 'agenda.consultar', { escopo: 'profissional', ...F, profissionalId: 'p-juliana' }), true);
    assert.equal(pode(ana, 'agenda.consultar', { escopo: 'cliente', clienteId: 'ana' }), true);
    assert.equal(pode(ana, 'agenda.consultar', { escopo: 'cliente', clienteId: 'x' }), false);
    assert.equal(pode(ana, 'agenda.consultar', { escopo: 'outro' }), false);
  });
  test('atualizar execução: gestor da empresa ou técnico atribuído', () => {
    assert.equal(pode(marina, 'os.atualizar', { ...F, profissionalId: 'p-juliana' }), true);
    assert.equal(pode(carlos, 'os.atualizar', { ...F, profissionalId: 'p-carlos' }), true);
    assert.equal(pode(carlos, 'os.atualizar', { ...F, profissionalId: 'p-juliana' }), false);
    assert.equal(pode(carlos, 'os.atualizar', { ...F, profissionalId: null }), false);
    assert.equal(pode(diego, 'os.atualizar', { ...F, profissionalId: 'p-carlos' }), false);
    assert.equal(pode(ana, 'os.atualizar', { ...F, profissionalId: 'p-carlos' }), false);
  });
  test('ver dados de clientes: admin só com justificativa; empresa da operação; técnico do atendimento; cliente próprios', () => {
    assert.equal(pode(paulo, 'clientes.ver', F), false);
    assert.equal(pode(paulo, 'clientes.ver', { ...F, justificativa: 'Atendimento ao chamado SUP-118' }), true);
    assert.equal(pode(marina, 'clientes.ver', F), true);
    assert.equal(pode(diego, 'clientes.ver', F), false);
    assert.equal(pode(carlos, 'clientes.ver', { ...F, profissionalId: 'p-carlos' }), true);
    assert.equal(pode(carlos, 'clientes.ver', F), false);
    assert.equal(pode(ana, 'clientes.ver', { clienteId: 'ana' }), true);
    assert.equal(pode(visitante, 'clientes.ver', { clienteId: 'ana' }), false);
  });
  test('situação da empresa: admin (principal/operações) com justificativa', () => {
    assert.equal(pode(paulo, 'empresa.situacao', { justificativa: 'Análise cadastral concluída.' }), true);
    assert.equal(pode(paulo, 'empresa.situacao', { justificativa: 'curta' }), false);
    assert.equal(pode(lucia, 'empresa.situacao', { justificativa: 'Análise cadastral concluída.' }), true);
    assert.equal(pode(sup, 'empresa.situacao', { justificativa: 'Análise cadastral concluída.' }), false);
    assert.equal(pode(marina, 'empresa.situacao', { justificativa: 'Análise cadastral concluída.' }), false);
  });
  test('gerir usuários: admin conforme nível; gestor apenas a equipe', () => {
    assert.equal(pode(paulo, 'usuarios.gerir'), true);
    assert.equal(pode(sup, 'usuarios.gerir'), false);
    assert.equal(pode(marina, 'usuarios.gerir'), false);
    assert.equal(pode(marina, 'usuarios.gerir', { escopo: 'equipe', ...F }), true);
    assert.equal(pode(diego, 'usuarios.gerir', { escopo: 'equipe', ...F }), false);
  });
  test('artigos, auditoria, suporte e moderação: somente administração', () => {
    for (const acao of ['artigos.publicar', 'auditoria.consultar', 'suporte.consultar']) {
      assert.equal(pode(paulo, acao), true);
      assert.equal(pode(sup, acao), true);
      assert.equal(pode(marina, acao), false);
      assert.equal(pode(ana, acao), false);
    }
    assert.equal(pode(paulo, 'admin.moderar'), true);
    assert.equal(pode(sup, 'admin.moderar'), false);
    assert.equal(pode(paulo, 'acao.inexistente'), false);
  });
  test('conta ou vínculo suspenso perde os acessos', () => {
    const suspensa = { ...ana, situacao: 'suspenso' };
    assert.equal(pode(suspensa, 'solicitacao.enviar'), false);
    const tecSuspenso = u('t', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', profissionalId: 'p-t', situacao: 'suspenso' }]);
    assert.equal(pode(tecSuspenso, 'os.atualizar', { ...F, profissionalId: 'p-t' }), false);
    assert.equal(vinculoEmpresa(tecSuspenso, 'friovale'), null);
    const admSusp = u('a', [{ tipo: 'admin', nivel: 'principal', situacao: 'suspenso' }]);
    assert.equal(pode(admSusp, 'auditoria.consultar'), false);
  });
});

describe('Acesso a rotas (alterar a URL não concede autorização)', () => {
  test('rotas públicas sempre acessíveis', () => assert.equal(acessoRota(null, null).status, 'ok'));
  test('sem sessão pede login', () => assert.equal(acessoRota(null, 'clientes').status, 'login'));
  test('cliente não acessa empresas nem admin', () => {
    assert.equal(acessoRota(ana, 'clientes').status, 'ok');
    assert.equal(acessoRota(ana, 'empresas').status, 'negado');
    assert.equal(acessoRota(ana, 'admin').status, 'negado');
  });
  test('técnico: só agenda própria, atendimentos e ajuda', () => {
    assert.equal(acessoRota(carlos, 'empresas', '').status, 'ok');
    assert.equal(acessoRota(carlos, 'empresas', 'agenda').status, 'ok');
    assert.equal(acessoRota(carlos, 'empresas', 'ordens').status, 'ok');
    assert.equal(acessoRota(carlos, 'empresas', 'ajuda').status, 'ok');
    for (const s of ['clientes', 'configuracoes', 'profissionais', 'solicitacoes', 'servicos', 'perfil']) {
      assert.equal(acessoRota(carlos, 'empresas', s).status, 'insuficiente', s);
    }
    assert.equal(acessoRota(carlos, 'clientes').status, 'negado');
    assert.equal(acessoRota(carlos, 'admin').status, 'negado');
  });
  test('gestora com dois vínculos acessa empresa e área do cliente', () => {
    assert.equal(acessoRota(marina, 'empresas', 'configuracoes').status, 'ok');
    assert.equal(acessoRota(marina, 'clientes').status, 'ok');
    assert.equal(acessoRota(marina, 'admin').status, 'negado');
    assert.deepEqual(ambientesDe(marina).map(a => a.tipo), ['empresas', 'clientes']);
    assert.deepEqual(ambientesDe(paulo).map(a => a.tipo), ['admin']);
  });
  test('vínculo suspenso ou conta suspensa negam acesso', () => {
    const t = u('t', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', situacao: 'suspenso' }]);
    assert.deepEqual(acessoRota(t, 'empresas', 'agenda'), { status: 'negado', motivo: 'vinculo_suspenso' });
    assert.equal(acessoRota({ ...ana, situacao: 'suspenso' }, 'clientes').motivo, 'conta_suspensa');
    assert.equal(acessoRota(ana, 'outro').status, 'negado');
  });
  test('admin acessa a central de administração', () => {
    assert.deepEqual(acessoRota(paulo, 'admin'), { status: 'ok', nivel: 'operacoes' });
    assert.equal(acessoRota(diego, 'empresas', 'solicitacoes', 'polar').status, 'ok');
  });
});

describe('Proteções administrativas', () => {
  const lucia2 = u('lucia2', [{ tipo: 'admin', nivel: 'principal' }]);
  const todos = [paulo, lucia, sup, marina];

  test('autoelevação bloqueada', () => {
    assert.equal(podeAlterarPapel(paulo, paulo, 'principal', todos).code, 'AUTOELEVACAO');
    assert.equal(podeAlterarPapel(lucia, lucia, 'operacoes', todos).code, 'AUTOELEVACAO');
  });
  test('operações não concede nem altera o nível Principal', () => {
    assert.equal(podeAlterarPapel(paulo, sup, 'principal', todos).code, 'NIVEL_INSUFICIENTE');
    assert.equal(podeAlterarPapel(paulo, lucia, 'operacoes', todos).code, 'NIVEL_INSUFICIENTE');
    assert.equal(podeAlterarPapel(paulo, sup, 'operacoes', todos).ok, true);
    assert.equal(podeAlterarPapel(lucia, sup, 'principal', todos).ok, true);
  });
  test('suporte não altera papéis; papel de empresa é gerido pela empresa; nível inválido', () => {
    assert.equal(podeAlterarPapel(sup, paulo, 'suporte', todos).code, 'PERMISSAO_INSUFICIENTE');
    assert.equal(podeAlterarPapel(ana, paulo, 'suporte', todos).code, 'PERMISSAO_INSUFICIENTE');
    assert.equal(podeAlterarPapel(lucia, marina, 'suporte', todos).code, 'PAPEL_EXTERNO');
    assert.equal(podeAlterarPapel(lucia, sup, 'mestre', todos).code, 'VALIDACAO');
  });
  test('último administrador principal habilitado é protegido', () => {
    assert.equal(principaisAtivos(todos), 1);
    assert.equal(podeAlterarPapel(lucia2, lucia, 'operacoes', [...todos]).code, 'ULTIMO_ADMIN_PRINCIPAL');
    assert.equal(podeAlterarPapel(lucia2, lucia, 'operacoes', [...todos, lucia2]).ok, true);
    assert.equal(podeSuspenderUsuario(paulo, lucia, todos).code, 'ULTIMO_ADMIN_PRINCIPAL');
    assert.equal(podeSuspenderUsuario(lucia2, lucia, [...todos, lucia2]).ok, true);
    assert.equal(podeSuspenderUsuario(paulo, lucia, [...todos, lucia2]).code, 'NIVEL_INSUFICIENTE');
  });
  test('suspensão: não suspende a si mesmo; suporte não suspende', () => {
    assert.equal(podeSuspenderUsuario(paulo, paulo, todos).code, 'AUTOSUSPENSAO');
    assert.equal(podeSuspenderUsuario(sup, marina, todos).code, 'PERMISSAO_INSUFICIENTE');
    assert.equal(podeSuspenderUsuario(paulo, marina, todos).ok, true);
  });
});
