import { describe, expect, it } from 'vitest';
import { factorReajuste, interesMoratorio, liquidar, type CuotaLiquidable } from './liquidacion.js';

const ipm = [
  { vigenciaDesde: '2026-02-01', valor: 100 },
  { vigenciaDesde: '2026-03-01', valor: 101 },
  { vigenciaDesde: '2026-04-01', valor: 103 },
];

describe('interesMoratorio', () => {
  it('TIM 0.9% mensual por 30 días sobre 1 000 = 9.00', () => {
    expect(interesMoratorio(1000, [{ vigenciaDesde: '2025-01-01', valor: 0.9 }], '2026-02-28', '2026-03-30').toFixed(2)).toBe('9.00');
  });

  it('cambia de tasa a mitad del atraso (31 días al 1% + 10 días al 0.9%)', () => {
    const tim = [
      { vigenciaDesde: '2026-04-01', valor: 0.9 },
      { vigenciaDesde: '2026-01-01', valor: 1 },
    ];
    expect(interesMoratorio(1000, tim, '2026-02-28', '2026-04-10').toFixed(2)).toBe('13.33');
  });

  it('no hay mora el mismo día del vencimiento ni antes, ni sin TIM registrada', () => {
    const tim = [{ vigenciaDesde: '2025-01-01', valor: 0.9 }];
    expect(interesMoratorio(1000, tim, '2026-02-28', '2026-02-28').toFixed(2)).toBe('0.00');
    expect(interesMoratorio(1000, tim, '2026-02-28', '2026-01-15').toFixed(2)).toBe('0.00');
    expect(interesMoratorio(1000, [], '2026-02-28', '2026-06-30').toFixed(2)).toBe('0.00');
  });
});

describe('factorReajuste', () => {
  it('usa el IPM del mes anterior a la fecha contra el de febrero', () => {
    expect(factorReajuste(ipm, '2026-02-28', '2026-05-15').toFixed(4)).toBe('0.0300');
    expect(factorReajuste(ipm, '2026-02-28', '2026-04-02').toFixed(4)).toBe('0.0100');
  });

  it('es 0 si se paga hasta la cuota 1, si el IPM bajó o si falta el IPM base', () => {
    expect(factorReajuste(ipm, '2026-02-28', '2026-02-20').toFixed(4)).toBe('0.0000');
    expect(factorReajuste([...ipm, { vigenciaDesde: '2026-05-01', valor: 95 }], '2026-02-28', '2026-06-10').toFixed(4)).toBe('0.0000');
    expect(factorReajuste(ipm.slice(1), '2026-02-28', '2026-05-15').toFixed(4)).toBe('0.0000');
  });
});

describe('liquidar', () => {
  const tim = [{ vigenciaDesde: '2025-01-01', valor: 0.9 }];
  const base: CuotaLiquidable = {
    esPredial: true,
    cuota: 2,
    anio: 2026,
    importe: 100,
    derechoEmision: 0,
    fechaVencimiento: '2026-05-31',
    vencimientoCuota1: '2026-02-28',
    generaMora: true,
  };

  it('cuota 2 del predial: reajuste IPM y mora sobre insoluto + reajuste', () => {
    const r = liquidar(base, '2026-06-30', ipm, tim); // reajuste 3%, 30 días de atraso
    expect(r.reajuste.toFixed(2)).toBe('3.00');
    expect(r.mora.toFixed(2)).toBe('0.93'); // 103 × 0.9% × 30/30
    expect(r.total.toFixed(2)).toBe('103.93');
    expect(r.diasAtraso).toBe(30);
  });

  it('cuota 1 con derecho de emisión: sin reajuste y la emisión no genera mora', () => {
    const r = liquidar({ ...base, cuota: 1, derechoEmision: 10, fechaVencimiento: '2026-02-28' }, '2026-03-30', ipm, tim);
    expect(r.reajuste.toFixed(2)).toBe('0.00');
    expect(r.mora.toFixed(2)).toBe('0.90');
    expect(r.total.toFixed(2)).toBe('110.90');
  });

  it('arbitrios no se reajustan y las cuotas fraccionadas no generan mora aquí', () => {
    expect(liquidar({ ...base, esPredial: false }, '2026-06-30', ipm, tim).reajuste.toFixed(2)).toBe('0.00');
    expect(liquidar({ ...base, generaMora: false }, '2026-06-30', ipm, tim).mora.toFixed(2)).toBe('0.00');
  });
});
