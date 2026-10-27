import { api } from '../../../lib/api'

export interface ValorTransferible extends Record<string, unknown> {
  id: number
  tipo: string
  anio: number
  numero: string
  contribuyente: {
    id: number
    numDoc: string
    nombreCompleto: string
    codigoLegacy: string | null
  }
  predio: {
    id: number
    codigoCatastro: string | null
    codigoLegacy: string | null
  } | null
  totalDeuda: number
  fechaEmision: string
  fechaNotificacion: string | null
  estado: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface Ejecutor {
  id: number
  codigo: string
  nombre: string
  activo: boolean
}

export interface Auxiliar {
  id: number
  codigo: string
  nombre: string
  activo: boolean
}

export interface TipoGestion {
  id: number
  codigo: string
  descripcion: string
  activo: boolean
}

export interface ValorDetalle {
  id: number
  tipo: string
  anio: number
  numero: string
  fechaEmision: string
  fechaNotificacion: string | null
  estado: string
  totalDeuda: number
  contribuyente: {
    id: number
    numDoc: string
    nombreCompleto: string
    codigoLegacy: string | null
    direccionFiscal: string | null
  }
  predio: {
    id: number
    codigoCatastro: string | null
    codigoLegacy: string | null
    referencia: string | null
    zona: { codigo: string; nombre: string } | null
  } | null
  detalles: {
    id: number
    importe: number
    mora: number
    reajuste: number
    subtotal: number
    cuentaCorriente: {
      id: number
      tributo: { codigo: string; nombre: string; tipo: string }
      anioFiscal: number
      cuota: number
      estado: string
    }
  }[]
  expedientes: {
    id: number
    anioExpediente: number
    numExpediente: string
    estado: string
    fechaGeneracion: string
    ejecutor: { id: number; codigo: string; nombre: string } | null
    auxiliar: { id: number; codigo: string; nombre: string } | null
  }[]
}

export const coactivaApi = {
  getValores: (params: {
    anio?: number
    tipo?: string
    contribuyente?: string
    estado?: string
    fechaDesde?: string
    fechaHasta?: string
    page?: number
    limit?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params.anio) searchParams.append('anio', String(params.anio))
    if (params.tipo) searchParams.append('tipo', params.tipo)
    if (params.contribuyente) searchParams.append('contribuyente', params.contribuyente)
    if (params.estado) searchParams.append('estado', params.estado)
    if (params.fechaDesde) searchParams.append('fechaDesde', params.fechaDesde)
    if (params.fechaHasta) searchParams.append('fechaHasta', params.fechaHasta)
    if (params.page) searchParams.append('page', String(params.page))
    if (params.limit) searchParams.append('limit', String(params.limit))
    return api.get<PaginatedResponse<ValorTransferible>>(`/coactiva/recepcion-transferencia/valores?${searchParams.toString()}`)
  },

  getValor: (id: number) => api.get<ValorDetalle>(`/coactiva/recepcion-transferencia/valores/${id}`),

  transferirIndividual: (id: number, data: { ejecutorId: number; auxiliarId: number; tipoGestionId?: number }) =>
    api.post(`/coactiva/recepcion-transferencia/valores/${id}/transferir`, data),

  transferirMasivo: (data: { valorIds: number[]; ejecutorId: number; auxiliarId: number; tipoGestionId?: number }) =>
    api.post('/coactiva/recepcion-transferencia/valores/transferir-masivo', data),

  getEjecutores: () => api.get<Ejecutor[]>('/coactiva/recepcion-transferencia/ejecutores'),

  getAuxiliares: () => api.get<Auxiliar[]>('/coactiva/recepcion-transferencia/auxiliares'),

  getTiposGestion: () => api.get<TipoGestion[]>('/coactiva/recepcion-transferencia/tipos-gestion'),
}

export function mensajeError(err: any): string {
  if (err?.response?.data?.message) {
    return Array.isArray(err.response.data.message) ? err.response.data.message.join(', ') : err.response.data.message
  }
  if (err?.message) return err.message
  return 'Error desconocido'
}