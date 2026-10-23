import type { LineaEstado } from '../rentas/estado-cuenta/estadoCuentaApi'

// Caja (specs/caja-v1.md): POST /caja/cobros/liquidar, POST /caja/cobros, GET /caja/recibos/:id.

export const RUTA_COBRO = '/caja/cancelaciones'
export const RUTA_RECIBOS = '/caja/recibos'

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
  cajero: { usuario: string; nombre: string | null }
  extorno: { motivo: string | null; fecha: string | null; por: string | null } | null
  lineas: LineaCobro[]
}

export function descripcionCuota(l: Pick<LineaCobro, 'cuota' | 'convenio'>) {
  if (l.convenio) return `Conv. ${l.convenio.numero} · ${l.convenio.cuotaNumero === 0 ? 'inicial' : `cuota ${l.convenio.cuotaNumero}`}`
  return l.cuota ? `Cuota ${l.cuota}` : 'Anual'
}
