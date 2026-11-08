import { isAxiosError } from 'axios'
import { api } from './api'

// Chat San Bartolo (specs/ia-chat-v1.md). Respuesta completa, sin streaming.
export const NIVEL_CHAT = 'ayuda.chat'

export interface Fuente {
  archivo: string
  guia: string
  seccion: string
}

export interface MensajeChat {
  id: number
  rol: 'USER' | 'IA'
  contenido: string
  fuentes: Fuente[]
  createdAt: string
}

export interface ConversacionResumen {
  id: number
  titulo: string
  creadoEn: string
  ultimoMensajeEn: string
}

export async function enviarMensaje(mensaje: string, convId: number | null) {
  const { data } = await api.post<{ convId: number; mensaje: MensajeChat }>('/ia/chat', {
    mensaje,
    ...(convId ? { convId } : {}),
  })
  return data
}

export async function listarConversaciones() {
  const { data } = await api.get<ConversacionResumen[]>('/ia/chat/conversaciones')
  return data
}

export async function obtenerConversacion(id: number) {
  const { data } = await api.get<ConversacionResumen & { mensajes: MensajeChat[] }>(
    `/ia/chat/conversaciones/${id}`,
  )
  return data
}

// 503 trae el mensaje claro del backend (sin key, sin red, cuota); el resto, conexión.
export function mensajeErrorChat(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const message: unknown = err.response?.data?.message
    if (status === 401) return 'Sesión vencida. Vuelve a ingresar.'
    if (status === 403) return 'Tu rol no tiene acceso al asistente.'
    if (status === 404) return 'La conversación ya no está disponible. Empieza una nueva.'
    if (status && (status < 500 || status === 503) && message) {
      return Array.isArray(message) ? message.join('. ') : String(message)
    }
  }
  return 'No se pudo conectar con el servidor. Intenta nuevamente.'
}
