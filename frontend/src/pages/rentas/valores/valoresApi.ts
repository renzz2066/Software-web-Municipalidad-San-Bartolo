// Contrato de /rentas/valores (backend/src/rentas/valores). specs/rentas-valores-v1.md.

export type TipoValor = 'OP' | 'RD'
export type EstadoValor = 'EMITIDO' | 'NOTIFICADO' | 'COACTIVO' | 'CANCELADO' | 'ANULADO'

export const RUTA_VALORES = '/rentas/control-recaudacion/valores'

export const NOMBRE_VALOR: Record<TipoValor, string> = {
  OP: 'Orden de Pago',
  RD: 'Resolución de Determinación',
}

export const ESTILO_VALOR: Record<EstadoValor, string> = {
  EMITIDO: 'bg-mar/10 text-mar-profundo',
  NOTIFICADO: 'bg-amber-50 text-amber-800',
  COACTIVO: 'bg-red-50 text-red-800',
  CANCELADO: 'bg-emerald-50 text-emerald-800',
  ANULADO: 'bg-slate-100 text-slate-600',
}

export interface PredioCorto {
  id: number
  numero?: string | null
  manzana?: string | null
  lote?: string | null
  via?: { tipoVia: string; nombre: string } | null
  urbanizacion?: { nombre: string } | null
}

export interface ContribuyenteCorto {
  id: number
  tipoDoc?: string
  numDoc?: string
  nombreCompleto?: string
}

export interface ResultadoEmision {
  anio: number
  fecha: string
  tipos: TipoValor[]
  valores: number
  contribuyentes: number
  total: string
  porTipo: Partial<Record<TipoValor, { cantidad: number; total: string }>>
  excluidas: { yaEnValor: number; noVencidas: number; recalculoPendiente: number; bajoMinimo: number }
  recalcular: ContribuyenteCorto[]
  totalRecalcular: number
  muestra: { tipo: TipoValor; contribuyente: ContribuyenteCorto; predio: PredioCorto | null; cuotas: number; total: string }[]
  ejecutado: boolean
  emitidos?: Partial<Record<TipoValor, [string, string]>>
}

export interface ValorResumen {
  id: number
  tipo: TipoValor
  anio: number
  numero: string
  estado: EstadoValor
  fechaEmision: string
  fechaNotificacion: string | null
  totalDeuda: string
  predio: PredioCorto | null
  aniosFiscales: number[]
  cuotas: number
}

export interface DetalleValor {
  id: number
  anio: number
  cuota: number
  tributo: { codigo: string; nombre: string; tipo: string }
  vencimiento: string | null
  estadoCuota: string
  importe: string
  reajuste: string
  mora: string
  derechoEmision: string
  subtotal: string
  hoy: { reajuste: string; mora: string; total: string }
}

export interface Valor {
  id: number
  tipo: TipoValor
  anio: number
  numero: string
  estado: EstadoValor
  fechaEmision: string
  fechaNotificacion: string | null
  fechaExigible: string | null
  modalidadNotificacion: string | null
  motivoAnulacion: string | null
  baseImponible: string | null
  totalDeuda: string
  contribuyente: Required<ContribuyenteCorto> & { direccionFiscal: string | null }
  predio: (PredioCorto & { usoPredio: string | null; zona: { codigo: string; nombre: string } | null }) | null
  transferencia: { anio: number; numero: string; fecha: string; estado: string } | null
  anioFiscal: number
  uit: string | null
  escala: { tramo: number; desdeUit: string; hastaUit: string | null; tasa: string }[]
  detalles: DetalleValor[]
  hoy: { fecha: string; total: string }
}

export function numeroValor(v: { tipo: TipoValor; anio: number; numero: string }): string {
  return `${v.tipo} N° ${v.anio}-${v.numero}`
}

export function direccionPredio(p: PredioCorto | null): string {
  if (!p) return '—'
  const partes = [
    p.via ? `${p.via.tipoVia} ${p.via.nombre}` : null,
    p.numero ? `N° ${p.numero}` : null,
    p.manzana ? `Mz. ${p.manzana}` : null,
    p.lote ? `Lt. ${p.lote}` : null,
    p.urbanizacion?.nombre ?? null,
  ]
  return partes.filter(Boolean).join(' ') || `Predio #${p.id}`
}
