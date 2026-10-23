import { isAxiosError } from 'axios'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { BuscadorContribuyente } from '../rentas/contribuyentes/BuscadorContribuyente'
import { soles } from '../rentas/contribuyentes/tipos'
import { hoyIso, useEstadoCuenta } from '../rentas/estado-cuenta/estadoCuentaApi'
import { TablaEstadoCuenta } from '../rentas/estado-cuenta/TablaEstadoCuenta'
import { mensajeError } from '../rentas/maestros/maestrosApi'
import { descripcionCuota, type Liquidacion, MEDIOS_PAGO, type MedioPago, type Recibo, RUTA_RECIBOS } from './cajaApi'

// Caja → Cancelaciones del Día (specs/caja-v1.md, K1–K3): contribuyente → cuotas del estado de
// cuenta a hoy → el servidor liquida → medio de pago → cobrar → recibo imprimible.

const ESTILO_CAMPO =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ESTILO_ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'

export function Cobro() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const contribuyenteId = params.get('contribuyente') ?? undefined
  const [recarga, setRecarga] = useState(0)
  const { datos, error, isLoading } = useEstadoCuenta(contribuyenteId, hoyIso(), recarga)
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO')
  const [numOperacion, setNumOperacion] = useState('')
  const [recibido, setRecibido] = useState('')
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  const lineasElegidas = datos?.lineas.filter((l) => elegidas.has(l.id)) ?? []
  const totalElegido = lineasElegidas.reduce((a, l) => a + Number(l.total), 0)
  const vuelto = liquidacion && recibido ? Number(recibido) - Number(liquidacion.total) : null

  function elegirContribuyente(id: number | null) {
    setElegidas(new Set())
    setLiquidacion(null)
    setErrorCobro(null)
    setParams(id ? { contribuyente: String(id) } : {})
  }

  function cambiarSeleccion(ids: number[], marcar: boolean) {
    setLiquidacion(null)
    setErrorCobro(null)
    setElegidas((prev) => {
      const s = new Set(prev)
      ids.forEach((id) => (marcar ? s.add(id) : s.delete(id)))
      return s
    })
  }

  // Un 409 significa que la deuda cambió (otro cajero cobró, se transfirió, pasó la medianoche…).
  function trasError(err: unknown) {
    setErrorCobro(mensajeError(err))
    if (isAxiosError(err) && err.response?.status === 409) {
      setLiquidacion(null)
      setElegidas(new Set())
      setRecarga((r) => r + 1)
    }
  }

  async function continuar() {
    setProcesando(true)
    setErrorCobro(null)
    try {
      const { data } = await api.post<Liquidacion>('/caja/cobros/liquidar', {
        contribuyenteId: Number(contribuyenteId),
        cuentaIds: [...elegidas],
      })
      setLiquidacion(data)
      setMedio('EFECTIVO')
      setNumOperacion('')
      setRecibido('')
    } catch (err) {
      trasError(err)
    } finally {
      setProcesando(false)
    }
  }

  async function cobrar() {
    if (!liquidacion) return
    if (medio !== 'EFECTIVO' && !numOperacion.trim()) {
      setErrorCobro('Indica el n.° de operación del pago')
      return
    }
    if (medio === 'EFECTIVO' && vuelto !== null && vuelto < 0) {
      setErrorCobro('El efectivo recibido no cubre el total')
      return
    }
    setProcesando(true)
    setErrorCobro(null)
    try {
      const { data } = await api.post<Recibo>('/caja/cobros', {
        contribuyenteId: liquidacion.contribuyenteId,
        cuentaIds: liquidacion.lineas.map((l) => l.id),
        medioPago: medio,
        numOperacion: medio === 'EFECTIVO' ? undefined : numOperacion.trim(),
        totalEsperado: Number(liquidacion.total),
      })
      navigate(`${RUTA_RECIBOS}/${data.id}`, { state: { original: true } })
    } catch (err) {
      trasError(err)
    } finally {
      setProcesando(false)
    }
  }

  const c = datos?.contribuyente
  const ayudaMedio = MEDIOS_PAGO.find((m) => m.value === medio)?.ayuda

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/caja"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Caja
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-cash-stack" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Cancelaciones del Día</h1>
              <p className="text-sm text-slate-500">
                Elige las cuotas que paga el contribuyente. La mora y el reajuste se calculan a hoy; las cuotas de un convenio se
                pagan en orden.
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="cobro-contribuyente" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <h2 id="cobro-contribuyente" className="sr-only">
            Contribuyente
          </h2>
          {contribuyenteId ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contribuyente</p>
                <p className="font-semibold text-mar-profundo">{c?.nombreCompleto ?? '…'}</p>
                {c && (
                  <p className="font-mono text-xs text-slate-500">
                    {c.tipoDoc} {c.numDoc}
                    {c.codigoLegacy && ` · SIMUN ${c.codigoLegacy}`}
                    {c.direccionFiscal && <span className="font-sans"> · {c.direccionFiscal}</span>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => elegirContribuyente(null)}
                className="rounded-md border border-mar-profundo/30 px-3 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                Cambiar contribuyente
              </button>
            </div>
          ) : (
            <BuscadorContribuyente id="cobro-buscar" label="Buscar contribuyente" alElegir={(x) => elegirContribuyente(x.id)} />
          )}
        </section>

        {contribuyenteId && (
          <section aria-labelledby="cobro-deuda" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
            <h2 id="cobro-deuda" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
              Deuda al {datos?.fecha ?? hoyIso()}
            </h2>
            <div className="mt-3">
              {error ? (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : isLoading || !datos ? (
                <p role="status" className="text-sm text-slate-500">
                  Calculando deuda…
                </p>
              ) : (
                <TablaEstadoCuenta datos={datos} seleccion={{ ids: elegidas, alCambiar: cambiarSeleccion }} />
              )}
            </div>

            {errorCobro && !liquidacion && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorCobro}
              </p>
            )}

            {!liquidacion && datos && datos.lineas.length > 0 && (
              <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white pt-4">
                <p className="text-sm text-slate-600" aria-live="polite">
                  {elegidas.size === 0 ? (
                    'Ninguna cuota elegida'
                  ) : (
                    <>
                      {elegidas.size} {elegidas.size === 1 ? 'cuota' : 'cuotas'} ·{' '}
                      <span className="font-semibold text-mar-profundo">{soles(totalElegido)}</span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void continuar()}
                  disabled={elegidas.size === 0 || procesando}
                  className="rounded-md bg-mar-profundo px-5 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                >
                  {procesando ? 'Liquidando…' : 'Continuar al cobro'}
                </button>
              </div>
            )}
          </section>
        )}

        {liquidacion && (
          <section aria-labelledby="cobro-confirmar" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-2 ring-mar">
            <h2 id="cobro-confirmar" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
              Confirmar cobro
            </h2>
            {liquidacion.avisos.map((a) => (
              <p key={a} role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {a}
              </p>
            ))}
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {liquidacion.lineas.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {l.anio} · {l.tributo.nombre} · {descripcionCuota(l)}
                    {l.estado === 'COACTIVO' && <span className="ml-1 rounded bg-slate-100 px-1 text-xs font-semibold text-slate-600">COACTIVO</span>}
                  </span>
                  <span className="font-medium">{soles(l.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t-2 border-slate-300 pt-3 text-lg font-bold text-mar-profundo">
              <span>Total a cobrar</span>
              <span>{soles(liquidacion.total)}</span>
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="cobro-medio" className={ESTILO_ETIQUETA}>
                  Medio de pago
                </label>
                <select id="cobro-medio" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)} className={ESTILO_CAMPO}>
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {medio === 'EFECTIVO' ? (
                <>
                  <div>
                    <label htmlFor="cobro-recibido" className={ESTILO_ETIQUETA}>
                      Efectivo recibido (opcional)
                    </label>
                    <input
                      id="cobro-recibido"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.10"
                      value={recibido}
                      onChange={(e) => setRecibido(e.target.value)}
                      className={ESTILO_CAMPO}
                    />
                  </div>
                  <div aria-live="polite">
                    <p className={ESTILO_ETIQUETA}>Vuelto</p>
                    <p className={`mt-1 py-2 text-lg font-semibold ${vuelto !== null && vuelto < 0 ? 'text-red-700' : 'text-mar-profundo'}`}>
                      {vuelto === null ? '—' : vuelto < 0 ? `Faltan ${soles(-vuelto)}` : soles(vuelto)}
                    </p>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label htmlFor="cobro-operacion" className={ESTILO_ETIQUETA}>
                    {ayudaMedio}
                  </label>
                  <input
                    id="cobro-operacion"
                    type="text"
                    maxLength={30}
                    required
                    value={numOperacion}
                    onChange={(e) => setNumOperacion(e.target.value)}
                    className={ESTILO_CAMPO}
                  />
                </div>
              )}
            </div>

            {errorCobro && (
              <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorCobro}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLiquidacion(null)}
                disabled={procesando}
                className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                Volver a la selección
              </button>
              <button
                type="button"
                onClick={() => void cobrar()}
                disabled={procesando}
                className="rounded-md bg-mar-profundo px-5 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                <i aria-hidden="true" className="bi bi-check2-circle mr-1" />
                {procesando ? 'Cobrando…' : `Cobrar ${soles(liquidacion.total)}`}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
