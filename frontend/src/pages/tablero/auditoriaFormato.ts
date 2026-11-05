// Lógica pura de la pantalla de auditoría (specs/auditoria-pantalla-v1.md).

export const ACCIONES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FALLIDO', 'LOGOUT'] as const
export type Accion = (typeof ACCIONES)[number]

export const ACCION_TEXTO: Record<Accion, string> = {
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Intento fallido',
  LOGOUT: 'Cierre de sesión',
}

// El texto acompaña al color (AA): nunca solo color
export const ACCION_ESTILO: Record<Accion, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-sky-100 text-sky-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-teal-100 text-teal-800',
  LOGIN_FALLIDO: 'bg-red-100 text-red-800',
  LOGOUT: 'bg-slate-200 text-slate-700',
}

// Tablas con trigger de auditoría (auditoria-v1). Al habilitar otra, agrégala aquí.
export const TABLAS_AUDITADAS = ['usuarios', 'roles', 'rol_nivel', 'oficinas', 'niveles'] as const

// Lo que pone el trigger cuando cambió la contraseña (nunca el valor real)
export const MARCA_PASSWORD = '[CAMBIADO]'

export interface AuditoriaItem {
  id: string
  usuarioId: number | null
  usuario: { id: number; usuario: string; nombres: string; apellidos: string } | null
  usuarioNombre: string | null
  accion: Accion
  tabla: string
  registroId: string | null
  modulo: string | null
  ip: string | null
  userAgent: string | null
  datosAntes: Record<string, unknown> | null
  datosDespues: Record<string, unknown> | null
  detalle: Record<string, unknown> | null
  createdAt: string
}

export type TipoCambio = 'agregado' | 'quitado' | 'cambiado'

export interface CampoDiff {
  campo: string
  tipo: TipoCambio
  antes?: unknown
  despues?: unknown
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

// Una fila por campo. UPDATE ya trae solo lo que cambió (lo filtra el trigger).
export function calcularDiff(antes: unknown, despues: unknown): CampoDiff[] {
  const a = esObjeto(antes) ? antes : {}
  const d = esObjeto(despues) ? despues : {}
  const campos = [...new Set([...Object.keys(d), ...Object.keys(a)])]
  return campos.map((campo) => {
    const enAntes = campo in a
    const enDespues = campo in d
    if (enAntes && enDespues) return { campo, tipo: 'cambiado', antes: a[campo], despues: d[campo] }
    if (enDespues) return { campo, tipo: 'agregado', despues: d[campo] }
    return { campo, tipo: 'quitado', antes: a[campo] }
  })
}

export function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined) return 'vacío'
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  if (typeof valor === 'object') return JSON.stringify(valor, null, 2)
  return String(valor)
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function formatearFecha(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA.format(fecha).replace(',', '')
}

// AAAA-MM-DD en hora de Lima (en-CA da ese formato)
const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' })
const DIA_MS = 24 * 60 * 60 * 1000

// D6: sin filtros en la URL se consultan los últimos 7 días (hoy incluido)
export function rangoPorDefecto(ahora = new Date()): { desde: string; hasta: string } {
  return {
    desde: FORMATO_DIA.format(new Date(ahora.getTime() - 6 * DIA_MS)),
    hasta: FORMATO_DIA.format(ahora),
  }
}

export type EtiquetaUsuario =
  | { tipo: 'usuario'; texto: string }
  | { tipo: 'intento'; texto: string }
  | { tipo: 'sistema'; dbUsuario: string | null }

export function etiquetaUsuario(item: AuditoriaItem): EtiquetaUsuario {
  if (item.usuario) {
    const nombre = `${item.usuario.nombres} ${item.usuario.apellidos}`.trim()
    return { tipo: 'usuario', texto: nombre ? `${nombre} (${item.usuario.usuario})` : item.usuario.usuario }
  }
  if (item.accion === 'LOGIN_FALLIDO') {
    return { tipo: 'intento', texto: item.usuarioNombre ?? '' }
  }
  if (item.usuarioId !== null) {
    return { tipo: 'usuario', texto: item.usuarioNombre ?? `#${item.usuarioId}` }
  }
  const db = item.detalle?.dbUsuario
  return { tipo: 'sistema', dbUsuario: typeof db === 'string' ? db : null }
}
