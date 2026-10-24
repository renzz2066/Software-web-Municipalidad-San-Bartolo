import { EstadoFiscalizacion, ModalidadNotificacion } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { diferencias, errorAccion, errorExpediente, errorRequerimiento, estadoTrasFichas, rangoFiscalizable } from './fiscalizacion.reglas.js';

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
  const predial = (cuota: number, importe: string) => ({ anio: 2026, tributo: 'PREDIAL', cuota, importe });

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
      [{ anio: 2026, tributo: 'RESIDUOS', cuota: 1, importe: 30 }],
      [{ anio: 2026, tributo: 'RESIDUOS', cuota: 1, importe: 20 }],
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
