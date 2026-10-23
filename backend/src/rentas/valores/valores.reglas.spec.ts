import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { errorAnulacion, errorNotificacion, planEmision, type CuotaEmitible, type OpcionesEmision } from './valores.reglas.js';

const D = Prisma.Decimal;

let siguienteId = 1;
function cuota(parcial: Partial<CuotaEmitible> & { total?: number }): CuotaEmitible {
  const total = new D(parcial.total ?? 100);
  return {
    id: siguienteId++,
    contribuyenteId: 1,
    predioId: null,
    anio: 2026,
    tributo: 'PREDIAL',
    fechaVencimiento: '2026-02-28',
    enValor: false,
    liquidacion: { insoluto: total, reajuste: new D(0), mora: new D(0), total },
    ...parcial,
  };
}

const op: OpcionesEmision = { fecha: '2026-10-22', soloVencidas: true, montoMinimo: 0 };

describe('planEmision', () => {
  it('agrupa el predial en una OP por contribuyente y año', () => {
    const r = planEmision(
      [cuota({ contribuyenteId: 1 }), cuota({ contribuyenteId: 1, fechaVencimiento: '2026-05-31' }), cuota({ contribuyenteId: 2 })],
      op,
    );
    expect(r.valores.map((v) => [v.tipo, v.contribuyenteId, v.detalles.length])).toEqual([
      ['OP', 1, 2],
      ['OP', 2, 1],
    ]);
    expect(r.valores[0].total.toFixed(2)).toBe('200.00');
  });

  it('emite una RD por predio aunque sea el mismo contribuyente', () => {
    const r = planEmision(
      [
        cuota({ tributo: 'ARBITRIOS', predioId: 5 }),
        cuota({ tributo: 'ARBITRIOS', predioId: 5 }),
        cuota({ tributo: 'ARBITRIOS', predioId: 9 }),
      ],
      op,
    );
    expect(r.valores.map((v) => [v.tipo, v.predioId, v.detalles.length])).toEqual([
      ['RD', 5, 2],
      ['RD', 9, 1],
    ]);
  });

  it('no vuelve a emitir cuotas que ya están en un valor vigente', () => {
    const r = planEmision([cuota({ enValor: true }), cuota({ enValor: true })], op);
    expect(r.valores).toHaveLength(0);
    expect(r.excluidas.yaEnValor).toBe(2);
  });

  it('excluye cuotas no vencidas; la que vence el día de emisión aún no está vencida', () => {
    const r = planEmision(
      [cuota({ fechaVencimiento: '2026-10-21' }), cuota({ fechaVencimiento: '2026-10-22' }), cuota({ fechaVencimiento: '2026-11-30' })],
      op,
    );
    expect(r.valores[0].detalles).toHaveLength(1);
    expect(r.excluidas.noVencidas).toBe(2);
  });

  it('con soloVencidas en falso incluye también las por vencer', () => {
    const r = planEmision([cuota({ fechaVencimiento: '2026-11-30' })], { ...op, soloVencidas: false });
    expect(r.valores).toHaveLength(1);
  });

  it('descarta valores bajo el monto mínimo', () => {
    const r = planEmision([cuota({ contribuyenteId: 1, total: 20 }), cuota({ contribuyenteId: 2, total: 50 })], { ...op, montoMinimo: 50 });
    expect(r.valores.map((v) => v.contribuyenteId)).toEqual([2]);
    expect(r.excluidas.bajoMinimo).toBe(1);
  });

  it('excluye contribuyentes con deuda por recalcular solo en el tipo afectado', () => {
    const r = planEmision([cuota({ contribuyenteId: 1 }), cuota({ contribuyenteId: 1, tributo: 'ARBITRIOS', predioId: 5 })], {
      ...op,
      excluir: (cid, tipo) => cid === 1 && tipo === 'OP',
    });
    expect(r.valores.map((v) => v.tipo)).toEqual(['RD']);
    expect(r.excluidas.recalculoPendiente).toBe(1);
  });
});

describe('errorNotificacion', () => {
  const ok = { fecha: '2026-10-23', modalidad: 'CEDULON' as const };

  it('acepta un cedulón sin datos del receptor', () => {
    expect(errorNotificacion('EMITIDO', '2026-10-20', ok, '2026-10-23')).toBeNull();
  });

  it('permite corregir la notificación de un valor ya notificado', () => {
    expect(errorNotificacion('NOTIFICADO', '2026-10-20', ok, '2026-10-23')).toBeNull();
  });

  it('rechaza valores anulados o en coactivo', () => {
    expect(errorNotificacion('ANULADO', '2026-10-20', ok, '2026-10-23')).toMatch(/anulado/);
    expect(errorNotificacion('COACTIVO', '2026-10-20', ok, '2026-10-23')).toMatch(/coactivo/);
  });

  it('rechaza fechas anteriores a la emisión o futuras', () => {
    expect(errorNotificacion('EMITIDO', '2026-10-24', ok, '2026-10-25')).toMatch(/anterior a la emisión/);
    expect(errorNotificacion('EMITIDO', '2026-10-20', ok, '2026-10-22')).toMatch(/futura/);
  });

  it('la notificación personal exige nombre y DNI', () => {
    const personal = { fecha: '2026-10-23', modalidad: 'PERSONAL' as const };
    expect(errorNotificacion('EMITIDO', '2026-10-20', personal, '2026-10-23')).toMatch(/nombre/);
    expect(errorNotificacion('EMITIDO', '2026-10-20', { ...personal, nombre: 'Ana', dni: '123' }, '2026-10-23')).toMatch(/DNI/);
    expect(errorNotificacion('EMITIDO', '2026-10-20', { ...personal, nombre: 'Ana', dni: '12345678' }, '2026-10-23')).toBeNull();
  });
});

describe('errorAnulacion', () => {
  it('exige un motivo explicado', () => {
    expect(errorAnulacion('EMITIDO', 'error')).toMatch(/mínimo 10/);
    expect(errorAnulacion('NOTIFICADO', 'Error en el área de terreno')).toBeNull();
  });

  it('no anula valores en coactivo, cancelados ni ya anulados', () => {
    expect(errorAnulacion('COACTIVO', 'Error en el área de terreno')).toMatch(/coactiva/);
    expect(errorAnulacion('CANCELADO', 'Error en el área de terreno')).toMatch(/cancelado/);
    expect(errorAnulacion('ANULADO', 'Error en el área de terreno')).toMatch(/anulado/);
  });
});
