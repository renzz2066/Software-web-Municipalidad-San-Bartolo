// Reglas puras del fraccionamiento (specs/rentas-valores-v1.md, V6). Sin Prisma: se prueban con vitest.
// - Cuota inicial (n.° 0) vence el día del convenio y no lleva interés.
// - El saldo se paga en n cuotas mensuales fijas (sistema francés) con el interés mensual del año;
//   la cuota k vence el último día del k-ésimo mes siguiente al del convenio.
// - Redondeo a 2 decimales por cuota; la última absorbe la diferencia para que la amortización
//   sume exactamente el saldo.
import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

const r2 = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface CuotaCronograma {
  numero: number; // 0 = cuota inicial
  vencimiento: string; // AAAA-MM-DD
  amortizacion: Dec;
  interes: Dec;
  monto: Dec;
}

export function finDeMes(fecha: string, mesesDespues: number): string {
  const [y, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + mesesDespues + 1, 0)).toISOString().slice(0, 10);
}

export function cronograma(total: Num, cuotaInicial: Num, n: number, interesMensualPct: Num, fecha: string): CuotaCronograma[] {
  const inicial = r2(new D(cuotaInicial));
  const saldoInicial = r2(new D(total)).minus(inicial);
  const r = new D(interesMensualPct).div(100);
  const cuotas: CuotaCronograma[] = [];
  if (inicial.gt(0)) {
    cuotas.push({ numero: 0, vencimiento: fecha, amortizacion: inicial, interes: new D(0), monto: inicial });
  }

  const fija = r.isZero()
    ? saldoInicial.div(n)
    : saldoInicial.times(r).div(new D(1).minus(new D(1).plus(r).pow(-n)));
  const cuotaFija = r2(fija);
  let saldo = saldoInicial;
  for (let k = 1; k <= n; k++) {
    const interes = r2(saldo.times(r));
    const amortizacion = k === n ? saldo : cuotaFija.minus(interes);
    cuotas.push({ numero: k, vencimiento: finDeMes(fecha, k), amortizacion, interes, monto: amortizacion.plus(interes) });
    saldo = saldo.minus(amortizacion);
  }
  return cuotas;
}

export interface LimitesFraccionamiento {
  cuotaInicialMinPct: Num;
  cuotasMax: number;
  montoMinimo: Num;
}

// Cuota inicial mínima en soles, redondeada hacia arriba al céntimo.
export function cuotaInicialMinima(total: Num, pct: Num): Dec {
  return new D(total).times(pct).div(100).toDecimalPlaces(2, D.ROUND_UP);
}

export function errorConvenio(
  limites: LimitesFraccionamiento | null,
  anio: number,
  c: { total: Num; cuotaInicial: Num; numCuotas: number },
): string | null {
  if (!limites) return `No hay parámetros de fraccionamiento ${anio}: regístralos en Maestros`;
  const total = new D(c.total);
  const inicial = new D(c.cuotaInicial);
  if (total.lessThan(limites.montoMinimo)) return `La deuda elegida es menor que el mínimo para fraccionar (S/ ${new D(limites.montoMinimo).toFixed(2)})`;
  const minima = cuotaInicialMinima(total, limites.cuotaInicialMinPct);
  if (inicial.lessThan(minima)) return `La cuota inicial debe ser al menos S/ ${minima.toFixed(2)} (${new D(limites.cuotaInicialMinPct).toString()}%)`;
  if (!inicial.lessThan(total)) return 'La cuota inicial debe ser menor que la deuda: no queda saldo que fraccionar';
  if (!Number.isInteger(c.numCuotas) || c.numCuotas < 1) return 'El número de cuotas debe ser al menos 1';
  if (c.numCuotas > limites.cuotasMax) return `El máximo es ${limites.cuotasMax} cuotas`;
  return null;
}

export const MOTIVO_ANULACION_MIN = 10;

// Anular solo un convenio vigente y sin cuotas pagadas (con pagos corresponde la pérdida, v2).
export function errorAnulacionConvenio(estado: string, cuotasPagadas: number, motivo: string): string | null {
  if (estado !== 'FRACCIONADO') return `El convenio ya está ${estado.toLowerCase()}`;
  if (cuotasPagadas > 0) return 'El convenio tiene cuotas pagadas: no se puede anular';
  if (motivo.trim().length < MOTIVO_ANULACION_MIN) return `Explica el motivo de la anulación (mínimo ${MOTIVO_ANULACION_MIN} caracteres)`;
  return null;
}
