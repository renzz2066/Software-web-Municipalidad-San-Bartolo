import { isAxiosError } from 'axios'

// Mensaje legible para errores de los maestros (Nest: {message: string | string[]}).
export function mensajeError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 401) return 'Sesión vencida. Vuelve a ingresar.'
    if (status === 403) return 'Sin permisos para los maestros de Rentas.'
    const message: unknown = err.response?.data?.message
    if (status && status < 500 && message) {
      return Array.isArray(message) ? message.join('. ') : String(message)
    }
  }
  return 'No se pudo conectar con el servidor. Intenta nuevamente.'
}

export interface Opcion {
  value: string
  label: string
}

export interface Zona {
  id: number
  codigo: string
  nombre: string
}

export interface Urbanizacion {
  id: number
  codigo: string
  nombre: string
}

export interface Via {
  id: number
  tipoVia: string
  nombre: string
}

export interface ResumenAnio {
  anio: number
  uit: { valor: string; ordenanza: string | null } | null
  conteos: Record<string, number>
  bloqueado: boolean
}
