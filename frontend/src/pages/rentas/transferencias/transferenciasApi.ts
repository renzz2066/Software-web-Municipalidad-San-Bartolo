import type { ContribuyenteCorto, PredioCorto, TipoValor } from '../valores/valoresApi'

// Contrato de /rentas/transferencias (backend/src/rentas/transferencias). specs/rentas-valores-v1.md, V7.

export const RUTA_TRANSFERENCIAS = '/rentas/control-recaudacion/transferencias'

export interface ValorTransferible {
  id: number
  tipo: TipoValor
  anio: number
  numero: string
  contribuyente: Required<ContribuyenteCorto>
  predio: PredioCorto | null
  fechaNotificacion: string | null
  fechaExigible: string | null
  cuotas: number
  deuda: string
}

export interface ResultadoTransferencia {
  fecha: string
  tipos: TipoValor[]
  cantidad: number
  monto: string
  excluidos: { noNotificado: number; plazoVigente: number; sinDeudaPendiente: number }
  valores: ValorTransferible[]
  ejecutado: boolean
  transferenciaId?: number
  numero?: string
}

export interface TransferenciaResumen {
  id: number
  anio: number
  numero: string
  fecha: string
  cantidad: number
  monto: string
  estado: 'ENVIADA' | 'RECIBIDA' | 'DEVUELTA'
}

export interface Memorandum extends TransferenciaResumen {
  valores: ValorTransferible[]
}
