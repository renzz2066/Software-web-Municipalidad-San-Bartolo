import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  impuestoPredial,
  planificar,
  repartir,
  tarifaArbitrio,
  valorizarPredio,
  vencimientos,
  type CuentaExistente,
  type LineaCuenta,
  type ParametrosAnio,
  type PredioCalculo,
} from './motor.js';

const D = Prisma.Decimal;

// UIT 2026 = 5 500; escala legal D.L. 776.
const params: ParametrosAnio = {
  anio: 2026,
  uit: 5500,
  derechoEmision: 10,
  escala: [
    { desdeUit: 0, hastaUit: 15, tasa: 0.2 },
    { desdeUit: 15, hastaUit: 60, tasa: 0.6 },
    { desdeUit: 60, hastaUit: null, tasa: 1 },
  ],
  aranceles: [
    { viaId: 1, urbanizacionId: null, valorM2: 100 },
    { viaId: 1, urbanizacionId: 7, valorM2: 140 },
  ],
  valoresUnitarios: [
    { componente: 'MUROS_COLUMNAS', categoria: 'C', valor: 200 },
    { componente: 'TECHOS', categoria: 'C', valor: 100 },
  ],
  depreciaciones: [
    { clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', antiguedadHasta: 5, porcentaje: 0 },
    { clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', antiguedadHasta: 10, porcentaje: 8 },
    { clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', antiguedadHasta: 20, porcentaje: 15 },
  ],
  tarifas: [
    { concepto: 'BARRIDO', zonaId: null, uso: null, tasa: 100 },
    { concepto: 'BARRIDO', zonaId: 1, uso: null, tasa: 150 },
    { concepto: 'BARRIDO', zonaId: 1, uso: 'CASA', tasa: 180 },
    { concepto: 'BARRIDO', zonaId: null, uso: 'COMERCIO', tasa: 300 },
  ],
};

const piso = {
  nivel: '01',
  anioConstruccion: 2016,
  clasificacion: 'CASA_HABITACION',
  material: 'LADRILLO',
  estadoConservacion: 'BUENO',
  categorias: 'CC-----',
  areaConstruida: 50,
};

const predio: PredioCalculo = {
  id: 1,
  viaId: 1,
  urbanizacionId: null,
  zonaId: 1,
  usoPredio: 'CASA',
  areaTerreno: 120,
  pisos: [piso],
  otrasInstalaciones: [{ valor: 500 }],
  titulares: [{ contribuyenteId: 1, porcentaje: 100 }],
};

describe('impuestoPredial', () => {
  it('aplica tramos marginales: 400 000 → 165 + 1 485 + 700', () => {
    expect(impuestoPredial(400000, params).toFixed(2)).toBe('2350.00');
  });

  it('en el borde exacto de 15 UIT solo cobra el primer tramo', () => {
    expect(impuestoPredial(82500, params).toFixed(2)).toBe('165.00');
  });

  it('aplica el mínimo de 0.6% UIT cuando el impuesto es menor', () => {
    expect(impuestoPredial(50000, params).toFixed(2)).toBe('100.00');
    expect(impuestoPredial(10000, params).toFixed(2)).toBe('33.00');
    expect(impuestoPredial(0, params).toFixed(2)).toBe('33.00');
  });
});

describe('valorizarPredio', () => {
  it('suma terreno + construcción depreciada + otras instalaciones', () => {
    const r = valorizarPredio(predio, params);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.terreno.toFixed(2)).toBe('12000.00'); // 120 × 100
    expect(r.pisos[0]).toMatchObject({ valorUnitario: '300.00', depreciacion: '8.00', valor: '13800.00' }); // 50 × 300 × 0.92
    expect(r.autoavaluo.toFixed(2)).toBe('26300.00');
  });

  it('prefiere el arancel de la urbanización y usa el tope de depreciación si la antigüedad lo supera', () => {
    const r = valorizarPredio({ ...predio, urbanizacionId: 7, pisos: [{ ...piso, anioConstruccion: 1990 }] }, params);
    expect(r.ok && r.terreno.toFixed(2)).toBe('16800.00');
    expect(r.ok && r.pisos[0].depreciacion).toBe('15.00');
  });

  it('informa qué falta en vez de calcular a medias', () => {
    expect(valorizarPredio({ ...predio, viaId: 2 }, params)).toMatchObject({ ok: false, error: expect.stringMatching(/arancel/) });
    expect(valorizarPredio({ ...predio, pisos: [{ ...piso, categorias: 'DC-----' }] }, params)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/MUROS_COLUMNAS categoría D/),
    });
    expect(valorizarPredio({ ...predio, pisos: [{ ...piso, material: 'ADOBE' }] }, params)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/depreciación/),
    });
  });
});

describe('tarifaArbitrio', () => {
  it('elige la tarifa más específica', () => {
    expect(tarifaArbitrio({ zonaId: 1, usoPredio: 'CASA' }, 'BARRIDO', params.tarifas)?.tasa).toBe(180);
    expect(tarifaArbitrio({ zonaId: 1, usoPredio: 'TIENDA' }, 'BARRIDO', params.tarifas)?.tasa).toBe(150);
    expect(tarifaArbitrio({ zonaId: 2, usoPredio: 'COMERCIO' }, 'BARRIDO', params.tarifas)?.tasa).toBe(300);
    expect(tarifaArbitrio({ zonaId: 2, usoPredio: 'CASA' }, 'BARRIDO', params.tarifas)?.tasa).toBe(100);
    expect(tarifaArbitrio({ zonaId: 2, usoPredio: 'CASA' }, 'PARQUES', params.tarifas)).toBeNull();
  });
});

describe('repartir y vencimientos', () => {
  it('reparte en 4 cuotas y la última absorbe el redondeo', () => {
    expect(repartir(100.01, 4).map((c) => c.toFixed(2))).toEqual(['25.00', '25.00', '25.00', '25.01']);
    expect(repartir(33, 4).map((c) => c.toFixed(2))).toEqual(['8.25', '8.25', '8.25', '8.25']);
    expect(repartir(0.03, 4).reduce((a, c) => a.plus(c), new D(0)).toFixed(2)).toBe('0.03');
  });

  it('vence el último día de feb, may, ago y nov', () => {
    expect(vencimientos(2026)).toEqual(['2026-02-28', '2026-05-31', '2026-08-31', '2026-11-30']);
    expect(vencimientos(2028)[0]).toBe('2028-02-29');
  });
});

describe('planificar (idempotencia)', () => {
  const linea = (cuota: number, importe: number): LineaCuenta => ({
    contribuyenteId: 1,
    predioId: null,
    tributoId: 1,
    cuota,
    importe: new D(importe),
    derechoEmision: new D(0),
    fechaVencimiento: '2026-02-28',
  });
  const existente = (id: number, cuota: number, importe: number, estado: string): CuentaExistente => ({
    id,
    contribuyenteId: 1,
    predioId: null,
    tributoId: 1,
    cuota,
    importe,
    derechoEmision: 0,
    estado,
  });

  it('la primera ejecución crea todo y la segunda no cambia nada', () => {
    const nuevas = [linea(1, 25), linea(2, 25)];
    expect(planificar(nuevas, []).crear).toHaveLength(2);
    const r = planificar(nuevas, [existente(10, 1, 25, 'PENDIENTE'), existente(11, 2, 25, 'PENDIENTE')]);
    expect(r).toMatchObject({ crear: [], actualizar: [], anular: [], sinCambio: 2 });
  });

  it('actualiza pendientes con otro monto y no toca las canceladas', () => {
    const r = planificar([linea(1, 30), linea(2, 30)], [existente(10, 1, 25, 'CANCELADO'), existente(11, 2, 25, 'PENDIENTE')]);
    expect(r.protegidas).toBe(1);
    expect(r.actualizar.map((a) => a.id)).toEqual([11]);
  });

  it('anula pendientes que ya no corresponden y reactiva anuladas que vuelven', () => {
    const r = planificar([linea(1, 25)], [existente(10, 1, 25, 'ANULADO'), existente(11, 2, 25, 'PENDIENTE'), existente(12, 3, 25, 'COACTIVO')]);
    expect(r.actualizar.map((a) => a.id)).toEqual([10]);
    expect(r.anular).toEqual([11]);
  });
});
