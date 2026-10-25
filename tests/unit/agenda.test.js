import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../src/domain/agenda.js';
import { HORA, MINUTO } from '../../src/domain/datas.js';
import { AGORA, SEG, TER, SAB, at, empresa, prof, ocup, SERV_HIG, SERV_PREV, SERV_INST } from './fixtures.js';

const verificar = (p, ini, fim, ocupacoes = [], extra = {}) => A.verificarProfissional({
  profissional: p, empresa: extra.empresa || empresa(), servico: 'servico' in extra ? extra.servico : SERV_PREV,
  inicio: at(SEG, ini), fim: at(SEG, fim), ocupacoes, agora: extra.agora ?? AGORA, ignorar: extra.ignorar
});

describe('Sobreposição de intervalos', () => {
  test('fim igual ao início não sobrepõe (borda)', () => {
    assert.equal(A.sobrepoe(0, 10, 10, 20), false);
    assert.equal(A.sobrepoe(10, 20, 0, 10), false);
    assert.equal(A.sobrepoe(0, 11, 10, 20), true);
  });
  test('tempo de preparo transforma a borda em conflito', () => {
    assert.equal(A.sobrepoe(0, 10, 10, 20, 5), true);
    assert.equal(A.sobrepoe(0, 10, 15, 20, 5), false);
  });
  test('temporária válida e confirmada ocupam; liberada e temporária vencida não', () => {
    assert.equal(A.ocupacaoAtiva({ estado: 'confirmada' }, AGORA), true);
    assert.equal(A.ocupacaoAtiva({ estado: 'bloqueio' }, AGORA), true);
    assert.equal(A.ocupacaoAtiva({ estado: 'temporaria', expiraEm: new Date(AGORA + HORA).toISOString() }, AGORA), true);
    assert.equal(A.ocupacaoAtiva({ estado: 'temporaria' }, AGORA), true);
    assert.equal(A.ocupacaoAtiva({ estado: 'temporaria', expiraEm: new Date(AGORA - 1).toISOString() }, AGORA), false);
    assert.equal(A.ocupacaoAtiva({ estado: 'liberada' }, AGORA), false);
  });
});

describe('Verificação de disponibilidade do profissional', () => {
  const carlos = prof('carlos', ['prev', 'hig', 'inst']);

  test('livre dentro da jornada', () => {
    assert.deepEqual(verificar(carlos, '08:00', '10:00'), { livre: true });
  });
  test('fora da jornada (antes do início ou depois do fim)', () => {
    assert.equal(verificar(carlos, '07:00', '09:00').motivo, 'FORA_DA_JORNADA');
    assert.equal(verificar(carlos, '16:00', '18:00').motivo, 'FORA_DA_JORNADA');
    assert.equal(verificar(carlos, '15:30', '17:30').livre, true);
  });
  test('intervalo de almoço não aceita atendimento', () => {
    assert.equal(verificar(carlos, '11:00', '13:00').motivo, 'INTERVALO');
    assert.equal(verificar(carlos, '10:00', '12:00').livre, true);
    assert.equal(verificar(carlos, '13:00', '15:00').livre, true);
  });
  test('dia fora da jornada (sábado) e folga individual', () => {
    const r = A.verificarProfissional({ profissional: carlos, empresa: empresa(), servico: SERV_PREV, inicio: at(SAB, '08:00'), fim: at(SAB, '10:00'), ocupacoes: [], agora: AGORA });
    assert.equal(r.motivo, 'FORA_DA_JORNADA');
    const folguista = prof('rafael', ['prev'], { folgas: [SEG] });
    assert.equal(verificar(folguista, '08:00', '10:00').motivo, 'FOLGA');
  });
  test('feriado fechado e feriado com atendimento parcial', () => {
    const fechado = empresa({ feriados: [{ data: SEG, tipo: 'fechado', descricao: 'Feriado' }] });
    assert.equal(verificar(carlos, '08:00', '10:00', [], { empresa: fechado }).motivo, 'FERIADO');
    const parcial = empresa({ feriados: [{ data: SEG, tipo: 'parcial', ate: '12:00' }] });
    assert.equal(verificar(carlos, '09:00', '11:00', [], { empresa: parcial }).livre, true);
    assert.equal(verificar(carlos, '13:00', '15:00', [], { empresa: parcial }).motivo, 'FORA_DA_JORNADA');
  });
  test('elegibilidade por serviço', () => {
    const juliana = prof('juliana', ['hig']);
    assert.equal(verificar(juliana, '08:00', '10:00').motivo, 'NAO_EXECUTA');
    assert.equal(verificar(juliana, '08:00', '09:30', [], { servico: SERV_HIG }).livre, true);
    assert.equal(verificar(juliana, '08:00', '09:30', [], { servico: null }).livre, true);
  });
  test('profissional suspenso, revogado ou convidado não atende', () => {
    for (const situacao of ['suspenso', 'revogado', 'convite']) {
      assert.equal(verificar(prof('x', ['prev'], { situacao }), '08:00', '10:00').motivo, 'PROFISSIONAL_INDISPONIVEL');
    }
  });
  test('horário no passado não é aceito', () => {
    assert.equal(verificar(carlos, '08:00', '10:00', [], { agora: at(SEG, '09:00') }).motivo, 'NO_PASSADO');
  });
  test('atendimento que cruza a meia-noite é recusado', () => {
    const r = A.verificarProfissional({ profissional: carlos, empresa: empresa(), servico: null, inicio: at(SEG, '23:00'), fim: at(TER, '01:00'), ocupacoes: [], agora: AGORA });
    assert.equal(r.motivo, 'FORA_DA_JORNADA');
  });
  test('bloqueio interno usa sobreposição simples (sem preparo)', () => {
    const blq = ocup('carlos', SEG, '10:00', '12:00', 'bloqueio');
    assert.equal(verificar(carlos, '09:00', '11:00', [blq]).motivo, 'BLOQUEIO');
    assert.equal(verificar(carlos, '08:00', '10:00', [blq]).livre, true);
  });
  test('atendimentos consideram o tempo de preparo/deslocamento', () => {
    const conf = ocup('carlos', SEG, '08:00', '09:30');
    const r = verificar(carlos, '09:30', '11:30', [conf]);
    assert.equal(r.livre, false);
    assert.equal(r.motivo, 'PREPARO');
    assert.equal(verificar(carlos, '10:00', '12:00', [conf]).livre, true);
    assert.equal(verificar(carlos, '09:00', '11:00', [conf]).motivo, 'OCUPADO');
  });
  test('sem preparo configurado, fim = início é permitido', () => {
    const conf = ocup('carlos', SEG, '08:00', '09:30');
    assert.equal(verificar(carlos, '09:30', '11:30', [conf], { empresa: empresa({ preparoMin: 0 }) }).livre, true);
  });
  test('temporária ocupa como a confirmada; liberada não ocupa', () => {
    const temp = ocup('carlos', SEG, '13:30', '15:30', 'temporaria', { expiraEm: new Date(AGORA + 24 * HORA).toISOString() });
    assert.equal(verificar(carlos, '14:00', '16:00', [temp]).motivo, 'OCUPADO');
    const lib = { ...temp, estado: 'liberada' };
    assert.equal(verificar(carlos, '14:00', '16:00', [lib]).livre, true);
  });
  test('ocupações de outro profissional ou ignoradas não contam', () => {
    const outra = ocup('juliana', SEG, '08:00', '10:00');
    assert.equal(verificar(carlos, '08:00', '10:00', [outra]).livre, true);
    const propria = ocup('carlos', SEG, '08:00', '10:00');
    assert.equal(verificar(carlos, '08:00', '10:00', [propria], { ignorar: [propria.id] }).livre, true);
  });
  test('usa a jornada padrão da empresa quando o profissional não tem jornada própria', () => {
    const p = prof('p', ['prev'], { jornada: null });
    assert.equal(verificar(p, '08:00', '10:00').livre, true);
    const semJornada = empresa({ jornadaPadrao: null });
    assert.equal(verificar(p, '08:00', '10:00', [], { empresa: semJornada }).motivo, 'FORA_DA_JORNADA');
  });
});

describe('Horários do dia e capacidade da empresa', () => {
  const carlos = prof('carlos', ['prev', 'hig']);
  const juliana = prof('juliana', ['prev']);

  test('profissionais em paralelo: a vaga existe enquanto houver um elegível livre', () => {
    const ocupacoes = [ocup('carlos', SEG, '08:00', '10:00')];
    const slots = A.horariosDoDia({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos, juliana], ocupacoes, data: SEG, agora: AGORA });
    const s8 = slots.find(s => s.hora === '08:00');
    assert.equal(s8.livre, true);
    assert.deepEqual(s8.profissionalIds, ['juliana']);
  });
  test('ausência de vaga quando todos os elegíveis estão ocupados', () => {
    const ocupacoes = [ocup('carlos', SEG, '08:00', '10:00'), ocup('juliana', SEG, '08:00', '10:00')];
    const slots = A.horariosDoDia({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos, juliana], ocupacoes, data: SEG, agora: AGORA });
    assert.equal(slots.find(s => s.hora === '08:00').livre, false);
    assert.equal(slots.find(s => s.hora === '07:30').livre, false);
    assert.equal(slots.find(s => s.hora === '10:00').livre, false, 'preparo de 30 min após o atendimento das 08:00–10:00');
    assert.equal(slots.find(s => s.hora === '13:00').livre, true);
  });
  test('horários respeitam duração do serviço e intervalo', () => {
    const slots = A.horariosDoDia({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos], ocupacoes: [], data: SEG, agora: AGORA });
    assert.equal(slots[0].hora, '07:30');
    assert.equal(slots.at(-1).hora, '15:30');
    assert.equal(slots.find(s => s.hora === '11:00').livre, false);
    assert.equal(slots.find(s => s.hora === '13:00').livre, true);
  });
  test('dia sem nenhum profissional elegível trabalhando não tem horários', () => {
    assert.deepEqual(A.horariosDoDia({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos], ocupacoes: [], data: SAB, agora: AGORA }), []);
    assert.deepEqual(A.horariosDoDia({ empresa: empresa(), servico: SERV_INST, profissionais: [carlos], ocupacoes: [], data: SEG, agora: AGORA }), []);
  });
  test('escolhe o profissional preferido ou o menos carregado', () => {
    const base = { empresa: empresa(), servico: SERV_PREV, profissionais: [carlos, juliana], agora: AGORA, inicio: at(SEG, '13:30') };
    const ocupacoes = [ocup('carlos', SEG, '08:00', '09:30')];
    assert.equal(A.escolherProfissional({ ...base, ocupacoes }).id, 'juliana');
    assert.equal(A.escolherProfissional({ ...base, ocupacoes, preferidoId: 'carlos' }).id, 'carlos');
    assert.equal(A.escolherProfissional({ ...base, ocupacoes: [] }).id, 'carlos');
    const cheio = [ocup('carlos', SEG, '13:30', '15:30'), ocup('juliana', SEG, '13:30', '15:30')];
    assert.equal(A.escolherProfissional({ ...base, ocupacoes: cheio }), null);
  });
  test('disponibilidade por profissional mostra motivos e a união exibida ao cliente', () => {
    const rafael = prof('rafael', ['prev'], { folgas: [SEG] });
    const bruno = prof('bruno', ['prev'], { situacao: 'convite' });
    const lotada = prof('lotada', ['prev']);
    const ocupacoes = [ocup('lotada', SEG, '07:30', '17:30', 'bloqueio')];
    const r = A.disponibilidadePorProfissional({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos, juliana, rafael, bruno, lotada, prof('ana', ['hig'])], ocupacoes, data: SEG, agora: AGORA });
    const por = Object.fromEntries(r.linhas.map(l => [l.profissional.id, l]));
    assert.equal(por.carlos.estado, 'disponivel');
    assert.equal(por.rafael.estado, 'indisponivel');
    assert.equal(por.rafael.motivo, 'FOLGA');
    assert.equal(por.lotada.estado, 'sem_horarios');
    assert.equal(por.ana.estado, 'nao_executa');
    assert.equal(por.bruno, undefined);
    assert.ok(r.uniao.includes('07:30'));
    assert.deepEqual(r.uniao, [...r.uniao].sort());
  });
});

describe('Bloqueios: conflitos, janelas livres e sugestões', () => {
  const carlos = prof('carlos', ['prev']);
  const ocupacoes = [
    ocup('carlos', SEG, '08:00', '09:30'),
    ocup('carlos', SEG, '13:30', '15:30', 'temporaria', { expiraEm: new Date(AGORA + 30 * HORA).toISOString() }),
    ocup('carlos', SEG, '16:00', '17:00', 'liberada'),
    ocup('juliana', SEG, '13:00', '15:00')
  ];

  test('bloqueio sobreposto a atendimento lista os afetados (temporários e confirmados)', () => {
    const c = A.conflitosDoBloqueio({ profissionalId: 'carlos', inicio: at(SEG, '13:00'), fim: at(SEG, '15:00'), ocupacoes, agora: AGORA });
    assert.equal(c.length, 1);
    assert.equal(c[0].estado, 'temporaria');
    const nenhum = A.conflitosDoBloqueio({ profissionalId: 'carlos', inicio: at(SEG, '09:30'), fim: at(SEG, '11:30'), ocupacoes, agora: AGORA });
    assert.equal(nenhum.length, 0);
  });
  test('janelas livres descontam intervalo e ocupações ativas', () => {
    const j = A.janelasLivres({ profissional: carlos, empresa: empresa(), data: SEG, ocupacoes, agora: AGORA });
    const fmt = j.map(([a, b]) => [new Date(a).toISOString().slice(11, 16), new Date(b).toISOString().slice(11, 16)]);
    // UTC = local + 4 h
    assert.deepEqual(fmt, [['11:30', '12:00'], ['13:30', '16:00'], ['17:00', '17:30'], ['19:30', '21:30']]);
    assert.deepEqual(A.janelasLivres({ profissional: carlos, empresa: empresa(), data: SAB, ocupacoes, agora: AGORA }), []);
  });
  test('sugere períodos livres com a duração desejada', () => {
    const s = A.sugerirJanelasBloqueio({ profissional: carlos, empresa: empresa(), data: SEG, ocupacoes, agora: AGORA, duracaoMs: 2 * HORA });
    assert.equal(s.length, 2);
    assert.equal(s[0][0], at(SEG, '09:30'));
    assert.equal(s[0][1], at(SEG, '11:30'));
    assert.equal(s[1][0], at(SEG, '15:30'));
    assert.equal(s[1][1], at(SEG, '17:30'));
    const curto = A.sugerirJanelasBloqueio({ profissional: carlos, empresa: empresa(), data: SEG, ocupacoes, agora: AGORA, duracaoMs: 30 * MINUTO });
    assert.equal(curto.length, 3);
  });
});

describe('Alternativas de horário', () => {
  test('ordena por proximidade do desejado e devolve em ordem cronológica', () => {
    const carlos = prof('carlos', ['prev']);
    const desejado = at(SEG, '13:30');
    const ocupacoes = [ocup('carlos', SEG, '13:30', '15:30')];
    const alt = A.alternativasHorario({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos], ocupacoes, datas: [SEG, TER], agora: AGORA, desejado, limite: 3 });
    assert.equal(alt.length, 3);
    assert.ok(alt.every(a => a.livre));
    assert.ok(alt[0].inicio < alt[1].inicio);
    assert.ok(!alt.some(a => a.inicio === desejado));
    const semRef = A.alternativasHorario({ empresa: empresa(), servico: SERV_PREV, profissionais: [carlos], ocupacoes: [], datas: [SEG], agora: AGORA, excluir: [at(SEG, '07:30')] });
    assert.equal(semRef[0].hora, '08:00');
  });
  test('jornada do profissional e fim do serviço', () => {
    assert.equal(A.jornadaDe({ jornada: null }, { jornadaPadrao: 'x' }), 'x');
    assert.equal(A.fimDoServico(0, { duracaoMin: 90 }), 90 * MINUTO);
    assert.equal(A.profissionaisElegiveis([prof('a', ['prev']), prof('b', ['hig'])], 'prev').length, 1);
  });
});
