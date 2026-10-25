import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../../src/domain/validacao.js';
import * as M from '../../src/domain/dinheiro.js';
import { verificarVersao, versoesAlteradas, buscarIdempotente, registrarIdempotente, CONFLITO } from '../../src/domain/concorrencia.js';
import { AGORA } from './fixtures.js';

describe('Validação da solicitação por etapa', () => {
  const base = { servicoId: 'hig', equipamentoModo: 'novo', equipTipo: 'Split hi-wall', localModo: 'novo', bairro: 'Centro', cidade: 'Cuiabá', descricao: 'Aparelho pingando água na parede da sala.', semHorario: false, inicio: '2026-10-26T12:00:00.000Z' };

  test('rascunho completo é válido', () => {
    const r = V.validarSolicitacao(base, { horarioLivre: () => true });
    assert.equal(r.ok, true);
  });
  test('erros aparecem na etapa correta, com mensagem próxima ao campo', () => {
    assert.deepEqual(V.validarEtapaSolicitacao(0, { servicoId: '' }), { servicoId: 'Escolha um serviço.' });
    assert.equal(V.validarEtapaSolicitacao(1, { ...base, equipTipo: ' ' }).equipTipo, 'Informe o tipo do equipamento.');
    assert.equal(V.validarEtapaSolicitacao(1, { ...base, equipamentoModo: 'salvo', equipamentoId: '' }).equipamentoId, 'Escolha um equipamento cadastrado.');
    assert.deepEqual(Object.keys(V.validarEtapaSolicitacao(2, { ...base, bairro: '', cidade: '' })), ['bairro', 'cidade']);
    assert.equal(V.validarEtapaSolicitacao(2, { ...base, localModo: 'salvo', enderecoId: '' }).enderecoId, 'Escolha um endereço salvo.');
    assert.match(V.validarEtapaSolicitacao(3, { ...base, descricao: 'curta' }).descricao, /15 caracteres/);
    assert.match(V.validarEtapaSolicitacao(3, { ...base, descricao: 'x'.repeat(601) }).descricao, /600/);
    assert.match(V.validarEtapaSolicitacao(4, { ...base, inicio: '' }).inicio, /Enviar sem horário definido/);
    assert.match(V.validarEtapaSolicitacao(4, base, { horarioLivre: () => false }).inicio, /não está mais disponível/);
    assert.deepEqual(V.validarEtapaSolicitacao(4, { ...base, semHorario: true, inicio: '' }), {});
  });
  test('resumo de erros informa a etapa de cada campo', () => {
    const r = V.validarSolicitacao({ ...base, bairro: '', descricao: '' });
    assert.equal(r.ok, false);
    assert.equal(r.etapaDoCampo.bairro, 2);
    assert.equal(r.etapaDoCampo.descricao, 3);
    assert.equal(V.ETAPAS_SOLICITACAO.length, 6);
  });
});

describe('Validações de cadastro, bloqueio, proposta e artigo', () => {
  test('e-mails de demonstração devem usar exemplo.invalid', () => {
    assert.equal(V.validarEmailDemo('ana.demo@exemplo.invalid'), null);
    assert.match(V.validarEmailDemo('ana@gmail.com'), /exemplo\.invalid/);
    assert.equal(V.validarEmailDemo(''), 'Informe o e-mail.');
    assert.equal(V.validarEmailDemo('sem-arroba'), 'Informe um e-mail válido.');
  });
  test('telefone, CNPJ (apenas formato) e cadastro completo', () => {
    assert.equal(V.validarTelefone('(65) 90000-0000'), null);
    assert.equal(V.validarTelefone(''), null);
    assert.equal(V.validarTelefone('', true), 'Informe o telefone.');
    assert.match(V.validarTelefone('123'), /DDD/);
    assert.equal(V.validarCnpjFormato('00.000.000/0000-00'), null);
    assert.match(V.validarCnpjFormato('123'), /formato/);
    assert.equal(V.validarCnpjFormato(''), 'Informe o CNPJ.');
    const ok = V.validarCadastro({ tipo: 'cliente', nome: 'Ana', email: 'a@exemplo.invalid', telefone: '65900000000', senha: '12345678', termos: true });
    assert.deepEqual(ok, {});
    const e = V.validarCadastro({ tipo: 'empresa', nome: '', email: 'x', telefone: '', senha: '1', termos: false });
    assert.deepEqual(Object.keys(e).sort(), ['cidade', 'cnpj', 'email', 'empresaNome', 'nome', 'senha', 'telefone', 'termos'].sort());
    assert.equal(e.nome, 'Informe o nome do responsável.');
    assert.equal(V.validarCadastro({ tipo: 'cliente' }).nome, 'Informe seu nome.');
  });
  test('justificativa mínima de 10 caracteres', () => {
    assert.equal(V.validarJustificativa('Análise concluída'), null);
    assert.match(V.validarJustificativa('curta'), /mínimo de 10/);
    assert.match(V.validarJustificativa(null, 3), /mínimo de 3/);
  });
  test('bloqueio exige fim depois do início e motivo', () => {
    assert.deepEqual(V.validarBloqueio({ diaInteiro: false, inicio: '13:00', fim: '15:00', motivo: 'Veículo' }), {});
    assert.deepEqual(Object.keys(V.validarBloqueio({ diaInteiro: false, inicio: '15:00', fim: '13:00', motivo: '' })), ['fim', 'motivo']);
    assert.deepEqual(V.validarBloqueio({ diaInteiro: true, inicio: '15:00', fim: '13:00', motivo: 'Folga' }), {});
  });
  test('proposta: profissional, itens, horário futuro e validade anterior ao horário', () => {
    const inicio = AGORA + 50 * 3600000;
    const itens = [{ descricao: 'Manutenção', valorCentavos: 22000 }];
    assert.deepEqual(V.validarProposta({ itens, inicio, validadeEm: AGORA + 48 * 3600000, agora: AGORA, profissionalId: 'p' }), {});
    assert.ok(V.validarProposta({ itens, inicio, validadeEm: AGORA + 72 * 3600000, agora: AGORA, profissionalId: 'p' }).validade);
    assert.ok(V.validarProposta({ itens: [], inicio: null, validadeEm: 0, agora: AGORA, profissionalId: '' }).profissionalId);
    assert.ok(V.validarProposta({ itens: [{ descricao: '' }], inicio, validadeEm: 0, agora: AGORA, profissionalId: 'p' }).itens);
    assert.match(V.validarProposta({ itens: [{ descricao: 'X', valorInvalido: true }], inicio, validadeEm: 0, agora: AGORA, profissionalId: 'p' }).itens, /Revise/);
    assert.ok(V.validarProposta({ itens, inicio: AGORA - 1, validadeEm: 0, agora: AGORA, profissionalId: 'p' }).inicio);
    assert.ok(V.validarProposta({ itens, inicio: null, validadeEm: 0, agora: AGORA, profissionalId: 'p' }).inicio);
  });
  test('artigo: título, resumo e passos obrigatórios para publicar', () => {
    assert.deepEqual(V.validarArtigo({ titulo: 'T', resumo: 'R', passos: ['p'] }), []);
    assert.equal(V.validarArtigo({ titulo: '', resumo: '', passos: [' '] }).length, 3);
    assert.equal(V.validarArtigo({ titulo: 'T', resumo: 'R' }).length, 1);
  });
  test('minimização de dados: e-mail mascarado, iniciais e nome curto', () => {
    assert.equal(V.mascararEmail('marina.demo@exemplo.invalid'), 'ma•••@exemplo.invalid');
    assert.equal(V.mascararEmail('invalido'), '—');
    assert.equal(V.iniciais('Ana Ribeiro'), 'AR');
    assert.equal(V.iniciais(''), '?');
    assert.equal(V.iniciais('Mercado Bom Preço (fictício)'), 'MB');
    assert.equal(V.nomeCurto('Marina Duarte'), 'Marina D.');
    assert.equal(V.nomeCurto('Ana'), 'Ana');
    assert.equal(V.nomeCurto(''), '');
  });
});

describe('Valores e preços', () => {
  test('formata e lê moeda brasileira', () => {
    assert.equal(M.formatarMoeda(22000), 'R$ 220,00');
    assert.equal(M.formatarMoeda(118050), 'R$ 1.180,50');
    assert.equal(M.lerMoeda('1.180,50'), 118050);
    assert.equal(M.lerMoeda('220'), 22000);
    assert.equal(M.lerMoeda('R$ 35,5'), 3550);
    assert.equal(M.lerMoeda(''), null);
    assert.equal(M.lerMoeda(null), null);
    assert.equal(M.lerMoeda('abc'), null);
    assert.equal(M.centavosParaCampo(3550), '35,50');
    assert.equal(M.centavosParaCampo(null), '');
  });
  test('rótulos de preço deixam claro o tipo', () => {
    assert.equal(M.rotuloPreco({ tipoPreco: 'fixo', precoCentavos: 18000 }), 'R$ 180,00');
    assert.equal(M.rotuloPreco({ tipoPreco: 'a_partir', precoCentavos: 45000 }), 'A partir de R$ 450,00');
    assert.equal(M.rotuloPreco({ tipoPreco: 'orcamento' }), 'Sob orçamento');
    assert.match(M.explicacaoPreco({ tipoPreco: 'a_partir', precoCentavos: 45000 }), /não é o valor final/);
    assert.match(M.explicacaoPreco({ tipoPreco: 'orcamento' }), /definido na proposta/);
    assert.equal(M.explicacaoPreco({ tipoPreco: 'fixo', precoCentavos: 18000 }), 'Preço fixo · R$ 180,00');
  });
  test('total da proposta com itens opcionais e a definir', () => {
    const itens = [{ descricao: 'Manutenção', valorCentavos: 22000 }, { descricao: 'Filtro, se necessário', valorCentavos: 3500, opcional: true }];
    assert.deepEqual(M.totalProposta(itens), { min: 22000, max: 25500, aDefinir: false });
    assert.equal(M.rotuloTotal(itens), 'R$ 220,00 a R$ 255,00');
    assert.equal(M.rotuloTotal([{ valorCentavos: 9000 }]), 'R$ 90,00');
    assert.equal(M.rotuloTotal([{ valorCentavos: 9000 }, { valorCentavos: null }]), 'R$ 90,00 + itens a definir após avaliação');
    assert.equal(M.rotuloTotal([]), 'A definir');
  });
});

describe('Concorrência: versão de registro e idempotência', () => {
  test('conflito de versão quando o registro mudou', () => {
    assert.equal(verificarVersao({ v: 3 }, 3), null);
    assert.equal(verificarVersao({ v: 3 }, null), null);
    const c = verificarVersao({ v: 4 }, 3);
    assert.equal(c.code, CONFLITO);
    assert.match(c.message, /Nada foi gravado/);
    assert.equal(verificarVersao(null, 1).code, 'NAO_ENCONTRADO');
  });
  test('detecta versões alteradas entre leitura e gravação', () => {
    assert.deepEqual(versoesAlteradas({ 'a/1': 1, 'b/2': 5 }, { 'a/1': 1, 'b/2': 6 }), ['b/2']);
    assert.deepEqual(versoesAlteradas({ 'a/1': 1 }, { 'a/1': 1 }), []);
  });
  test('a mesma chave devolve o mesmo resultado sem duplicar', () => {
    let reg = {};
    assert.equal(buscarIdempotente(reg, 'k1', AGORA), null);
    reg = registrarIdempotente(reg, 'k1', { ok: true, data: { id: 'SOL-1' } }, AGORA);
    assert.deepEqual(buscarIdempotente(reg, 'k1', AGORA + 1000), { ok: true, data: { id: 'SOL-1' } });
    assert.equal(buscarIdempotente(reg, null, AGORA), null);
    assert.equal(buscarIdempotente(reg, 'k1', AGORA + 49 * 3600000), null, 'chave vencida');
    const limpo = registrarIdempotente(reg, 'k2', { ok: true }, AGORA + 49 * 3600000);
    assert.deepEqual(Object.keys(limpo), ['k2']);
    assert.deepEqual(Object.keys(registrarIdempotente(reg, null, null, AGORA)), ['k1']);
  });
});
