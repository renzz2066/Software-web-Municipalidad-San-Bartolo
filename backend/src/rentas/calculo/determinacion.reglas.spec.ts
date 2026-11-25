import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  agruparArbitrios,
  aniosADeterminar,
  determinarAnio,
  exoneracionPredio,
  incrementoNivel,
  mesDesde,
  numeroPiso,
  rigeEn,
  tarifaV2,
  usosDelMes,
  valorizar,
  valorizarObra,
  vencimientosPredial,
  vigenteArbitrios,
  vigentePredial,
  type DeclaracionPredio,
  type Declarado,
  type Maestro,
  type ParametrosV2,
  type PredioDelAnio,
  type UsoDatos,
} from './determinacion.reglas.js';

const D = Prisma.Decimal;
const SIN_FERIADOS = new Set<string>();
const TRIMESTRES = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
];
const OP = { cuotasArbitrios: TRIMESTRES, feriados: SIN_FERIADOS };

// UIT 2026 = 5 500; escala legal (TUO LTM art. 13).
const params: ParametrosV2 = {
  anio: 2026,
  uit: 5500,
  derechoEmision: 10,
  escala: [
    { desdeUit: 0, hastaUit: 15, tasa: 0.2 },
    { desdeUit: 15, hastaUit: 60, tasa: 0.6 },
    { desdeUit: 60, hastaUit: null, tasa: 1 },
  ],
  aranceles: [{ viaId: 1, urbanizacionId: null, valorM2: 100 }],
  valoresUnitarios: [
    { componente: 'MUROS_COLUMNAS', categoria: 'C', valor: 200 },
    { componente: 'TECHOS', categoria: 'C', valor: 100 },
  ],
  depreciaciones: [{ clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', antiguedadHasta: 50, porcentaje: 0 }],
  tarifas: [
    { concepto: 'RESIDUOS', zonaId: null, uso: null, frecuencia: null, ubicacionParque: null, unidad: 'PREDIO', tasa: 120 },
    { concepto: 'BARRIDO', zonaId: null, uso: null, frecuencia: 'DIARIA', ubicacionParque: null, unidad: 'ML', tasa: 2 },
  ],
  rusticos: [{ categoria: 'A1', clasificacion: null, valorHa: 10000 }],
  conceptos: ['RESIDUOS', 'BARRIDO'],
};

const maestro: Maestro = { tipo: 'URBANO', viaId: 1, urbanizacionId: null, zonaId: 1, frecuenciaBarrido: 'DIARIA', ubicacionParque: null, frontis: 10 };
const uso = (u: Partial<UsoDatos> = {}): UsoDatos => ({
  uso: 'CASA',
  subUso: null,
  area: 100,
  frontis: null,
  participacion: null,
  fechaInicio: null,
  fechaFin: null,
  predominante: true,
  ...u,
});
const declarado = (d: Partial<Declarado> = {}): Declarado => ({ areaTerreno: 100, areaComun: null, niveles: [], obras: [], usos: [uso()], rusticos: [], ...d });
const anioEntero = (pct = 100, usos = [uso()]) => Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: pct, usos }));
const predio = (p: Partial<PredioDelAnio> = {}): PredioDelAnio => ({
  predioId: 1,
  origen: 'DJ 26-0000001 · anexo 1',
  condicion: 'PROPIETARIO_UNICO',
  porcentaje: 100,
  afectoPredial: true,
  maestro,
  declarado: declarado(),
  meses: anioEntero(),
  exoneracion: 0,
  ...p,
});
const SIN_BENEFICIOS = { inafecto: null, deduccion: null, exoneracion: null };

const decl = (d: Partial<DeclaracionPredio>): DeclaracionPredio => ({
  djId: 1,
  origen: 'DJ',
  fechaPresentacion: '2026-01-10',
  orden: 1,
  descargo: false,
  anioAfectacion: 2024,
  fechaArbitrios: '2023-06-01',
  porcentaje: 100,
  condicion: null,
  declarado: declarado(),
  ...d,
});

describe('qué rige cada año (J10, J11, J15)', () => {
  it('J10: una compra en el año N afecta el predial desde N+1', () => {
    const compra = decl({ anioAfectacion: 2024, fechaArbitrios: '2023-06-01' }); // compra del 2023-05-10
    expect(vigentePredial([compra], 2023)).toBeNull();
    expect(vigentePredial([compra], 2024)).toBe(compra);
    // los arbitrios, desde el mes siguiente (J11)
    expect(vigenteArbitrios([compra], 2023, 5)).toBeNull();
    expect(vigenteArbitrios([compra], 2023, 6)).toBe(compra);
  });

  it('J15: una DJ que toca 3 años determina 3 años, hasta el actual', () => {
    expect(aniosADeterminar([{ anioAfectacion: 2024, fechaArbitrios: '2024-01-01' }], 2026)).toEqual([2024, 2025, 2026]);
    // los arbitrios del año de la compra amplían el rango
    expect(aniosADeterminar([{ anioAfectacion: 2025, fechaArbitrios: '2024-06-01' }], 2026)).toEqual([2024, 2025, 2026]);
    // una compra de este mes rige el predial del año próximo: este año solo determina arbitrios
    expect(aniosADeterminar([{ anioAfectacion: 2027, fechaArbitrios: '2026-12-01' }], 2026)).toEqual([2026]);
    expect(aniosADeterminar([{ anioAfectacion: 2027, fechaArbitrios: '2027-01-01' }], 2026)).toEqual([]);
  });

  it('una rectificatoria de 2024 no pisa una modificación que rige desde 2026', () => {
    const original = decl({ orden: 1, anioAfectacion: 2024, fechaPresentacion: '2024-01-10' });
    const modificacion = decl({ orden: 2, anioAfectacion: 2026, fechaPresentacion: '2025-07-01' });
    const rectificatoria = decl({ orden: 3, anioAfectacion: 2024, fechaPresentacion: '2026-03-01' });
    const todas = [original, modificacion, rectificatoria];
    expect(vigentePredial(todas, 2025)).toBe(rectificatoria);
    expect(vigentePredial(todas, 2026)).toBe(modificacion);
  });

  it('el descargo es lo último que rige: el predio sale desde su año de afectación', () => {
    const compra = decl({ orden: 1, anioAfectacion: 2020 });
    const venta = decl({ orden: 2, anioAfectacion: 2025, descargo: true, fechaPresentacion: '2024-06-10' });
    expect(vigentePredial([compra, venta], 2024)).toBe(compra);
    expect(vigentePredial([compra, venta], 2025)?.descargo).toBe(true);
  });
});

describe('arbitrios por mes (J11, R03, L07)', () => {
  it('con MES_SIGUIENTE un hecho de mayo rige desde junio; uno de diciembre, desde enero del año siguiente', () => {
    expect(mesDesde('2026-05-20', 2026, 'MES_SIGUIENTE')).toBe(6);
    expect(mesDesde('2026-05-20', 2026, 'MES_DEL_HECHO')).toBe(5);
    expect(mesDesde('2025-12-20', 2026, 'MES_SIGUIENTE')).toBe(1);
    expect(mesDesde('2024-03-01', 2026, 'MES_SIGUIENTE')).toBe(0);
  });

  it('un uso que empieza en agosto paga desde septiembre y uno que acaba en agosto paga agosto', () => {
    const tienda = uso({ uso: 'COMERCIO', fechaInicio: '2026-08-15', predominante: false });
    const casa = uso({ fechaFin: '2026-08-15' });
    expect(usosDelMes([casa, tienda], 2026, 8, 'MES_SIGUIENTE').map((u) => u.uso)).toEqual(['CASA']);
    expect(usosDelMes([casa, tienda], 2026, 9, 'MES_SIGUIENTE').map((u) => u.uso)).toEqual(['COMERCIO']);
  });

  it('L06/L07: agrupa los meses en cuotas y la última absorbe el redondeo', () => {
    // 100 / 12 = 8.3333 por mes; cuotas trimestrales 25.00 + 25.00 + 25.00 y la última 25.00 cuadra 100.00
    const meses = Array.from({ length: 12 }, (_, i) => ({ predioId: 1, uso: 'CASA', mes: i + 1, concepto: 'RESIDUOS', importe: new D('8.3333') }));
    const cuotas = agruparArbitrios(meses, TRIMESTRES, 2026, SIN_FERIADOS);
    expect(cuotas.map((c) => c.importe.toFixed(2))).toEqual(['25.00', '25.00', '25.00', '25.00']);
    expect(cuotas.map((c) => c.vence)).toEqual(['2026-02-27', '2026-05-29', '2026-08-31', '2026-11-30']);
    // compra en mayo: de junio a diciembre (7 meses), la cuota 2 solo tiene junio
    const desdeJunio = meses.filter((m) => m.mes >= 6);
    const parcial = agruparArbitrios(desdeJunio, TRIMESTRES, 2026, SIN_FERIADOS);
    expect(parcial.map((c) => [c.cuota, c.importe.toFixed(2)])).toEqual([
      [2, '8.33'],
      [3, '25.00'],
      [4, '25.00'],
    ]);
  });

  it('la tarifa más específica gana y cada concepto se cobra sobre su unidad', () => {
    const tarifas = [
      ...params.tarifas,
      { concepto: 'RESIDUOS', zonaId: 1, uso: 'COMERCIO', frecuencia: null, ubicacionParque: null, unidad: 'M2', tasa: 3 },
    ];
    expect(tarifaV2({ zonaId: 1, uso: 'COMERCIO', frecuencia: null, parque: null }, 'RESIDUOS', tarifas)?.unidad).toBe('M2');
    expect(tarifaV2({ zonaId: 2, uso: 'COMERCIO', frecuencia: null, parque: null }, 'RESIDUOS', tarifas)?.unidad).toBe('PREDIO');
    expect(tarifaV2({ zonaId: 1, uso: 'CASA', frecuencia: 'SEMANAL', parque: null }, 'BARRIDO', tarifas)).toBeNull();
  });
});

describe('autoavalúo (V01–V07)', () => {
  it('V04: el área común entra por su % de participación', () => {
    const v = valorizar(
      1,
      maestro,
      declarado({
        niveles: [
          { nivel: '1', anioConstruccion: 2020, clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', categorias: 'CC-----', areaPropia: 50, areaComun: 20, participacion: 50 },
        ],
      }),
      params,
    );
    // terreno 100 × 100 = 10 000; construcción (50 + 10) × 300 = 18 000
    expect(v.ok && [v.terreno.toFixed(2), v.construccion.toFixed(2), v.autoavaluo.toFixed(2)]).toEqual(['10000.00', '18000.00', '28000.00']);
  });

  it('V06/V07: sin arancel no se valoriza; el rústico usa su arancel por hectárea', () => {
    const sinVia = valorizar(1, { ...maestro, viaId: 9 }, declarado(), params);
    expect(sinVia.ok).toBe(false);
    const rustico = valorizar(2, { ...maestro, tipo: 'RUSTICO', viaId: null }, declarado({ rusticos: [{ categoria: 'A1', clasificacion: 'X', hectareas: 1.5 }] }), params);
    expect(rustico.ok && rustico.terreno.toFixed(2)).toBe('15000.00');
    const sinArancel = valorizar(2, { ...maestro, tipo: 'RUSTICO', viaId: null }, declarado({ rusticos: [{ categoria: 'B9', clasificacion: null, hectareas: 1 }] }), params);
    expect(sinArancel.ok).toBe(false);
  });
});

describe('determinación del año (L01–L07, P14, P15, R06)', () => {
  it('L01: la base suma los predios por su %, incluido el que no se declaró en esta DJ (J15)', () => {
    const declarado2 = predio({ predioId: 2, origen: 'Padrón', porcentaje: 50, declarado: declarado({ areaTerreno: 200 }) });
    const d = determinarAnio(params, [predio(), declarado2], SIN_BENEFICIOS, OP);
    // 10 000 + 50% de 20 000 = 20 000 → 0.2% = 40 (mínimo 0.6% UIT = 33): 40 en 4 cuotas + emisión en la 1
    expect(d.baseImponible.toFixed(2)).toBe('20000.00');
    expect(d.impuesto.toFixed(2)).toBe('40.00');
    expect(d.cuotasPredial.map((c) => [c.importe.toFixed(2), c.derechoEmision.toFixed(2)])).toEqual([
      ['10.00', '10.00'],
      ['10.00', '0.00'],
      ['10.00', '0.00'],
      ['10.00', '0.00'],
    ]);
    expect(d.cuotasPredial.map((c) => c.vence)).toEqual(vencimientosPredial(2026, SIN_FERIADOS));
  });

  it('L06: la última cuota del predial absorbe el redondeo', () => {
    const d = determinarAnio({ ...params, escala: [{ desdeUit: 0, hastaUit: null, tasa: 1 }] }, [predio({ declarado: declarado({ areaTerreno: 50.01 }) })], SIN_BENEFICIOS, OP);
    // 5 001 × 1% = 50.01 → 12.50 × 3 + 12.51
    expect(d.cuotasPredial.map((c) => c.importe.toFixed(2))).toEqual(['12.50', '12.50', '12.50', '12.51']);
  });

  it('J10: el predio comprado en el año no paga predial pero sí arbitrios desde el mes siguiente', () => {
    const comprado = predio({ afectoPredial: false, meses: anioEntero().filter((m) => m.mes >= 6) });
    const d = determinarAnio(params, [comprado], SIN_BENEFICIOS, OP);
    expect(d.cuotasPredial).toEqual([]);
    expect(d.impuesto.toFixed(2)).toBe('0.00');
    // RESIDUOS 120/año × 7/12 = 70 ; BARRIDO 2 × 10 m de frontis = 20/año × 7/12 = 11.67
    expect(d.arbitrios.toFixed(2)).toBe('81.67');
  });

  it('P15: deduce 50 UIT con un solo predio; con dos, no y avisa', () => {
    const deduccion = { regimen: 'DEDUCCION', nombre: 'Pensionista', resolucion: 'RG-1', deduccionUit: 50, anioDesde: 2020, anioHasta: null, vigente: true };
    const uno = determinarAnio(params, [predio()], { ...SIN_BENEFICIOS, deduccion }, OP);
    expect(uno.deduccion.toFixed(2)).toBe('10000.00');
    expect(uno.impuesto.toFixed(2)).toBe('0.00');
    expect(uno.cuotasPredial).toHaveLength(1); // solo el derecho de emisión
    const dos = determinarAnio(params, [predio(), predio({ predioId: 2 })], { ...SIN_BENEFICIOS, deduccion }, OP);
    expect(dos.deduccion.toFixed(2)).toBe('0.00');
    expect(dos.avisos.some((a) => a.startsWith('P15'))).toBe(true);
  });

  it('P14: el inafecto no paga predial ni emisión; R06: el predio exonerado entra por su parte', () => {
    const inafecto = { regimen: 'INAFECTACION', nombre: 'Beneficencia', resolucion: 'RG-2', anioDesde: 2020, anioHasta: null, vigente: true };
    expect(determinarAnio(params, [predio()], { ...SIN_BENEFICIOS, inafecto }, OP).cuotasPredial).toEqual([]);
    const exonerado = determinarAnio(params, [predio({ exoneracion: 50 })], SIN_BENEFICIOS, OP);
    expect(exonerado.baseImponible.toFixed(2)).toBe('5000.00');
  });

  it('V06: un predio sin arancel deja el predial sin calcular, con el motivo', () => {
    const d = determinarAnio(params, [predio({ maestro: { ...maestro, viaId: 9 } })], SIN_BENEFICIOS, OP);
    expect(d.predialCalculable).toBe(false);
    expect(d.errores[0]).toMatch(/arancel/);
    expect(d.cuotasPredial).toEqual([]);
  });

  it('las resoluciones rigen en sus años; una revocada, hasta su año final', () => {
    expect(rigeEn({ anioDesde: 2024, anioHasta: null, vigente: true }, 2026)).toBe(true);
    expect(rigeEn({ anioDesde: 2024, anioHasta: 2025, vigente: false }, 2025)).toBe(true);
    expect(rigeEn({ anioDesde: 2024, anioHasta: 2025, vigente: false }, 2026)).toBe(false);
    expect(rigeEn({ anioDesde: 2024, anioHasta: null, vigente: false }, 2024)).toBe(false);
    expect(exoneracionPredio([{ regimen: 'EXONERACION', nombre: 'x', resolucion: 'r', porcentaje: 30, anioDesde: 2026, anioHasta: null, vigente: true }], 2026)).toBe(30);
  });
});

// ---- Fase 7: V03 (incremento por pisos) y V05 (obras complementarias) ----

describe('V03: incremento del valor unitario por piso', () => {
  const nivel = (n: string) => ({
    nivel: n,
    anioConstruccion: 2026,
    clasificacion: 'CASA_HABITACION',
    material: 'LADRILLO',
    estadoConservacion: 'BUENO',
    categorias: 'CC-----',
    areaPropia: 10,
    areaComun: null,
    participacion: null,
  });

  it('solo los niveles numéricos cuentan como piso', () => {
    expect(numeroPiso('5')).toBe(5);
    expect(numeroPiso('05')).toBe(5);
    expect(numeroPiso('p7')).toBe(7);
    expect(numeroPiso('S1')).toBeNull();
    expect(numeroPiso('AZ')).toBeNull();
    expect(numeroPiso('MZ')).toBeNull();
  });

  it('sube el % desde el piso indicado; sin parámetro no hay incremento', () => {
    const inc = { desdePiso: 5, pct: 5 };
    expect(incrementoNivel('4', inc).toFixed(2)).toBe('0.00');
    expect(incrementoNivel('5', inc).toFixed(2)).toBe('5.00');
    expect(incrementoNivel('12', inc).toFixed(2)).toBe('5.00');
    expect(incrementoNivel('AZ', inc).toFixed(2)).toBe('0.00');
    expect(incrementoNivel('9', null).toFixed(2)).toBe('0.00');
  });

  it('el valor unitario sube antes de depreciar (300 → 315 en el piso 5)', () => {
    const p = { ...params, incrementoPisos: { desdePiso: 5, pct: 5 } };
    const v = valorizar(1, maestro, declarado({ niveles: [nivel('4'), nivel('5')] }), p);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.niveles.map((n) => [n.nivel, n.valorUnitario, n.incremento, n.valor])).toEqual([
      ['4', '300.00', '0.00', '3000.00'],
      ['5', '315.00', '5.00', '3150.00'],
    ]);
  });
});

describe('V05: obras complementarias a valor oficial', () => {
  const p = {
    ...params,
    factorObras: 0.68,
    valoresObras: [{ codigo: 'C01', unidad: 'ml', valor: 200 }],
    depreciaciones: [
      ...params.depreciaciones,
      { clasificacion: 'CASA_HABITACION', material: 'CONCRETO', estadoConservacion: 'REGULAR', antiguedadHasta: 10, porcentaje: 20 },
    ],
  };
  const cerco = { descripcion: 'CERCO', cantidad: 10, valorDeclarado: 999, codigo: 'C01', anioConstruccion: 2020, material: 'CONCRETO', estadoConservacion: 'REGULAR' };

  it('cantidad × valor × factor × (1 − depreciación); ignora el valor declarado', () => {
    const r = valorizarObra(cerco, 'CASA_HABITACION', p);
    expect(r.ok && r.valor.toFixed(2)).toBe('1088.00'); // 10 × 200 × 0.68 × 0.80
    expect(r.ok && r.obra).toMatchObject({ codigo: 'C01', valorUnitario: '200.00', factor: '0.6800', depreciacion: '20.00' });
  });

  it('sin código sigue el valor declarado (como v1 y lo guardado antes de la Fase 7)', () => {
    const r = valorizarObra({ descripcion: 'TANQUE', cantidad: 1, valorDeclarado: 1500 }, 'CASA_HABITACION', p);
    expect(r.ok && r.valor.toFixed(2)).toBe('1500.00');
  });

  it('sin factor, sin valor del código o sin depreciación, el predio no se valoriza', () => {
    expect(valorizarObra(cerco, 'CASA_HABITACION', { ...p, factorObras: null })).toMatchObject({ ok: false });
    expect(valorizarObra({ ...cerco, codigo: 'X99' }, 'CASA_HABITACION', p)).toMatchObject({ ok: false });
    expect(valorizarObra({ ...cerco, material: 'ADOBE' }, 'CASA_HABITACION', p)).toMatchObject({ ok: false });
    const v = valorizar(1, maestro, declarado({ obras: [cerco] }), { ...p, factorObras: null });
    expect(v.ok).toBe(false);
  });

  it('suma al autoavalúo del predio', () => {
    const v = valorizar(1, maestro, declarado({ obras: [cerco] }), p);
    expect(v.ok && [v.obras.toFixed(2), v.autoavaluo.toFixed(2)]).toEqual(['1088.00', '11088.00']);
  });
});
