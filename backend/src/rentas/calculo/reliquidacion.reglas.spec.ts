import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  bajas,
  errorAnularLiquidada,
  errorLiquidar,
  errorResolverRevision,
  estadoTrasLiquidar,
  planificarCuenta,
  venceRevision,
  type CuentaActual,
  type LineaNueva,
} from './reliquidacion.reglas.js';

const D = Prisma.Decimal;
const PREDIAL = { tributoId: 1, predioId: null };
const VENCE = ['2026-02-27', '2026-05-29', '2026-08-31', '2026-11-30'];

const nuevas = (montos: number[], emision = 0): LineaNueva[] =>
  montos.map((m, i) => ({ ...PREDIAL, cuota: i + 1, importe: new D(m), derechoEmision: new D(i === 0 ? emision : 0), vence: VENCE[i] }));
const actuales = (montos: number[], estados: string[] = [], enValor: boolean[] = []): CuentaActual[] =>
  montos.map((m, i) => ({ id: 100 + i, ...PREDIAL, cuota: i + 1, importe: m, derechoEmision: 0, estado: estados[i] ?? 'PENDIENTE', enValor: enValor[i] ?? false, ajusteDeId: null }));

describe('reliquidación (L09, L10)', () => {
  it('sin cambios no toca la cuenta', () => {
    const plan = planificarCuenta(nuevas([100, 100, 100, 100]), actuales([100, 100, 100, 100]), [PREDIAL]);
    expect(plan.crear).toEqual([]);
    expect(plan.anular).toEqual([]);
    expect(plan.sinCambio).toBe(4);
  });

  it('L10: con la cuota 1 pagada, sube el impuesto: ajuste por la diferencia y se rehacen las pendientes', () => {
    const plan = planificarCuenta(nuevas([150, 150, 150, 150]), actuales([100, 100, 100, 100], ['CANCELADO']), [PREDIAL]);
    expect(plan.anular).toEqual([101, 102, 103]);
    expect(plan.crear.map((c) => [c.cuota, c.importe.toFixed(2), c.ajusteDeId])).toEqual([
      [1, '50.00', 100], // la pagada se cierra por lo pagado; la diferencia va como ajuste de esa cuota
      [2, '150.00', null],
      [3, '150.00', null],
      [4, '150.00', null],
    ]);
    expect(plan.crear[0].vence).toBe(VENCE[0]); // la diferencia corre desde el vencimiento original
  });

  it('L10: con la cuota 1 pagada, baja el impuesto: el exceso pagado se aplica a las cuotas nuevas', () => {
    const plan = planificarCuenta(nuevas([75, 75, 75, 75]), actuales([100, 100, 100, 100], ['CANCELADO']), [PREDIAL]);
    expect(plan.crear.map((c) => [c.cuota, c.importe.toFixed(2)])).toEqual([
      [2, '50.00'],
      [3, '75.00'],
      [4, '75.00'],
    ]);
    expect(plan.saldoAFavor).toEqual([]);
  });

  it('L10: si lo pagado supera todo lo nuevo, queda saldo a favor', () => {
    const plan = planificarCuenta(nuevas([10, 10, 10, 10]), actuales([100, 100, 100, 100], ['CANCELADO', 'CANCELADO']), [PREDIAL]);
    expect(plan.crear).toEqual([]);
    expect(plan.anular).toEqual([102, 103]);
    expect(plan.saldoAFavor[0].importe.toFixed(2)).toBe('160.00');
  });

  it('L09: no baja una deuda que ya tiene valor emitido; subirla sí se puede', () => {
    const conValor = actuales([100, 100, 100, 100], [], [false, true]);
    const baja = planificarCuenta(nuevas([80, 80, 80, 80]), conValor, [PREDIAL]);
    expect(baja.bloqueos).toHaveLength(1);
    expect(baja.crear).toEqual([]);
    const sube = planificarCuenta(nuevas([120, 120, 120, 120]), conValor, [PREDIAL]);
    expect(sube.bloqueos).toEqual([]);
    // la cuota en valor no se anula: se agrega el ajuste
    expect(sube.anular).toEqual([100, 102, 103]);
    expect(sube.crear.find((c) => c.cuota === 2)?.ajusteDeId).toBe(101);
  });

  it('un grupo que ya no corresponde (predio vendido) anula lo pendiente', () => {
    const arbitrios = { tributoId: 2, predioId: 7 };
    const viejas: CuentaActual[] = [1, 2, 3, 4].map((c) => ({ id: 200 + c, ...arbitrios, cuota: c, importe: 30, derechoEmision: 0, estado: c === 1 ? 'CANCELADO' : 'PENDIENTE', enValor: false, ajusteDeId: null }));
    const plan = planificarCuenta([], viejas, [arbitrios]);
    expect(plan.anular).toEqual([202, 203, 204]);
    expect(plan.saldoAFavor[0].importe.toFixed(2)).toBe('30.00');
  });

  it('el derecho de emisión va una sola vez en la cuota 1', () => {
    const plan = planificarCuenta(nuevas([10, 10, 10, 10], 8), [], [PREDIAL]);
    expect(plan.crear.map((c) => c.derechoEmision.toFixed(2))).toEqual(['8.00', '0.00', '0.00', '0.00']);
  });
});

describe('revisión de una DJ a la baja (J14, J17)', () => {
  it('J14: baja si lo determinado es menor que lo liquidado; un año sin liquidar no cuenta', () => {
    const r = bajas([
      { anio: 2025, tributo: 'PREDIAL', liquidado: new D(100), determinado: new D(80) },
      { anio: 2026, tributo: 'PREDIAL', liquidado: new D(0), determinado: new D(50) },
      { anio: 2026, tributo: 'ARBITRIOS', liquidado: new D(90), determinado: new D(90) },
    ]);
    expect(r.map((b) => b.anio)).toEqual([2025]);
  });

  it('el plazo es de 45 días hábiles desde la recepción, sin fines de semana ni feriados', () => {
    expect(venceRevision('2026-03-02', new Set())).toBe('2026-05-04');
    expect(venceRevision('2026-03-02', new Set(['2026-04-02', '2026-04-03']))).toBe('2026-05-06');
  });

  const dj = { estado: 'EN_REVISION', creadoPorId: 5, revisionVence: '2026-05-04' };
  it('J17: quien registró la DJ no puede aprobarla', () => {
    expect(errorResolverRevision(dj, 'APROBAR', { id: 5, rol: 'SUPERVISOR' }, '2026-04-01', 'revisado en campo')).toMatch(/J17/);
    expect(errorResolverRevision(dj, 'APROBAR', { id: 6, rol: 'SUPERVISOR' }, '2026-04-01', 'revisado en campo')).toBeNull();
    expect(errorResolverRevision(dj, 'APROBAR', { id: 6, rol: 'CAJERO' }, '2026-04-01', 'revisado en campo')).toMatch(/supervisor/);
  });

  it('J14: vencido el plazo ya no se rechaza, y queda liquidable', () => {
    expect(errorResolverRevision(dj, 'RECHAZAR', { id: 6, rol: 'SUPERVISOR' }, '2026-05-04', 'no corresponde la baja')).toBeNull();
    expect(errorResolverRevision(dj, 'RECHAZAR', { id: 6, rol: 'SUPERVISOR' }, '2026-05-05', 'no corresponde la baja')).toMatch(/Venció/);
    expect(errorLiquidar({ ...dj, tipo: 'DECLARATIVA' }, '2026-05-04', true)).toMatch(/revisión/);
    expect(errorLiquidar({ ...dj, tipo: 'DECLARATIVA' }, '2026-05-05', true)).toBeNull();
  });

  it('J04/J17: una DJ liquidada la anula otro supervisor', () => {
    expect(errorAnularLiquidada({ creadoPorId: 5 }, { id: 5, rol: 'ADMIN' })).toMatch(/J17/);
    expect(errorAnularLiquidada({ creadoPorId: 5 }, { id: 6, rol: 'CAJERO' })).toMatch(/supervisor/);
    expect(errorAnularLiquidada({ creadoPorId: 5 }, { id: 6, rol: 'SUPERVISOR' })).toBeNull();
  });
});

describe('estado de la persona al liquidar (P01, P03)', () => {
  const base = { estado: 'HABILITADO', huboDescargo: true, prediosActivos: 0, tieneDeuda: false, estadoAlHabilitar: 'HABILITADO' };
  it('el descargo del último predio inhabilita solo si no hay deuda', () => {
    expect(estadoTrasLiquidar(base).estado).toBe('INHABILITADO');
    const conDeuda = estadoTrasLiquidar({ ...base, tieneDeuda: true });
    expect(conDeuda.estado).toBe('HABILITADO');
    expect(conDeuda.aviso).toMatch(/P01/);
  });

  it('sin descargo no se inhabilita; un inhabilitado con predio activo vuelve a habilitarse', () => {
    expect(estadoTrasLiquidar({ ...base, huboDescargo: false }).estado).toBe('HABILITADO');
    expect(estadoTrasLiquidar({ ...base, estado: 'INHABILITADO', prediosActivos: 1, estadoAlHabilitar: 'PENDIENTE' }).estado).toBe('PENDIENTE');
  });
});
