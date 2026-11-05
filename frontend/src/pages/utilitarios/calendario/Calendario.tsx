import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { diasHabilesEntre, esHabil, sumarHabiles } from '../../../lib/plazos'
import { aFecha, mensajeUtilidad } from '../utilitariosApi'
import { AnioCampo, AvisoSeccion } from '../utilitariosUi'

// U4: calendario tributario (specs/utilitarios-v1.md). Feriados de
// GET /rentas/maestros/feriados/:anio y la misma regla de días hábiles que los plazos de valores.

interface Feriado {
  fecha: string
  descripcion: string
}

const fechaOk = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f))

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-md p-4 ring-1 ring-slate-200">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

const claseCampo =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'

export function Calendario() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [feriados, setFeriados] = useState<Set<string> | null>(null)
  const [lista, setLista] = useState<Feriado[]>([])
  const [error, setError] = useState<string | null>(null)

  const [hoy, setHoy] = useState(() => hoyLocal())
  const [desde, setDesde] = useState(() => hoyLocal())
  const [hasta, setHasta] = useState(() => hoyLocal())
  const [base, setBase] = useState(() => hoyLocal())
  const [n, setN] = useState('10')

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      setFeriados(null)
      try {
        const { data } = await api.get<Feriado[]>(`/rentas/maestros/feriados/${anio}`)
        if (!cancelled) {
          setLista(data)
          setFeriados(new Set(data.map((f) => aFecha(f.fecha))))
        }
      } catch (err) {
        if (!cancelled) setError(mensajeUtilidad(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [anio])

  const listo = feriados !== null

  const detalle = useMemo(() => {
    if (!listo || !fechaOk(hoy)) return null
    const dia = new Date(`${hoy}T00:00:00Z`).getUTCDay()
    const esFeriado = feriados!.has(hoy)
    const finde = dia === 0 || dia === 6
    return {
      habilitado: esHabil(hoy, feriados!),
      motivo: esFeriado ? `feriado: ${lista.find((f) => aFecha(f.fecha) === hoy)?.descripcion ?? 'sin descripción'}` : finde ? DIAS[dia] : null,
      dia: DIAS[dia],
    }
  }, [listo, hoy, feriados, lista])

  const rango = useMemo(() => {
    if (!listo || !fechaOk(desde) || !fechaOk(hasta)) return null
    try {
      return { dias: diasHabilesEntre(desde, hasta, feriados!), error: null }
    } catch (e) {
      return { dias: 0, error: e instanceof Error ? e.message : 'No se pudo calcular' }
    }
  }, [listo, desde, hasta, feriados])

  const suma = useMemo(() => {
    if (!listo || !fechaOk(base)) return null
    try {
      const nDias = Number(n)
      if (!Number.isInteger(nDias) || nDias < 0 || nDias > 3660) return { fecha: null, error: 'Escribe entre 0 y 3660 días hábiles.' }
      return { fecha: sumarHabiles(base, nDias, feriados!), error: null }
    } catch (e) {
      return { fecha: null, error: e instanceof Error ? e.message : 'No se pudo calcular' }
    }
  }, [listo, base, n, feriados])

  const bloqueado = !listo || error !== null

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/utilitarios"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Utilitarios
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-calendar-week" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Calendario Tributario</h1>
              <p className="text-sm text-slate-500">
                Feriados del año, días hábiles y cómputo de plazos administrativos.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
            <AnioCampo id="cal-anio" valor={anio} alCambiar={setAnio} />
            <div className="mt-4">
              {error ? (
                <AvisoSeccion mensaje={error} />
              ) : !listo ? (
                <p role="status" className="text-sm text-slate-500">
                  Cargando feriados…
                </p>
              ) : (
                <p role="status" className="text-sm text-slate-600">
                  {lista.length === 0
                    ? `Sin feriados cargados para ${anio}.`
                    : `${lista.length} feriado(s) registrado(s) en ${anio}.`}
                </p>
              )}
            </div>
          </div>

          {bloqueado ? null : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Tarjeta titulo="¿Es día hábil?">
                  <label htmlFor="cal-hoy" className="block text-xs font-semibold text-slate-500">
                    Fecha
                  </label>
                  <input
                    id="cal-hoy"
                    type="date"
                    value={hoy}
                    onChange={(e) => setHoy(e.target.value)}
                    className={claseCampo}
                  />
                  <div role="status" className="mt-2 text-sm">
                    {!fechaOk(hoy) || !detalle ? (
                      <span className="text-red-700">Fecha no válida.</span>
                    ) : detalle.habilitado ? (
                      <span className="font-medium text-emerald-700">Sí, día hábil ({detalle.dia}).</span>
                    ) : (
                      <span className="font-medium text-red-700">No: {detalle.motivo ?? detalle.dia}.</span>
                    )}
                  </div>
                </Tarjeta>

                <Tarjeta titulo="Días hábiles entre fechas">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="cal-desde" className="block text-xs font-semibold text-slate-500">
                        Desde
                      </label>
                      <input id="cal-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseCampo} />
                    </div>
                    <div>
                      <label htmlFor="cal-hasta" className="block text-xs font-semibold text-slate-500">
                        Hasta
                      </label>
                      <input id="cal-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
                    </div>
                  </div>
                  <p role="status" className="mt-2 text-sm">
                    {rango?.error ? (
                      <span className="text-red-700">{rango.error}</span>
                    ) : rango ? (
                      <>
                        <span className="text-lg font-bold text-mar-profundo">{rango.dias}</span> día(s) hábil(es)
                      </>
                    ) : (
                      <span className="text-red-700">Fechas no válidas.</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Cuenta desde el día siguiente a “Desde”.</p>
                </Tarjeta>

                <Tarjeta titulo="Sumar días hábiles">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="cal-base" className="block text-xs font-semibold text-slate-500">
                        Desde
                      </label>
                      <input id="cal-base" type="date" value={base} onChange={(e) => setBase(e.target.value)} className={claseCampo} />
                    </div>
                    <div>
                      <label htmlFor="cal-n" className="block text-xs font-semibold text-slate-500">
                        Días
                      </label>
                      <input
                        id="cal-n"
                        type="number"
                        min={0}
                        max={3660}
                        value={n}
                        onChange={(e) => setN(e.target.value)}
                        className={claseCampo}
                      />
                    </div>
                  </div>
                  <p role="status" className="mt-2 text-sm">
                    {suma?.error ? (
                      <span className="text-red-700">{suma.error}</span>
                    ) : suma?.fecha ? (
                      <>
                        Vence el <span className="font-bold text-mar-profundo">{suma.fecha}</span>
                      </>
                    ) : (
                      <span className="text-red-700">Fecha no válida.</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">El día 1 es el siguiente hábil a la fecha.</p>
                </Tarjeta>
              </div>

              <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
                <h2 className="text-sm font-semibold text-mar-profundo">Feriados de {anio}</h2>
                {lista.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No hay feriados registrados. Se cargan en Rentas → Maestros → Feriados.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Feriados del año {anio}</caption>
                      <thead>
                        <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                          <th scope="col" className="px-2 py-2">Fecha</th>
                          <th scope="col" className="px-2 py-2">Día</th>
                          <th scope="col" className="px-2 py-2">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((f) => {
                          const iso = aFecha(f.fecha)
                          const dia = new Date(`${iso}T00:00:00Z`).getUTCDay()
                          return (
                            <tr key={iso} className="border-b border-slate-100">
                              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{iso}</td>
                              <td className="px-2 py-1.5 text-slate-600">{DIAS[dia]}</td>
                              <td className="px-2 py-1.5">{f.descripcion}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
