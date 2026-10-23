// Reglas puras de emisión de valores (specs/rentas-valores-v1.md, V1-V2). Sin Prisma: se prueban con vitest.
// - OP (Código Tributario art. 78): predial, uno por contribuyente y año.
// - RD (art. 76): arbitrios, uno por contribuyente, predio y año.
// - Solo cuotas PENDIENTE vencidas a la fecha de emisión y que no estén ya en un valor vigente.
import { EstadoValor, Prisma, TipoValor } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

export const ESTADOS_VALOR_VIGENTE: EstadoValor[] = [EstadoValor.EMITIDO, EstadoValor.NOTIFICADO];

export type TributoValorizable = 'PREDIAL' | 'ARBITRIOS';

export const tipoValorDe = (tributo: TributoValorizable): TipoValor => (tributo === 'PREDIAL' ? TipoValor.OP : TipoValor.RD);

export interface CuotaEmitible {
  id: number;
  contribuyenteId: number;
  predioId: number | null;
  anio: number;
  tributo: TributoValorizable;
  fechaVencimiento: string; // AAAA-MM-DD
  enValor: boolean;
  liquidacion: { insoluto: Dec; reajuste: Dec; mora: Dec; total: Dec }; // a la fecha de emisión
}

export interface OpcionesEmision {
  fecha: string; // AAAA-MM-DD de emisión
  soloVencidas: boolean;
  montoMinimo: Num; // por valor
  excluir?: (contribuyenteId: number, tipo: TipoValor) => boolean; // p. ej. deuda por recalcular
}

export interface DetalleValorPlan {
  cuentaId: number;
  importe: Dec;
  reajuste: Dec;
  mora: Dec;
  subtotal: Dec; // incluye derecho de emisión
}

export interface ValorPlan {
  clave: string;
  tipo: TipoValor;
  contribuyenteId: number;
  predioId: number | null;
  anio: number;
  detalles: DetalleValorPlan[];
  total: Dec;
}

// Cuotas descartadas, por motivo.
export interface Exclusiones {
  yaEnValor: number;
  noVencidas: number;
  recalculoPendiente: number;
  bajoMinimo: number;
}

export function claveValor(tipo: TipoValor, c: Pick<CuotaEmitible, 'contribuyenteId' | 'predioId' | 'anio'>): string {
  return tipo === TipoValor.OP ? `OP|${c.contribuyenteId}|${c.anio}` : `RD|${c.contribuyenteId}|${c.predioId ?? '-'}|${c.anio}`;
}

export function planEmision(cuotas: CuotaEmitible[], op: OpcionesEmision): { valores: ValorPlan[]; excluidas: Exclusiones } {
  const excluidas: Exclusiones = { yaEnValor: 0, noVencidas: 0, recalculoPendiente: 0, bajoMinimo: 0 };
  const grupos = new Map<string, ValorPlan>();

  for (const c of cuotas) {
    if (c.enValor) {
      excluidas.yaEnValor++;
      continue;
    }
    // Vence el mismo día de la emisión = todavía no está vencida.
    if (op.soloVencidas && c.fechaVencimiento >= op.fecha) {
      excluidas.noVencidas++;
      continue;
    }
    const tipo = tipoValorDe(c.tributo);
    if (op.excluir?.(c.contribuyenteId, tipo)) {
      excluidas.recalculoPendiente++;
      continue;
    }
    const clave = claveValor(tipo, c);
    const grupo = grupos.get(clave) ?? {
      clave,
      tipo,
      contribuyenteId: c.contribuyenteId,
      predioId: tipo === TipoValor.OP ? null : c.predioId,
      anio: c.anio,
      detalles: [],
      total: new D(0),
    };
    const l = c.liquidacion;
    grupo.detalles.push({ cuentaId: c.id, importe: l.insoluto, reajuste: l.reajuste, mora: l.mora, subtotal: l.total });
    grupo.total = grupo.total.plus(l.total);
    grupos.set(clave, grupo);
  }

  const minimo = new D(op.montoMinimo);
  const valores: ValorPlan[] = [];
  for (const v of grupos.values()) {
    if (v.total.lessThan(minimo)) excluidas.bajoMinimo += v.detalles.length;
    else valores.push(v);
  }
  valores.sort(
    (a, b) =>
      a.tipo.localeCompare(b.tipo) ||
      a.anio - b.anio ||
      a.contribuyenteId - b.contribuyenteId ||
      (a.predioId ?? 0) - (b.predioId ?? 0),
  );
  return { valores, excluidas };
}

// ---- Notificación y anulación (V4, V5) ----

export interface DatosNotificacion {
  fecha: string; // AAAA-MM-DD
  modalidad: 'PERSONAL' | 'NEGATIVA' | 'CEDULON' | 'PUBLICACION';
  dni?: string | null;
  nombre?: string | null;
}

// Se puede notificar un valor emitido o corregir la notificación de uno ya notificado.
export function errorNotificacion(estado: EstadoValor, fechaEmision: string, n: DatosNotificacion, hoy: string): string | null {
  if (!ESTADOS_VALOR_VIGENTE.includes(estado)) {
    return `No se puede notificar un valor ${estado.toLowerCase()}`;
  }
  if (n.fecha < fechaEmision) return 'La notificación no puede ser anterior a la emisión';
  if (n.fecha > hoy) return 'La fecha de notificación no puede ser futura';
  if (n.modalidad === 'PERSONAL') {
    if (!n.nombre?.trim()) return 'Registra el nombre de quien recibió el valor';
    if (!/^[0-9A-Z]{8,12}$/.test(n.dni?.trim().toUpperCase() ?? '')) return 'Registra el DNI (8 dígitos) o CE de quien recibió el valor';
  }
  return null;
}

export const MOTIVO_ANULACION_MIN = 10;

export function errorAnulacion(estado: EstadoValor, motivo: string): string | null {
  if (estado === EstadoValor.COACTIVO) return 'Un valor en cobranza coactiva no se anula desde Rentas';
  if (!ESTADOS_VALOR_VIGENTE.includes(estado)) return `El valor ya está ${estado.toLowerCase()}`;
  if (motivo.trim().length < MOTIVO_ANULACION_MIN) return `Explica el motivo de la anulación (mínimo ${MOTIVO_ANULACION_MIN} caracteres)`;
  return null;
}

// ---- Transferencia a cobranza coactiva (V7) ----

export type MotivoNoTransferible = 'noNotificado' | 'plazoVigente' | 'sinDeudaPendiente';

// Solo valores notificados, ya exigibles y con alguna cuota todavía PENDIENTE (las fraccionadas
// o pagadas no se cobran en coactivo).
export function motivoNoTransferible(
  v: { estado: EstadoValor; fechaExigible: string | null },
  cuotasPendientes: number,
  hoy: string,
): MotivoNoTransferible | null {
  if (v.estado !== EstadoValor.NOTIFICADO || !v.fechaExigible) return 'noNotificado';
  if (v.fechaExigible > hoy) return 'plazoVigente';
  if (cuotasPendientes === 0) return 'sinDeudaPendiente';
  return null;
}
