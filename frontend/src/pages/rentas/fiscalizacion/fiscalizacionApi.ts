import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import type { PredioApi } from '../predios/tipos'
import type { Modalidad } from '../valores/valoresApi'

// Expedientes de fiscalización (specs/rentas-fiscalizacion-v1.md, F1–F3): /rentas/fiscalizacion/*.

export const RUTA_FISCALIZACION = '/rentas/fiscalizacion'
export const RUTA_EXPEDIENTES = '/rentas/fiscalizacion/expedientes'

export type TipoFiscalizacion = 'ORDINARIA' | 'A_SOLICITUD'
export type EstadoFiscalizacion = 'ABIERTO' | 'INSPECCIONADO' | 'RESUELTO' | 'SIN_DIFERENCIAS' | 'ANULADO'

export const TIPOS: { value: TipoFiscalizacion; label: string }[] = [
  { value: 'ORDINARIA', label: 'Ordinaria (de oficio)' },
  { value: 'A_SOLICITUD', label: 'A solicitud' },
]

export const ETIQUETA_ESTADO: Record<EstadoFiscalizacion, string> = {
  ABIERTO: 'Abierto',
  INSPECCIONADO: 'Inspeccionado',
  RESUELTO: 'Resuelto',
  SIN_DIFERENCIAS: 'Sin diferencias',
  ANULADO: 'Anulado',
}

export const ESTILO_ESTADO: Record<EstadoFiscalizacion, string> = {
  ABIERTO: 'bg-sky-50 text-sky-800',
  INSPECCIONADO: 'bg-amber-50 text-amber-800',
  RESUELTO: 'bg-emerald-50 text-emerald-800',
  SIN_DIFERENCIAS: 'bg-slate-100 text-slate-700',
  ANULADO: 'bg-red-50 text-red-700',
}

export const etiquetaTipo = (t: TipoFiscalizacion) => TIPOS.find((x) => x.value === t)?.label ?? t

export interface ContribuyenteExpediente {
  id: number
  tipoPersona: string
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  direccionFiscal: string | null
  codigoLegacy: string | null
}

export interface OpcionesApertura {
  contribuyente: ContribuyenteExpediente
  predios: { id: number; numero: string | null; manzana: string | null; lote: string | null; usoPredio: string | null; via: { id: number; tipoVia: string; nombre: string } | null }[]
  fiscalizadores: { id: number; nombre: string; dni: string }[]
  sinDeclaracion: boolean
  rango: { desde: number; hasta: number }
  aniosConParametros: number[]
}

export interface ExpedienteListado {
  id: number
  numero: string
  tipo: TipoFiscalizacion
  estado: EstadoFiscalizacion
  anioDesde: number
  anioHasta: number
  fechaApertura: string
  inspeccion: { fecha: string; hora: string } | null
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string }
  fiscalizador: string
  predios: number
}

// Lo que guarda la ficha: el mismo cuerpo que la DJ (predio, pisos, instalaciones) + observación.
export interface Ficha {
  predio: {
    viaId: number
    urbanizacionId: number | null
    zonaId: number | null
    numero?: string
    manzana?: string
    lote?: string
    referencia?: string
    codigoCatastro?: string
    areaTerreno: number
    usoPredio: string
  }
  pisos: {
    nivel: string
    anioConstruccion: number | null
    clasificacion: string
    material: string
    estadoConservacion: string
    categorias: string
    areaConstruida: number
  }[]
  otrasInstalaciones: { descripcion: string; unidad?: string; cantidad?: number }[]
  observacion: string | null
}

// POST .../liquidar (F4) y lo guardado al resolver (F5).
export interface DiferenciaCuota {
  anio: number
  tributo: string
  predioId: number | null
  cuota: number
  declarado: string
  fiscalizado: string
  diferencia: string
}

export interface Liquidacion {
  totalOmitido: string
  sinDiferencias: boolean
  anios: {
    anio: number
    baseFiscalizada: string | null
    porTributo: { tributo: string; declarado: string; fiscalizado: string; omitido: string }[]
    aumentos: DiferenciaCuota[]
    disminuciones: DiferenciaCuota[]
  }[]
}

export const RUTA_VALORES_FISCALIZACION = '/rentas/fiscalizacion/valores'

export interface Expediente {
  id: number
  numero: string
  tipo: TipoFiscalizacion
  estado: EstadoFiscalizacion
  anioDesde: number
  anioHasta: number
  fechaApertura: string
  observacion: string | null
  motivoAnulacion: string | null
  abiertoPor: string | null
  contribuyente: ContribuyenteExpediente
  fiscalizador: { id: number; nombre: string; dni: string }
  inspeccion: { fecha: string; hora: string } | null
  notificacion: { fecha: string; modalidad: Modalidad | null; dni: string | null; nombre: string | null } | null
  predios: { predioId: number; ficha: Ficha | null; liquidacion: unknown; predio: PredioApi }[]
  liquidacion: Liquidacion | null
  valores: { id: number; tipo: string; numero: string; estado: string; totalDeuda: string; predioId: number | null }[]
}

export function useExpediente(id: string | undefined, recarga = 0) {
  const [expediente, setExpediente] = useState<Expediente | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<Expediente>(`/rentas/fiscalizacion/expedientes/${id}`)
        if (!cancelled) setExpediente(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id, recarga])

  return { expediente, setExpediente, error }
}
