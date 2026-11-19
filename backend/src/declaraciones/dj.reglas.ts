// DJ presentada (specs/rentas-nucleo-v2.md, Fase 4; reglas J01–J17, R03, R04). Lógica pura.
import { CLASIFICACIONES, ESTADOS_CONSERVACION, MATERIALES, REGEX_CATEGORIAS } from '../rentas/catalogos-construccion.js';

export type EstadoDj = 'PENDIENTE' | 'EN_REVISION' | 'LIQUIDADA' | 'ANULADA' | 'RECHAZADA';

// Códigos de motivo que el código necesita (filas `sistema` del catálogo MOTIVO_DJ).
export const MOTIVO = {
  INSCRIPCION: 'INSCRIPCION',
  COMPRA: 'COMPRA',
  VENTA: 'VENTA',
  BAJA: 'BAJA',
  FISCALIZACION: 'FISCALIZACION', // la registra la resolución de una fiscalización (Fase 6)
  MODIFICACION: 'MODIFICACION', // J08: cambios de más de 5 UIT (Fase 7)
  ANUAL: 'ANUAL',
} as const;

// J09 (Fase 7): sub-motivo de la DJ anual que objeta la actualización de valores.
export const SUB_MOTIVO_OBJECION = 'AN_OBJECION';

export const DESCARGOS: string[] = [MOTIVO.VENTA, MOTIVO.BAJA];
// Solo estos motivos pueden crear un predio que aún no existe en el padrón.
export const CREAN_PREDIO: string[] = [MOTIVO.INSCRIPCION, MOTIVO.COMPRA];

export const ROLES_ADQUIRIENTE = ['ADQUIRIENTE', 'TRANSFERENTE'] as const;
export const MONEDAS = ['PEN', 'USD'] as const;

// J02: AA-NNNNNNN.
export function numeroDj(anio: number, numero: number): string {
  return `${String(anio).slice(-2)}-${String(numero).padStart(7, '0')}`;
}

// J10: quien adquiere en el año N es contribuyente desde N+1. Sin fecha de adquisición (p. ej. una
// inscripción sin documento) se toma el año en que se presenta.
export function anioAfectacionPorDefecto(fechaAdquisicion: string | null, fechaPresentacion: string): number {
  return fechaAdquisicion ? Number(fechaAdquisicion.slice(0, 4)) + 1 : Number(fechaPresentacion.slice(0, 4));
}

// J11: los arbitrios afectan desde el mes del hecho o el siguiente (regla arbitrios.inicioAfectacion).
export function fechaArbitriosPorDefecto(fechaHecho: string, inicio: 'MES_DEL_HECHO' | 'MES_SIGUIENTE'): string {
  const anio = Number(fechaHecho.slice(0, 4));
  const mes = Number(fechaHecho.slice(5, 7));
  if (inicio === 'MES_DEL_HECHO') return `${anio}-${String(mes).padStart(2, '0')}-01`;
  return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

// ---- Cabecera ----

export interface CabeceraDj {
  motivo: string;
  fechaPresentacion: string;
  folios?: number | null;
}

export function errorCabecera(c: CabeceraDj, hoy: string): string | null {
  if (c.fechaPresentacion > hoy) return 'La fecha de presentación no puede ser futura';
  if (c.folios != null && c.folios < 1) return 'Los folios deben ser 1 o más';
  return null;
}

// J06: la inscripción se usa una sola vez por persona.
export function errorInscripcionRepetida(motivo: string, otrasInscripciones: string[]): string | null {
  if (motivo !== MOTIVO.INSCRIPCION || otrasInscripciones.length === 0) return null;
  return `La persona ya tiene una DJ de inscripción (${otrasInscripciones[0]}): usa otro motivo, p. ej. adquisición`;
}

// J09 (Fase 7): la objeción a la actualización anual de valores es una DJ anual con el sub-motivo
// AN_OBJECION. Vale hasta el vencimiento del pago al contado del año y si ese año se liquidó con la
// actualización masiva; sus anexos rigen desde ese año.
export function errorObjecion(o: { fechaPresentacion: string; venceContado: string; actualizado: boolean; aniosAfectacion: number[] }): string | null {
  const anio = Number(o.fechaPresentacion.slice(0, 4));
  if (o.fechaPresentacion > o.venceContado) {
    return `La objeción a la actualización de ${anio} se presenta hasta el ${o.venceContado} (pago al contado). Fuera de plazo, presenta una rectificatoria`;
  }
  if (!o.actualizado) return `La persona no tiene el año ${anio} liquidado con la actualización masiva de valores: no hay actualización que objetar`;
  if (o.aniosAfectacion.some((a) => a !== anio)) return `Los anexos de la objeción rigen desde ${anio}, el año que se objeta`;
  return null;
}

// ---- Anexo ----

export interface NivelDj {
  nivel: string;
  anioConstruccion?: number | null;
  mesConstruccion?: number | null;
  clasificacion: string;
  material: string;
  estadoConservacion: string;
  categorias: string;
  areaPropia: number;
  areaComun?: number | null;
  participacion?: number | null;
}

export interface ObraDj {
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  anioConstruccion?: number | null;
  material?: string | null;
  estadoConservacion?: string | null;
}

export interface UsoDj {
  uso: string;
  area: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  predominante?: boolean;
}

export interface AdquirienteDj {
  rol: string;
  tipoDoc?: string | null;
  numDoc?: string | null;
}

export interface AnexoDj {
  porcentaje: number;
  fechaAdquisicion?: string | null;
  fechaDocumento?: string | null;
  fechaDescargo?: string | null;
  anioAfectacion: number;
  areaTerreno: number;
  areaComun?: number | null;
  valorTransferencia?: number | null;
  moneda?: string | null;
  niveles: NivelDj[];
  obras: ObraDj[];
  usos: UsoDj[];
  rusticos: { hectareas: number }[];
  adquirientes: AdquirienteDj[];
}

export interface ContextoAnexo {
  motivo: string;
  fechaPresentacion: string;
  rustico: boolean;
  anioActual: number;
}

const dentro = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

// Todo lo que un anexo debe cumplir por sí mismo (R03, R04, J10–J12, V01–V07). El prefijo dice cuál es.
export function errorAnexo(a: AnexoDj, ctx: ContextoAnexo, prefijo: string): string | null {
  const e = (m: string) => `${prefijo}: ${m}`;
  if (!(a.porcentaje > 0 && a.porcentaje <= 100)) return e('el porcentaje de propiedad debe estar entre 0 y 100');
  // Un descargo saca el predio: no necesita volver a declarar sus características.
  const descargo = DESCARGOS.includes(ctx.motivo);
  if (!descargo && !ctx.rustico && !(a.areaTerreno > 0)) return e('el área de terreno debe ser mayor que 0');
  if (a.areaTerreno < 0) return e('el área de terreno no puede ser negativa');
  if (a.areaComun != null && a.areaComun < 0) return e('el área común no puede ser negativa');

  for (const [fecha, nombre] of [
    [a.fechaAdquisicion, 'de adquisición'],
    [a.fechaDocumento, 'del documento'],
    [a.fechaDescargo, 'de descargo'],
  ] as const) {
    if (fecha && fecha > ctx.fechaPresentacion) return e(`la fecha ${nombre} no puede ser posterior a la presentación`);
  }
  if (a.fechaAdquisicion && a.fechaDescargo && a.fechaDescargo < a.fechaAdquisicion) return e('el descargo no puede ser anterior a la adquisición');
  if (!dentro(a.anioAfectacion, 1990, ctx.anioActual + 1)) return e(`el año de afectación debe estar entre 1990 y ${ctx.anioActual + 1}`);

  // J12: el descargo lleva su fecha y, si es una transferencia, a quién se transfirió.
  if (descargo && !a.fechaDescargo) return e('un descargo necesita la fecha de descargo');
  if (!descargo && a.fechaDescargo) return e('la fecha de descargo solo va en un descargo (venta o baja)');
  if (ctx.motivo === MOTIVO.VENTA && !a.adquirientes.some((x) => x.rol === 'ADQUIRIENTE')) {
    return e('en un descargo por transferencia indica quién adquiere el predio');
  }
  if (ctx.motivo === MOTIVO.COMPRA && !a.fechaAdquisicion) return e('una adquisición necesita la fecha de adquisición');
  for (const x of a.adquirientes) {
    if (!(ROLES_ADQUIRIENTE as readonly string[]).includes(x.rol)) return e('el rol del adquiriente o transferente no es válido');
    if (Boolean(x.tipoDoc) !== Boolean(x.numDoc)) return e('del adquiriente o transferente indica tipo y número de documento, o ninguno');
  }
  if ((a.valorTransferencia != null) !== Boolean(a.moneda)) return e('el valor de transferencia va con su moneda');
  if (a.moneda && !(MONEDAS as readonly string[]).includes(a.moneda)) return e('la moneda es PEN o USD');

  const eNiveles = errorNiveles(a.niveles, ctx.anioActual);
  if (eNiveles) return e(eNiveles);
  for (const o of a.obras) {
    if (!o.descripcion.trim()) return e('cada obra complementaria lleva su descripción');
    if (!(o.cantidad > 0)) return e(`la obra "${o.descripcion}" debe tener cantidad mayor que 0`);
    if (o.anioConstruccion != null && !dentro(o.anioConstruccion, 1900, ctx.anioActual)) return e(`el año de la obra "${o.descripcion}" no es válido`);
    // V05: la obra con código se valoriza y deprecia con las tablas del año.
    if (o.codigo) {
      if (o.anioConstruccion == null) return e(`la obra "${o.descripcion}" tiene código: indica su año de construcción`);
      if (!(MATERIALES as readonly string[]).includes(o.material ?? '')) return e(`la obra "${o.descripcion}" tiene código: indica su material`);
      if (!(ESTADOS_CONSERVACION as readonly string[]).includes(o.estadoConservacion ?? '')) return e(`la obra "${o.descripcion}" tiene código: indica su estado de conservación`);
    }
  }
  const eUsos = descargo && a.usos.length === 0 ? null : errorUsos(a.usos);
  if (eUsos) return e(eUsos);
  // V07: los aranceles rústicos solo van en un predio rústico, y un rústico los necesita.
  if (!ctx.rustico && a.rusticos.length) return e('los aranceles rústicos solo van en un predio rústico');
  if (ctx.rustico && !descargo && !a.rusticos.length) return e('un predio rústico necesita sus hectáreas por categoría');
  if (a.rusticos.some((r) => !(r.hectareas > 0))) return e('las hectáreas deben ser mayores que 0');
  return null;
}

export function errorNiveles(niveles: NivelDj[], anioActual: number): string | null {
  const vistos = new Set<string>();
  for (const n of niveles) {
    const nivel = n.nivel.trim().toUpperCase();
    if (!nivel) return 'cada nivel lleva su nombre (1, 2, S1, AZ…)';
    if (vistos.has(nivel)) return `el nivel ${nivel} está repetido`;
    vistos.add(nivel);
    if (!(n.areaPropia > 0)) return `el nivel ${nivel} debe tener área propia mayor que 0`;
    if (n.anioConstruccion != null && !dentro(n.anioConstruccion, 1900, anioActual)) return `el año de construcción del nivel ${nivel} debe estar entre 1900 y ${anioActual}`;
    if (n.mesConstruccion != null && !dentro(n.mesConstruccion, 1, 12)) return `el mes de construcción del nivel ${nivel} debe estar entre 1 y 12`;
    if (!(CLASIFICACIONES as readonly string[]).includes(n.clasificacion)) return `la clasificación del nivel ${nivel} no es válida`;
    if (!(MATERIALES as readonly string[]).includes(n.material)) return `el material del nivel ${nivel} no es válido`;
    if (!(ESTADOS_CONSERVACION as readonly string[]).includes(n.estadoConservacion)) return `el estado de conservación del nivel ${nivel} no es válido`;
    if (!REGEX_CATEGORIAS.test(n.categorias)) return `las categorías del nivel ${nivel} son 7 letras de la A a la I (o "-")`;
    // V04: el área común se reparte por % de participación.
    if (n.areaComun != null && n.areaComun > 0 && !(n.participacion != null && n.participacion > 0 && n.participacion <= 100)) {
      return `el nivel ${nivel} tiene área común: indica su % de participación`;
    }
  }
  return null;
}

// R03: al menos un uso; uno predominante (si no se marca, el de mayor área).
export function errorUsos(usos: UsoDj[]): string | null {
  if (usos.length === 0) return 'indica al menos un uso del predio';
  if (usos.filter((u) => u.predominante).length > 1) return 'solo un uso es el predominante';
  for (const u of usos) {
    if (!(u.area > 0)) return `el uso ${u.uso} debe tener área mayor que 0`;
    if (u.fechaInicio && u.fechaFin && u.fechaFin < u.fechaInicio) return `el uso ${u.uso} termina antes de empezar`;
  }
  return null;
}

export function indicePredominante(usos: UsoDj[]): number {
  const marcado = usos.findIndex((u) => u.predominante);
  if (marcado >= 0) return marcado;
  return usos.reduce((mejor, u, i) => (u.area > usos[mejor].area ? i : mejor), 0);
}

// R04: lo que declara cada condómino en su propia DJ no pasa de 100 por predio.
export function errorPorcentajes(predio: string, propio: number, otros: { nombre: string; porcentaje: number }[]): string | null {
  const centavos = (n: number) => Math.round(n * 100);
  const suma = otros.reduce((s, o) => s + centavos(o.porcentaje), centavos(propio));
  if (suma <= 10000) return null;
  const detalle = otros.map((o) => `${o.nombre} ${o.porcentaje}%`).join(', ');
  return `${predio}: los porcentajes declarados suman ${(suma / 100).toFixed(2)}% (${detalle} y esta DJ ${propio}%). No pueden pasar de 100%`;
}

// ---- Estados (J04, J05, J17) ----

export function errorEditar(estado: EstadoDj): string | null {
  return estado === 'PENDIENTE' ? null : 'Solo se edita una DJ pendiente: una liquidada se reabre o se rectifica con otra DJ';
}

// J04: una DJ que ya generó cuenta también se anula, extornando esa cuenta (lo hace el servicio de
// determinación, con las reglas J17 de errorAnularLiquidada).
export function errorAnular(estado: EstadoDj): string | null {
  if (estado === 'PENDIENTE' || estado === 'EN_REVISION' || estado === 'LIQUIDADA') return null;
  return `La DJ ya está ${estado === 'ANULADA' ? 'anulada' : 'rechazada'}`;
}

export function errorReabrir(estado: EstadoDj, motivo: string, reabribles: string[]): string | null {
  if (estado !== 'LIQUIDADA') return 'Solo se reabre una DJ liquidada';
  if (!reabribles.includes(motivo)) return 'Este motivo no se reabre (regla dj.motivosReabribles): presenta una rectificatoria';
  return null;
}
