import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MAQUINAS, podeTransitar, transitar, verificarRelacoes, rotulo, estadoOcupacaoExibicao, ESTADOS_INICIAIS } from '../../src/domain/estados.js';

const TODOS = m => Object.keys(MAQUINAS[m]);

describe('Máquinas de estado', () => {
  for (const maquina of Object.keys(MAQUINAS)) {
    test(`${maquina}: todas as transições válidas são aceitas`, () => {
      for (const [de, paras] of Object.entries(MAQUINAS[maquina])) {
        for (const para of paras) {
          assert.equal(podeTransitar(maquina, de, para), true, `${de} → ${para}`);
          assert.deepEqual(transitar(maquina, de, para), { ok: true, estado: para });
        }
      }
    });
    test(`${maquina}: transições inválidas são rejeitadas`, () => {
      for (const de of TODOS(maquina)) {
        for (const para of TODOS(maquina)) {
          if (MAQUINAS[maquina][de].includes(para)) continue;
          assert.equal(podeTransitar(maquina, de, para), false, `${de} → ${para}`);
          const r = transitar(maquina, de, para);
          assert.equal(r.ok, false);
          assert.equal(r.code, 'TRANSICAO_INVALIDA');
          assert.match(r.message, /Não é possível passar de/);
        }
      }
    });
    test(`${maquina}: estados iniciais`, () => {
      for (const ini of ESTADOS_INICIAIS[maquina]) assert.equal(podeTransitar(maquina, null, ini), true);
      const naoInicial = TODOS(maquina).find(e => !ESTADOS_INICIAIS[maquina].includes(e));
      assert.equal(podeTransitar(maquina, null, naoInicial), false);
    });
  }

  test('casos de negócio explícitos', () => {
    assert.equal(podeTransitar('solicitacao', 'proposta', 'aceita'), true);
    assert.equal(podeTransitar('solicitacao', 'enviada', 'aceita'), false, 'não aceita sem proposta');
    assert.equal(podeTransitar('solicitacao', 'expirada', 'aceita'), false, 'proposta expirada não pode ser confirmada');
    assert.equal(podeTransitar('solicitacao', 'expirada', 'enviada'), true, 'pedir nova proposta');
    assert.equal(podeTransitar('ocupacao', 'liberada', 'confirmada'), false);
    assert.equal(podeTransitar('execucao', 'agendada', 'concluida'), false, 'precisa passar pela execução');
    assert.equal(podeTransitar('execucao', 'concluida', 'cancelada'), false);
    assert.equal(podeTransitar('desconhecida', 'a', 'b'), false);
  });
});

describe('Relações entre as dimensões', () => {
  test('aceita exige ocupação confirmada e execução', () => {
    assert.deepEqual(verificarRelacoes({ solicitacao: { estado: 'aceita' }, ocupacao: { estado: 'confirmada' }, execucao: { estado: 'agendada' } }), []);
    const v = verificarRelacoes({ solicitacao: { estado: 'aceita' }, ocupacao: { estado: 'temporaria' }, execucao: null });
    assert.equal(v.length, 2);
  });
  test('não existe execução antes da aceitação', () => {
    const v = verificarRelacoes({ solicitacao: { estado: 'proposta' }, ocupacao: { estado: 'temporaria' }, execucao: { estado: 'agendada' } });
    assert.ok(v.some(x => x.includes('sem solicitação aceita')));
  });
  test('recusada, cancelada e expirada implicam ocupação liberada', () => {
    for (const estado of ['recusada', 'cancelada', 'expirada']) {
      assert.deepEqual(verificarRelacoes({ solicitacao: { estado }, ocupacao: { estado: 'liberada' } }), []);
      assert.equal(verificarRelacoes({ solicitacao: { estado }, ocupacao: { estado: 'temporaria' } }).length, 1);
    }
    assert.deepEqual(verificarRelacoes({ solicitacao: { estado: 'cancelada' }, ocupacao: { estado: 'liberada' }, execucao: { estado: 'cancelada' } }), []);
  });
  test('bloqueio interno é ocupação sem solicitação', () => {
    assert.deepEqual(verificarRelacoes({ ocupacao: { estado: 'bloqueio' } }), []);
    assert.ok(verificarRelacoes({ solicitacao: { estado: 'enviada' }, ocupacao: { estado: 'bloqueio' } }).length >= 1);
  });
  test('ocupação confirmada com solicitação não aceita é incoerente', () => {
    assert.ok(verificarRelacoes({ solicitacao: { estado: 'proposta' }, ocupacao: { estado: 'confirmada' } }).length >= 1);
    assert.deepEqual(verificarRelacoes({ ocupacao: { estado: 'confirmada' }, execucao: null }), []);
  });
});

describe('Rótulos de status', () => {
  test('todo status tem texto, ícone e tom', () => {
    for (const m of ['solicitacao', 'ocupacao', 'execucao']) {
      for (const e of TODOS(m)) {
        const r = rotulo(m, e);
        assert.ok(r.label && r.icon && r.tom, `${m}.${e}`);
      }
    }
    assert.equal(rotulo('empresa', 'aguardando').label, 'Aguardando habilitação');
    assert.equal(rotulo('registro', 'convite').label, 'Convite pendente');
    assert.equal(rotulo('x', 'y').label, 'y');
    assert.equal(rotulo('x', null).label, '—');
  });
  test('ocupação ausente é exibida como “Sem horário reservado”', () => {
    assert.equal(estadoOcupacaoExibicao(null), 'sem_horario');
    assert.equal(estadoOcupacaoExibicao({ estado: 'confirmada' }), 'confirmada');
    assert.equal(rotulo('ocupacao', 'sem_horario').label, 'Sem horário reservado');
  });
});
