import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { RUTA_DIRECCIONES, type DireccionResumen } from './direccionesApi'

// Registro Tributario → catálogo de direcciones únicas del distrito (C3; D01–D05).

interface Pagina {
  items: DireccionResumen[]
  total: number
  page: number
  pageSize: number
}

export function Direcciones() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const todas = params.get('todas') === '1'
  const [texto, setTexto] = useState(q)
  const [datos, setDatos] = useState<Pagina | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<Pagina>('/direcciones', {
          params: { q: q || undefined, page, pageSize: 20, ...(todas ? { incluirInactivas: 'true' } : {}) },
        })
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
  }, [q, page, todas])

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
          titulo="Direcciones"
          descripcion="Direcciones únicas del distrito: las comparten personas y, más adelante, predios."
          volverA={{ etiqueta: 'Registro Tributario', ruta: RUTA_BASE }}
          accion={{ etiqueta: 'Nueva dirección', icono: 'bi bi-geo-alt', to: `${RUTA_DIRECCIONES}/nueva` }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            actualizar({ q: texto.trim() || null })
          }}
          role="search"
          className="mt-6 flex flex-wrap gap-2 rounded-panel border border-borde bg-white p-4"
        >
          <label htmlFor="buscar-direccion" className="sr-only">
            Buscar dirección
          </label>
          <input
            id="buscar-direccion"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Vía, número, manzana, habilitación o referencia"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
          <button
            type="submit"
            className="rounded-md bg-mar px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-search mr-1" />
            Buscar
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={todas} onChange={(e) => actualizar({ todas: e.target.checked ? '1' : null })} className="h-4 w-4 accent-mar-profundo" />
            Incluir dadas de baja
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
              <i aria-hidden="true" className="bi bi-geo-alt text-2xl text-slate-400" />
              <p className="mt-1">{q ? `Sin resultados para "${q}".` : 'Aún no hay direcciones registradas.'}</p>
              <Link to={`${RUTA_DIRECCIONES}/nueva`} className="mt-2 inline-block font-medium text-mar hover:text-mar-profundo">
                Registrar dirección
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Direcciones encontradas</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-4 py-3">
                        Dirección
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Referencia
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Personas
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.items.map((d) => (
                      <tr
                        key={d.id}
                        tabIndex={0}
                        onClick={() => navigate(`${RUTA_DIRECCIONES}/${d.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`${RUTA_DIRECCIONES}/${d.id}`)
                        }}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                      >
                        <td className="px-4 py-3 font-medium text-mar-profundo">{d.direccion}</td>
                        <td className="px-4 py-3 text-slate-600">{d.referencia ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{d._count.contribuyentes}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${d.activo ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {d.activo ? 'Activa' : 'De baja'}
                          </span>
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
                  <button
                    type="button"
                    onClick={() => actualizar({ page: String(page - 1) })}
                    disabled={page <= 1}
                    className="rounded-md px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                  >
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
