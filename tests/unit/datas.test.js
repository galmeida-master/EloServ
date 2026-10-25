import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../src/domain/datas.js';

describe('Fuso horário e formatação pt-BR', () => {
  test('converte horário local de Cuiabá (UTC−4) para UTC', () => {
    const ms = D.paraUtc('2026-10-28', '13:30', 'America/Cuiaba');
    assert.equal(new Date(ms).toISOString(), '2026-10-28T17:30:00.000Z');
  });

  test('converte horário local de São Paulo (UTC−3) para UTC', () => {
    const ms = D.paraUtc('2026-10-28', '13:30', 'America/Sao_Paulo');
    assert.equal(new Date(ms).toISOString(), '2026-10-28T16:30:00.000Z');
  });

  test('o mesmo instante é exibido de forma diferente em cada fuso', () => {
    const instante = '2026-10-28T17:30:00.000Z';
    assert.equal(D.horaLocal(instante, 'America/Cuiaba'), '13:30');
    assert.equal(D.horaLocal(instante, 'America/Sao_Paulo'), '14:30');
    assert.equal(D.dataLocal('2026-10-28T03:30:00.000Z', 'America/Cuiaba'), '2026-10-27');
    assert.equal(D.dataLocal('2026-10-28T03:30:00.000Z', 'America/Sao_Paulo'), '2026-10-28');
  });

  test('ida e volta UTC ↔ local preserva data e hora', () => {
    for (const fuso of ['America/Cuiaba', 'America/Sao_Paulo', 'America/Campo_Grande']) {
      const ms = D.paraUtc('2026-12-31', '23:30', fuso);
      assert.equal(D.dataLocal(ms, fuso), '2026-12-31');
      assert.equal(D.horaLocal(ms, fuso), '23:30');
      assert.equal(D.minutosLocal(ms, fuso), 23 * 60 + 30);
    }
  });

  test('deslocamento do fuso e rótulos UTC', () => {
    assert.equal(D.deslocamentoMin('2026-10-28T12:00:00Z', 'America/Cuiaba'), -240);
    assert.equal(D.deslocamentoMin('2026-10-28T12:00:00Z', 'America/Sao_Paulo'), -180);
    assert.equal(D.rotuloUtc('America/Cuiaba', Date.parse('2026-10-28T12:00:00Z')), 'UTC−4');
    assert.equal(D.rotuloUtc('UTC', 0), 'UTC+0');
    assert.equal(D.rotuloUtc('Asia/Kolkata', 0), 'UTC+5:30');
    assert.equal(D.rotuloFuso('America/Cuiaba', 0), 'Horário de Cuiabá (UTC−4)');
    assert.equal(D.rotuloFuso('America/Sao_Paulo', 0), 'Horário de Brasília (UTC−3)');
    assert.match(D.rotuloFuso('Europe/Lisbon', 0), /^Horário de Europe\/Lisbon/);
  });

  test('formatos brasileiros dd/mm/aaaa e relógio de 24 horas', () => {
    const ms = D.paraUtc('2026-10-28', '13:30', 'America/Cuiaba');
    assert.equal(D.formatarData(ms, 'America/Cuiaba'), '28/10/2026');
    assert.equal(D.formatarDataCurta(ms, 'America/Cuiaba'), '28/10');
    assert.equal(D.formatarDataHora(ms, 'America/Cuiaba'), 'Qua, 28/10/2026 · 13:30');
    assert.equal(D.formatarIntervalo(ms, ms + 2 * D.HORA, 'America/Cuiaba'), 'Qua, 28/10/2026 · 13:30–15:30');
    assert.equal(D.formatarPrazo(ms, 'America/Cuiaba'), '28/10/2026, 13:30');
    assert.equal(D.formatarRegistro(new Date(ms), 'America/Cuiaba'), '28/10/2026 · 13:30');
    assert.equal(D.dataBr('2026-01-05'), '05/01/2026');
    assert.equal(D.isoUtc(ms), '2026-10-28T17:30:00.000Z');
  });

  test('aritmética de calendário e rótulos de dia/mês', () => {
    assert.equal(D.somarDias('2026-10-31', 1), '2026-11-01');
    assert.equal(D.somarDias('2026-01-01', -1), '2025-12-31');
    assert.equal(D.diaSemanaData('2026-10-26'), 1);
    assert.equal(D.somarMeses('2026-10-24', 6), '2027-04');
    assert.equal(D.rotuloMes('2027-04'), 'abril de 2027');
    assert.deepEqual(D.rotuloDia('2026-10-26'), { curto: 'Seg', dataCurta: '26/10', completo: 'Seg, 26/10/2026', longo: 'segunda-feira, 26/10/2026' });
    assert.equal(D.hmParaMin('07:30'), 450);
    assert.equal(D.minParaHm(450), '07:30');
  });

  test('próximos dias e dias úteis', () => {
    assert.deepEqual(D.proximosDiasUteis('2026-10-24', 5), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    assert.deepEqual(D.proximosDiasUteis('2026-10-30', 2, ['2026-11-02']), ['2026-11-03', '2026-11-04']);
    assert.deepEqual(D.proximosDias('2026-10-24', 3), ['2026-10-26', '2026-10-27', '2026-10-28']);
    assert.deepEqual(D.proximosDias('2026-10-24', 2, { pularDomingo: false }), ['2026-10-25', '2026-10-26']);
  });

  test('emMs aceita número, Date e ISO', () => {
    assert.equal(D.emMs(5), 5);
    assert.equal(D.emMs(new Date(10)), 10);
    assert.equal(D.emMs('1970-01-01T00:00:00.020Z'), 20);
  });
});
