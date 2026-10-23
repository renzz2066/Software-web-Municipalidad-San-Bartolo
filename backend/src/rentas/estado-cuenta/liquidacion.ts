// Liquidación de deuda a una fecha (specs/rentas-nucleo-v1.md, C6). Lógica pura.
// - Reajuste (D.L. 776 art. 15): cuotas 2-4 del predial × variación acumulada del IPM entre el
//   mes de vencimiento de la cuota 1 y el mes anterior a la fecha. Pago hasta la cuota 1: sin reajuste.
// - Interés moratorio (Código Tributario art. 33): TIM mensual / 30 por día de atraso, simple,
//   sobre insoluto + reajuste, tramo a tramo según la TIM vigente. El derecho de emisión no genera mora.
import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

const DIA_MS = 86_400_000;

export interface Tasa {
  vigenciaDesde: string; // AAAA-MM-DD
  valor: Num;
}

export interface CuotaLiquidable {
  esPredial: boolean;
  cuota: number;
  anio: number;
  importe: Num;
  derechoEmision: Num;
  fechaVencimiento: string; // AAAA-MM-DD
  vencimientoCuota1: string; // AAAA-MM-DD (para el reajuste)
  generaMora: boolean; // PENDIENTE/COACTIVO sí; FRACCIONADO no (lo rige el convenio)
}

export interface Liquidacion {
  insoluto: Dec;
  reajuste: Dec;
  mora: Dec;
  derechoEmision: Dec;
  total: Dec;
  diasAtraso: number;
}

const r2 = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP);
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA_MS);
const masDias = (f: string, n: number) => new Date(Date.parse(f) + n * DIA_MS).toISOString().slice(0, 10);

// Valor vigente en una fecha: la última tasa con vigenciaDesde <= fecha.
export function vigente(tasas: Tasa[], fecha: string): Tasa | null {
  let r: Tasa | null = null;
  for (const t of tasas) if (t.vigenciaDesde <= fecha && (!r || t.vigenciaDesde > r.vigenciaDesde)) r = t;
  return r;
}

export function factorReajuste(ipm: Tasa[], vencimientoCuota1: string, fecha: string): Dec {
  if (fecha <= vencimientoCuota1) return new D(0);
  const mesBase = `${vencimientoCuota1.slice(0, 7)}-01`;
  const [y, m] = fecha.split('-').map(Number);
  const mesAnterior = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const base = ipm.find((t) => t.vigenciaDesde === mesBase);
  const actual = vigente(ipm, mesAnterior);
  if (!base || !actual || new D(base.valor).isZero()) return new D(0);
  const variacion = new D(actual.valor).div(base.valor).minus(1);
  return variacion.isPositive() ? variacion : new D(0);
}

// Interés simple tramo a tramo: cada día de atraso usa la TIM vigente ese día.
export function interesMoratorio(base: Num, tim: Tasa[], vencimiento: string, fecha: string): Dec {
  if (fecha <= vencimiento) return new D(0);
  const ordenadas = [...tim].sort((a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde));
  let total = new D(0);
  let desde = masDias(vencimiento, 1);
  while (desde <= fecha) {
    const t = vigente(ordenadas, desde);
    const siguiente = ordenadas.find((x) => x.vigenciaDesde > desde);
    const hasta = siguiente && siguiente.vigenciaDesde <= fecha ? masDias(siguiente.vigenciaDesde, -1) : fecha;
    const n = dias(desde, hasta) + 1;
    if (t) total = total.plus(new D(base).times(t.valor).div(100).div(30).times(n));
    desde = masDias(hasta, 1);
  }
  return total;
}

export function liquidar(c: CuotaLiquidable, fecha: string, ipm: Tasa[], tim: Tasa[]): Liquidacion {
  const insoluto = new D(c.importe);
  const reajuste = c.esPredial && c.cuota >= 2 ? r2(insoluto.times(factorReajuste(ipm, c.vencimientoCuota1, fecha))) : new D(0);
  const mora = c.generaMora ? r2(interesMoratorio(insoluto.plus(reajuste), tim, c.fechaVencimiento, fecha)) : new D(0);
  const derechoEmision = new D(c.derechoEmision);
  return {
    insoluto,
    reajuste,
    mora,
    derechoEmision,
    total: insoluto.plus(reajuste).plus(mora).plus(derechoEmision),
    diasAtraso: Math.max(0, dias(c.fechaVencimiento, fecha)),
  };
}
