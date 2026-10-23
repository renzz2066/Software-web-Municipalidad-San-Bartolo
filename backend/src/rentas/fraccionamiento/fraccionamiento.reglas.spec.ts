import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { cronograma, cuotaInicialMinima, errorAnulacionConvenio, errorConvenio, finDeMes } from './fraccionamiento.reglas.js';

const D = Prisma.Decimal;
const suma = (xs: Prisma.Decimal[]) => xs.reduce((a, x) => a.plus(x), new D(0)).toFixed(2);

describe('cronograma', () => {
  it('cuota inicial sin interés y saldo en cuotas fijas (sistema francés)', () => {
    // Saldo 900 al 1% mensual en 3 cuotas: cuota fija = 900·0.01/(1-1.01^-3) = 306.02.
    const c = cronograma(1000, 100, 3, 1, '2026-10-23');
    expect(c.map((x) => x.numero)).toEqual([0, 1, 2, 3]);
    expect(c[0]).toMatchObject({ vencimiento: '2026-10-23' });
    expect(c[0].interes.toFixed(2)).toBe('0.00');
    expect(c[1].monto.toFixed(2)).toBe('306.02');
    expect(c[1].interes.toFixed(2)).toBe('9.00');
    expect(c[2].monto.toFixed(2)).toBe('306.02');
  });

  it('la amortización suma exactamente el saldo y el total = deuda + intereses', () => {
    const c = cronograma(1000, 100, 3, 1, '2026-10-23');
    const cuotas = c.filter((x) => x.numero > 0);
    expect(suma(cuotas.map((x) => x.amortizacion))).toBe('900.00');
    expect(suma(c.map((x) => x.monto))).toBe(new D(1000).plus(suma(c.map((x) => x.interes))).toFixed(2));
  });

  it('sin interés reparte en partes iguales y la última ajusta el redondeo', () => {
    const c = cronograma(100, 0, 3, 0, '2026-10-23');
    expect(c.map((x) => x.monto.toFixed(2))).toEqual(['33.33', '33.33', '33.34']);
    expect(c[0].numero).toBe(1); // sin cuota inicial no hay cuota 0
  });

  it('vence el último día de cada mes siguiente, también en febrero', () => {
    expect(cronograma(300, 0, 3, 0, '2026-12-15').map((x) => x.vencimiento)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(finDeMes('2027-01-31', 1)).toBe('2027-02-28');
  });
});

describe('errorConvenio', () => {
  const limites = { cuotaInicialMinPct: 10, cuotasMax: 24, montoMinimo: 200 };
  const ok = { total: 1000, cuotaInicial: 100, numCuotas: 12 };

  it('acepta un convenio dentro de los límites', () => {
    expect(errorConvenio(limites, 2026, ok)).toBeNull();
  });

  it('exige parámetros del año', () => {
    expect(errorConvenio(null, 2026, ok)).toMatch(/parámetros de fraccionamiento 2026/);
  });

  it('rechaza deuda bajo el mínimo, cuota inicial insuficiente o que lo cubre todo', () => {
    expect(errorConvenio(limites, 2026, { ...ok, total: 150, cuotaInicial: 20 })).toMatch(/mínimo para fraccionar/);
    expect(errorConvenio(limites, 2026, { ...ok, cuotaInicial: 99.99 })).toMatch(/al menos S\/ 100.00/);
    expect(errorConvenio(limites, 2026, { ...ok, cuotaInicial: 1000 })).toMatch(/no queda saldo/);
  });

  it('rechaza más cuotas de las permitidas', () => {
    expect(errorConvenio(limites, 2026, { ...ok, numCuotas: 25 })).toMatch(/máximo es 24/);
    expect(errorConvenio(limites, 2026, { ...ok, numCuotas: 0 })).toMatch(/al menos 1/);
  });

  it('la cuota inicial mínima redondea hacia arriba al céntimo', () => {
    expect(cuotaInicialMinima('697.96', 10).toFixed(2)).toBe('69.80');
    expect(cuotaInicialMinima('100.01', 10).toFixed(2)).toBe('10.01');
  });
});

describe('errorAnulacionConvenio', () => {
  it('anula un convenio vigente sin pagos y con motivo', () => {
    expect(errorAnulacionConvenio('FRACCIONADO', 0, 'El vecino desistió del convenio')).toBeNull();
  });

  it('no anula convenios ya anulados, con cuotas pagadas o sin motivo', () => {
    expect(errorAnulacionConvenio('ANULADO', 0, 'El vecino desistió del convenio')).toMatch(/anulado/);
    expect(errorAnulacionConvenio('FRACCIONADO', 1, 'El vecino desistió del convenio')).toMatch(/pagadas/);
    expect(errorAnulacionConvenio('FRACCIONADO', 0, 'no')).toMatch(/mínimo 10/);
  });
});
