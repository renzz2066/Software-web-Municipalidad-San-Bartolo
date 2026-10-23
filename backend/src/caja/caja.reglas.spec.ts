import { EstadoCuenta, EstadoValor, MedioPago, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  CuotaACobrar,
  errorCierre,
  errorCobro,
  errorEstadoCuotas,
  errorExtorno,
  errorExtornoConvenio,
  errorOrdenConvenio,
  estadoValorRestaurado,
  lineasPago,
  montoEnLetras,
  resumenCierre,
  todoPagado,
  totalCoincide,
  totalRecibo,
} from './caja.reglas.js';

const D = Prisma.Decimal;
const { PENDIENTE, CANCELADO, COACTIVO, FRACCIONADO } = EstadoCuenta;

const cuota = (id: number, total: string, extra: Partial<CuotaACobrar> = {}): CuotaACobrar => ({
  id,
  estado: PENDIENTE,
  liquidacion: { insoluto: new D(total), reajuste: new D(0), mora: new D(0), derechoEmision: new D(0), total: new D(total) },
  ...extra,
});

describe('errorCobro', () => {
  const base = { cuentaIds: [1, 2], medioPago: MedioPago.EFECTIVO, cerroHoy: false };

  it('efectivo sin n.° de operación es válido', () => {
    expect(errorCobro(base)).toBeNull();
  });

  it('fuera de efectivo exige n.° de operación', () => {
    expect(errorCobro({ ...base, medioPago: MedioPago.TARJETA, numOperacion: '  ' })).toMatch(/operación/);
    expect(errorCobro({ ...base, medioPago: MedioPago.TRANSFERENCIA, numOperacion: 'YAPE-123' })).toBeNull();
  });

  it('cheque deshabilitado, sin cuotas, repetidas o con la caja cerrada', () => {
    expect(errorCobro({ ...base, medioPago: MedioPago.CHEQUE, numOperacion: '1' })).toMatch(/no habilitado/);
    expect(errorCobro({ ...base, cuentaIds: [] })).toMatch(/al menos una/);
    expect(errorCobro({ ...base, cuentaIds: [1, 1] })).toMatch(/repetidas/);
    expect(errorCobro({ ...base, cerroHoy: true })).toMatch(/cerraste/);
  });
});

describe('errorEstadoCuotas', () => {
  it('cobra PENDIENTE y COACTIVO; rechaza ya cobradas o fraccionadas', () => {
    expect(errorEstadoCuotas([{ id: 1, estado: PENDIENTE }, { id: 2, estado: COACTIVO }])).toBeNull();
    expect(errorEstadoCuotas([{ id: 1, estado: PENDIENTE }, { id: 2, estado: CANCELADO }])).toMatch(/cuota 2/);
    expect(errorEstadoCuotas([{ id: 3, estado: FRACCIONADO }])).toMatch(/fraccionado/);
  });
});

describe('errorOrdenConvenio', () => {
  const cronograma = new Map([
    [7, [0, 1, 2, 3].map((n) => ({ cuotaNumero: n, estado: n === 0 ? CANCELADO : PENDIENTE }))],
  ]);
  const deConvenio = (id: number, n: number) => cuota(id, '50', { convenio: { convenioId: 7, cuotaNumero: n } });

  it('la siguiente cuota, o varias seguidas, se pueden cobrar', () => {
    expect(errorOrdenConvenio([deConvenio(11, 1)], cronograma)).toBeNull();
    expect(errorOrdenConvenio([deConvenio(12, 2), deConvenio(11, 1)], cronograma)).toBeNull();
  });

  it('no se salta cuotas pendientes', () => {
    expect(errorOrdenConvenio([deConvenio(12, 2)], cronograma)).toMatch(/falta la cuota 1/);
    expect(errorOrdenConvenio([deConvenio(11, 1), deConvenio(13, 3)], cronograma)).toMatch(/falta la cuota 2/);
  });

  it('la cuota inicial va primero', () => {
    const sinInicial = new Map([[7, [0, 1].map((n) => ({ cuotaNumero: n, estado: PENDIENTE }))]]);
    expect(errorOrdenConvenio([deConvenio(11, 1)], sinInicial)).toMatch(/cuota inicial/);
  });

  it('cuotas de tributos sin convenio no tienen orden', () => {
    expect(errorOrdenConvenio([cuota(1, '10'), cuota(2, '10')], cronograma)).toBeNull();
  });
});

describe('lineas y total del recibo', () => {
  it('el total es la suma de las liquidaciones y guarda el estado previo', () => {
    const c = cuota(5, '100.50', {
      estado: COACTIVO,
      liquidacion: { insoluto: new D('90'), reajuste: new D('2.25'), mora: new D('5.25'), derechoEmision: new D('3'), total: new D('100.50') },
    });
    const lineas = lineasPago([c, cuota(6, '20.10')]);
    expect(lineas[0]).toMatchObject({ cuentaId: 5, estadoAnterior: COACTIVO });
    expect(lineas[0].mora.toFixed(2)).toBe('5.25');
    expect(totalRecibo(lineas).toFixed(2)).toBe('120.60');
  });

  it('total distinto al mostrado no coincide (409)', () => {
    expect(totalCoincide('120.60', new D('120.6'))).toBe(true);
    expect(totalCoincide('120.60', '120.61')).toBe(false);
  });
});

describe('efectos en valor y convenio', () => {
  it('pagado solo cuando todas las cuotas están canceladas', () => {
    expect(todoPagado([CANCELADO, CANCELADO])).toBe(true);
    expect(todoPagado([CANCELADO, PENDIENTE])).toBe(false);
    expect(todoPagado([])).toBe(false);
  });

  it('el extorno devuelve el valor a coactivo, notificado o emitido', () => {
    expect(estadoValorRestaurado({ transferenciaId: 3, fechaNotificacion: '2026-10-01' })).toBe(EstadoValor.COACTIVO);
    expect(estadoValorRestaurado({ transferenciaId: null, fechaNotificacion: '2026-10-01' })).toBe(EstadoValor.NOTIFICADO);
    expect(estadoValorRestaurado({ transferenciaId: null, fechaNotificacion: null })).toBe(EstadoValor.EMITIDO);
  });
});

describe('errorExtorno', () => {
  const recibo = { estado: CANCELADO, cajeroId: 4, fechaCaja: '2026-10-24' };
  const ctx = { usuarioId: 4, hoy: '2026-10-24', puedeExtornarAjenos: false, cerroHoy: false, motivo: 'Cobro duplicado' };

  it('el cajero extorna su recibo del día', () => {
    expect(errorExtorno(recibo, ctx)).toBeNull();
  });

  it('recibo de otro cajero o de otro día: solo con caja.extornos', () => {
    expect(errorExtorno({ ...recibo, cajeroId: 9 }, ctx)).toMatch(/supervisor/);
    expect(errorExtorno({ ...recibo, fechaCaja: '2026-10-23' }, ctx)).toMatch(/supervisor/);
    expect(errorExtorno({ ...recibo, fechaCaja: '2026-10-23' }, { ...ctx, puedeExtornarAjenos: true })).toBeNull();
  });

  it('motivo obligatorio, recibo vigente y caja abierta', () => {
    expect(errorExtorno(recibo, { ...ctx, motivo: '  ab ' })).toMatch(/motivo/);
    expect(errorExtorno({ ...recibo, estado: EstadoCuenta.EXTORNADO }, ctx)).toMatch(/ya está extornado/);
    expect(errorExtorno(recibo, { ...ctx, cerroHoy: true, puedeExtornarAjenos: true })).toMatch(/cerraste/);
  });
});

describe('errorExtornoConvenio', () => {
  const cronograma = (pagadas: number[]) =>
    new Map([[7, [0, 1, 2].map((n) => ({ cuotaNumero: n, estado: pagadas.includes(n) ? CANCELADO : PENDIENTE }))]]);

  it('se extorna la última cuota pagada, o varias juntas desde el final', () => {
    expect(errorExtornoConvenio([{ convenioId: 7, cuotaNumero: 1 }], cronograma([0, 1]))).toBeNull();
    expect(errorExtornoConvenio([1, 2].map((n) => ({ convenioId: 7, cuotaNumero: n })), cronograma([0, 1, 2]))).toBeNull();
  });

  it('no deja una cuota posterior pagada sobre una anterior pendiente', () => {
    expect(errorExtornoConvenio([{ convenioId: 7, cuotaNumero: 0 }], cronograma([0, 1]))).toMatch(/cuota 1/);
  });

  it('recibos sin cuotas de convenio no tienen restricción', () => {
    expect(errorExtornoConvenio([], cronograma([0, 1]))).toBeNull();
  });
});

describe('errorCierre', () => {
  it('hoy o un día anterior abierto; nunca futuro ni dos veces', () => {
    expect(errorCierre('2026-10-24', '2026-10-24', false)).toBeNull();
    expect(errorCierre('2026-10-20', '2026-10-24', false)).toBeNull();
    expect(errorCierre('2026-10-25', '2026-10-24', false)).toMatch(/aún no llega/);
    expect(errorCierre('2026-10-24', '2026-10-24', true)).toMatch(/ya está cerrada/);
  });
});

describe('resumenCierre', () => {
  const predial = { codigo: '001', nombre: 'Predial' };
  const arbitrios = { codigo: '004', nombre: 'Arbitrios' };
  const cobrados = [
    { medioPago: MedioPago.EFECTIVO, total: '100.00', lineas: [{ tributo: predial, subtotal: '60.00' }, { tributo: arbitrios, subtotal: '40.00' }] },
    { medioPago: MedioPago.TARJETA, total: '50.00', lineas: [{ tributo: predial, subtotal: '50.00' }] },
    { medioPago: MedioPago.EFECTIVO, total: '30.00', lineas: [{ tributo: arbitrios, subtotal: '30.00' }] },
  ];

  it('suma por medio y por tributo y resta los extornos del día', () => {
    const r = resumenCierre(cobrados, [cobrados[2]]);
    expect(r).toMatchObject({ cantidadRecibos: 3, cantidadExtornos: 1, diferencia: null });
    expect(r.total.toFixed(2)).toBe('150.00');
    expect(r.totalesPorMedio).toEqual({ EFECTIVO: '100.00', TARJETA: '50.00' });
    expect(r.totalesPorTributo).toEqual([
      { codigo: '001', nombre: 'Predial', total: '110.00' },
      { codigo: '004', nombre: 'Arbitrios', total: '40.00' },
    ]);
    expect(r.efectivoEsperado.toFixed(2)).toBe('100.00');
  });

  it('arqueo: sobrante positivo, faltante negativo', () => {
    expect(resumenCierre(cobrados, [], '131.50').diferencia?.toFixed(2)).toBe('1.50');
    expect(resumenCierre(cobrados, [], 129).diferencia?.toFixed(2)).toBe('-1.00');
  });

  it('lo cobrado y extornado el mismo día no deja líneas en cero', () => {
    const r = resumenCierre(cobrados, [cobrados[1]]);
    expect(r.totalesPorMedio).toEqual({ EFECTIVO: '130.00' });
    expect(r.totalesPorTributo.map((t) => t.codigo)).toEqual(['001', '004']);
  });

  it('día sin movimientos', () => {
    const r = resumenCierre([], []);
    expect(r.total.toFixed(2)).toBe('0.00');
    expect(r.totalesPorMedio).toEqual({});
  });
});

describe('montoEnLetras', () => {
  it.each([
    ['0', 'CERO CON 00/100 SOLES'],
    ['1', 'UNO CON 00/100 SOLES'],
    ['21.05', 'VEINTIUNO CON 05/100 SOLES'],
    ['100', 'CIEN CON 00/100 SOLES'],
    ['120.50', 'CIENTO VEINTE CON 50/100 SOLES'],
    ['1001', 'MIL UNO CON 00/100 SOLES'],
    ['21000', 'VEINTIÚN MIL CON 00/100 SOLES'],
    ['31531.99', 'TREINTA Y UN MIL QUINIENTOS TREINTA Y UNO CON 99/100 SOLES'],
    ['1000000', 'UN MILLÓN CON 00/100 SOLES'],
    ['2500700.10', 'DOS MILLONES QUINIENTOS MIL SETECIENTOS CON 10/100 SOLES'],
  ])('%s → %s', (monto, letras) => {
    expect(montoEnLetras(monto)).toBe(letras);
  });

  it('redondea a 2 decimales y rechaza montos fuera de rango', () => {
    expect(montoEnLetras('10.005')).toBe('DIEZ CON 01/100 SOLES');
    expect(() => montoEnLetras(-1)).toThrow();
  });
});
