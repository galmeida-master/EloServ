import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/domain/reservas.js';
import { HORA } from '../../src/domain/datas.js';
import { AGORA } from './fixtures.js';

const iso = ms => new Date(ms).toISOString();

describe('Expiração de reserva temporária e de proposta', () => {
  const ocupacoes = [
    { id: 'o1', estado: 'temporaria', expiraEm: iso(AGORA - 1) },
    { id: 'o2', estado: 'temporaria', expiraEm: iso(AGORA + HORA) },
    { id: 'o3', estado: 'confirmada' },
    { id: 'o4', estado: 'temporaria', expiraEm: iso(AGORA + 5 * HORA) },
    { id: 'o5', estado: 'temporaria', expiraEm: iso(AGORA + 50 * HORA) },
    { id: 'o6', estado: 'confirmada' }
  ];
  const solicitacoes = [
    { id: 's1', estado: 'enviada', ocupacaoId: 'o1' },
    { id: 's2', estado: 'em_analise', ocupacaoId: 'o2' },
    { id: 's3', estado: 'proposta', ocupacaoId: 'o4', proposta: { validadeEm: iso(AGORA) } },
    { id: 's4', estado: 'aceita', ocupacaoId: 'o6', reagendamento: { ocupacaoId: 'o5', prazo: iso(AGORA - HORA) } },
    { id: 's5', estado: 'proposta', ocupacaoId: null, proposta: { validadeEm: iso(AGORA + HORA) } },
    { id: 's6', estado: 'enviada', ocupacaoId: null }
  ];

  test('reserva vencida é liberada e a solicitação sem proposta expira', () => {
    const r = R.calcularExpiracoes({ ocupacoes, solicitacoes }, AGORA);
    assert.ok(r.liberarOcupacoes.includes('o1'));
    assert.ok(!r.liberarOcupacoes.includes('o2'));
    assert.ok(!r.liberarOcupacoes.includes('o3'));
    assert.deepEqual(r.expirarSolicitacoes.find(x => x.id === 's1'), { id: 's1', motivo: 'reserva' });
    assert.ok(!r.expirarSolicitacoes.some(x => x.id === 's2'));
  });
  test('proposta vencida expira e libera o horário vinculado', () => {
    const r = R.calcularExpiracoes({ ocupacoes, solicitacoes }, AGORA);
    assert.deepEqual(r.expirarSolicitacoes.find(x => x.id === 's3'), { id: 's3', motivo: 'proposta' });
    assert.ok(r.liberarOcupacoes.includes('o4'));
    assert.ok(!r.expirarSolicitacoes.some(x => x.id === 's5'));
    assert.ok(!r.expirarSolicitacoes.some(x => x.id === 's6'));
  });
  test('pedido de reagendamento vencido libera apenas o novo horário (original mantido)', () => {
    const r = R.calcularExpiracoes({ ocupacoes, solicitacoes }, AGORA);
    assert.deepEqual(r.reagendamentosVencidos, ['s4']);
    assert.ok(r.liberarOcupacoes.includes('o5'));
    assert.ok(!r.liberarOcupacoes.includes('o6'));
  });
  test('convites vencidos e detecção de pendências', () => {
    const profissionais = [
      { id: 'p1', situacao: 'convite', conviteExpiraEm: iso(AGORA - 1) },
      { id: 'p2', situacao: 'convite', conviteExpiraEm: iso(AGORA + 1) },
      { id: 'p3', situacao: 'ativo' }
    ];
    const r = R.calcularExpiracoes({ ocupacoes: [], solicitacoes: [], profissionais }, AGORA);
    assert.deepEqual(r.convites, ['p1']);
    assert.equal(R.haExpiracoes(r), true);
    assert.equal(R.haExpiracoes(R.calcularExpiracoes({ ocupacoes: [], solicitacoes: [] }, AGORA)), false);
  });
  test('prazos de reserva e de reagendamento', () => {
    assert.equal(R.prazoReserva(AGORA, 24, null), AGORA + 24 * HORA);
    assert.equal(R.prazoReserva(AGORA, 24, iso(AGORA + 10 * HORA)), AGORA + 10 * HORA);
    assert.equal(R.prazoReagendamento(AGORA, iso(AGORA + 100 * HORA)), AGORA + 48 * HORA);
    assert.equal(R.prazoReagendamento(AGORA, iso(AGORA + 10 * HORA)), AGORA + 9 * HORA);
  });
});

describe('Reagendamento', () => {
  const sol = { estado: 'aceita', reagendamento: null };
  const os = { estado: 'agendada' };
  const novo = iso(AGORA + 72 * HORA);

  test('permitido apenas para atendimento confirmado, agendado e sem pedido pendente', () => {
    assert.equal(R.podeReagendar(sol, os, novo, AGORA).ok, true);
    assert.equal(R.podeReagendar({ estado: 'proposta' }, os, novo, AGORA).code, 'TRANSICAO_INVALIDA');
    assert.equal(R.podeReagendar(null, os, novo, AGORA).ok, false);
    assert.equal(R.podeReagendar(sol, { estado: 'execucao' }, novo, AGORA).code, 'TRANSICAO_INVALIDA');
    assert.equal(R.podeReagendar(sol, null, novo, AGORA).ok, false);
    assert.equal(R.podeReagendar({ ...sol, reagendamento: { prazo: novo } }, os, novo, AGORA).code, 'REAGENDAMENTO_PENDENTE');
    assert.equal(R.podeReagendar(sol, os, iso(AGORA - 1), AGORA).code, 'VALIDACAO');
    assert.equal(R.podeReagendar(sol, os, null, AGORA).code, 'VALIDACAO');
    assert.equal(R.podeReagendar(sol, os, iso(AGORA + HORA / 2), AGORA).code, 'VALIDACAO');
  });
  test('original preservado até a confirmação: aceito → novo confirmado e original liberado', () => {
    assert.deepEqual(R.resolverReagendamento({ original: { estado: 'confirmada' }, novo: {}, aceito: true, novoAindaValido: true }), { ok: true, original: 'liberada', novo: 'confirmada' });
  });
  test('recusa ou expiração mantêm o original', () => {
    assert.deepEqual(R.resolverReagendamento({ original: { estado: 'confirmada' }, novo: {}, aceito: false }), { ok: true, original: 'confirmada', novo: 'liberada' });
    const r = R.resolverReagendamento({ original: { estado: 'confirmada' }, novo: {}, aceito: true, novoAindaValido: false });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'HORARIO_INDISPONIVEL');
    assert.equal(r.original, 'confirmada');
  });
  test('política de cancelamento demonstrativa (12 h)', () => {
    assert.equal(R.avaliarCancelamento(iso(AGORA + 13 * HORA), AGORA).semCusto, true);
    assert.equal(R.avaliarCancelamento(iso(AGORA + 11 * HORA), AGORA).semCusto, false);
  });
});
