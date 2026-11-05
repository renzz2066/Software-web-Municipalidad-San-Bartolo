import { Link } from 'react-router-dom'
import { useAccesos } from '../../context/AccesosContext'
import { PageHeader } from '../../components/layout/PageHeader'
import type { Modulo } from './catalogo'

// Hub genérico: lista los submódulos del módulo habilitados para el rol.
export function ModuloHub({ modulo }: { modulo: Modulo }) {
  const { tiene, isLoading } = useAccesos()
  const visibles = modulo.submodulos.filter(
    (sub) => isLoading || tiene(`${modulo.codigo}.${sub.slug}`),
  )
  return (
    <div className="mx-auto max-w-content p-4 sm:p-8">
      <PageHeader
        titulo={modulo.titulo}
        descripcion="Estructura visual. Funcionalidad pendiente."
        volverA={{ etiqueta: 'Inicio', ruta: '/' }}
      />

      <main className="mt-6 grid gap-4 sm:grid-cols-2">
        {visibles.length === 0 && !isLoading ? (
          <p className="rounded-panel border border-borde bg-white p-6 text-center text-sm text-tinta-suave sm:col-span-2">
            Tu rol no tiene accesos asignados en este módulo.
          </p>
        ) : (
          visibles.map((sub) => (
            <Link
              key={sub.slug}
              to={`/${modulo.codigo}/${sub.slug}`}
              className="group rounded-panel border border-borde bg-white p-5 transition-colors duration-150 hover:bg-arena-suave focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-mar-profundo/5 text-xl text-mar"
              >
                <i className={sub.icono} />
              </span>
              <h2 className="mt-3 font-serif font-semibold text-mar-profundo group-hover:text-mar">
                {sub.titulo}
              </h2>
            </Link>
          ))
        )}
      </main>
    </div>
  )
}
