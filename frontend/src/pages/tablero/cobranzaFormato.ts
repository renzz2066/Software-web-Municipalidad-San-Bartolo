// Tipos y formatos de Priorización de Cobranza (specs/prediccion-cobranza-v1.md).

export type Grupo = 'PUNTUAL' | 'TARDIO' | 'INCOBRABLE'
export type EstadoGestion = 'PENDIENTE' | 'CONTACTADO' | 'COMPROMISO' | 'PAGO' | 'NO_UBICADO'
export type Tramo = 'A' | 'B' | 'C'

export interface Puntaje {
  id: number
  anio: number
  prioridad: number
  tramo: Tramo
  codigoLegacy: string
  grupo: Grupo
  pPuntual: number
  pTardio: number
  pIncobrable: number
  deudaAnio: number
  deudaPendiente: number
  deudaEsperada: number
  accion: string
  estadoGestion: EstadoGestion
  ultimaGestionAt: string | null
  contribuyente: { id: number; nombreCompleto: string; tipoDoc: string; numDoc: string | null } | null
}

export interface Lote {
  id: number
  anio: number
  modelo: string
  archivo: string
  filas: number
  enlazados: number
  vigente: boolean
  createdAt: string
  creadoPor: { usuario: string; nombres: string; apellidos: string } | null
}

export interface Resumen {
  lote: Lote | null
  deudaEsperadaTotal?: number
  concentracionTop20?: number
  porGrupo?: { grupo: Grupo; contribuyentes: number; deudaAnio: number; deudaEsperada: number }[]
  porTramo?: { tramo: Tramo; contribuyentes: number; deudaEsperada: number }[]
  acciones?: { accion: string; contribuyentes: number }[]
  gestiones?: Partial<Record<EstadoGestion, number>> & { gestionados: number }
}

export interface Gestion {
  id: number
  estado: EstadoGestion
  observacion: string | null
  createdAt: string
  creadoPor: { usuario: string; nombres: string; apellidos: string } | null
}

export const GRUPOS: Grupo[] = ['PUNTUAL', 'TARDIO', 'INCOBRABLE']

export const GRUPO_TEXTO: Record<Grupo, string> = {
  PUNTUAL: 'Puntual',
  TARDIO: 'Tardío',
  INCOBRABLE: 'Incobrable',
}

// Semántica de estados del sistema: ok = bueno, aviso = atención, ladrillo = deuda/riesgo
export const GRUPO_ESTILO: Record<Grupo, string> = {
  PUNTUAL: 'bg-ok-fondo text-ok',
  TARDIO: 'bg-aviso-fondo text-aviso',
  INCOBRABLE: 'bg-ladrillo/10 text-ladrillo',
}

export const GRUPO_BARRA: Record<Grupo, string> = {
  PUNTUAL: 'bg-ok',
  TARDIO: 'bg-amber-400',
  INCOBRABLE: 'bg-ladrillo',
}

export const TRAMO_TEXTO: Record<Tramo, string> = {
  A: 'Tramo A (primer 5 %)',
  B: 'Tramo B (5 % a 20 %)',
  C: 'Tramo C (resto)',
}

export const ESTADOS: EstadoGestion[] = ['PENDIENTE', 'CONTACTADO', 'COMPROMISO', 'PAGO', 'NO_UBICADO']

export const ESTADO_TEXTO: Record<EstadoGestion, string> = {
  PENDIENTE: 'Pendiente',
  CONTACTADO: 'Contactado',
  COMPROMISO: 'Compromiso de pago',
  PAGO: 'Pagó',
  NO_UBICADO: 'No ubicado',
}

export const ESTADO_ESTILO: Record<EstadoGestion, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-600',
  CONTACTADO: 'bg-mar/10 text-mar',
  COMPROMISO: 'bg-aviso-fondo text-aviso',
  PAGO: 'bg-ok-fondo text-ok',
  NO_UBICADO: 'bg-ladrillo/10 text-ladrillo',
}

// Etiquetas cortas para el filtro: las acciones del modelo son largas y se cortaban en el select.
const ACCION_CORTA: Record<string, string> = {
  'Gestión intensiva (llamada, visita, OP/RD)': 'Gestión intensiva',
  'Seguimiento preventivo (monto alto)': 'Seguimiento preventivo',
  'Recordatorio por SMS': 'Recordatorio SMS',
  'Recordatorio por carta': 'Recordatorio carta',
  'Incentivo por pronto pago': 'Incentivo pronto pago',
}

export function accionCorta(accion: string): string {
  return ACCION_CORTA[accion] ?? accion
}

export function porcentaje(valor: number, decimales = 1): string {
  return `${(valor * 100).toLocaleString('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`
}

export function soles(valor: number, decimales = 2): string {
  return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`
}

/** Anchos (en %) de la barra apilada de probabilidades; suman 100 aunque el redondeo no cuadre. */
export function anchosBarra(p: Pick<Puntaje, 'pPuntual' | 'pTardio' | 'pIncobrable'>): Record<Grupo, number> {
  const total = p.pPuntual + p.pTardio + p.pIncobrable || 1
  const puntual = (p.pPuntual / total) * 100
  const tardio = (p.pTardio / total) * 100
  return { PUNTUAL: puntual, TARDIO: tardio, INCOBRABLE: Math.max(0, 100 - puntual - tardio) }
}

export function nombreUsuario(u: { nombres: string; apellidos: string; usuario: string } | null): string {
  if (!u) return 'Sistema'
  return `${u.nombres} ${u.apellidos}`.trim() || u.usuario
}

export function requiereObservacion(estado: EstadoGestion): boolean {
  return estado === 'COMPROMISO' || estado === 'NO_UBICADO'
}
