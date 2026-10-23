import type { PredioCorto, TipoValor } from '../valores/valoresApi'

// Contrato de /rentas/convenios (backend/src/rentas/fraccionamiento). specs/rentas-valores-v1.md, V6.

export const RUTA_CONVENIOS = '/rentas/control-recaudacion/convenios'

export type EstadoConvenio = 'FRACCIONADO' | 'ANULADO' | 'CANCELADO'

export const ESTILO_CONVENIO: Record<string, string> = {
  FRACCIONADO: 'bg-mar/10 text-mar-profundo',
  CANCELADO: 'bg-emerald-50 text-emerald-800',
  ANULADO: 'bg-slate-100 text-slate-600',
}

export const ETIQUETA_CONVENIO: Record<string, string> = {
  FRACCIONADO: 'VIGENTE',
  CANCELADO: 'CANCELADO',
  ANULADO: 'ANULADO',
}

export interface DeudaFraccionable {
  id: number
  anio: number
  cuota: number
  tributo: { codigo: string; nombre: string; tipo: string }
  predio: PredioCorto | null
  vencimiento: string | null
  diasAtraso: number
  insoluto: string
  reajuste: string
  mora: string
  derechoEmision: string
  total: string
  valor?: { tipo: TipoValor; anio: number; numero: string } | null
}

export interface CuotaCronograma {
  numero: number
  vencimiento: string
  amortizacion: string
  interes: string
  monto: string
  estado?: string
}

export interface SimulacionConvenio {
  fecha: string
  anio: number
  total: string
  cuotaInicial: string
  cuotaInicialMinima: string
  numCuotas: number
  cuotasMax: number
  interesMensual: string
  ordenanza: string | null
  totalIntereses: string
  totalAPagar: string
  deudas: DeudaFraccionable[]
  cronograma: CuotaCronograma[]
  ejecutado: boolean
  convenioId?: number
  numero?: string
}

export interface ConvenioResumen {
  id: number
  numero: string
  fecha: string
  montoTotal: string
  cuotaInicial: string
  numCuotas: number
  estado: EstadoConvenio
  totalCronograma: string
  cuotasPendientes: number
}

export interface Convenio {
  id: number
  numero: string
  fecha: string
  estado: EstadoConvenio
  motivoAnulacion: string | null
  montoTotal: string
  cuotaInicial: string
  numCuotas: number
  interesMensual: string
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string; direccionFiscal: string | null }
  deudas: (Omit<DeudaFraccionable, 'vencimiento' | 'diasAtraso' | 'derechoEmision' | 'total' | 'valor'> & { estadoCuenta: string; subtotal: string })[]
  cronograma: CuotaCronograma[]
  totalIntereses: string
  totalAPagar: string
}

export const etiquetaCuota = (numero: number) => (numero === 0 ? 'Inicial' : String(numero))
