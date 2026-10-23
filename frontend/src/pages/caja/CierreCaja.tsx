import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { hoyLocal } from '../../lib/fechas'
import { soles } from '../rentas/contribuyentes/tipos'
import { mensajeError } from '../rentas/maestros/maestrosApi'
import { type Cierre, RUTA_CIERRE, RUTA_COBRO, useResumenCierre } from './cajaApi'
import { DetalleCierre } from './DetalleCierre'

// Cierre diario del cajero (specs/caja-v1.md, K5, decisión 8): resumen en vivo del día → arqueo
// opcional del efectivo → cerrar. Cerrado, ya no cobra ni extorna ese día y el cierre se imprime.

const BOTON_SECUNDARIO =
  'rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'
const BOTON_PRIMARIO =
  'rounded-md bg-mar-profundo px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

function Marco({ volverA, volverTexto, imprimible, children }: { volverA: string; volverTexto: string; imprimible: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to={volverA}
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            {volverTexto}
          </Link>
          <button type="button" onClick={() => window.print()} disabled={!imprimible} className={BOTON_PRIMARIO}>
            <i aria-hidden="true" className="bi bi-printer mr-1" />
            Imprimir / PDF
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const TARJETA = 'mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10 print:mt-0 print:rounded-none print:p-0 print:shadow-none print:ring-0'

export function CierreCaja() {
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? hoyLocal()
  const [recarga, setRecarga] = useState(0)
  const { cierre, error } = useResumenCierre(fecha, recarga)
  const [efectivo, setEfectivo] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function cerrar() {
    setProcesando(true)
    setErrorCierre(null)
    try {
      await api.post<Cierre>('/caja/cierre', { fecha, efectivoDeclarado: efectivo === '' ? undefined : Number(efectivo) })
      setConfirmando(false)
      setRecarga((r) => r + 1)
    } catch (err) {
      setErrorCierre(mensajeError(err))
      setConfirmando(false)
    } finally {
      setProcesando(false)
    }
  }

  const diferencia = cierre && efectivo !== '' ? Number(efectivo) - Number(cierre.efectivoEsperado) : null
  const esHoy = fecha === hoyLocal()

  return (
    <Marco volverA={RUTA_COBRO} volverTexto="Cancelaciones del Día" imprimible={!!cierre?.cerrado}>
      {cierre?.diasSinCerrar && cierre.diasSinCerrar.length > 0 && (
        <div role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          Tienes días con cobros sin cerrar:{' '}
          {cierre.diasSinCerrar.map((d, i) => (
            <span key={d}>
              {i > 0 && ', '}
              <button type="button" onClick={() => setParams({ fecha: d })} className="font-semibold underline focus-visible:outline-3 focus-visible:outline-turquesa">
                {d}
              </button>
            </span>
          ))}
          .
        </div>
      )}
      {!esHoy && (
        <p className="mt-3 text-sm print:hidden">
          <Link to={RUTA_CIERRE} className="font-medium text-mar underline focus-visible:outline-3 focus-visible:outline-turquesa">
            Ver la caja de hoy
          </Link>
        </p>
      )}

      <main className={TARJETA}>
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !cierre ? (
          <p role="status" className="text-sm text-slate-500">
            Calculando el resumen…
          </p>
        ) : (
          <DetalleCierre cierre={cierre} />
        )}
      </main>

      {cierre && !cierre.cerrado && (
        <section aria-labelledby="cierre-cerrar" className="mt-4 rounded-xl bg-white p-6 shadow-md ring-2 ring-mar print:hidden">
          <h2 id="cierre-cerrar" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
            Cerrar caja del {fecha}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Al cerrar no podrás cobrar ni extornar en este día de caja. El cierre queda guardado tal como se ve arriba.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <label htmlFor="cierre-efectivo" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Efectivo contado (arqueo, opcional)
              </label>
              <input
                id="cierre-efectivo"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.10"
                value={efectivo}
                disabled={confirmando}
                onChange={(e) => setEfectivo(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-50"
              />
            </div>
            <p className="pb-2 text-sm" aria-live="polite">
              {diferencia === null
                ? `Esperado ${soles(cierre.efectivoEsperado)}`
                : Math.abs(diferencia) < 0.005
                  ? 'Cuadra con lo esperado'
                  : `${diferencia > 0 ? 'Sobrante' : 'Faltante'} ${soles(Math.abs(diferencia))}`}
            </p>
          </div>
          {errorCierre && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {errorCierre}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {confirmando && (
              <button type="button" onClick={() => setConfirmando(false)} disabled={procesando} className={BOTON_SECUNDARIO}>
                Volver
              </button>
            )}
            <button
              type="button"
              onClick={() => (confirmando ? void cerrar() : setConfirmando(true))}
              disabled={procesando}
              className={BOTON_PRIMARIO}
            >
              <i aria-hidden="true" className="bi bi-lock mr-1" />
              {procesando ? 'Cerrando…' : confirmando ? `Confirmar cierre de ${soles(cierre.total)}` : 'Cerrar caja'}
            </button>
          </div>
        </section>
      )}
    </Marco>
  )
}

// Cierre guardado, por id (reportes o el propio cajero).
export function CierreImprimible() {
  const { id } = useParams()
  const location = useLocation()
  const volverA = (location.state as { volverA?: string } | null)?.volverA ?? '/caja/reportes'
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Cierre>(`/caja/cierres/${id}`)
        if (!cancelled) setCierre(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <Marco volverA={volverA} volverTexto="Volver" imprimible={!!cierre}>
      <main className={TARJETA}>
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !cierre ? (
          <p role="status" className="text-sm text-slate-500">
            Cargando cierre…
          </p>
        ) : (
          <DetalleCierre cierre={cierre} />
        )}
      </main>
    </Marco>
  )
}
