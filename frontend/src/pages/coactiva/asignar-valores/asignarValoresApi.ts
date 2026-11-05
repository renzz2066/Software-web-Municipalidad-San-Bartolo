import { api } from '../../../lib/api'

export interface Memorandum {
  id: number
  numero: string
  anio: number
  areaOrigen: string
  fechaRecepcion: string
}

export interface Auxiliar {
  id: number
  codigo: string
  nombre: string
  activo: boolean
}

export interface ValorAsignable {
  id: number
  tipo: string
  numero: string
  contribuyente: {
    nombreCompleto: string
    numDoc: string
  }
  totalDeuda: number
  memorandumId: number
  auxiliarAsignadoId: number
}

export interface AsignarValoresInput {
  valorIds: number[]
  auxiliarId: number
}

export interface AsignarValoresResultado {
  exitosos: number
  fallidos: { valorId: number; error: string }[]
}

export const asignarValoresApi = {
  getMemorandums: () => api.get('/coactiva/asignar-valores/memorandums'),
  getAuxiliares: () => api.get('/coactiva/asignar-valores/auxiliares'),
  getValoresByMemorandum: (memorandumId: number) => api.get('/coactiva/asignar-valores/valores/' + memorandumId),
  asignarValores: (data: AsignarValoresInput) => api.post('/coactiva/asignar-valores/asignar', data)
}