import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'
import { EliminarRolModal } from './EliminarRolModal'

interface RolResumen {
  id: number
  nombre: string
  descripcion: string | null
}

export function Roles() {
  const [roles, setRoles] = useState<RolResumen[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<RolResumen[]>('/roles')
        if (!cancelled) {
          setRoles(data)
        }
      } catch (err) {
        if (cancelled) return
        if (isAxiosError(err) && err.response?.status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (isAxiosError(err) && err.response?.status === 403) {
          setError('Sin permisos para ver roles.')
        } else {
          setError('No se pudo conectar con el servidor. Intenta nuevamente.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const seleccionado = roles.find((r) => r.id === selectedId) ?? null

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/accesibilidad"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Accesibilidad
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
              >
                <i className="bi bi-person-badge" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-mar-profundo">Roles</h1>
                <p className="text-sm text-slate-500">
                  Roles asignables a los usuarios.
                </p>
              </div>
            </div>
            <Link
              to="/accesibilidad/roles/nuevo"
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
              Nuevo rol
            </Link>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500" role="status">
              Cargando roles…
            </p>
          ) : error ? (
            <div className="p-8 text-center">
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
              <Link
                to="/"
                className="mt-3 inline-block text-sm font-medium text-mar hover:text-mar-profundo"
              >
                Volver al inicio
              </Link>
            </div>
          ) : roles.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No hay roles registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-4 py-3">
                      Nombre
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Descripción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => {
                    const selected = r.id === selectedId
                    return (
                      <Fragment key={r.id}>
                        <tr
                          tabIndex={0}
                          aria-selected={selected}
                          aria-expanded={selected}
                          onClick={() => setSelectedId(selected ? null : r.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedId(selected ? null : r.id)
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-100 transition focus-visible:outline-3 focus-visible:outline-turquesa ${
                            selected ? 'bg-mar/10' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-mar-profundo/5 px-2 py-1 text-xs font-semibold text-mar-profundo">
                              {r.nombre}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {r.descripcion ?? '—'}
                          </td>
                        </tr>
                        {selected && (
                          <tr className="border-b border-slate-100 bg-mar/5">
                            <td colSpan={2} className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs text-slate-500">
                                  Seleccionado: <strong className="text-mar-profundo">{r.nombre}</strong>
                                </span>
                                <Link
                                  to={`/accesibilidad/roles/${r.id}/editar`}
                                  className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
                                >
                                  <i aria-hidden="true" className="bi bi-pencil mr-1" />
                                  Modificar
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setShowDelete(true)}
                                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-3 focus-visible:outline-turquesa"
                                >
                                  <i aria-hidden="true" className="bi bi-trash mr-1" />
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </main>

        {showDelete && seleccionado && (
          <EliminarRolModal
            id={seleccionado.id}
            nombre={seleccionado.nombre}
            onClose={() => setShowDelete(false)}
            onDeleted={() => {
              setShowDelete(false)
              setSelectedId(null)
              setRefreshKey((k) => k + 1)
            }}
          />
        )}
      </div>
    </div>
  )
}
