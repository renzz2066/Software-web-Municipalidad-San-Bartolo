import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { hoyLocal } from '../../lib/fechas'
import { soles } from '../rentas/contribuyentes/tipos'
import { mensajeError } from '../rentas/maestros/maestrosApi'
import { type CierresDia, RUTA_CIERRES } from './cajaApi'
import { ConsultaRecibos } from './ConsultaRecibos'

// Caja → Reportes (specs/caja-v1.md, K6): cierres de todos los cajeros por día (y quién falta
// cerrar) y consulta de recibos. Reportes mensuales y por clasificador quedan para v2.

const PESTANAS = [
  { id: 'cierres', titulo: 'Cierres del día', ayuda: 'Cierres de cada cajero y quiénes tienen movimientos sin cerrar.' },
  { id: 'recibos', titulo: 'Recibos', ayuda: 'Recibos de todos los cajeros por día de caja o por número.' },
] as const

function CierresDelDia() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? hoyLocal()
  const [datos, setDatos] = useState<CierresDia | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<CierresDia>('/caja/cierres', { params: { fecha } })
        if (!cancelled) setDatos(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [fecha])

  return (
    <>
      <label htmlFor="cie-fecha" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Día de caja
      </label>
      <input
        id="cie-fecha"
        type="date"
        value={fecha}
        onChange={(e) => {
          const p = new URLSearchParams(params)
          p.set('fecha', e.target.value)
          setParams(p)
        }}
        className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
      />

      <div className="mt-4">
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !datos ? (
          <p role="status" className="text-sm text-slate-500">
            Cargando cierres…
          </p>
        ) : (
          <>
            {datos.sinCerrar.length > 0 && (
              <p role="status" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Con movimientos sin cerrar: {datos.sinCerrar.map((u) => `${u.nombre} (${u.usuario})`).join(', ')}.
              </p>
            )}
            {datos.cierres.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">Ningún cajero cerró caja este día.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Cierres del {datos.fecha}</caption>
                  <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-2 py-2">Cajero</th>
                      <th scope="col" className="px-2 py-2">Cerrado</th>
                      <th scope="col" className="px-2 py-2 text-right">Recibos</th>
                      <th scope="col" className="px-2 py-2 text-right">Extornos</th>
                      <th scope="col" className="px-2 py-2 text-right">Arqueo</th>
                      <th scope="col" className="px-2 py-2 text-right">Total neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.cierres.map((c) => {
                      const dif = c.diferencia === null ? null : Number(c.diferencia)
                      return (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="px-2 py-1.5">
                            <Link
                              to={`${RUTA_CIERRES}/${c.id}`}
                              state={{ volverA: `${location.pathname}${location.search}` }}
                              className="font-medium text-mar hover:text-mar-profundo hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                            >
                              {c.cajero.nombre}
                            </Link>
                            <span className="block text-xs text-slate-500">{c.cajero.usuario}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {new Date(c.cerradoEn).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-2 py-1.5 text-right">{c.cantidadRecibos}</td>
                          <td className="px-2 py-1.5 text-right">{c.cantidadExtornos}</td>
                          <td className={`whitespace-nowrap px-2 py-1.5 text-right ${dif !== null && dif < 0 ? 'text-red-700' : ''}`}>
                            {dif === null ? '—' : dif === 0 ? 'Cuadra' : `${dif > 0 ? '+' : '−'}${soles(Math.abs(dif))}`}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{soles(c.total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold text-mar-profundo">
                      <th scope="row" colSpan={5} className="px-2 py-2 text-left">
                        Total de cierres del día
                      </th>
                      <td className="whitespace-nowrap px-2 py-2 text-right">{soles(datos.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export function Reportes() {
  const [params, setParams] = useSearchParams()
  const pestana = params.get('tab') === 'recibos' ? 'recibos' : 'cierres'
  const actual = PESTANAS.find((p) => p.id === pestana)!

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
              <i className="bi bi-bar-chart" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Reportes de Caja</h1>
              <p className="text-sm text-slate-500">{actual.ayuda}</p>
            </div>
          </div>
        </header>

        <nav aria-label="Reportes de caja" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setParams({ tab: p.id })}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                pestana === p.id ? 'bg-white text-mar-profundo shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-b-xl rounded-tr-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          {pestana === 'cierres' ? <CierresDelDia /> : <ConsultaRecibos />}
        </main>
      </div>
    </div>
  )
}
