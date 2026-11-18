// Liquidación v2 ("Generar Cta.", specs/rentas-nucleo-v2.md, Fase 5; reglas L08–L10, J14, J17, P03 de
// docs/rentas/reglas-negocio.md). Lógica pura: compara lo determinado con la cuenta corriente.
import { Prisma } from '@prisma/client';
import { sumarHabiles } from '../valores/plazos.js';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

export type Tributo = 'PREDIAL' | 'ARBITRIOS';
export const PLAZO_REVISION_HABILES = 45; // J14 (CT art. 88)
export const ROLES_SUPERVISION = ['SUPERVISOR', 'ADMIN'];

// ---- Cuenta corriente ----

export interface LineaNueva {
  tributoId: number;
  predioId: number | null;
  cuota: number;
  importe: Dec;
  derechoEmision: Dec;
  vence: string;
}

export interface CuentaActual {
  id: number;
  tributoId: number;
  predioId: number | null;
  cuota: number;
  importe: Num;
  derechoEmision: Num;
  estado: string; // EstadoCuenta
  enValor: boolean; // en una OP/RD vigente (EMITIDO/NOTIFICADO/COACTIVO)
  ajusteDeId: number | null;
}

export interface LineaCrear extends LineaNueva {
  ajusteDeId: number | null;
}

export interface PlanCuenta {
  crear: LineaCrear[];
  anular: number[];
  sinCambio: number;
  saldoAFavor: { tributoId: number; predioId: number | null; importe: Dec }[];
  bloqueos: { tributoId: number; predioId: number | null; motivo: string }[];
}

const SIN_EFECTO = ['ANULADO', 'EXTORNADO'];
export const claveGrupo = (g: { tributoId: number; predioId: number | null }) => `${g.tributoId}|${g.predioId ?? '-'}`;

// Una cuota se puede rehacer si está pendiente y no la cobra un valor; lo demás se respeta.
const libre = (c: CuentaActual) => c.estado === 'PENDIENTE' && !c.enValor;
// L09: en un valor, en coactivo o en un convenio, la deuda no baja con una DJ.
const conTramite = (c: CuentaActual) => c.enValor || c.estado === 'COACTIVO' || c.estado === 'FRACCIONADO';

// L09 y L10, por grupo (tributo + predio) y cuota:
// - lo pendiente sin valor se anula y se vuelve a crear con lo nuevo (si no cambió, no se toca);
// - lo pagado se cierra por lo pagado: si lo nuevo es mayor, la diferencia es una cuota de ajuste
//   (ajusteDeId) con el mismo vencimiento; si es menor, el exceso pagado se aplica a las cuotas nuevas
//   del mismo grupo y lo que sobre queda como saldo a favor;
// - bajar una deuda que está en un valor, en coactivo o en un convenio no se hace: se corrige por reclamo.
// `grupos` = todos los grupos que la liquidación alcanza (los que ya no corresponden se vacían).
export function planificarCuenta(nuevas: LineaNueva[], actuales: CuentaActual[], grupos: { tributoId: number; predioId: number | null }[]): PlanCuenta {
  const plan: PlanCuenta = { crear: [], anular: [], sinCambio: 0, saldoAFavor: [], bloqueos: [] };
  const vistos = new Set<string>();
  for (const g of grupos) {
    const k = claveGrupo(g);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const n = nuevas.filter((x) => claveGrupo(x) === k);
    const e = actuales.filter((x) => claveGrupo(x) === k && !SIN_EFECTO.includes(x.estado));
    const totalNuevo = n.reduce((t, x) => t.plus(x.importe), new D(0));
    const totalActual = e.reduce((t, x) => t.plus(x.importe), new D(0));
    if (totalNuevo.lt(totalActual) && e.some(conTramite)) {
      plan.bloqueos.push({ ...g, motivo: 'baja una deuda que ya está en un valor emitido, en coactivo o en un convenio: se corrige por reclamo (L09)' });
      continue;
    }

    const crear: LineaCrear[] = [];
    const anular: number[] = [];
    let exceso = new D(0);
    let bloqueado = false;
    const cuotas = [...new Set([...n.map((x) => x.cuota), ...e.map((x) => x.cuota)])].sort((a, b) => a - b);
    for (const cuota of cuotas) {
      const nueva = n.find((x) => x.cuota === cuota);
      const importe = nueva?.importe ?? new D(0);
      const emision = nueva?.derechoEmision ?? new D(0);
      const ek = e.filter((x) => x.cuota === cuota);
      const vigente = ek.reduce((t, x) => t.plus(x.importe), new D(0));
      const vigenteEmision = ek.reduce((t, x) => t.plus(x.derechoEmision), new D(0));
      if (vigente.eq(importe) && vigenteEmision.eq(emision)) {
        if (ek.length) plan.sinCambio++;
        continue;
      }
      const fijas = ek.filter((x) => !libre(x));
      anular.push(...ek.filter(libre).map((x) => x.id));
      let falta = importe.minus(fijas.reduce((t, x) => t.plus(x.importe), new D(0)));
      let faltaEmision = emision.minus(fijas.reduce((t, x) => t.plus(x.derechoEmision), new D(0)));
      if (falta.isNegative()) {
        if (fijas.some(conTramite)) {
          bloqueado = true;
          break;
        }
        exceso = exceso.plus(falta.negated());
        falta = new D(0);
      }
      if (faltaEmision.isNegative()) {
        exceso = exceso.plus(faltaEmision.negated());
        faltaEmision = new D(0);
      }
      if (falta.gt(0) || faltaEmision.gt(0)) {
        const base = fijas.find((x) => x.ajusteDeId === null) ?? fijas[0];
        crear.push({
          ...g,
          cuota,
          importe: falta,
          derechoEmision: faltaEmision,
          vence: nueva?.vence ?? '',
          ajusteDeId: base ? (base.ajusteDeId ?? base.id) : null,
        });
      }
    }
    if (bloqueado) {
      plan.bloqueos.push({ ...g, motivo: 'baja una cuota que ya está en un valor emitido, en coactivo o en un convenio: se corrige por reclamo (L09)' });
      continue;
    }
    // L10: el exceso pagado se aplica a las cuotas nuevas, en orden.
    for (const c of crear) {
      if (!exceso.gt(0)) break;
      const usado = D.min(exceso, c.importe);
      c.importe = c.importe.minus(usado);
      exceso = exceso.minus(usado);
    }
    plan.crear.push(...crear.filter((c) => c.importe.gt(0) || c.derechoEmision.gt(0)));
    plan.anular.push(...anular);
    if (exceso.gt(0)) plan.saldoAFavor.push({ ...g, importe: exceso });
  }
  return plan;
}

// ---- J14: ¿la DJ baja la obligación de un período ya liquidado? ----

export interface ComparacionAnio {
  anio: number;
  tributo: Tributo;
  liquidado: Dec; // lo vigente en la cuenta (importe, sin derecho de emisión)
  determinado: Dec;
}

export function bajas(comparaciones: ComparacionAnio[]): ComparacionAnio[] {
  return comparaciones.filter((c) => c.liquidado.gt(0) && c.determinado.lt(c.liquidado));
}

export function venceRevision(fechaPresentacion: string, feriados: ReadonlySet<string>): string {
  return sumarHabiles(fechaPresentacion, PLAZO_REVISION_HABILES, feriados);
}

export interface DjRevision {
  estado: string;
  creadoPorId: number | null;
  revisionVence: string | null;
}

// J14/J17: la revisión la resuelve un supervisor que no registró la DJ. Vencido el plazo, la DJ surte
// efecto: se puede aprobar (o liquidar directamente), pero ya no rechazar.
export function errorResolverRevision(dj: DjRevision, accion: 'APROBAR' | 'RECHAZAR', actor: { id: number; rol: string }, hoy: string, justificacion: string): string | null {
  if (dj.estado !== 'EN_REVISION') return 'La DJ no está en revisión';
  if (!ROLES_SUPERVISION.includes(actor.rol)) return 'Solo un supervisor resuelve la revisión de una DJ';
  if (dj.creadoPorId !== null && dj.creadoPorId === actor.id) return 'Quien registró la DJ no puede resolver su revisión: la resuelve otro supervisor (J17)';
  if (accion === 'RECHAZAR' && dj.revisionVence && hoy > dj.revisionVence) {
    return `Venció el plazo de revisión (${dj.revisionVence}): la DJ surte efecto y ya no se puede rechazar; lo que quede por revisar va a fiscalización (J14)`;
  }
  if (justificacion.trim().length < 10) return 'Justifica la decisión (mínimo 10 caracteres)';
  return null;
}

export interface DjLiquidable {
  estado: string;
  tipo: string;
  revisionVence: string | null;
}

export function errorLiquidar(dj: DjLiquidable, hoy: string, determinada: boolean): string | null {
  if (dj.estado === 'EN_REVISION') {
    if (!dj.revisionVence || hoy <= dj.revisionVence) {
      return `La DJ baja la obligación de un período liquidado y está en revisión hasta el ${dj.revisionVence ?? '—'}: la aprueba un supervisor (J14)`;
    }
  } else if (dj.estado !== 'PENDIENTE') {
    return dj.estado === 'LIQUIDADA' ? 'La DJ ya está liquidada' : 'La DJ está anulada o rechazada';
  }
  if (!determinada) return 'Primero determina la DJ para revisar lo que se va a liquidar';
  return null;
}

// J04/J17: anular una DJ que ya generó cuenta extorna esa cuenta; lo hace un supervisor que no la registró.
export function errorAnularLiquidada(dj: { creadoPorId: number | null }, actor: { id: number; rol: string }): string | null {
  if (!ROLES_SUPERVISION.includes(actor.rol)) return 'Solo un supervisor anula una DJ que ya generó cuenta';
  if (dj.creadoPorId !== null && dj.creadoPorId === actor.id) return 'Quien registró la DJ no puede anularla una vez liquidada: la anula otro supervisor (J17)';
  return null;
}

// ---- P03: estado de la persona tras liquidar ----

export function estadoTrasLiquidar(p: {
  estado: string;
  huboDescargo: boolean;
  prediosActivos: number;
  tieneDeuda: boolean;
  estadoAlHabilitar: string;
}): { estado: string; aviso: string | null } {
  if (p.prediosActivos === 0 && p.huboDescargo && p.estado !== 'INHABILITADO') {
    if (p.tieneDeuda) return { estado: p.estado, aviso: 'Se quedó sin predios pero mantiene deuda: no se inhabilita (P01)' };
    return { estado: 'INHABILITADO', aviso: 'Se quedó sin predios y sin deuda: pasa a inhabilitado (P03)' };
  }
  if (p.prediosActivos > 0 && p.estado === 'INHABILITADO') {
    return { estado: p.estadoAlHabilitar, aviso: 'Vuelve a tener un predio activo: se habilita (P03)' };
  }
  return { estado: p.estado, aviso: null };
}
