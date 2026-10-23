// Contrato de backend/src/predios (Fase C).

export type Motivo = 'INSCRIPCION' | 'COMPRA' | 'VENTA' | 'RECTIFICACION' | 'BAJA'

export const MOTIVOS: { value: Motivo; label: string; ayuda: string }[] = [
  { value: 'INSCRIPCION', label: 'Inscripción', ayuda: 'Registra un predio nuevo.' },
  { value: 'RECTIFICACION', label: 'Rectificación', ayuda: 'Corrige datos, construcción o porcentajes.' },
  { value: 'COMPRA', label: 'Compra', ayuda: 'La presenta el comprador; queda como titular.' },
  { value: 'VENTA', label: 'Venta', ayuda: 'La presenta el vendedor; deja de ser titular.' },
  { value: 'BAJA', label: 'Baja', ayuda: 'El predio deja de estar afecto (demolición, fusión, etc.).' },
]

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
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string }
}

export interface PredioApi {
  id: number
  codigoLegacy: string | null
  codigoCatastro: string | null
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
    observacion: string | null
    contribuyente: { id: number; nombreCompleto: string }
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

export const etiquetaMotivo = (m: Motivo) => MOTIVOS.find((x) => x.value === m)?.label ?? m
