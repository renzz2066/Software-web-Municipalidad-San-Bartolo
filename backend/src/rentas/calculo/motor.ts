// Motor de cálculo de predial y arbitrios (specs/rentas-nucleo-v1.md, C5). Lógica pura:
// recibe parámetros del año y predios ya cargados; no toca Prisma. Montos con Decimal y
// redondeo a 2 decimales por cuota (decisión 4 de la spec).
import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

// D.L. 776 art. 13: impuesto mínimo = 0.6% de la UIT vigente al 1 de enero.
export const MINIMO_PREDIAL_PCT_UIT = 0.6;
export const CUOTAS_POR_ANIO = 4; // predial y arbitrios trimestrales (decisiones 3 y spec D)
const MESES_VENCIMIENTO = [2, 5, 8, 11]; // feb, may, ago, nov

// Mismo orden que el enum ComponenteConstruccion y que las letras de Piso.categorias.
export const COMPONENTES = ['MUROS_COLUMNAS', 'TECHOS', 'PISOS', 'PUERTAS_VENTANAS', 'REVESTIMIENTOS', 'BANOS', 'INSTALACIONES'] as const;

export interface ParametrosAnio {
  anio: number;
  uit: Num;
  derechoEmision: Num;
  escala: { desdeUit: Num; hastaUit: Num | null; tasa: Num }[];
  aranceles: { viaId: number; urbanizacionId: number | null; valorM2: Num }[];
  valoresUnitarios: { componente: string; categoria: string; valor: Num }[];
  depreciaciones: { clasificacion: string; material: string; estadoConservacion: string; antiguedadHasta: number; porcentaje: Num }[];
  tarifas: { concepto: string; zonaId: number | null; uso: string | null; tasa: Num }[];
}

export interface PisoCalculo {
  nivel: string;
  anioConstruccion: number | null;
  clasificacion: string | null;
  material: string | null;
  estadoConservacion: string | null;
  categorias: string | null;
  areaConstruida: Num | null;
}

export interface PredioCalculo {
  id: number;
  viaId: number | null;
  urbanizacionId: number | null;
  zonaId: number | null;
  usoPredio: string | null;
  areaTerreno: Num | null;
  pisos: PisoCalculo[];
  otrasInstalaciones: { valor: Num | null }[];
  titulares: { contribuyenteId: number; porcentaje: Num }[];
}

export interface PisoValorizado {
  nivel: string;
  valorUnitario: string;
  depreciacion: string;
  valor: string;
}

export type Valorizacion =
  | { ok: true; terreno: Dec; construccion: Dec; otras: Dec; autoavaluo: Dec; arancel: Dec; pisos: PisoValorizado[] }
  | { ok: false; error: string };

export const redondear = (x: Num) => new D(x).toDecimalPlaces(2, D.ROUND_HALF_UP);

// ---- Autoavalúo ----

export function valorizarPredio(p: PredioCalculo, params: ParametrosAnio): Valorizacion {
  if (!p.viaId || p.areaTerreno === null) {
    return { ok: false, error: `Predio #${p.id}: falta vía o área de terreno` };
  }
  const arancel =
    params.aranceles.find((a) => a.viaId === p.viaId && a.urbanizacionId === p.urbanizacionId) ??
    params.aranceles.find((a) => a.viaId === p.viaId && a.urbanizacionId === null);
  if (!arancel) {
    return { ok: false, error: `Predio #${p.id}: no hay arancel ${params.anio} para su vía` };
  }
  const terreno = redondear(new D(p.areaTerreno).times(arancel.valorM2));

  const pisos: PisoValorizado[] = [];
  let construccion = new D(0);
  for (const piso of p.pisos) {
    const r = valorizarPiso(piso, params);
    if ('error' in r) return { ok: false, error: `Predio #${p.id}, nivel ${piso.nivel}: ${r.error}` };
    pisos.push({ nivel: piso.nivel, valorUnitario: r.valorUnitario.toFixed(2), depreciacion: r.depreciacion.toFixed(2), valor: r.valor.toFixed(2) });
    construccion = construccion.plus(r.valor);
  }
  const otras = p.otrasInstalaciones.reduce((acc, o) => acc.plus(o.valor ?? 0), new D(0));
  return {
    ok: true,
    terreno,
    construccion,
    otras: redondear(otras),
    autoavaluo: redondear(terreno.plus(construccion).plus(otras)),
    arancel: new D(arancel.valorM2),
    pisos,
  };
}

function valorizarPiso(piso: PisoCalculo, params: ParametrosAnio) {
  if (!piso.categorias || piso.categorias.length !== COMPONENTES.length) {
    return { error: 'faltan las categorías de construcción' };
  }
  if (piso.anioConstruccion === null || piso.areaConstruida === null) {
    return { error: 'falta año de construcción o área' };
  }
  let valorUnitario = new D(0);
  for (let i = 0; i < COMPONENTES.length; i++) {
    const letra = piso.categorias[i];
    if (letra === '-') continue;
    const vu = params.valoresUnitarios.find((v) => v.componente === COMPONENTES[i] && v.categoria === letra);
    if (!vu) return { error: `no hay valor unitario ${params.anio} para ${COMPONENTES[i]} categoría ${letra}` };
    valorUnitario = valorUnitario.plus(vu.valor);
  }
  const antiguedad = Math.max(0, params.anio - piso.anioConstruccion);
  const filas = params.depreciaciones
    .filter((d) => d.clasificacion === piso.clasificacion && d.material === piso.material && d.estadoConservacion === piso.estadoConservacion)
    .sort((a, b) => a.antiguedadHasta - b.antiguedadHasta);
  if (filas.length === 0) {
    return { error: 'no hay depreciación para su clasificación, material y conservación' };
  }
  // Primer rango que cubre la antigüedad; si la supera a todos, el último (tope de la tabla).
  const fila = filas.find((d) => d.antiguedadHasta >= antiguedad) ?? filas[filas.length - 1];
  const depreciacion = new D(fila.porcentaje);
  const valor = redondear(new D(piso.areaConstruida).times(valorUnitario).times(new D(100).minus(depreciacion)).div(100));
  return { valorUnitario, depreciacion, valor };
}

// ---- Impuesto predial (por contribuyente, sobre la suma de sus predios en el distrito) ----

export function impuestoPredial(base: Num, params: Pick<ParametrosAnio, 'uit' | 'escala'>): Dec {
  const uit = new D(params.uit);
  const b = new D(base);
  let impuesto = new D(0);
  for (const t of params.escala) {
    const desde = uit.times(t.desdeUit);
    const hasta = t.hastaUit === null ? null : uit.times(t.hastaUit);
    if (b.lte(desde)) continue;
    const tope = hasta === null || b.lt(hasta) ? b : hasta;
    impuesto = impuesto.plus(tope.minus(desde).times(t.tasa).div(100));
  }
  const minimo = uit.times(MINIMO_PREDIAL_PCT_UIT).div(100);
  return redondear(D.max(impuesto, minimo));
}

// ---- Arbitrios: tarifa más específica (zona+uso > zona > uso > general) ----

export function tarifaArbitrio(predio: Pick<PredioCalculo, 'zonaId' | 'usoPredio'>, concepto: string, tarifas: ParametrosAnio['tarifas']) {
  const uso = predio.usoPredio?.toUpperCase() ?? null;
  const candidatas = tarifas.filter(
    (t) => t.concepto === concepto && (t.zonaId === null || t.zonaId === predio.zonaId) && (t.uso === null || t.uso === uso),
  );
  const puntaje = (t: (typeof candidatas)[number]) => (t.zonaId !== null ? 2 : 0) + (t.uso !== null ? 1 : 0);
  return candidatas.sort((a, b) => puntaje(b) - puntaje(a))[0] ?? null;
}

// ---- Cuotas ----

// Reparte con redondeo por cuota; la última absorbe la diferencia para que la suma cuadre.
export function repartir(total: Num, n: number): Dec[] {
  const t = redondear(total);
  const cuota = t.div(n).toDecimalPlaces(2, D.ROUND_DOWN);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? cuota : t.minus(cuota.times(n - 1))));
}

// Vencimiento: último día del mes de la cuota (feriados no contemplados en v1).
export function vencimientos(anio: number): string[] {
  return MESES_VENCIMIENTO.map((mes) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10));
}

// ---- Sincronización idempotente con la cuenta corriente existente ----

export interface LineaCuenta {
  contribuyenteId: number;
  predioId: number | null;
  tributoId: number;
  cuota: number;
  importe: Dec;
  derechoEmision: Dec;
  fechaVencimiento: string;
}

export interface CuentaExistente {
  id: number;
  contribuyenteId: number;
  predioId: number | null;
  tributoId: number;
  cuota: number;
  importe: Num;
  derechoEmision: Num;
  estado: string;
  enValor?: boolean; // incluida en una OP/RD vigente (EMITIDO/NOTIFICADO)
  ajustes?: Num; // diferencias de fiscalización vigentes sobre esta cuota (filas con ajusteDeId)
}

export const claveCuenta = (c: { contribuyenteId: number; predioId: number | null; tributoId: number; cuota: number }) =>
  `${c.contribuyenteId}|${c.predioId ?? '-'}|${c.tributoId}|${c.cuota}`;

// Solo se tocan cuotas PENDIENTE (o ANULADO que vuelve a corresponder). Las CANCELADO,
// FRACCIONADO, COACTIVO o EXTORNADO quedan intactas: ya tienen pagos o trámites encima.
// Una PENDIENTE dentro de un valor vigente tampoco cambia ni se anula: hay que anular el valor
// antes (specs/rentas-valores-v1.md, V8). Las diferencias de una fiscalización son parte de la cuota:
// se suman al comparar y se descuentan al actualizar, para no cobrarlas dos veces
// (specs/rentas-fiscalizacion-v1.md, decisión 3).
export function planificar(nuevas: LineaCuenta[], existentes: CuentaExistente[]) {
  const porClave = new Map(existentes.map((e) => [claveCuenta(e), e]));
  const crear: LineaCuenta[] = [];
  const actualizar: (LineaCuenta & { id: number })[] = [];
  let sinCambio = 0;
  let protegidas = 0;
  const vistas = new Set<string>();

  for (const n of nuevas) {
    const k = claveCuenta(n);
    vistas.add(k);
    const e = porClave.get(k);
    if (!e) {
      crear.push(n);
    } else if (e.estado === 'PENDIENTE' || e.estado === 'ANULADO') {
      const ajustes = new D(e.ajustes ?? 0);
      const igual =
        e.estado === 'PENDIENTE' && new D(e.importe).plus(ajustes).eq(n.importe) && new D(e.derechoEmision).eq(n.derechoEmision);
      if (igual) sinCambio++;
      else if (e.enValor) protegidas++;
      else actualizar.push({ ...n, importe: n.importe.minus(ajustes), id: e.id });
    } else {
      protegidas++;
    }
  }
  const anular = existentes.filter((e) => e.estado === 'PENDIENTE' && !e.enValor && !vistas.has(claveCuenta(e))).map((e) => e.id);
  return { crear, actualizar, anular, sinCambio, protegidas };
}
