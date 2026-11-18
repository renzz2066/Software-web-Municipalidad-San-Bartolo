// Contrato de backend/src/predios (Fase C).

export type Motivo = 'INSCRIPCION' | 'COMPRA' | 'VENTA' | 'RECTIFICACION' | 'BAJA' | 'FISCALIZACION'

export const MOTIVOS: { value: Motivo; label: string; ayuda: string }[] = [
  { value: 'INSCRIPCION', label: 'Inscripción', ayuda: 'Registra un predio nuevo.' },
  { value: 'RECTIFICACION', label: 'Rectificación', ayuda: 'Corrige datos, construcción o porcentajes.' },
  { value: 'COMPRA', label: 'Compra', ayuda: 'La presenta el comprador; queda como titular.' },
  { value: 'VENTA', label: 'Venta', ayuda: 'La presenta el vendedor; deja de ser titular.' },
  { value: 'BAJA', label: 'Baja', ayuda: 'El predio deja de estar afecto (demolición, fusión, etc.).' },
]

// Solo la genera la resolución de una fiscalización; no se elige en el formulario.
export const ETIQUETA_FISCALIZACION = 'Fiscalización'

export interface Catalogos {
  zonas: { id: number; codigo: string; nombre: string }[]
  urbanizaciones: { id: number; codigo: string; nombre: string }[]
  vias: { id: number; tipoVia: string; nombre: string }[]
}

export interface PisoApi {
  id: number
  nivel: string
  anioConstruccion: number | null
  clasificacion: string | null
  material: string | null
  estadoConservacion: string | null
  categorias: string | null
  areaConstruida: string | null
}

export interface OtraInstalacionApi {
  id: number
  descripcion: string
  unidad: string | null
  cantidad: string | null
  valor: string | null
}

export interface TitularApi {
  porcentaje: string
  esPrincipal: boolean
  fechaAdquisicion: string | null
  condicion: string | null // R05: catálogo CONDICION_PROPIEDAD
  contribuyente: { id: number; tipoDoc: string; numDoc: string | null; nombreCompleto: string }
}

export type TipoPredio = 'URBANO' | 'RUSTICO'

// Linderos (R01): metros y colindante por lado.
export const LADOS = ['Frente', 'Derecha', 'Izquierda', 'Fondo'] as const
export type Lado = (typeof LADOS)[number]

// R06: inafectación o exoneración del predio.
export interface BeneficioPredio {
  id: number
  codigo: string
  porcentaje: string
  baseLegal: string
  expediente: string | null
  resolucion: string
  fechaResolucion: string
  anioDesde: number
  anioHasta: number | null
  vigente: boolean
  observacion: string | null
}

// Maestro (Fase 3, R01/R02): lo que no se declara en la DJ.
export interface MaestroPredio {
  tipo: TipoPredio
  nombre: string | null
  latitud: string | null
  longitud: string | null
  linderoFrenteMetros: string | null
  linderoFrenteColindante: string | null
  linderoDerechaMetros: string | null
  linderoDerechaColindante: string | null
  linderoIzquierdaMetros: string | null
  linderoIzquierdaColindante: string | null
  linderoFondoMetros: string | null
  linderoFondoColindante: string | null
  frecuenciaBarrido: string | null
  ubicacionParque: string | null
  frontis: string | null
}

// C4: personas asociadas al predio en un año (GET /predios/:id/personas?anio=).
export interface PersonaAsociada {
  porcentaje: string
  condicion: string | null
  fechaAdquisicion: string | null
  fechaFin: string | null
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA'
  contribuyenteDelAnio: boolean
  finDesconocido: boolean
  contribuyente: { id: number; tipoDoc: string; numDoc: string | null; nombreCompleto: string }
}

export interface PredioApi extends MaestroPredio {
  id: number
  codigoLegacy: string | null
  codigoCatastro: string | null
  direccionId: number | null
  direccion: { id: number; direccion: string; activo: boolean } | null
  beneficios?: BeneficioPredio[]
  zonaId: number | null
  urbanizacionId: number | null
  viaId: number | null
  numero: string | null
  manzana: string | null
  lote: string | null
  referencia: string | null
  areaTerreno: string | null
  areaConstruida: string | null
  valorAutovaluo: string | null
  usoPredio: string | null
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA'
  zona: { id: number; codigo: string; nombre: string } | null
  urbanizacion: { id: number; codigo: string; nombre: string } | null
  via: { id: number; tipoVia: string; nombre: string } | null
  pisos: PisoApi[]
  otrasInstalaciones: OtraInstalacionApi[]
  contribuyentes: TitularApi[]
  declaraciones?: {
    id: number
    anio: number
    motivo: Motivo
    fecha: string
    fechaHecho: string | null
    observacion: string | null
    contribuyente: { id: number; nombreCompleto: string }
    // DJ extemporánea (specs/rentas-fiscalizacion-v1.md, F7)
    vencePlazo: string | null
    extemporanea: boolean
    multaDescartada: string | null
    multas: { id: number; anio: number; numero: string; estado: string }[]
  }[]
}

export function direccion(p: Pick<PredioApi, 'via' | 'numero' | 'manzana' | 'lote' | 'urbanizacion' | 'id'>): string {
  const partes = [
    p.via ? `${p.via.tipoVia} ${p.via.nombre}` : null,
    p.numero ? `N° ${p.numero}` : null,
    p.manzana ? `Mz. ${p.manzana}` : null,
    p.lote ? `Lt. ${p.lote}` : null,
    p.urbanizacion?.nombre ?? null,
  ]
  return partes.filter(Boolean).join(' ') || `Predio #${p.id}`
}

export const etiquetaMotivo = (m: Motivo) => (m === 'FISCALIZACION' ? ETIQUETA_FISCALIZACION : (MOTIVOS.find((x) => x.value === m)?.label ?? m))
