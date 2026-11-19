import { BaseMulta, MotivoDeclaracion, TipoPersona } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { aplicarProrroga, esExtemporanea, montoMulta, plazoDjPresentada, superaCincoUit, ultimoDiaHabilDelMes, vencePlazoDJ, type VariacionDj } from './multas.reglas.js';

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

describe('plazo de la DJ presentada (J08)', () => {
  const sin = new Set<string>();
  it('adquisición: último día hábil del mes siguiente al primer hecho', () => {
    expect(plazoDjPresentada('COMPRA', ['2026-05-20', '2026-04-03'], 2026, sin)).toEqual({
      hecho: '2026-04-03',
      vence: '2026-05-29',
      venceOriginal: '2026-05-29',
      prorroga: null,
      cambio5Uit: false,
    });
    expect(plazoDjPresentada('VENTA', ['2025-12-10'], 2026, sin)?.vence).toBe('2026-01-30');
  });

  it('anual: último día hábil de febrero; otros motivos no tienen plazo aquí', () => {
    expect(plazoDjPresentada('ANUAL', [], 2026, sin)?.vence).toBe('2026-02-27');
    expect(plazoDjPresentada('MODIFICACION', ['2026-01-10'], 2026, sin)).toBeNull();
    expect(plazoDjPresentada('COMPRA', [null], 2026, sin)).toBeNull();
  });
});

describe('J08: modificación de más de 5 UIT (Fase 7)', () => {
  const sin = new Set<string>();
  const variacion = (cambio: string | null, uit: string | null = '5500.00'): VariacionDj => ({
    anio: 2026,
    hecho: '2026-03-15',
    uit,
    limite: uit ? String(Number(uit) * 5) : null,
    predios: [{ predioId: 1, antes: '100000.00', despues: null, cambio }],
    supera: superaCincoUit([{ predioId: 1, antes: '100000.00', despues: null, cambio }], uit),
  });

  it('cuenta el cambio de cada predio, suba o baje, contra 5 UIT del año', () => {
    expect(superaCincoUit([{ predioId: 1, antes: '0', despues: '27500.01', cambio: '27500.01' }], 5500)).toBe(true);
    expect(superaCincoUit([{ predioId: 1, antes: '0', despues: '27500', cambio: '27500.00' }], 5500)).toBe(false); // igual no sobrepasa
    expect(superaCincoUit([{ predioId: 1, antes: '40000', despues: '10000', cambio: '-30000.00' }], 5500)).toBe(true); // demolición
    expect(superaCincoUit([{ predioId: 1, antes: null, despues: '90000', cambio: null }], 5500)).toBe(false); // sin valorizar
    expect(superaCincoUit([{ predioId: 1, antes: '0', despues: '90000', cambio: '90000' }], null)).toBe(false); // sin UIT
  });

  it('si supera, vence el último día hábil del mes siguiente al documento', () => {
    const p = plazoDjPresentada('MODIFICACION', [], 2026, sin, { variacion: variacion('30000.00') });
    expect(p).toMatchObject({ hecho: '2026-03-15', vence: '2026-04-30', cambio5Uit: true });
  });

  it('si no supera, o aún no se determinó, no hay plazo sancionable', () => {
    expect(plazoDjPresentada('MODIFICACION', [], 2026, sin, { variacion: variacion('1000.00') })).toBeNull();
    expect(plazoDjPresentada('MODIFICACION', [], 2026, sin, { variacion: null })).toBeNull();
  });
});

describe('J16: prórroga del plazo (Fase 7)', () => {
  const sin = new Set<string>();

  it('mueve el vencimiento a la fecha límite más lejana, si es posterior', () => {
    const p = plazoDjPresentada('ANUAL', [], 2026, sin, { prorrogas: [{ id: 1, fechaLimite: '2026-03-31' }, { id: 2, fechaLimite: '2026-04-30' }] });
    expect(p).toMatchObject({ vence: '2026-04-30', venceOriginal: '2026-02-27', prorroga: { id: 2 } });
  });

  it('una fecha límite anterior al plazo no lo acorta', () => {
    expect(aplicarProrroga('2026-02-27', [{ id: 1, fechaLimite: '2026-02-10' }])).toEqual({ vence: '2026-02-27', prorroga: null });
    expect(aplicarProrroga('2026-02-27', [])).toEqual({ vence: '2026-02-27', prorroga: null });
  });
});
