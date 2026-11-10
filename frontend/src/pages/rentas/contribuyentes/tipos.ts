// Tipos y utilidades de contribuyentes (contrato: backend/src/contribuyentes).

export type TipoPersona = 'NATURAL' | 'JURIDICA' | 'SUCESION'
export type EstadoRegistro = 'ACTIVO' | 'INACTIVO' | 'BAJA'

export interface ContribuyenteResumen {
  id: number
  codigoLegacy: string | null
  tipoPersona: TipoPersona
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  direccionFiscal: string | null
  estado: EstadoRegistro
}

export interface Contribuyente extends ContribuyenteResumen {
  ubigeo: string | null
  telefono: string | null
  celular: string | null
  email: string | null
  // Domicilio fiscal (SIMUN: bloque "Datos Domicilio Fiscal")
  zonaId: number | null
  urbanizacionId: number | null
  viaId: number | null
  numero: string | null
  interior: string | null
  manzana: string | null
  lote: string | null
  referencia: string | null
  // Cónyuge y representante legal: opcionales, como en SIMUN
  conyugeNombre: string | null
  conyugeNumDoc: string | null
  representanteNombre: string | null
  representanteNumDoc: string | null
  representanteDireccion: string | null
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

export const TIPOS_DOC = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const

export const RUTA_BASE = '/rentas/registro-tributario'

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

// Validación previa en cliente; el backend vuelve a validar (documento.ts).
function rucValido(ruc: string): boolean {
  return (
    /^(10|15|16|17|20)\d{9}$/.test(ruc) &&
    (11 - (PESOS_RUC.reduce((a, p, i) => a + p * Number(ruc[i]), 0) % 11)) % 10 === Number(ruc[10])
  )
}

export function errorDocumento(tipoDoc: string, numDoc: string, tipoPersona: TipoPersona): string | null {
  const doc = numDoc.replace(/\s+/g, '').toUpperCase()
  if (tipoDoc === 'DNI' && !/^\d{8}$/.test(doc)) return 'El DNI debe tener 8 dígitos'
  if (tipoDoc === 'RUC' && !rucValido(doc)) return 'El RUC no es válido'
  if (tipoDoc === 'CE' && !/^[A-Z0-9]{9,12}$/.test(doc)) return 'El carné de extranjería debe tener de 9 a 12 caracteres'
  if (tipoDoc === 'PASAPORTE' && !/^[A-Z0-9]{6,12}$/.test(doc)) return 'El pasaporte debe tener de 6 a 12 caracteres'
  if (tipoPersona === 'JURIDICA' && !(tipoDoc === 'RUC' && doc.startsWith('20'))) {
    return 'Una persona jurídica se registra con RUC que empieza en 20'
  }
  return null
}

// Dónde hay una API de identidad que resuelva el documento (specs/consulta-identidad-v1.md).
// CE y pasaporte no: no aparece el botón "Buscar datos".
export function formatoConsultable(tipoDoc: string, numDoc: string): boolean {
  const doc = numDoc.replace(/\s+/g, '').toUpperCase()
  if (tipoDoc === 'DNI') return /^\d{8}$/.test(doc)
  if (tipoDoc === 'RUC') return rucValido(doc)
  return false
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
  consultadoEn?: string
}

export function soles(valor: string | number): string {
  return `S/ ${Number(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const ESTILO_ESTADO: Record<EstadoRegistro, string> = {
  ACTIVO: 'bg-emerald-50 text-emerald-800',
  INACTIVO: 'bg-amber-50 text-amber-800',
  BAJA: 'bg-slate-100 text-slate-600',
}
