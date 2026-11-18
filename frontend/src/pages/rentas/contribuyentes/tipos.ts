// Tipos y utilidades de personas (contrato: backend/src/contribuyentes; specs/rentas-nucleo-v2.md, Fase 1).

export type TipoPersona = 'NATURAL' | 'JURIDICA' | 'SUCESION'
// P16: PENDIENTE = datos por validar; no frena la tributación.
export type EstadoPersona = 'HABILITADO' | 'INHABILITADO' | 'PENDIENTE'

export interface ContribuyenteResumen {
  id: number
  codigoLegacy: string | null
  tipoPersona: TipoPersona
  tipoDoc: string // documento principal; SIN_DOCUMENTO si no tiene
  numDoc: string | null
  nombreCompleto: string
  direccionFiscal: string | null
  estado: EstadoPersona
}

export interface DocumentoPersona {
  id: number
  orden: number
  tipoDoc: string
  numDoc: string
}

export interface ContactoPersona {
  id: number
  orden: number
  tipo: string
  valor: string
}

export interface RelacionadoPersona {
  id: number
  orden: number
  tipo: string
  tipoDoc: string | null
  numDoc: string | null
  nombreCompleto: string
  direccion: string | null
  vigente: boolean
  persona: { id: number; nombreCompleto: string } | null
}

export interface BeneficioPersona {
  id: number
  codigo: string
  baseLegal: string
  expediente: string | null
  resolucion: string
  fechaResolucion: string
  anioDesde: number
  anioHasta: number | null
  vigente: boolean
  observacion: string | null
}

export interface Contribuyente extends ContribuyenteResumen {
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  nombres: string | null
  razonSocial: string | null
  tipoSucesion: string | null
  nombreRevisado: boolean
  fechaNacimiento: string | null
  dniCausante: string | null
  ubigeo: string | null
  // Domicilio fiscal (SIMUN: bloque "Datos Domicilio Fiscal"); la Fase 2 lo lleva a direcciones únicas.
  zonaId: number | null
  urbanizacionId: number | null
  viaId: number | null
  numero: string | null
  interior: string | null
  manzana: string | null
  lote: string | null
  referencia: string | null
  perfilCumplimiento: string | null
  perfilCobranza: string | null
  clasificacion: string | null
  sinDocumentoMotivo: string | null
  excepcionAprobadaAt: string | null
  excepcionAprobadaPor: { usuario: string; nombres: string; apellidos: string } | null
  motivoEstado: string | null
  documentos: DocumentoPersona[]
  contactos: ContactoPersona[]
  relacionados: RelacionadoPersona[]
  beneficios: BeneficioPersona[]
  pendientes: string[]
  createdAt: string
  updatedAt: string
}

// Catálogo de ubigeo (GET /contribuyentes/ubigeos).
export interface Ubigeo {
  codigo: string
  departamento: string
  provincia: string
  distrito: string
}

// San Bartolo (Lima/Lima): ubigeo con el que se abre el alta.
export const UBIGEO_DEFECTO = '150129'

export interface Catalogos {
  zonas: { id: number; codigo: string; nombre: string }[]
  urbanizaciones: { id: number; codigo: string; nombre: string }[]
  vias: { id: number; tipoVia: string; nombre: string }[]
}

export const TIPOS_PERSONA: { value: TipoPersona; label: string }[] = [
  { value: 'NATURAL', label: 'Persona natural' },
  { value: 'JURIDICA', label: 'Persona jurídica' },
  { value: 'SUCESION', label: 'Sucesión indivisa' },
]

export const SIN_DOCUMENTO = 'SIN_DOCUMENTO'

export const RUTA_BASE = '/rentas/registro-tributario'

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

function rucValido(ruc: string): boolean {
  return (
    /^(10|15|16|17|20)\d{9}$/.test(ruc) &&
    (11 - (PESOS_RUC.reduce((a, p, i) => a + p * Number(ruc[i]), 0) % 11)) % 10 === Number(ruc[10])
  )
}

// P17: todos los dígitos iguales o una escalera (12345678, 87654321…). Mismo criterio que el backend.
export function documentoFicticio(tipoDoc: string, numDoc: string): boolean {
  const cuerpo = tipoDoc === 'RUC' ? numDoc.slice(2, 10) : numDoc
  if (!/^\d{6,}$/.test(cuerpo)) return false
  if (/^(\d)\1+$/.test(cuerpo)) return true
  const d = [...cuerpo].map(Number)
  const paso = (s: number) => d.every((x, i) => i === 0 || x === (d[i - 1] + s + 10) % 10)
  return paso(1) || paso(-1)
}

// Validación previa en cliente (P07, P17); el backend vuelve a validar (persona.reglas.ts).
export function errorDocumento(tipoDoc: string, numDoc: string): string | null {
  const doc = numDoc.replace(/\s+/g, '').toUpperCase()
  if (!doc) return 'Escribe el número'
  if (tipoDoc === 'DNI' && !/^\d{8}$/.test(doc)) return 'El DNI debe tener 8 dígitos'
  if (tipoDoc === 'RUC' && !rucValido(doc)) return 'El RUC no es válido'
  if (tipoDoc === 'CE' && !/^[A-Z0-9]{9,12}$/.test(doc)) return 'El carné de extranjería debe tener de 9 a 12 caracteres'
  if (tipoDoc === 'PASAPORTE' && !/^[A-Z0-9]{6,12}$/.test(doc)) return 'El pasaporte debe tener de 6 a 12 caracteres'
  if (!['DNI', 'RUC', 'CE', 'PASAPORTE'].includes(tipoDoc) && !/^[A-Z0-9-]{4,15}$/.test(doc)) return 'De 4 a 15 letras o números'
  if (documentoFicticio(tipoDoc, doc)) return 'Parece un número inventado: registra el real o deja a la persona sin documento'
  return null
}

// Dónde hay una API de identidad que resuelva el documento (specs/consulta-identidad-v1.md).
export function formatoConsultable(tipoDoc: string, numDoc: string): boolean {
  const doc = numDoc.replace(/\s+/g, '').toUpperCase()
  if (tipoDoc === 'DNI') return /^\d{8}$/.test(doc)
  if (tipoDoc === 'RUC') return rucValido(doc)
  return false
}

// La consulta de DNI arma el nombre como "paterno materno nombres" (decisión 7): se separa igual
// y el funcionario lo revisa antes de guardar.
export function partirNombre(completo: string): { apellidoPaterno: string; apellidoMaterno: string; nombres: string } {
  const w = completo.trim().split(/\s+/).filter(Boolean)
  if (w.length >= 3) return { apellidoPaterno: w[0], apellidoMaterno: w[1], nombres: w.slice(2).join(' ') }
  if (w.length === 2) return { apellidoPaterno: w[0], apellidoMaterno: '', nombres: w[1] }
  return { apellidoPaterno: w[0] ?? '', apellidoMaterno: '', nombres: '' }
}

// P05: misma regla que el backend, para la vista previa.
export function componerNombre(p: {
  tipoPersona: TipoPersona
  apellidoPaterno: string
  apellidoMaterno: string
  nombres: string
  razonSocial: string
  abreviaturaSucesion?: string | null
}): string {
  const partes =
    p.tipoPersona === 'JURIDICA'
      ? [p.razonSocial]
      : [p.tipoPersona === 'SUCESION' ? (p.abreviaturaSucesion ?? '') : '', p.apellidoPaterno, p.apellidoMaterno, p.nombres]
  return partes
    .map((x) => x.trim().replace(/\s+/g, ' ').toUpperCase())
    .filter(Boolean)
    .join(' ')
    .slice(0, 120)
}

// Respuesta de GET /contribuyentes/identidad: `origen` dice si sirve para rellenar o solo para avisar.
export interface ConsultaIdentidad {
  origen: 'propia' | 'cache' | 'externa'
  contribuyenteId: number | null
  tipoPersona: TipoPersona
  nombreCompleto: string
  estado: string | null
  condicion?: string | null
  direccionExterna?: string | null
  // Solo RUC: ubigeo del domicilio fiscal, ya validado contra el catálogo local.
  ubigeo?: string | null
  consultadoEn?: string
}

export function soles(valor: string | number): string {
  return `S/ ${Number(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Estados: ok habilitado, aviso pendiente, neutro inhabilitado (skills/ui-components.md, 9).
export const ESTILO_ESTADO: Record<EstadoPersona, string> = {
  HABILITADO: 'bg-emerald-50 text-emerald-800',
  PENDIENTE: 'bg-amber-50 text-amber-800',
  INHABILITADO: 'bg-slate-100 text-slate-600',
}

export const ETIQUETA_ESTADO: Record<EstadoPersona, string> = {
  HABILITADO: 'Habilitado',
  PENDIENTE: 'Pendiente',
  INHABILITADO: 'Inhabilitado',
}

// Documento para mostrar en listas y fichas.
export function documentoTexto(c: Pick<ContribuyenteResumen, 'tipoDoc' | 'numDoc'>): string {
  return c.numDoc ? `${c.tipoDoc} ${c.numDoc}` : 'Sin documento'
}
