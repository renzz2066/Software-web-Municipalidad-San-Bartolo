import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO, RUTA_BASE, type ContribuyenteResumen } from './tipos'

// Registro Tributario → búsqueda única de contribuyentes (C1).

interface Pagina {
  items: ContribuyenteResumen[]
  total: number
  page: number
  pageSize: number
}

export function Contribuyentes() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const incluirBaja = params.get('baja') === '1'
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
        const { data } = await api.get<Pagina>('/contribuyentes', {
          params: { q: q || undefined, page, pageSize: 20, incluirBaja: incluirBaja ? 'true' : undefined },
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
  }, [q, page, incluirBaja])

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (texto.trim()) next.set('q', texto.trim())
    else next.delete('q')
    next.delete('page')
    setParams(next)
  }

  function irPagina(p: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(p))
    setParams(next)
  }

  function alternarBaja() {
    const next = new URLSearchParams(params)
    if (incluirBaja) next.delete('baja')
    else next.set('baja', '1')
    next.delete('page')
    setParams(next)
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/rentas"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Rentas
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
              >
                <i className="bi bi-journal-text" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-mar-profundo">Registro Tributario</h1>
                <p className="text-sm text-slate-500">Contribuyentes, sus predios, deuda y declaraciones juradas.</p>
              </div>
            </div>
            <Link
              to={`${RUTA_BASE}/contribuyentes/nuevo`}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-person-plus mr-1" />
              Nuevo contribuyente
            </Link>
          </div>

          <form onSubmit={buscar} role="search" className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="buscar" className="sr-only">
              Buscar contribuyente
            </label>
            <input
              id="buscar"
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="DNI, RUC, nombre, dirección o código SIMUN"
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
              <input type="checkbox" checked={incluirBaja} onChange={alternarBaja} className="h-4 w-4" />
              Incluir dados de baja
            </label>
          </form>
        </header>

        <main className="mt-6 rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500" role="status">
              Buscando…
            </p>
          ) : error ? (
            <p role="alert" className="p-8 text-center text-sm font-medium text-red-700">
              {error}
            </p>
          ) : !datos || datos.items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <p>{q ? `Sin resultados para "${q}".` : 'Aún no hay contribuyentes registrados.'}</p>
              <Link to={`${RUTA_BASE}/contribuyentes/nuevo`} className="mt-2 inline-block font-medium text-mar hover:text-mar-profundo">
                Registrar contribuyente
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Contribuyentes encontrados</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-4 py-3">
                        Documento
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Nombre / razón social
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Domicilio fiscal
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.items.map((c) => (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        onClick={() => navigate(`${RUTA_BASE}/contribuyentes/${c.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`${RUTA_BASE}/contribuyentes/${c.id}`)
                        }}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                          {c.tipoDoc} {c.numDoc}
                        </td>
                        <td className="px-4 py-3 font-medium text-mar-profundo">{c.nombreCompleto}</td>
                        <td className="px-4 py-3 text-slate-600">{c.direccionFiscal ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ESTILO_ESTADO[c.estado]}`}>{c.estado}</span>
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
                    onClick={() => irPagina(page - 1)}
                    disabled={page <= 1}
                    className="rounded-md px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => irPagina(page + 1)}
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
