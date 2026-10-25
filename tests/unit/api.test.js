// Testes da camada api/ (servidor simulado) com armazenamento em memória.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { usarArmazenamento, armazenamentoEmMemoria, storage, CHAVES } from '../../src/api/storage.js';
import { ler, restaurarDemonstracao } from '../../src/api/db.js';
import { definirSim } from '../../src/api/sim.js';
import { avancar } from '../../src/api/clock.js';
import * as agenda from '../../src/api/agenda.js';
import * as req from '../../src/api/requests.js';
import * as orders from '../../src/api/orders.js';
import * as comp from '../../src/api/companies.js';
import * as users from '../../src/api/users.js';
import * as notif from '../../src/api/notifications.js';
import * as auth from '../../src/api/auth.js';
import { paraUtc, HORA, DIA } from '../../src/domain/datas.js';
import { acessoRota } from '../../src/domain/permissoes.js';

const F = 'America/Cuiaba';
const ALVO = paraUtc('2026-10-24', '10:00', F);
const em = (data, hora) => new Date(paraUtc(data, hora, F)).toISOString();
const D0 = '2026-10-26', D2 = '2026-10-28', D4 = '2026-10-30';
const ANA = { ator: 'u-ana' }, MARINA = { ator: 'u-marina' };
const sol = id => ler().solicitacoes.find(s => s.id === id);
const ocup = id => ler().ocupacoes.find(o => o.id === id);
const usuario = id => ler().usuarios.find(u => u.id === id);

function reiniciar() {
  const mem = armazenamentoEmMemoria();
  mem.clear();
  usarArmazenamento(mem);
  storage.set(CHAVES.relogio, String(ALVO - Date.now()));
  definirSim({ latencia: 'nenhuma', falharProximoEnvio: false, falharEmail: false, falharCatalogo: false });
  restaurarDemonstracao();
}

const rascunho = (extra = {}) => ({
  empresaSlug: 'friovale', servicoId: 'sv-fv-hig', equipamentoModo: 'novo', equipTipo: 'Split hi-wall', equipCapacidade: '9.000 BTUs',
  localModo: 'novo', localRotulo: 'Casa', bairro: 'Centro', cidade: 'Cuiabá', descricao: 'Aparelho pingando água na parede da sala.',
  semHorario: false, inicio: em(D0, '10:00'), ...extra
});

describe('API simulada: dados demonstrativos', () => {
  beforeEach(reiniciar);
  test('semana de demonstração são os próximos cinco dias úteis', () => {
    assert.deepEqual(ler().meta.diasDemo, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    assert.equal(ocup('oc-1038').inicio, em(D2, '13:30'));
  });
  test('dados fictícios: e-mails exemplo.invalid e CNPJ zerado', () => {
    const e = ler();
    assert.ok(e.usuarios.every(u => u.email.endsWith('@exemplo.invalid')));
    assert.ok(e.empresas.every(x => x.cnpj === '00.000.000/0000-00'));
  });
});

describe('API simulada: reserva temporária na solicitação', () => {
  beforeEach(reiniciar);

  test('envio cria solicitação e reserva temporária de um profissional elegível', async () => {
    const r = await req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'k1' });
    assert.equal(r.ok, true, r.message);
    assert.equal(r.data.id, 'SOL-1042');
    const s = sol('SOL-1042');
    const o = ocup(s.ocupacaoId);
    assert.equal(s.estado, 'enviada');
    assert.equal(o.estado, 'temporaria');
    assert.equal(o.profissionalId, 'p-rafael', 'elegível livre com menos atendimentos no dia (Juliana está ocupada às 10:00)');
    assert.equal(Date.parse(o.expiraEm) - ALVO <= 24 * HORA + 5000, true);
  });

  test('idempotência: a mesma chave devolve o mesmo resultado sem duplicar', async () => {
    const antes = ler().solicitacoes.length;
    const [a, b] = await Promise.all([req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'dup' }), req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'dup' })]);
    assert.equal(a.data.id, b.data.id);
    assert.equal(ler().solicitacoes.length, antes + 1);
    const c = await req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'dup' });
    assert.equal(c.repetida, true);
    assert.equal(ler().solicitacoes.length, antes + 1);
  });

  test('horário ocupado por operação concorrente: nada é gravado e há alternativas', async () => {
    await agenda.simularReservaConcorrente({ empresaId: 'friovale', servicoId: 'sv-fv-hig', inicio: em(D0, '10:00') });
    const antes = ler().solicitacoes.length;
    const r = await req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'k2' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'HORARIO_INDISPONIVEL');
    assert.ok(r.details.alternativas.length > 0);
    assert.equal(ler().solicitacoes.length, antes);
    assert.ok(ler().auditoria.some(a => a.acao === 'Conflito de reserva'));
    const ok2 = await req.criarSolicitacao(rascunho({ inicio: r.details.alternativas[0].inicio }), { ...ANA, idempotencyKey: 'k3' });
    assert.equal(ok2.ok, true);
  });

  test('falha de conexão simulada: nada gravado; nova tentativa funciona', async () => {
    definirSim({ falharProximoEnvio: true });
    const antes = ler().meta.rev;
    const r = await req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'k4' });
    assert.equal(r.code, 'FALHA_CONEXAO');
    assert.equal(ler().meta.rev, antes);
    const r2 = await req.criarSolicitacao(rascunho(), { ...ANA, idempotencyKey: 'k4' });
    assert.equal(r2.ok, true);
  });

  test('sem horário definido não reserva nada; empresa suspensa não recebe solicitações', async () => {
    const r = await req.criarSolicitacao(rascunho({ semHorario: true, inicio: '' }), ANA);
    assert.equal(r.ok, true);
    assert.equal(sol(r.data.id).ocupacaoId, null);
    const r2 = await req.criarSolicitacao(rascunho({ empresaSlug: 'pantanal' }), ANA);
    assert.equal(r2.code, 'EMPRESA_INDISPONIVEL');
  });

  test('visitante não envia; técnico não envia', async () => {
    assert.equal((await req.criarSolicitacao(rascunho(), { ator: null })).code, 'NAO_AUTENTICADO');
    assert.equal((await req.criarSolicitacao(rascunho(), { ator: 'u-carlos' })).code, 'ACESSO_NEGADO');
  });
});

describe('API simulada: proposta e confirmação', () => {
  beforeEach(reiniciar);

  test('confirmação revalida, confirma a ocupação e cria a ordem de serviço', async () => {
    const s = sol('SOL-1038');
    const r = await req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: s.v, idempotencyKey: 'c1' }, ANA);
    assert.equal(r.ok, true, r.message);
    assert.equal(sol('SOL-1038').estado, 'aceita');
    assert.equal(ocup('oc-1038').estado, 'confirmada');
    assert.equal(ler().ordens.find(o => o.id === r.data.ordemId).estado, 'agendada');
  });

  test('conflito de versão: a tela desatualizada recebe CONFLITO_ATUALIZACAO', async () => {
    const v = sol('SOL-1038').v;
    const [a, b] = await Promise.all([
      req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: v, idempotencyKey: 'aba-1' }, ANA),
      req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: v, idempotencyKey: 'aba-2' }, ANA)
    ]);
    const codigos = [a, b].map(x => (x.ok ? 'ok' : x.code)).sort();
    assert.deepEqual(codigos, ['CONFLITO_ATUALIZACAO', 'ok']);
    assert.equal(ler().ordens.filter(o => o.solicitacaoId === 'SOL-1038').length, 1);
  });

  test('horário ocupado na revalidação: nada é confirmado e é possível pedir outro horário', async () => {
    await agenda.simularOcupacaoSobreposta({ ocupacaoId: 'oc-1038' });
    const r = await req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: sol('SOL-1038').v, idempotencyKey: 'c2' }, ANA);
    assert.equal(r.code, 'HORARIO_INDISPONIVEL');
    assert.equal(sol('SOL-1038').estado, 'proposta');
    assert.ok(r.details.alternativas.length > 0);
    const r2 = await req.pedirOutroHorario({ solicitacaoId: 'SOL-1038', inicio: r.details.alternativas[0].inicio, versao: sol('SOL-1038').v }, ANA);
    assert.equal(r2.ok, true, r2.message);
    assert.equal(sol('SOL-1038').estado, 'em_analise');
    assert.equal(ocup('oc-1038').estado, 'liberada');
  });

  test('proposta expirada não pode ser confirmada', async () => {
    avancar(4 * DIA);
    const r = await req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: sol('SOL-1038').v }, ANA);
    assert.equal(r.code, 'PROPOSTA_EXPIRADA');
  });

  test('empresa envia proposta, cliente pede ajuste e recusa libera o horário', async () => {
    const s = sol('SOL-1040');
    const r = await req.enviarProposta({ solicitacaoId: 'SOL-1040', profissionalId: 'p-carlos', inicio: em(D0, '13:30'), validadeHoras: 24, versao: s.v, itens: [{ descricao: 'Manutenção', valorCentavos: 22000 }] }, MARINA);
    assert.equal(r.ok, true, r.message);
    assert.equal(sol('SOL-1040').estado, 'proposta');
    const aj = await req.pedirAjuste({ solicitacaoId: 'SOL-1040', texto: 'Pode ser pela manhã?', versao: sol('SOL-1040').v }, { ator: 'u-roberto' });
    assert.equal(aj.ok, true);
    assert.equal(ocup('oc-1040').estado, 'temporaria', 'reserva mantida até a validade');
    const vazio = await req.pedirAjuste({ solicitacaoId: 'SOL-1040', texto: ' ', versao: sol('SOL-1040').v }, { ator: 'u-roberto' });
    assert.equal(vazio.ok, false);
    await req.enviarProposta({ solicitacaoId: 'SOL-1040', profissionalId: 'p-carlos', inicio: em(D0, '13:30'), validadeHoras: 24, versao: sol('SOL-1040').v, itens: [{ descricao: 'Manutenção', valorCentavos: 22000 }] }, MARINA);
    const rec = await req.recusarProposta({ solicitacaoId: 'SOL-1040', versao: sol('SOL-1040').v, motivo: 'Prefiro outra data' }, { ator: 'u-roberto' });
    assert.equal(rec.ok, true);
    assert.equal(ocup('oc-1040').estado, 'liberada');
  });

  test('proposta com profissional ocupado é recusada pelo servidor', async () => {
    const r = await req.enviarProposta({ solicitacaoId: 'SOL-1040', profissionalId: 'p-rafael', inicio: em(D0, '13:30'), validadeHoras: 24, versao: sol('SOL-1040').v, itens: [{ descricao: 'X', valorCentavos: 100 }] }, MARINA);
    assert.equal(r.code, 'HORARIO_INDISPONIVEL');
  });
});

describe('API simulada: reagendamento preserva o horário original', () => {
  beforeEach(reiniciar);

  test('pedido mantém o original; confirmação libera o original', async () => {
    const r = await req.solicitarReagendamento({ solicitacaoId: 'SOL-1027', inicio: em(D4, '10:00'), idempotencyKey: 'r1' }, ANA);
    assert.equal(r.ok, true, r.message);
    assert.equal(ocup('oc-2205').estado, 'confirmada');
    const novo = ocup(sol('SOL-1027').reagendamento.ocupacaoId);
    assert.equal(novo.estado, 'temporaria');
    const resp = await req.responderReagendamento({ solicitacaoId: 'SOL-1027', aceitar: true, versao: sol('SOL-1027').v }, MARINA);
    assert.equal(resp.ok, true, resp.message);
    assert.equal(ocup('oc-2205').estado, 'liberada');
    assert.equal(ocup(novo.id).estado, 'confirmada');
    assert.equal(ler().ordens.find(o => o.id === 'OS-2205').inicio, em(D4, '10:00'));
  });

  test('recusa ou prazo vencido mantêm o original', async () => {
    await req.solicitarReagendamento({ solicitacaoId: 'SOL-1027', inicio: em(D4, '10:00') }, ANA);
    const novoId = sol('SOL-1027').reagendamento.ocupacaoId;
    await req.responderReagendamento({ solicitacaoId: 'SOL-1027', aceitar: false, versao: sol('SOL-1027').v }, MARINA);
    assert.equal(ocup('oc-2205').estado, 'confirmada');
    assert.equal(ocup(novoId).estado, 'liberada');
    await req.solicitarReagendamento({ solicitacaoId: 'SOL-1027', inicio: em(D4, '13:30') }, ANA);
    avancar(49 * HORA);
    await agenda.expirarReservas();
    assert.equal(sol('SOL-1027').reagendamento, null);
    assert.equal(ocup('oc-2205').estado, 'confirmada');
  });
});

describe('API simulada: agenda, bloqueios e expiração', () => {
  beforeEach(reiniciar);

  test('bloqueio conflitante não é salvo e sugere janelas livres', async () => {
    const r = await agenda.criarBloqueio({ profissionalId: 'p-carlos', data: D0, diaInteiro: false, inicio: '13:00', fim: '15:00', motivo: 'Manutenção do veículo' }, MARINA);
    assert.equal(r.code, 'BLOQUEIO_CONFLITANTE');
    assert.ok(r.details.afetados.some(a => a.ref === 'SOL-1040'));
    assert.deepEqual(r.details.alternativas[0], { inicio: '09:30', fim: '11:30' });
    const ok2 = await agenda.criarBloqueio({ profissionalId: 'p-carlos', data: D0, diaInteiro: false, inicio: '09:30', fim: '11:30', motivo: 'Manutenção do veículo' }, MARINA);
    assert.equal(ok2.ok, true);
    assert.equal(ok2.data.rotulo, 'BLQ-09');
    const pub = agenda.horariosPublicos({ empresaId: 'friovale', servicoId: 'sv-fv-hig', data: D0 });
    assert.ok(pub.every(h => Object.keys(h).sort().join() === 'hora,inicio,livre'), 'agenda pública só tem horários');
  });

  test('técnico não configura bloqueios; outra empresa não vê dados', async () => {
    const r = await agenda.criarBloqueio({ profissionalId: 'p-carlos', data: D0, diaInteiro: true, motivo: 'X' }, { ator: 'u-carlos' });
    assert.equal(r.code, 'NAO_ENCONTRADO');
    const d = await req.enviarProposta({ solicitacaoId: 'SOL-1040', profissionalId: 'p-carlos', inicio: em(D0, '13:30'), validadeHoras: 24, itens: [{ descricao: 'X', valorCentavos: 1 }] }, { ator: 'u-diego' });
    assert.equal(d.code, 'NAO_ENCONTRADO');
    assert.deepEqual(req.solicitacoesDaEmpresa(usuario('u-diego'), 'friovale'), []);
    assert.equal(req.solicitacaoDaEmpresa(usuario('u-diego'), 'friovale', 'SOL-1040'), null);
    assert.equal(agenda.agendaDoDia({ empresaId: 'friovale', data: D0, usuario: usuario('u-diego') }), null);
    const tec = agenda.agendaDoDia({ empresaId: 'friovale', data: D0, usuario: usuario('u-carlos') });
    assert.deepEqual(tec.colunas.map(c => c.id), ['p-carlos']);
  });

  test('reserva temporária vencida é liberada e a solicitação expira', async () => {
    avancar(2 * DIA);
    const r = await agenda.expirarReservas();
    assert.ok(r.data.alteradas > 0);
    assert.equal(sol('SOL-1040').estado, 'expirada');
    assert.equal(ocup('oc-1040').estado, 'liberada');
    const conv = ler().profissionais.find(p => p.id === 'p-bruno');
    assert.equal(conv.situacao, 'convite');
    avancar(2 * DIA);
    await agenda.expirarReservas();
    assert.equal(ler().profissionais.find(p => p.id === 'p-bruno').situacao, 'convite_expirado');
  });
});

describe('API simulada: execução da ordem de serviço', () => {
  beforeEach(reiniciar);
  test('técnico executa somente as atribuídas; concluir exige trabalho realizado', async () => {
    const os = ler().ordens.find(o => o.id === 'OS-2201');
    assert.equal((await orders.iniciarExecucao({ ordemId: 'OS-2202', versao: 1 }, { ator: 'u-carlos' })).code, 'NAO_ENCONTRADO');
    assert.equal((await orders.iniciarExecucao({ ordemId: 'OS-2201', versao: os.v }, { ator: 'u-carlos' })).ok, true);
    const v = ler().ordens.find(o => o.id === 'OS-2201').v;
    assert.equal((await orders.concluirOrdem({ ordemId: 'OS-2201', trabalho: '', versao: v }, { ator: 'u-carlos' })).code, 'VALIDACAO');
    const r = await orders.concluirOrdem({ ordemId: 'OS-2201', trabalho: 'Higienização completa.', retornoMeses: 6, versao: v }, { ator: 'u-carlos' });
    assert.equal(r.ok, true);
    assert.equal(r.data.proximoRetorno, '2027-04');
  });
});

describe('API simulada: equipe e revogação de acesso', () => {
  beforeEach(reiniciar);
  test('revogar exige tratar cada atendimento futuro; histórico preservado; técnico perde acesso', async () => {
    const futuros = comp.atendimentosFuturos(usuario('u-marina'), 'friovale', 'p-rafael');
    assert.deepEqual(futuros.map(f => f.ref), ['OS-2203', 'OS-2207', 'OS-2208']);
    const semTrat = await comp.revogarProfissional({ profissionalId: 'p-rafael', tratamentos: {}, justificativa: 'Encerramento do vínculo.' }, MARINA);
    assert.equal(semTrat.code, 'TRATAMENTO_PENDENTE');
    const opc = Object.fromEntries(futuros.map(f => [f.ref, f.opcoes]));
    assert.equal(opc['OS-2203'].find(o => o.id === 'p-juliana').livre, false);
    assert.equal(opc['OS-2207'].find(o => o.id === 'p-carlos').livre, true);
    const tratamentos = { [futuros[0].id]: 'combinar', [futuros[1].id]: 'p-carlos', [futuros[2].id]: 'p-juliana' };
    const r = await comp.revogarProfissional({ profissionalId: 'p-rafael', tratamentos, justificativa: 'Encerramento do vínculo.' }, MARINA);
    assert.equal(r.ok, true, r.message);
    assert.equal(ler().ordens.find(o => o.id === 'OS-2207').profissionalId, 'p-carlos');
    assert.equal(ler().ordens.find(o => o.id === 'OS-2203').profissionalId, null);
    assert.ok(ler().ordens.find(o => o.id === 'OS-2207').historico.some(h => h.texto.includes('Reatribuída para Carlos M.')));
    assert.equal(acessoRota(usuario('u-rafael'), 'empresas', 'agenda').status, 'negado');
    assert.ok(ler().auditoria.some(a => a.acao === 'Acesso revogado' && a.entidade.includes('Rafael')));
  });
  test('reatribuição para profissional ocupado é recusada na transação', async () => {
    const futuros = comp.atendimentosFuturos(usuario('u-marina'), 'friovale', 'p-rafael');
    const tratamentos = { [futuros[0].id]: 'p-juliana', [futuros[1].id]: 'p-carlos', [futuros[2].id]: 'p-juliana' };
    const r = await comp.revogarProfissional({ profissionalId: 'p-rafael', tratamentos, justificativa: 'Encerramento do vínculo.' }, MARINA);
    assert.equal(r.code, 'HORARIO_INDISPONIVEL');
    assert.equal(ler().profissionais.find(p => p.id === 'p-rafael').situacao, 'ativo');
  });
});

describe('API simulada: administração', () => {
  beforeEach(reiniciar);
  test('habilitar exige análise completa e justificativa; empresa aparece no catálogo', async () => {
    const PAULO = { ator: 'u-paulo' };
    assert.equal((await comp.alterarSituacaoEmpresa({ empresaId: 'gelo-fino', acao: 'habilitar', justificativa: 'curta' }, PAULO)).code, 'VALIDACAO');
    assert.equal((await comp.alterarSituacaoEmpresa({ empresaId: 'gelo-fino', acao: 'habilitar', justificativa: 'Análise cadastral concluída.' }, PAULO)).code, 'ANALISE_INCOMPLETA');
    for (const [k] of comp.ITENS_ANALISE) await comp.marcarAnalise({ empresaId: 'gelo-fino', item: k, valor: true }, PAULO);
    const r = await comp.alterarSituacaoEmpresa({ empresaId: 'gelo-fino', acao: 'habilitar', justificativa: 'Análise cadastral concluída.' }, PAULO);
    assert.equal(r.ok, true);
    assert.ok(comp.catalogoSincrono().some(c => c.slug === 'gelo-fino' && c.recente));
    assert.ok(ler().auditoria.some(a => a.acao === 'Empresa habilitada' && a.justificativa === 'Análise cadastral concluída.'));
    assert.equal((await comp.alterarSituacaoEmpresa({ empresaId: 'friovale', acao: 'habilitar', justificativa: 'Análise cadastral concluída.' }, { ator: 'u-marina' })).code, 'ACESSO_NEGADO');
  });
  test('último principal protegido e autoelevação bloqueada', async () => {
    assert.equal((await users.suspenderUsuario({ usuarioId: 'u-lucia', justificativa: 'Teste de proteção.' }, { ator: 'u-paulo' })).code, 'ULTIMO_ADMIN_PRINCIPAL');
    assert.equal((await users.alterarPapel({ usuarioId: 'u-paulo', nivel: 'principal', justificativa: 'Autoelevação.' }, { ator: 'u-paulo' })).code, 'AUTOELEVACAO');
    assert.equal((await users.alterarPapel({ usuarioId: 'u-lucia', nivel: 'operacoes', justificativa: 'Rebaixar única principal.' }, { ator: 'u-lucia' })).code, 'AUTOELEVACAO');
    const u = users.usuariosAdmin(usuario('u-paulo'));
    assert.equal(u.principais, 1);
    assert.ok(u.lista.every(x => x.emailMascarado.includes('•••')));
  });
});

describe('API simulada: sessão, notificações e e-mail desacoplado', () => {
  beforeEach(reiniciar);
  test('falha de e-mail não desfaz reserva confirmada', async () => {
    await req.confirmarProposta({ solicitacaoId: 'SOL-1038', versao: sol('SOL-1038').v }, ANA);
    definirSim({ falharEmail: true });
    const r = await notif.processarFilaEmail();
    assert.equal(r.data.falhou, true);
    assert.ok(notif.filaEmail().some(m => m.situacao === 'falhou'));
    assert.equal(ocup('oc-1038').estado, 'confirmada');
    assert.equal(sol('SOL-1038').estado, 'aceita');
  });
  test('sessão expira após 30 minutos sem atividade e escritas são recusadas', async () => {
    auth.entrarComoPersona('u-ana');
    assert.equal(auth.usuarioAtual().id, 'u-ana');
    avancar(31 * 60000);
    assert.equal(auth.usuarioAtual(), null);
    assert.equal(auth.verificarAcesso('clientes', '').status, 'expirada');
    const r = await req.criarSolicitacao(rascunho());
    assert.equal(r.code, 'SESSAO_EXPIRADA');
  });
  test('login, troca de ambiente e cadastro', async () => {
    assert.equal((await auth.entrar({ email: 'ana.demo@exemplo.invalid', senha: '123' })).code, 'CREDENCIAIS');
    const r = await auth.entrar({ email: 'marina.demo@exemplo.invalid', senha: 'demonstracao' });
    assert.equal(r.data.ambiente, 'empresas');
    assert.equal(auth.trocarAmbiente('clientes'), true);
    assert.equal(auth.trocarAmbiente('admin'), false);
    const c = await auth.cadastrar({ tipo: 'empresa', empresaNome: 'Nova Clima', cnpj: '00.000.000/0000-00', cidade: 'Cuiabá', nome: 'Teste Silva', email: 'teste@exemplo.invalid', telefone: '65900000000', senha: '12345678', termos: true });
    assert.equal(c.ok, true, c.message);
    assert.equal(ler().empresas.find(e => e.id === c.data.empresaId).situacao, 'aguardando');
    assert.equal((await auth.recuperarAcesso('inexistente@exemplo.invalid')).ok, true);
  });
  test('notificações marcadas como lidas', async () => {
    assert.ok(notif.naoLidas(usuario('u-ana')) > 0);
    await notif.marcarTodasLidas(ANA);
    assert.equal(notif.naoLidas(usuario('u-ana')), 0);
  });
});
