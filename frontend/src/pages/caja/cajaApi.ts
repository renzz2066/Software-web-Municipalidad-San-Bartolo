import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { LineaEstado } from '../rentas/estado-cuenta/estadoCuentaApi'
import { mensajeError } from '../rentas/maestros/maestrosApi'

// Caja (specs/caja-v1.md): POST /caja/cobros/liquidar, POST /caja/cobros, GET /caja/recibos(/:id),
// POST /caja/recibos/:id/extornar.

export const RUTA_COBRO = '/caja/cancelaciones'
export const RUTA_RECIBOS = '/caja/recibos'
export const MOTIVO_EXTORNO_MIN = 5

export type MedioPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'DEPOSITO'

// Decisión 5: un medio por recibo; cheque deshabilitado.
export const MEDIOS_PAGO: { value: MedioPago; label: string; ayuda?: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta', ayuda: 'N.° de voucher' },
  { value: 'TRANSFERENCIA', label: 'Transferencia / Yape / Plin', ayuda: 'N.° de operación' },
  { value: 'DEPOSITO', label: 'Depósito en cuenta', ayuda: 'N.° de operación' },
]

export const etiquetaMedio = (m: string) => MEDIOS_PAGO.find((x) => x.value === m)?.label ?? m

export interface LineaCobro {
  id: number
  anio: number
  cuota: number
  tributo: { codigo: string; nombre: string; tipo: string }
  predio: LineaEstado['predio']
  convenio: { numero: string; cuotaNumero: number } | null
  insoluto: string
  reajuste: string
  mora: string
  derechoEmision: string
  total: string
}

export interface Liquidacion {
  fecha: string
  contribuyenteId: number
  lineas: (LineaCobro & { estado: string; vencimiento: string | null })[]
  total: string
  avisos: string[]
}

export interface Recibo {
  id: number
  numero: string
  fecha: string
  fechaCaja: string
  estado: 'CANCELADO' | 'EXTORNADO'
  medioPago: MedioPago
  numOperacion: string | null
  total: string
  totalEnLetras: string
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string; direccionFiscal: string | null; codigoLegacy: string | null }
  cajero: { id: number; usuario: string; nombre: string | null }
  extorno: { motivo: string | null; fecha: string | null; por: string | null } | null
  lineas: LineaCobro[]
}

export function descripcionCuota(l: Pick<LineaCobro, 'cuota' | 'convenio'>) {
  if (l.convenio) return `Conv. ${l.convenio.numero} · ${l.convenio.cuotaNumero === 0 ? 'inicial' : `cuota ${l.convenio.cuotaNumero}`}`
  return l.cuota ? `Cuota ${l.cuota}` : 'Anual'
}

export interface ReciboListado {
  id: number
  numero: string
  fecha: string
  fechaCaja: string
  total: string
  medioPago: MedioPago
  estado: 'CANCELADO' | 'EXTORNADO'
  cajeroId: number
  cajero: string
  cuotas: number
  contribuyente: { id: number; tipoDoc: string; numDoc: string; nombreCompleto: string }
}

export const horaLima = (fecha: string) =>
  new Date(fecha).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })

// GET /caja/recibos: sin caja.reportes ni caja.extornos el backend devuelve solo los recibos propios.

export interface FiltrosRecibos {
  fecha?: string
  numero?: string
}

export function useRecibos(filtros: FiltrosRecibos, recarga = 0) {
  const [recibos, setRecibos] = useState<ReciboListado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { fecha, numero } = filtros

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<ReciboListado[]>('/caja/recibos', { params: { fecha: fecha || undefined, numero: numero || undefined } })
        if (!cancelled) setRecibos(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [fecha, numero, recarga])

  return { recibos, error }
}

export const RUTA_CIERRE = '/caja/cierre'
export const RUTA_CIERRES = '/caja/cierres'

// GET /caja/cierre (resumen propio; el cierre guardado si ya cerró), GET /caja/cierres/:id.
export interface Cierre {
  id: number | null
  fecha: string
  cerrado: boolean
  cajero: { id: number; usuario: string; nombre?: string }
  cantidadRecibos: number
  cantidadExtornos: number
  total: string
  totalesPorMedio: Record<string, string>
  totalesPorTributo: { codigo: string; nombre: string; total: string }[]
  efectivoEsperado: string
  efectivoDeclarado: string | null
  diferencia: string | null
  cerradoEn: string | null
  diasSinCerrar?: string[]
}

// GET /caja/cierres?fecha= (caja.reportes)
export interface CierresDia {
  fecha: string
  cierres: {
    id: number
    cajero: { id: number; usuario: string; nombre: string }
    cantidadRecibos: number
    cantidadExtornos: number
    total: string
    diferencia: string | null
    cerradoEn: string
  }[]
  sinCerrar: { id: number; usuario: string; nombre: string }[]
  total: string
}

export function useResumenCierre(fecha: string, recarga = 0) {
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<Cierre>('/caja/cierre', { params: { fecha } })
        if (!cancelled) setCierre(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [fecha, recarga])

  return { cierre, error }
}
