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

// J08 (Fase 7): lo que cambió el autoavalúo de cada predio con una DJ de modificación, guardado al
// determinarla (antes = lo que regía sin esta DJ; después = lo declarado), con los parámetros del año del hecho.
export interface VariacionDj {
  anio: number;
  hecho: string | null;
  uit: string | null; // null = falta la UIT de ese año: no se evalúa
  limite: string | null; // 5 UIT
  predios: { predioId: number; antes: string | null; despues: string | null; cambio: string | null }[];
  supera: boolean;
}

export const UIT_MODIFICACION = 5;

// TUO LTM art. 14 b): cambios en el predio de más de 5 UIT. Cuenta el cambio de cada predio, suba o baje.
export function superaCincoUit(predios: VariacionDj['predios'], uit: Num | null): boolean {
  if (uit === null) return false;
  const limite = new D(uit).times(UIT_MODIFICACION);
  return predios.some((p) => p.cambio !== null && new D(p.cambio).abs().gt(limite));
}

// J16: prórroga aprobada que alcanza a la DJ (ya filtrada por persona, motivo y año del vencimiento).
export interface ProrrogaAplicable {
  id: number;
  fechaLimite: string;
}

export interface PlazoDj {
  hecho: string | null;
  vence: string;
  venceOriginal: string;
  prorroga: ProrrogaAplicable | null;
  cambio5Uit: boolean;
}

// Mes siguiente al hecho: último día hábil.
function mesSiguiente(hecho: string, feriados: ReadonlySet<string>) {
  const [y, m] = hecho.split('-').map(Number);
  const siguiente = new Date(Date.UTC(y, m, 1));
  return ultimoDiaHabilDelMes(siguiente.getUTCFullYear(), siguiente.getUTCMonth() + 1, feriados);
}

// J08 para la DJ presentada (v2, specs/rentas-nucleo-v2.md, Fases 5 y 7). TUO LTM art. 14:
// - inscripción, adquisición o transferencia: último día hábil del mes siguiente al primer hecho
//   declarado (adquisición o descargo de cualquier anexo);
// - modificación de más de 5 UIT (según lo guardado al determinar): igual, desde la fecha del documento;
// - anual: último día hábil de febrero del año.
// Una prórroga aprobada (J16) mueve el vencimiento a su fecha límite, si es posterior.
export function plazoDjPresentada(
  motivo: string,
  hechos: (string | null)[],
  anioPresentacion: number,
  feriados: ReadonlySet<string>,
  op: { variacion?: VariacionDj | null; prorrogas?: ProrrogaAplicable[] } = {},
): PlazoDj | null {
  const base = plazoBase(motivo, hechos, anioPresentacion, feriados, op.variacion ?? null);
  if (!base) return null;
  return { ...base, venceOriginal: base.vence, ...aplicarProrroga(base.vence, op.prorrogas ?? []) };
}

function plazoBase(motivo: string, hechos: (string | null)[], anioPresentacion: number, feriados: ReadonlySet<string>, variacion: VariacionDj | null) {
  if (motivo === 'ANUAL') return { hecho: null, vence: ultimoDiaHabilDelMes(anioPresentacion, 2, feriados), cambio5Uit: false };
  if (motivo === 'MODIFICACION') {
    if (!variacion?.supera || !variacion.hecho) return null;
    return { hecho: variacion.hecho, vence: mesSiguiente(variacion.hecho, feriados), cambio5Uit: true };
  }
  if (!['INSCRIPCION', 'COMPRA', 'VENTA'].includes(motivo)) return null;
  const hecho = hechos.filter((h): h is string => Boolean(h)).sort()[0];
  if (!hecho) return null;
  return { hecho, vence: mesSiguiente(hecho, feriados), cambio5Uit: false };
}

// J16: gana la fecha límite más lejana de las prórrogas que alcanzan a la DJ, si es posterior al plazo.
export function aplicarProrroga(vence: string, prorrogas: ProrrogaAplicable[]): { vence: string; prorroga: ProrrogaAplicable | null } {
  const mejor = [...prorrogas].sort((a, b) => b.fechaLimite.localeCompare(a.fechaLimite))[0];
  return mejor && mejor.fechaLimite > vence ? { vence: mejor.fechaLimite, prorroga: mejor } : { vence, prorroga: null };
}
