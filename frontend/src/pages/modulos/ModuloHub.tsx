import { Link } from 'react-router-dom'
import { useAccesos } from '../../context/AccesosContext'
import type { Modulo } from './catalogo'

// Hub genérico: lista los submódulos del módulo habilitados para el rol.
export function ModuloHub({ modulo }: { modulo: Modulo }) {
  const { tiene, isLoading } = useAccesos()
  const visibles = modulo.submodulos.filter(
    (sub) => isLoading || tiene(`${modulo.codigo}.${sub.slug}`),
  )
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Inicio
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className={modulo.icono} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">{modulo.titulo}</h1>
              <p className="text-sm text-slate-500">
                Estructura visual. Funcionalidad pendiente.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 grid gap-4 sm:grid-cols-2">
          {visibles.length === 0 && !isLoading ? (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-md ring-1 ring-mar-profundo/10 sm:col-span-2">
              Tu rol no tiene accesos asignados en este módulo.
            </p>
          ) : (
            visibles.map((sub) => (
              <Link
                key={sub.slug}
                to={`/${modulo.codigo}/${sub.slug}`}
                className="group rounded-xl bg-white p-5 shadow-md ring-1 ring-mar-profundo/10 transition hover:shadow-lg hover:ring-mar/30 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-mar-profundo/5 text-xl text-mar"
                >
                  <i className={sub.icono} />
                </span>
                <h2 className="mt-3 font-semibold text-mar-profundo group-hover:text-mar">
                  {sub.titulo}
                </h2>
              </Link>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
