import { EstadoFiscalizacion, ModalidadNotificacion, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  type CuotaDeclarada,
  diferencias,
  errorAccion,
  errorExpediente,
  errorRequerimiento,
  estadoTrasFichas,
  planAjustes,
  rangoFiscalizable,
  referenciaDeclarada,
} from './fiscalizacion.reglas.js';

const D = Prisma.Decimal;

const { ABIERTO, INSPECCIONADO, RESUELTO } = EstadoFiscalizacion;

describe('rangoFiscalizable', () => {
  it('4 años atrás, o 6 si nunca declaró (art. 43)', () => {
    expect(rangoFiscalizable(2026, false)).toEqual({ desde: 2022, hasta: 2026 });
    expect(rangoFiscalizable(2026, true)).toEqual({ desde: 2020, hasta: 2026 });
  });
});

describe('errorExpediente', () => {
  const base = {
    anioDesde: 2024,
    anioHasta: 2026,
    predioIds: [5],
    anioActual: 2026,
    sinDeclaracion: false,
    aniosConParametros: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
  };

  it('rango válido con parámetros cargados', () => {
    expect(errorExpediente(base)).toBeNull();
  });

  it('años prescritos salvo que el contribuyente no haya declarado', () => {
    expect(errorExpediente({ ...base, anioDesde: 2021 })).toMatch(/prescritos \(4 años\)/);
    expect(errorExpediente({ ...base, anioDesde: 2021, sinDeclaracion: true })).toBeNull();
    expect(errorExpediente({ ...base, anioDesde: 2019, sinDeclaracion: true })).toMatch(/prescritos \(6 años\)/);
  });

  it('sin predios, rango invertido, años futuros o sin parámetros', () => {
    expect(errorExpediente({ ...base, predioIds: [] })).toMatch(/al menos un predio/);
    expect(errorExpediente({ ...base, predioIds: [5, 5] })).toMatch(/repetidos/);
    expect(errorExpediente({ ...base, anioDesde: 2026, anioHasta: 2025 })).toMatch(/mayor que el final/);
    expect(errorExpediente({ ...base, anioHasta: 2027 })).toMatch(/aún no llegan/);
    expect(errorExpediente({ ...base, aniosConParametros: [2024, 2026] })).toMatch(/2025 no tiene parámetros/);
  });
});

describe('errorAccion y estadoTrasFichas', () => {
  it('liquidar exige todas las fichas', () => {
    expect(errorAccion(ABIERTO, 'LIQUIDAR')).toMatch(/ficha de inspección/);
    expect(errorAccion(INSPECCIONADO, 'LIQUIDAR')).toBeNull();
  });

  it('un expediente resuelto ya no cambia', () => {
    expect(errorAccion(RESUELTO, 'FICHA')).toMatch(/resuelto/);
    expect(errorAccion(RESUELTO, 'ANULAR', 'Motivo suficientemente largo')).toMatch(/resuelto/);
  });

  it('anular exige motivo', () => {
    expect(errorAccion(ABIERTO, 'ANULAR', 'corto')).toMatch(/motivo/);
    expect(errorAccion(ABIERTO, 'ANULAR', 'Contribuyente fallecido, pasa a sucesión')).toBeNull();
  });

  it('pasa a inspeccionado con la ficha de todos los predios', () => {
    expect(estadoTrasFichas(2, 2)).toBe(INSPECCIONADO);
    expect(estadoTrasFichas(1, 2)).toBe(ABIERTO);
    expect(estadoTrasFichas(0, 0)).toBe(ABIERTO);
  });
});

describe('errorRequerimiento', () => {
  const base = { fechaApertura: '2026-10-20', fechaInspeccion: '2026-10-28', hoy: '2026-10-24' };
  const personal = { fecha: '2026-10-22', modalidad: ModalidadNotificacion.PERSONAL, dni: '12345678', nombre: 'Juan Pérez' };

  it('programa la visita sin notificación todavía', () => {
    expect(errorRequerimiento(base)).toBeNull();
    expect(errorRequerimiento({ ...base, fechaInspeccion: '2026-10-19' })).toMatch(/anterior a la apertura/);
  });

  it('notificación personal válida antes de la visita', () => {
    expect(errorRequerimiento({ ...base, notificacion: personal })).toBeNull();
    expect(errorRequerimiento({ ...base, notificacion: { ...personal, dni: '' } })).toMatch(/DNI/);
    expect(errorRequerimiento({ ...base, notificacion: { ...personal, modalidad: ModalidadNotificacion.CEDULON, dni: null, nombre: null } })).toBeNull();
  });

  it('la visita va después del día de la notificación, que no es futura ni previa a la apertura', () => {
    expect(errorRequerimiento({ ...base, fechaInspeccion: '2026-10-22', notificacion: personal })).toMatch(/después del día/);
    expect(errorRequerimiento({ ...base, notificacion: { ...personal, fecha: '2026-10-25' } })).toMatch(/futura/);
    expect(errorRequerimiento({ ...base, notificacion: { ...personal, fecha: '2026-10-19' } })).toMatch(/anterior a la apertura/);
  });
});

describe('diferencias', () => {
  const predial = (cuota: number, importe: string) => ({ anio: 2026, tributo: 'PREDIAL', predioId: null, cuota, importe });

  it('determina lo que sube por cuota; una diferencia anterior suma a lo declarado', () => {
    const declarado = [1, 2, 3, 4].map((c) => predial(c, '100.00')).concat(predial(1, '10.00'));
    const fiscalizado = [1, 2, 3, 4].map((c) => predial(c, '125.00'));
    const r = diferencias(declarado, fiscalizado);
    expect(r.aumentos.map((a) => [a.cuota, a.diferencia.toFixed(2)])).toEqual([
      [1, '15.00'],
      [2, '25.00'],
      [3, '25.00'],
      [4, '25.00'],
    ]);
    expect(r.totalOmitido.toFixed(2)).toBe('90.00');
    expect(r.porAnio).toHaveLength(1);
    expect(r.porAnio[0].declarado.toFixed(2)).toBe('410.00');
    expect(r.porAnio[0].fiscalizado.toFixed(2)).toBe('500.00');
    expect(r.porAnio[0].omitido.toFixed(2)).toBe('90.00');
  });

  it('lo que baja no se determina: queda para un descargo', () => {
    const r = diferencias(
      [{ anio: 2026, tributo: 'RESIDUOS', predioId: 5, cuota: 1, importe: 30 }],
      [{ anio: 2026, tributo: 'RESIDUOS', predioId: 5, cuota: 1, importe: 20 }],
    );
    expect(r.aumentos).toHaveLength(0);
    expect(r.disminuciones[0].diferencia.toFixed(2)).toBe('-10.00');
    expect(r.totalOmitido.toFixed(2)).toBe('0.00');
  });

  it('una cuota que no existía (predio omitido) es diferencia completa', () => {
    const r = diferencias([], [predial(1, '80.50')]);
    expect(r.aumentos[0].declarado.toFixed(2)).toBe('0.00');
    expect(r.aumentos[0].diferencia.toFixed(2)).toBe('80.50');
  });

  it('sin cambios no hay diferencias', () => {
    const filas = [predial(1, '100')];
    const r = diferencias(filas, filas);
    expect(r.aumentos).toHaveLength(0);
    expect(r.disminuciones).toHaveLength(0);
  });
});

describe('referenciaDeclarada', () => {
  const predial = (cuota: number, importe: number) => ({ anio: 2026, tributo: 'PREDIAL', predioId: null, cuota, importe });

  it('otro predio declarado y sin calcular no es omisión de la fiscalización', () => {
    // Cuenta corriente: 100 por cuota. Con lo declarado (otro predio inscrito sin calcular) el motor da 160;
    // con la ficha (un piso más del predio fiscalizado), 175.
    const cuenta = [1, 2].map((c) => predial(c, 100));
    const determinado = [1, 2].map((c) => predial(c, 160));
    const fiscalizado = [1, 2].map((c) => predial(c, 175));
    const referencia = referenciaDeclarada(cuenta, determinado);
    const r = diferencias(referencia, fiscalizado);
    expect(r.aumentos.map((a) => [a.cuota, a.declarado.toFixed(2), a.diferencia.toFixed(2)])).toEqual([
      [1, '160.00', '15.00'],
      [2, '160.00', '15.00'],
    ]);
    expect(r.totalOmitido.toFixed(2)).toBe('30.00');
    expect(diferencias(cuenta, referencia).aumentos.map((a) => a.diferencia.toFixed(2))).toEqual(['60.00', '60.00']);
  });

  it('si la cuenta corriente ya es mayor (diferencias anteriores), manda la cuenta corriente', () => {
    const referencia = referenciaDeclarada([predial(1, 100), predial(1, 30)], [predial(1, 110)]);
    expect(referencia.map((x) => [x.cuota, new D(x.importe).toFixed(2)])).toEqual([[1, '130.00']]);
  });
});

describe('diferencias por predio en arbitrios', () => {
  it('cada predio se compara por separado', () => {
    const arb = (predioId: number, importe: number) => ({ anio: 2026, tributo: 'RESIDUOS', predioId, cuota: 1, importe });
    const r = diferencias([arb(5, 30), arb(6, 30)], [arb(5, 30), arb(6, 45)]);
    expect(r.aumentos.map((a) => [a.predioId, a.diferencia.toFixed(2)])).toEqual([[6, '15.00']]);
    expect(r.porAnio[0].omitido.toFixed(2)).toBe('15.00');
  });
});

describe('planAjustes', () => {
  const aumento = (cuota: number, diferencia: number) => ({
    anio: 2026,
    tributo: 'PREDIAL',
    predioId: null,
    cuota,
    declarado: new D(100),
    fiscalizado: new D(100 + diferencia),
    diferencia: new D(diferencia),
  });
  const cuota = (id: number, n: number, estado: string, extra: Partial<CuotaDeclarada> = {}): CuotaDeclarada => ({
    id,
    anio: 2026,
    tributo: 'PREDIAL',
    predioId: null,
    cuota: n,
    importe: 100,
    estado,
    enValor: false,
    ajusteDeId: null,
    ...extra,
  });

  it('pendiente libre sube; pagada, en coactivo o en un valor recibe una diferencia', () => {
    const r = planAjustes(
      [aumento(1, 25), aumento(2, 25), aumento(3, 25), aumento(4, 25)],
      [cuota(1, 1, 'CANCELADO'), cuota(2, 2, 'PENDIENTE'), cuota(3, 3, 'PENDIENTE', { enValor: true }), cuota(4, 4, 'COACTIVO')],
    );
    expect(r.actualizar.map((a) => [a.id, a.importe.toFixed(2)])).toEqual([[2, '125.00']]);
    expect(r.ajustes.map((a) => [a.ajusteDeId, a.importe.toFixed(2)])).toEqual([
      [1, '25.00'],
      [3, '25.00'],
      [4, '25.00'],
    ]);
    expect(r.crear).toHaveLength(0);
  });

  it('lo declarado sin calcular sube fuera de la RD; solo lo omitido entra a la RD', () => {
    const sinCalcular = [aumento(1, 60), aumento(2, 60), aumento(3, 60)];
    const r = planAjustes([aumento(1, 15), aumento(2, 15)], [cuota(1, 1, 'CANCELADO'), cuota(2, 2, 'PENDIENTE'), cuota(3, 3, 'PENDIENTE', { enValor: true })], sinCalcular);
    expect(r.actualizar.map((a) => [a.id, a.importe.toFixed(2), a.enRD])).toEqual([[2, '175.00', true]]);
    expect(r.ajustes.map((a) => [a.ajusteDeId, a.importe.toFixed(2), a.enRD])).toEqual([
      [1, '60.00', false],
      [1, '15.00', true],
      [3, '60.00', false],
    ]);
  });

  it('una cuota que no existe o está anulada nace completa; una diferencia previa no es base', () => {
    const r = planAjustes([aumento(1, 80), aumento(2, 80)], [cuota(9, 2, 'ANULADO'), cuota(10, 1, 'PENDIENTE', { ajusteDeId: 3 })]);
    expect(r.crear.map((c) => [c.cuota, c.importe.toFixed(2)])).toEqual([
      [1, '80.00'],
      [2, '80.00'],
    ]);
  });
});
