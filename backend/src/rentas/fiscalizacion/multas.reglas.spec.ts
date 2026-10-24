import { BaseMulta, MotivoDeclaracion, TipoPersona } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { esExtemporanea, montoMulta, ultimoDiaHabilDelMes, vencePlazoDJ } from './multas.reglas.js';

const sinFeriados = new Set<string>();
const i1761 = { base: BaseMulta.UIT, porcentajeNatural: 50, porcentajeJuridica: 100 };
const i1781 = { base: BaseMulta.TRIBUTO_OMITIDO, porcentajeNatural: 50, porcentajeJuridica: 50 };

describe('montoMulta', () => {
  it('176.1: 50 % UIT persona natural y sucesión, 1 UIT jurídica', () => {
    expect(montoMulta(i1761, TipoPersona.NATURAL, 5350).toFixed(2)).toBe('2675.00');
    expect(montoMulta(i1761, TipoPersona.SUCESION, 5350).toFixed(2)).toBe('2675.00');
    expect(montoMulta(i1761, TipoPersona.JURIDICA, 5350).toFixed(2)).toBe('5350.00');
  });

  it('178.1: 50 % del tributo omitido, redondeado a 2 decimales', () => {
    expect(montoMulta(i1781, TipoPersona.NATURAL, 5350, '333.33').toFixed(2)).toBe('166.67');
    expect(montoMulta(i1781, TipoPersona.NATURAL, 5350, 0).toFixed(2)).toBe('0.00');
  });
});

describe('plazo de la DJ (D.L. 776 art. 14)', () => {
  it('último día hábil del mes, saltando fin de semana y feriados', () => {
    expect(ultimoDiaHabilDelMes(2026, 10, sinFeriados)).toBe('2026-10-30'); // el 31 es sábado
    expect(ultimoDiaHabilDelMes(2026, 10, new Set(['2026-10-30']))).toBe('2026-10-29');
    expect(ultimoDiaHabilDelMes(2026, 11, sinFeriados)).toBe('2026-11-30');
  });

  it('compra o inscripción: hasta el último día hábil del mes siguiente', () => {
    expect(vencePlazoDJ(MotivoDeclaracion.COMPRA, '2026-09-15', sinFeriados)).toBe('2026-10-30');
    expect(vencePlazoDJ(MotivoDeclaracion.INSCRIPCION, '2026-12-03', sinFeriados)).toBe('2027-01-29'); // cruza el año
  });

  it('venta, rectificación, baja y fiscalización no tienen plazo sancionable aquí', () => {
    for (const m of [MotivoDeclaracion.VENTA, MotivoDeclaracion.RECTIFICACION, MotivoDeclaracion.BAJA, MotivoDeclaracion.FISCALIZACION]) {
      expect(vencePlazoDJ(m, '2026-01-10', sinFeriados)).toBeNull();
    }
  });

  it('extemporánea solo si se presentó después del vencimiento', () => {
    expect(esExtemporanea(MotivoDeclaracion.COMPRA, '2026-09-15', '2026-10-30', sinFeriados)).toBe(false);
    expect(esExtemporanea(MotivoDeclaracion.COMPRA, '2026-09-15', '2026-11-02', sinFeriados)).toBe(true);
    expect(esExtemporanea(MotivoDeclaracion.COMPRA, null, '2027-05-01', sinFeriados)).toBe(false);
  });
});
