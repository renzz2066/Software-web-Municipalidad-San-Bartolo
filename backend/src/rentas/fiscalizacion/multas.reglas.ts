// Reglas puras de multas tributarias (specs/rentas-fiscalizacion-v1.md, F6, F7, decisiones 5 y 6).
// - Monto: % de la UIT del año de la infracción o % del tributo omitido, según la infracción; la
//   persona jurídica usa su propio %, la natural y la sucesión el de persona natural. Sin gradualidad.
// - Plazo de la DJ (D.L. 776 art. 14 b): la inscripción o la compra se declara hasta el último día
//   hábil del mes siguiente al hecho. Venta, rectificación, baja y fiscalización no generan multa aquí.
import { BaseMulta, MotivoDeclaracion, Prisma, TipoPersona } from '@prisma/client';
import { esHabil, masDias } from '../valores/plazos.js';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

const r2 = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface InfraccionMulta {
  base: BaseMulta;
  porcentajeNatural: Num;
  porcentajeJuridica: Num;
}

export const porcentajeMulta = (i: InfraccionMulta, tipoPersona: TipoPersona): Dec =>
  new D(tipoPersona === TipoPersona.JURIDICA ? i.porcentajeJuridica : i.porcentajeNatural);

export function montoMulta(i: InfraccionMulta, tipoPersona: TipoPersona, uit: Num, tributoOmitido: Num = 0): Dec {
  const base = i.base === BaseMulta.UIT ? new D(uit) : new D(tributoOmitido);
  const monto = r2(base.times(porcentajeMulta(i, tipoPersona)).div(100));
  return monto.isNegative() ? new D(0) : monto;
}

// Último día hábil del mes (mes 1-12) de `anio`.
export function ultimoDiaHabilDelMes(anio: number, mes: number, feriados: ReadonlySet<string>): string {
  let f = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  while (!esHabil(f, feriados)) f = masDias(f, -1);
  return f;
}

const CON_PLAZO: MotivoDeclaracion[] = [MotivoDeclaracion.INSCRIPCION, MotivoDeclaracion.COMPRA];

// Vencimiento del plazo para declarar, o null si el motivo no tiene plazo sancionable aquí.
export function vencePlazoDJ(motivo: MotivoDeclaracion, fechaHecho: string, feriados: ReadonlySet<string>): string | null {
  if (!CON_PLAZO.includes(motivo)) return null;
  const [y, m] = fechaHecho.split('-').map(Number);
  const siguiente = new Date(Date.UTC(y, m, 1)); // primer día del mes siguiente
  return ultimoDiaHabilDelMes(siguiente.getUTCFullYear(), siguiente.getUTCMonth() + 1, feriados);
}

// La DJ es extemporánea si se presentó después del vencimiento (F7: propone la multa 176.1).
export function esExtemporanea(motivo: MotivoDeclaracion, fechaHecho: string | null, fechaPresentacion: string, feriados: ReadonlySet<string>) {
  if (!fechaHecho) return false;
  const vence = vencePlazoDJ(motivo, fechaHecho, feriados);
  return vence !== null && fechaPresentacion > vence;
}
