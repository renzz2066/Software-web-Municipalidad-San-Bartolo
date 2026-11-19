import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { RUTA_BASE, documentoTexto } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO_DJ, ETIQUETA_ESTADO_DJ, RUTA_DJ, type DjResumen, type EstadoDj } from './djApi'

// Registro Tributario → DJ presentadas (C5). Búsqueda por número (AA-NNNNNNN), nombre o documento.

interface Pagina {
  items: DjResumen[]
  total: number
  page: number
  pageSize: number
}

export function Declaraciones() {
  const navigate = useNavigate()
  const motivos = useCatalogo('MOTIVO_DJ')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const estado = params.get('estado') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [texto, setTexto] = useState(q)
  const [datos, setDatos] = useState<Pagina | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<Pagina>('/declaraciones', { params: { q: q || undefined, estado: estado || undefined, page, pageSize: 20 } })
        if (vivo) setDatos(data)
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      } finally {
        if (vivo) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [q, estado, page])

  function actualizar(cambios: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in cambios)) next.delete('page')
    setParams(next)
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="DJ presentadas"
          descripcion="Declaraciones juradas con un anexo por predio. Se registran pendientes; la liquidación llega después."
          volverA={{ etiqueta: 'Registro Tributario', ruta: RUTA_BASE }}
          accion={{ etiqueta: 'Nueva DJ', icono: 'bi bi-file-earmark-plus', to: `${RUTA_DJ}/nueva` }}
        />
        <p className="mt-3 text-sm">
          <Link to={`${RUTA_DJ}/prorrogas`} className="font-medium text-mar hover:underline">
            <i aria-hidden="true" className="bi bi-calendar-plus mr-1" />
            Prórrogas de presentación (J16)
          </Link>
        </p>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            actualizar({ q: texto.trim() || null })
          }}
          className="mt-6 flex flex-wrap gap-2 rounded-panel border border-borde bg-white p-4"
        >
          <label htmlFor="buscar-dj" className="sr-only">
            Buscar DJ
          </label>
          <input
            id="buscar-dj"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="N° de DJ (26-0000001), nombre o documento"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
          <button type="submit" className="rounded-md bg-mar px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa">
            <i aria-hidden="true" className="bi bi-search mr-1" />
            Buscar
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Estado
            <select
              value={estado}
              onChange={(e) => actualizar({ estado: e.target.value || null })}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <option value="">Todos</option>
              {(Object.keys(ETIQUETA_ESTADO_DJ) as EstadoDj[]).map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_DJ[e]}
                </option>
              ))}
            </select>
          </label>
        </form>

        <main className="mt-6 rounded-panel border border-borde bg-white">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500" role="status">
              Buscando…
            </p>
          ) : error ? (
            <p role="alert" className="p-8 text-center text-sm font-medium text-ladrillo">
              {error}
            </p>
          ) : !datos || datos.items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <i aria-hidden="true" className="bi bi-file-earmark-text text-2xl text-slate-400" />
              <p className="mt-1">{q ? `Sin resultados para "${q}".` : 'Aún no hay DJ presentadas.'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">DJ presentadas</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-4 py-3">N°</th>
                      <th scope="col" className="px-4 py-3">Contribuyente</th>
                      <th scope="col" className="px-4 py-3">Motivo</th>
                      <th scope="col" className="px-4 py-3">Presentada</th>
                      <th scope="col" className="px-4 py-3 text-right">Anexos</th>
                      <th scope="col" className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.items.map((d) => (
                      <tr
                        key={d.id}
                        tabIndex={0}
                        onClick={() => navigate(`${RUTA_DJ}/${d.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`${RUTA_DJ}/${d.id}`)
                        }}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{d.numeroTexto}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-mar-profundo">{d.contribuyente.nombreCompleto}</span>
                          <span className="block font-mono text-xs text-slate-500">{documentoTexto(d.contribuyente)}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{nombreDe(motivos, d.motivo)}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{d.fechaPresentacion}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{d._count.anexos}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ESTILO_ESTADO_DJ[d.estado]}`}>{ETIQUETA_ESTADO_DJ[d.estado]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Paginación" className="flex items-center justify-between px-4 py-3 text-sm text-slate-600">
                <span>
                  {datos.total} resultado{datos.total === 1 ? '' : 's'} · página {datos.page} de {totalPaginas}
                </span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => actualizar({ page: String(page - 1) })} disabled={page <= 1} className="rounded-md px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40">
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => actualizar({ page: String(page + 1) })}
                    disabled={page >= totalPaginas}
                    className="rounded-md px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </span>
              </nav>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
