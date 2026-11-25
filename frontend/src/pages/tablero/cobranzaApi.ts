import { isAxiosError } from 'axios'

// Mensajes de error de la API (P8): 401 sesión, 403 acceso, 400/404 el mensaje del backend, resto conexión.
export function mensajeError(err: unknown): string {
  if (!isAxiosError(err)) return 'Ocurrió un error inesperado. Intenta nuevamente.'
  const status = err.response?.status
  const message = (err.response?.data as { message?: string | string[] } | undefined)?.message
  if ((status === 400 || status === 404 || status === 413) && message) {
    return Array.isArray(message) ? message[0] : message
  }
  if (status === 413) return 'El archivo es demasiado grande (máximo 10 MB).'
  if (status === 401) return 'Sesión vencida. Vuelve a ingresar.'
  if (status === 403) return 'No tienes acceso a la priorización de cobranza.'
  return 'No se pudo conectar con el servidor. Intenta nuevamente.'
}
