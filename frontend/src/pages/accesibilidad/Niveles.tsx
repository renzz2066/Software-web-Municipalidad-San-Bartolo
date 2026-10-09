import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'

interface Subnivel {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  orden: number
  habilitado: boolean
}

interface ModuloNivel extends Subnivel {
  subniveles: Subnivel[]
}

export function Niveles() {
  const [modulos, setModulos] = useState<ModuloNivel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<ModuloNivel[]>('/niveles')
        if (!cancelled) setModulos(data)
      } catch (err) {
        if (cancelled) return
        if (isAxiosError(err) && err.response?.status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
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
  }, [])

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
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-diagram-3" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Niveles</h1>
              <p className="text-sm text-slate-500">
                Los niveles los registra el sistema automáticamente. No se pueden crear ni modificar.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-4">
          {isLoading ? (
            <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-md ring-1 ring-mar-profundo/10" role="status">
              Cargando niveles…
            </p>
          ) : error ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-md ring-1 ring-mar-profundo/10">
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
          ) : modulos.length === 0 ? (
            <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-md ring-1 ring-mar-profundo/10">
              No hay niveles registrados.
            </p>
          ) : (
            modulos.map((modulo) => (
              <section
                key={modulo.id}
                aria-label={modulo.nombre}
                className="rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10"
              >
                <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:px-6">
                  <span className="rounded-md bg-mar-profundo px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Módulo
                  </span>
                  <div>
                    <h2 className="font-semibold text-mar-profundo">{modulo.nombre}</h2>
                    {modulo.descripcion && (
                      <p className="text-xs text-slate-500">{modulo.descripcion}</p>
                    )}
                  </div>
                </div>
                <ul>
                  {modulo.subniveles.map((sub) => (
                    <li
                      key={sub.id}
                      className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:px-6 ${
                        sub.habilitado ? '' : 'bg-slate-50 opacity-70'
                      }`}
                    >
                      <span className="rounded-md bg-mar/10 px-2 py-1 text-xs font-semibold text-mar">
                        Subnivel
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-mar-profundo">{sub.nombre}</p>
                        <p className="truncate font-mono text-xs text-slate-400">{sub.codigo}</p>
                      </div>
                      {!sub.habilitado && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                          <i aria-hidden="true" className="bi bi-lock" />
                          Sin acceso
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
