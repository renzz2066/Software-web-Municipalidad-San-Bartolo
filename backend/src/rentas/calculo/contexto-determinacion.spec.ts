import { EstadoRegistro, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prediosDelAnio, type Comun, type ContextoPersona, type Liquidada } from './contexto-determinacion.js';
import type { DeclaracionPredio, Declarado, MesArbitrio, PrevioPredio, UsoDatos } from './determinacion.reglas.js';

const uso = (u: Partial<UsoDatos> = {}): UsoDatos => ({ uso: 'CASA', subUso: null, area: 100, frontis: null, participacion: null, fechaInicio: null, fechaFin: null, predominante: true, ...u });
const declarado = (area: number, usos = [uso()]): Declarado => ({ areaTerreno: area, areaComun: null, niveles: [], obras: [], usos, rusticos: [] });
const maestro = { tipo: 'URBANO' as const, viaId: 1, urbanizacionId: null, zonaId: 1, frecuenciaBarrido: null, ubicacionParque: null, frontis: null };
const meses = (desde: number, hasta: number): MesArbitrio[] =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => ({ mes: desde + i, porcentaje: 100, usos: [uso()] }));

const comun = (): Comun => ({
  maestros: new Map([1, 2, 3].map((id) => [id, { maestro, padron: declarado(50), resoluciones: [] }])),
  atributos: new Map(),
  feriados: new Set(),
  tributos: new Map(),
  codigoTributo: new Map(),
  cuotasArbitrios: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
  inicioArbitrios: 'MES_SIGUIENTE',
  parametros: new Map(),
});

const previo = (p: Partial<PrevioPredio>): PrevioPredio => ({ origen: 'DJ 25-0000001 · anexo 1', condicion: null, porcentaje: 100, afectoPredial: true, declarado: declarado(120), meses: meses(1, 12), ...p });
const liquidada = (anio: number, predios: [number, PrevioPredio][]): Liquidada => ({
  id: anio,
  anio,
  djId: null,
  dj: null,
  huella: null,
  baseAfecta: new Prisma.Decimal(0),
  liquidaPredial: true,
  predios: new Map(predios),
});
const persona = (p: Partial<ContextoPersona> = {}): ContextoPersona => ({
  contribuyenteId: 7,
  decls: new Map(),
  titularidad: new Map(),
  liquidadas: new Map(),
  resolucionesPersona: [],
  pendientes: [],
  ...p,
});

describe('determinación anual: qué rige el año nuevo (J09)', () => {
  it('arrastra lo que regía en diciembre: el vendido en junio sale y el comprado en el año ya paga predial (J10)', () => {
    const p = persona({
      liquidadas: new Map([
        [
          2026,
          liquidada(2026, [
            [1, previo({})], // todo el año
            [2, previo({ meses: meses(1, 6) })], // vendido en junio
            [3, previo({ afectoPredial: false, meses: meses(7, 12) })], // comprado en junio: sin predial 2026
          ]),
        ],
      ]),
    });
    const r = prediosDelAnio(comun(), p, 2027);
    expect(r.map((x) => x.predioId)).toEqual([1, 3]);
    expect(r.every((x) => x.afectoPredial && x.meses.length === 12)).toBe(true);
    expect(r[0].origen).toBe('Determinación 2026');
    expect(r[0].declarado.areaTerreno).toBe(120);
  });

  it('un anexo de DJ que ya rige gana al arrastre', () => {
    const modificacion: DeclaracionPredio = {
      djId: 9,
      origen: 'DJ 26-0000004 · anexo 1',
      fechaPresentacion: '2026-11-10',
      orden: 1,
      descargo: false,
      anioAfectacion: 2027,
      fechaArbitrios: '2026-12-01',
      porcentaje: 100,
      condicion: null,
      declarado: declarado(200),
    };
    const p = persona({ decls: new Map([[1, [modificacion]]]), liquidadas: new Map([[2026, liquidada(2026, [[1, previo({})]])]]) });
    const [x] = prediosDelAnio(comun(), p, 2027);
    expect(x.origen).toBe('DJ 26-0000004 · anexo 1');
    expect(x.declarado.areaTerreno).toBe(200);
  });

  it('sin determinación previa rige el padrón: titular al 1 de enero', () => {
    const p = persona({
      titularidad: new Map([[1, { contribuyenteId: 7, fechaAdquisicion: '2020-03-01', fechaFin: null, estado: EstadoRegistro.ACTIVO, porcentaje: 50, condicion: 'CONDOMINIO' }]]),
    });
    const [x] = prediosDelAnio(comun(), p, 2027);
    expect([x.origen, x.porcentaje, x.afectoPredial, x.meses.length]).toEqual(['Padrón', 50, true, 12]);
  });

  it('quien dejó de ser titular (descargo del transferente) no arrastra el predio', () => {
    const p = persona({
      titularidad: new Map([[1, { contribuyenteId: 7, fechaAdquisicion: '2020-03-01', fechaFin: '2026-09-01', estado: EstadoRegistro.BAJA, porcentaje: 100, condicion: null }]]),
      liquidadas: new Map([[2026, liquidada(2026, [[1, previo({})]])]]),
    });
    expect(prediosDelAnio(comun(), p, 2027)).toEqual([]);
  });

  it('fiscalización: la ficha reemplaza lo declarado y la ubicación sin escribir nada', () => {
    const p = persona({ liquidadas: new Map([[2026, liquidada(2026, [[1, previo({})]])]]) });
    const ficha = declarado(300, [uso({ uso: 'COMERCIO', area: 300 })]);
    const [x] = prediosDelAnio(comun(), p, 2026, new Map([[1, { maestro: { viaId: 5 }, declarado: ficha }]]));
    expect(x.origen).toBe('Ficha de fiscalización');
    expect(x.maestro.viaId).toBe(5);
    expect(x.declarado.areaTerreno).toBe(300);
    expect(x.meses[0].usos[0].uso).toBe('COMERCIO');
  });
});
