// Reglas puras de fiscalización (specs/rentas-fiscalizacion-v1.md). Sin Prisma: se prueban con vitest.
// - Años fiscalizables: la deuda prescribe a los 4 años, a los 6 si el contribuyente no declaró el
//   predio (Código Tributario art. 43); solo años con parámetros en Maestros (decisión 8).
// - El expediente avanza ABIERTO → INSPECCIONADO (todas las fichas) → RESUELTO | SIN_DIFERENCIAS;
//   se anula con motivo mientras no esté resuelto.
// - Diferencias por año, tributo y cuota: solo se determina lo que sube; lo que baja queda anotado
//   para un descargo (decisión 7).
import { EstadoFiscalizacion, ModalidadNotificacion, Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

const r2 = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP);

export const PRESCRIPCION_ANIOS = 4;
export const PRESCRIPCION_SIN_DJ_ANIOS = 6;

export function rangoFiscalizable(anioActual: number, sinDeclaracion: boolean) {
  return { desde: anioActual - (sinDeclaracion ? PRESCRIPCION_SIN_DJ_ANIOS : PRESCRIPCION_ANIOS), hasta: anioActual };
}

export interface DatosExpediente {
  anioDesde: number;
  anioHasta: number;
  predioIds: number[];
  anioActual: number;
  sinDeclaracion: boolean; // ningún predio del expediente tiene DJ del contribuyente
  aniosConParametros: number[]; // años con UIT/escala/tarifas en Maestros
}

export function errorExpediente(d: DatosExpediente): string | null {
  if (d.predioIds.length === 0) return 'Elige al menos un predio a fiscalizar';
  if (new Set(d.predioIds).size !== d.predioIds.length) return 'Hay predios repetidos en el expediente';
  if (d.anioDesde > d.anioHasta) return 'El año inicial no puede ser mayor que el final';
  const rango = rangoFiscalizable(d.anioActual, d.sinDeclaracion);
  if (d.anioHasta > rango.hasta) return 'No se fiscalizan años que aún no llegan';
  if (d.anioDesde < rango.desde) {
    return `Los años anteriores a ${rango.desde} están prescritos (${d.sinDeclaracion ? PRESCRIPCION_SIN_DJ_ANIOS : PRESCRIPCION_ANIOS} años)`;
  }
  for (let a = d.anioDesde; a <= d.anioHasta; a++) {
    if (!d.aniosConParametros.includes(a)) return `El año ${a} no tiene parámetros en Maestros: cárgalos antes de fiscalizarlo`;
  }
  return null;
}

export type AccionExpediente = 'REQUERIMIENTO' | 'FICHA' | 'LIQUIDAR' | 'RESOLVER' | 'ANULAR';

const PERMITIDAS: Record<EstadoFiscalizacion, AccionExpediente[]> = {
  ABIERTO: ['REQUERIMIENTO', 'FICHA', 'ANULAR'],
  INSPECCIONADO: ['REQUERIMIENTO', 'FICHA', 'LIQUIDAR', 'RESOLVER', 'ANULAR'],
  RESUELTO: [],
  SIN_DIFERENCIAS: [],
  ANULADO: [],
};

const ETIQUETA: Record<EstadoFiscalizacion, string> = {
  ABIERTO: 'abierto',
  INSPECCIONADO: 'inspeccionado',
  RESUELTO: 'resuelto',
  SIN_DIFERENCIAS: 'cerrado sin diferencias',
  ANULADO: 'anulado',
};

export function errorAccion(estado: EstadoFiscalizacion, accion: AccionExpediente, motivo?: string): string | null {
  if (!PERMITIDAS[estado].includes(accion)) {
    if (accion === 'LIQUIDAR' || accion === 'RESOLVER') {
      return estado === EstadoFiscalizacion.ABIERTO
        ? 'Registra la ficha de inspección de todos los predios antes de liquidar'
        : `El expediente está ${ETIQUETA[estado]}`;
    }
    return `El expediente está ${ETIQUETA[estado]}: ya no admite cambios`;
  }
  if (accion === 'ANULAR') {
    const m = motivo?.trim() ?? '';
    if (m.length < 10) return 'Indica el motivo de la anulación (mínimo 10 caracteres)';
    if (m.length > 200) return 'El motivo admite hasta 200 caracteres';
  }
  return null;
}

// Requerimiento de inspección (F2): la visita se programa después de abierto el expediente y, si ya
// se notificó, después de la notificación (surte efecto al día siguiente, art. 106). Notificación
// personal: DNI/CE y nombre de quien recibe, como en los valores (art. 104).
export interface DatosRequerimiento {
  fechaApertura: string; // AAAA-MM-DD
  fechaInspeccion: string; // AAAA-MM-DD (la hora se guarda aparte)
  notificacion?: { fecha: string; modalidad: ModalidadNotificacion; dni?: string | null; nombre?: string | null } | null;
  hoy: string;
}

export function errorRequerimiento(d: DatosRequerimiento): string | null {
  if (d.fechaInspeccion < d.fechaApertura) return 'La inspección no puede ser anterior a la apertura del expediente';
  const n = d.notificacion;
  if (!n) return null;
  if (n.fecha < d.fechaApertura) return 'La notificación no puede ser anterior a la apertura del expediente';
  if (n.fecha > d.hoy) return 'La fecha de notificación no puede ser futura';
  if (d.fechaInspeccion <= n.fecha) return 'La inspección debe programarse después del día de la notificación';
  if (n.modalidad === ModalidadNotificacion.PERSONAL) {
    if (!n.nombre?.trim()) return 'Registra el nombre de quien recibió el requerimiento';
    if (!/^[0-9A-Z]{8,12}$/.test(n.dni?.trim().toUpperCase() ?? '')) return 'Registra el DNI (8 dígitos) o CE de quien recibió el requerimiento';
  }
  return null;
}

// Con la ficha de todos los predios el expediente pasa a INSPECCIONADO.
export const estadoTrasFichas = (conFicha: number, total: number): EstadoFiscalizacion =>
  total > 0 && conFicha === total ? EstadoFiscalizacion.INSPECCIONADO : EstadoFiscalizacion.ABIERTO;

export interface ImporteCuota {
  anio: number;
  tributo: string; // código del tributo (PREDIAL, RESIDUOS…)
  predioId: number | null; // null en el predial (va por contribuyente); el predio en arbitrios
  cuota: number;
  importe: Num;
}

export interface DiferenciaCuota {
  anio: number;
  tributo: string;
  predioId: number | null;
  cuota: number;
  declarado: Dec;
  fiscalizado: Dec;
  diferencia: Dec;
}

export interface ResumenDiferencias {
  aumentos: DiferenciaCuota[]; // se determinan (RD de fiscalización)
  disminuciones: DiferenciaCuota[]; // solo se anotan: las atiende un descargo
  porAnio: { anio: number; tributo: string; declarado: Dec; fiscalizado: Dec; omitido: Dec }[];
  totalOmitido: Dec;
}

const clave = (c: { anio: number; tributo: string; predioId: number | null; cuota: number }) =>
  `${c.anio}|${c.tributo}|${c.predioId ?? '-'}|${c.cuota}`;

const sumar = (filas: ImporteCuota[]) => {
  const m = new Map<string, { anio: number; tributo: string; predioId: number | null; cuota: number; total: Dec }>();
  for (const f of filas) {
    const k = clave(f);
    const actual = m.get(k) ?? { anio: f.anio, tributo: f.tributo, predioId: f.predioId, cuota: f.cuota, total: new D(0) };
    actual.total = actual.total.plus(f.importe);
    m.set(k, actual);
  }
  return m;
};

// Lo declarado contra lo que se mide la fiscalización, por cuota: lo mayor entre la cuenta corriente y
// lo que el motor determina con lo declarado. El predial va por contribuyente: un predio inscrito por DJ
// y aún sin calcular no es omisión detectada por la fiscalización (ni da multa 178.1).
export function referenciaDeclarada(cuenta: ImporteCuota[], determinado: ImporteCuota[]): ImporteCuota[] {
  const cc = sumar(cuenta);
  const det = sumar(determinado);
  return [...new Set([...cc.keys(), ...det.keys()])].map((k) => {
    const { anio, tributo, predioId, cuota } = cc.get(k) ?? det.get(k)!;
    const c = cc.get(k)?.total ?? new D(0);
    const d = det.get(k)?.total ?? new D(0);
    return { anio, tributo, predioId, cuota, importe: D.max(c, d) };
  });
}

// `declarado`: lo que hay en cuenta corriente (incluidas diferencias anteriores, que se suman a su cuota),
// o la referencia de `referenciaDeclarada`. `fiscalizado`: lo que resulta de valorizar el predio con la ficha.
export function diferencias(declarado: ImporteCuota[], fiscalizado: ImporteCuota[]): ResumenDiferencias {
  const dec = sumar(declarado);
  const fis = sumar(fiscalizado);
  const aumentos: DiferenciaCuota[] = [];
  const disminuciones: DiferenciaCuota[] = [];
  for (const k of new Set([...dec.keys(), ...fis.keys()])) {
    const base = dec.get(k) ?? fis.get(k)!;
    const d = r2(dec.get(k)?.total ?? new D(0));
    const f = r2(fis.get(k)?.total ?? new D(0));
    const fila = {
      anio: base.anio,
      tributo: base.tributo,
      predioId: base.predioId,
      cuota: base.cuota,
      declarado: d,
      fiscalizado: f,
      diferencia: f.minus(d),
    };
    if (fila.diferencia.isPositive() && !fila.diferencia.isZero()) aumentos.push(fila);
    else if (fila.diferencia.isNegative()) disminuciones.push(fila);
  }
  const orden = (a: DiferenciaCuota, b: DiferenciaCuota) =>
    a.anio - b.anio || a.tributo.localeCompare(b.tributo) || (a.predioId ?? 0) - (b.predioId ?? 0) || a.cuota - b.cuota;
  aumentos.sort(orden);
  disminuciones.sort(orden);

  const porAnio = new Map<string, { anio: number; tributo: string; declarado: Dec; fiscalizado: Dec; omitido: Dec }>();
  for (const k of new Set([...dec.keys(), ...fis.keys()])) {
    const base = dec.get(k) ?? fis.get(k)!;
    const kk = `${base.anio}|${base.tributo}`;
    const fila = porAnio.get(kk) ?? { anio: base.anio, tributo: base.tributo, declarado: new D(0), fiscalizado: new D(0), omitido: new D(0) };
    fila.declarado = fila.declarado.plus(r2(dec.get(k)?.total ?? new D(0)));
    fila.fiscalizado = fila.fiscalizado.plus(r2(fis.get(k)?.total ?? new D(0)));
    porAnio.set(kk, fila);
  }
  for (const a of aumentos) porAnio.get(`${a.anio}|${a.tributo}`)!.omitido = porAnio.get(`${a.anio}|${a.tributo}`)!.omitido.plus(a.diferencia);

  return {
    aumentos,
    disminuciones,
    porAnio: [...porAnio.values()].sort((a, b) => a.anio - b.anio || a.tributo.localeCompare(b.tributo)),
    totalOmitido: aumentos.reduce((t, a) => t.plus(a.diferencia), new D(0)),
  };
}

// ---- Resolución (F5, decisión 3): cómo entra cada aumento a la cuenta corriente ----

export interface CuotaDeclarada {
  id: number;
  anio: number;
  tributo: string;
  predioId: number | null;
  cuota: number;
  importe: Num;
  estado: string; // EstadoCuenta
  enValor: boolean; // en una OP/RD vigente
  ajusteDeId: number | null;
}

// `enRD`: la fila entra a la RD de fiscalización (tiene omitido); sin él solo sube a lo declarado.
export interface PlanAjustes {
  actualizar: { id: number; importe: Dec; enRD: boolean }[]; // cuota PENDIENTE libre: sube a lo fiscalizado
  ajustes: { ajusteDeId: number; anio: number; tributo: string; predioId: number | null; cuota: number; importe: Dec; enRD: boolean }[]; // protegida
  crear: { anio: number; tributo: string; predioId: number | null; cuota: number; importe: Dec; enRD: boolean }[]; // no existía (o estaba anulada)
}

// Una cuota PENDIENTE que no está en un valor vigente se sube; una protegida (pagada, fraccionada, en
// coactivo o en un valor) recibe una fila de diferencia que apunta a ella; si no existía, nace la cuota.
// `sinCalcular`: lo declarado que faltaba en la cuenta corriente (cuenta corriente → referencia); en una
// cuota protegida va en su propia fila de diferencia, fuera de la RD.
export function planAjustes(aumentos: DiferenciaCuota[], cuotas: CuotaDeclarada[], sinCalcular: DiferenciaCuota[] = []): PlanAjustes {
  const base = new Map(cuotas.filter((c) => c.ajusteDeId === null && c.estado !== 'ANULADO').map((c) => [clave(c), c]));
  const omitido = new Map(aumentos.map((a) => [clave(a), a]));
  const previo = new Map(sinCalcular.map((s) => [clave(s), s]));
  const plan: PlanAjustes = { actualizar: [], ajustes: [], crear: [] };
  for (const k of new Set([...omitido.keys(), ...previo.keys()])) {
    const { anio, tributo, predioId, cuota } = omitido.get(k) ?? previo.get(k)!;
    const llave = { anio, tributo, predioId, cuota };
    const o = omitido.get(k)?.diferencia ?? new D(0);
    const p = previo.get(k)?.diferencia ?? new D(0);
    const enRD = o.isPositive() && !o.isZero();
    const c = base.get(k);
    if (!c) plan.crear.push({ ...llave, importe: p.plus(o), enRD });
    else if (c.estado === 'PENDIENTE' && !c.enValor) plan.actualizar.push({ id: c.id, importe: r2(new D(c.importe).plus(p).plus(o)), enRD });
    else {
      if (!p.isZero()) plan.ajustes.push({ ajusteDeId: c.id, ...llave, importe: p, enRD: false });
      if (enRD) plan.ajustes.push({ ajusteDeId: c.id, ...llave, importe: o, enRD: true });
    }
  }
  return plan;
}
