import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'

// GET /contribuyentes/:id/estado-cuenta?fecha= (backend/src/rentas/estado-cuenta).

export interface LineaEstado {
  id: number
  anio: number
  tributo: { codigo: string; nombre: string; tipo: string }
  predio: { id: number; numero: string | null; manzana: string | null; lote: string | null; via: { tipoVia: string; nombre: string } | null } | null
  cuota: number
  vencimiento: string | null
  estado: 'PENDIENTE' | 'COACTIVO' | 'FRACCIONADO'
  diasAtraso: number
  insoluto: string
  reajuste: string
  mora: string
  derechoEmision: string
  total: string
}

export interface EstadoCuenta {
  fecha: string
  generado: string
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string; direccionFiscal: string | null; codigoLegacy: string | null }
  lineas: LineaEstado[]
  totales: { insoluto: string; reajuste: string; mora: string; derechoEmision: string; total: string }
  porAnio: { anio: number; total: string }[]
  avisos: string[]
}

export { hoyLocal as hoyIso } from '../../../lib/fechas'

// recarga: cambia para volver a pedir (p. ej. tras ejecutar un cálculo).
export function useEstadoCuenta(contribuyenteId: number | string | undefined, fecha: string, recarga = 0) {
  const [datos, setDatos] = useState<EstadoCuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!contribuyenteId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<EstadoCuenta>(`/contribuyentes/${contribuyenteId}/estado-cuenta`, { params: { fecha } })
        if (!cancelled) setDatos(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId, fecha, recarga])

  return { datos, error, isLoading }
}
